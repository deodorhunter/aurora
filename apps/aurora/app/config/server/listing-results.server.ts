import { flattenToAppURL, PLONE_BLOCK_TYPE } from '@plone/helpers';
import { SOMERSAULT_KEY } from '@plone/plate/constants';
import type { Brain, Content, QuerystringParameter } from '@plone/types';
import type PloneClient from '@plone/client';

/**
 * The most searches one page render runs. Listings whose criteria are past the
 * cap keep their stored results. Distinct criteria are counted, not listings:
 * two listings with the same criteria share one search.
 */
export const MAX_LISTING_SEARCHES = 20;

type Node = Record<string, unknown> & { children?: unknown };

type ListingNode = Node & {
  querystring?: Partial<QuerystringParameter>;
  items?: Brain[];
};

const isListing = (node: Node): node is ListingNode =>
  node.type === PLONE_BLOCK_TYPE && node['@type'] === 'listing';

const hasCriteria = (node: ListingNode) =>
  !!node.querystring && typeof node.querystring === 'object';

/** The search a listing's criteria stand for: the fields the editor's own
 * preview sends (see `QuerystringWidgetContext`), and nothing else. */
const searchArgs = (querystring: Partial<QuerystringParameter>) => {
  const { query, sort_on, sort_order, limit, b_size } = querystring;
  return { query: query ?? [], sort_on, sort_order, limit, b_size };
};

/**
 * Collects every listing with criteria in a somersault value, at any depth
 * (`column_group > column > listing`, or any other container).
 */
function collectListings(nodes: unknown, found: ListingNode[] = []) {
  if (!Array.isArray(nodes)) return found;
  for (const node of nodes) {
    if (!node || typeof node !== 'object') continue;
    if (isListing(node as Node)) {
      if (hasCriteria(node as ListingNode)) found.push(node as ListingNode);
      continue;
    }
    collectListings((node as Node).children, found);
  }
  return found;
}

/**
 * Copies `nodes`, giving each listing in `results` its resolved `items`. Only
 * the containers on the way to a changed listing are copied.
 */
function withResults(
  nodes: unknown[],
  results: Map<ListingNode, Brain[]>,
): unknown[] {
  let changed = false;
  const next = nodes.map((node) => {
    if (!node || typeof node !== 'object') return node;
    const items = results.get(node as ListingNode);
    if (items) {
      changed = true;
      return { ...(node as Node), items };
    }
    const children = (node as Node).children;
    if (!Array.isArray(children)) return node;
    const nextChildren = withResults(children, results);
    if (nextChildren === children) return node;
    changed = true;
    return { ...(node as Node), children: nextChildren };
  });
  return changed ? next : nodes;
}

/**
 * Resolves the results of every Listing a page renders.
 *
 * A Plone Aurora page renders its somersault value, so a Listing is a
 * `ploneBlock` node anywhere in that tree, and its stored `items` are only a
 * snapshot of its `querystring` from when it was last edited. This searches
 * each listing's criteria and renders the results, at every depth.
 *
 * Cost: one search per distinct set of criteria, all in parallel, at most
 * `MAX_LISTING_SEARCHES` per render. A failed search keeps that listing's
 * stored results and does not fail the page. A listing whose criteria are
 * empty shows no results, as the editor's preview does.
 *
 * Called by the `fetchPloneContent` middleware, before any loader runs, so
 * the view, the root loader and `@@edit` all get the same results. The
 * somersault value itself is not mutated: `content.blocks` gets a copy with
 * the results in it.
 */
export async function resolveListingResults(args: {
  cli: PloneClient;
  content: Content | undefined;
}) {
  const { content } = args;
  const somersault = content?.blocks?.[SOMERSAULT_KEY] as
    { value?: unknown } | undefined;
  if (!content || !Array.isArray(somersault?.value)) return;

  const listings = collectListings(somersault.value);
  if (listings.length === 0) return;

  const results = new Map<ListingNode, Brain[]>();
  const searches = new Map<
    string,
    { search: ReturnType<typeof searchArgs>; listings: ListingNode[] }
  >();
  for (const listing of listings) {
    const search = searchArgs(listing.querystring!);
    if (search.query.length === 0) {
      results.set(listing, []);
      continue;
    }
    const key = JSON.stringify(search);
    const group = searches.get(key);
    if (group) group.listings.push(listing);
    else searches.set(key, { search, listings: [listing] });
  }

  const settled = await Promise.allSettled(
    [...searches.values()]
      .slice(0, MAX_LISTING_SEARCHES)
      .map(async ({ search, listings: group }) => {
        const response = await args.cli.querystringSearch({
          ...search,
          post: true,
        });
        const items = flattenToAppURL(response.data.items ?? []);
        for (const listing of group) results.set(listing, items);
      }),
  );
  for (const outcome of settled) {
    if (outcome.status === 'rejected') {
      // eslint-disable-next-line no-console
      console.error('Failed to resolve listing results:', outcome.reason);
    }
  }
  if (results.size === 0) return;

  content.blocks = {
    ...content.blocks,
    [SOMERSAULT_KEY]: {
      ...somersault,
      value: withResults(somersault.value, results),
    } as unknown as (typeof content.blocks)[string],
  };
}
