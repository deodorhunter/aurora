/**
 * ATS-202/204 — Template Tree discovery (browse, tag facets, faceted search).
 *
 * Written in core's acceptance method (fixture + login + content helpers).
 * Runs by default now (ATS-608): `make acceptance-backend-start` /
 * `make acceptance-frontend-start` stand up the robot acceptance backend
 * (:55001, templatestudio addon installed) and Aurora (:3001) pointed at it —
 * see frontend/CLAUDE.md §3. Run with:
 *
 *   cd core && PLAYWRIGHT_BASE_URL=http://localhost:3001 \
 *     ../packages/template-studio/node_modules/.bin/playwright test \
 *     --config=playwright.config.ts studio-tree --reporter=line
 *
 * Scenarios mirror the exploratory shots in frontend/qa/studio-shots.mjs, but
 * assert behaviour instead of producing images.
 */
import { createContent } from '../../../../packages/tooling/playwright/content';
import { login } from '../../../../packages/tooling/playwright/login';
import { expect, test } from '../../../../packages/tooling/playwright/test';

import type { Page } from '@playwright/test';

const hostname = process.env.BACKEND_HOST || '127.0.0.1';
const siteId = process.env.SITE_ID || 'plone';
const apiURL = process.env.API_PATH || `http://${hostname}:55001/${siteId}`;
const authHeader =
  'Basic ' + Buffer.from('admin:secret', 'utf8').toString('base64');

// The dev-mode SSR build is slow to compile and hydrate on first hit; 10s (the
// repo default) is not enough for a cold Studio route.
test.describe.configure({ timeout: 60_000 });

/**
 * Open the Studio and wait until it is actually INTERACTIVE.
 *
 * `goto` alone resolves on the SSR document, and RAC's handlers are not
 * attached yet — a `fill`/`click` issued in that window is silently swallowed
 * (the search never runs, the tag chip never navigates), which reads exactly
 * like a wrong selector. Waiting for network idle lets hydration land first.
 */
async function gotoStudio(page: Page) {
  await page.goto('/~/studio');
  await page.waitForLoadState('networkidle');
}

test.describe('Studio Template Tree', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    // `tags` on a LayoutBlueprint is constrained to the curated
    // collective.templatestudio.AvailableTags vocabulary (ATS-107). That
    // vocabulary is EMPTY on a fresh acceptance site, so creating a tagged
    // blueprint below dies with `BadRequest: [{'message': 'Constraint not
    // satisfied', 'field': 'tags'}]` unless the registry record is seeded
    // first. Same authenticated-request idiom as content.ts's helpers.
    const registryResponse = await page.request.patch(`${apiURL}/@registry`, {
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: authHeader,
      },
      data: {
        'collective.templatestudio.available_tags': ['campaign-2026', 'test'],
      },
    });
    if (!registryResponse.ok()) {
      throw new Error(
        `Seeding available_tags failed: PATCH ${apiURL}/@registry returned ${registryResponse.status()} ${registryResponse.statusText()}`,
      );
    }

    // Seed a physical tree: a grouped + tagged layout, and a loose block
    // template — enough to exercise kind roots, group folders, and facets.
    //
    // No defensive pre-delete here on purpose. `remote_zodb_setup`/`teardown`
    // isolate each test against the layer's base DB, so these ids are always
    // free — unless something wrote to the acceptance backend from *outside*
    // the fixture (manual probing lands in the base DB and is then baked into
    // every later snapshot). If these creates start failing with "id already
    // in use", the backend is dirty: restart `make acceptance-backend-start`.
    // Swallowing that here would equally hide a real duplicate-id regression.
    await createContent(page, {
      contentType: 'BlueprintGroup',
      contentId: 'marketing',
      contentTitle: 'Marketing',
      path: 'blueprints/layouts',
    });
    await createContent(page, {
      contentType: 'LayoutBlueprint',
      contentId: 'landing',
      contentTitle: 'Landing page',
      path: 'blueprints/layouts/marketing',
      transition: 'publish',
      bodyModifier: (body) => ({ ...body, tags: ['campaign-2026', 'test'] }),
    });
    await createContent(page, {
      contentType: 'LayoutBlueprint',
      contentId: 'teaser',
      contentTitle: 'Teaser template',
      path: 'blueprints/blocks',
      bodyModifier: (body) => ({ ...body, tags: ['test'] }),
    });
  });

  test('browse view renders kind roots, group folders and tag facets', async ({
    page,
  }) => {
    await gotoStudio(page);

    // ATS-610 retired the top-level `TreeSection`s (they made pointer
    // drag-and-drop impossible), so kind roots are ordinary rows like
    // everything else. RAC's Tree renders a `treegrid` whose items are `row`s
    // — NOT `tree`/`treeitem`, and not a `navigation` landmark named
    // "Blueprints" (there is no nav landmark around the tree at all).
    const tree = page.getByRole('treegrid', { name: 'Blueprint tree' });
    await expect(tree.getByRole('row', { name: /Page blueprints/ })).toBeVisible();
    await expect(tree.getByRole('row', { name: /Block templates/ })).toBeVisible();
    // Group folder nested under its kind root, and the blueprint under that.
    await expect(tree.getByRole('row', { name: /Marketing/ })).toBeVisible();
    await expect(tree.getByRole('row', { name: /Landing page/ })).toBeVisible();
    await expect(tree.getByRole('row', { name: /Teaser template/ })).toBeVisible();

    // Tag facet chips come from facets.tags with counts (no client-side scan).
    // They live in the search header (`TagGroupFilter.tsx`), a SIBLING of the
    // tree. ATS-B45/audit M3 moved this off RAC `TagGroup`/`Tag` — built on
    // `useGridListItem`, a `grid` of dismissible-token `row`s, the wrong model
    // for a set of independent on/off filters — onto `ToggleButtonGroup` +
    // `ToggleButton`: a `toolbar` named "Filter by tag" (the control's job,
    // not the noun "Tags") containing real `button`s with `aria-pressed`,
    // each named "<tag>, <count>" (a `sr-only` comma keeps "news" + "2" from
    // concatenating into "news2" in the accessibility tree).
    const tagFilter = page.getByRole('toolbar', { name: 'Filter by tag' });
    await expect(tagFilter.getByRole('button', { name: /^test/ })).toBeVisible();
    await expect(
      tagFilter.getByRole('button', { name: /campaign-2026/ }),
    ).toBeVisible();
  });

  test('search flattens the tree to a results list', async ({ page }) => {
    await gotoStudio(page);
    // `templatestudio.tree.searchAriaLabel` reads "Filter blueprints" (the
    // toolbar above's "Filter by tag" is the same vocabulary) — the tree's
    // own search was never named "Search blueprints".
    await page.getByRole('searchbox', { name: /filter blueprints/i }).fill('Landing');

    // Searching swaps the treegrid out for a flat listbox of matches — the
    // tree is gone entirely, not merely filtered in place.
    const results = page.getByRole('listbox', { name: /Blueprints matching Landing/ });
    await expect(results.getByRole('option', { name: /Landing page/ })).toBeVisible();
    await expect(results.getByRole('option')).toHaveCount(1);
    await expect(
      page.getByRole('treegrid', { name: 'Blueprint tree' }),
    ).toBeHidden();
  });

  test('selecting a tag facet filters via repeatable ?tags=', async ({ page }) => {
    await gotoStudio(page);
    // See the toolbar-of-toggle-buttons note on the browse test above.
    await page
      .getByRole('toolbar', { name: 'Filter by tag' })
      .getByRole('button', { name: /campaign-2026/ })
      .click();

    await expect(page).toHaveURL(/tags=campaign-2026/);

    // The filter is server-side (repeatable ?tags=), so the untagged teaser is
    // absent from the tree rather than merely hidden — its kind root stays,
    // reporting a count of 0.
    const tree = page.getByRole('treegrid', { name: 'Blueprint tree' });
    await expect(tree.getByRole('row', { name: /Landing page/ })).toBeVisible();
    await expect(tree.getByRole('row', { name: /Teaser template/ })).toHaveCount(0);
    await expect(tree.getByRole('row', { name: /Block templates/ })).toBeVisible();
  });
});
