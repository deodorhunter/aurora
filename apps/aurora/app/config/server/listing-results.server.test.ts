import { expect, describe, it, afterEach, vi } from 'vitest';
import config from '@plone/registry';
import {
  MAX_LISTING_SEARCHES,
  resolveListingResults,
} from './listing-results.server';

/**
 * A Plone Aurora page renders its somersault value, so a Listing is a
 * `ploneBlock` node anywhere in that tree — top level, or nested in a layout
 * (`column_group > column > listing`). Its stored `items` are only a snapshot
 * of what its `querystring` returned when it was last edited; the rendered
 * results must be resolved when the page is rendered.
 */
describe('resolveListingResults', () => {
  const apiPath = 'http://localhost:8080/Plone';

  afterEach(() => {
    config.settings = {};
  });

  const listing = (id: string, portalType: string, stale: string) => ({
    type: 'ploneBlock',
    '@type': 'listing',
    id,
    headline: id,
    querystring: {
      query: [
        {
          i: 'portal_type',
          o: 'plone.app.querystring.operation.selection.any',
          v: [portalType],
        },
      ],
      sort_on: 'sortable_title',
      limit: 5,
    },
    items: [{ '@id': `/${stale}`, title: stale }],
    children: [{ text: '' }],
  });

  const pageWithListings = () => ({
    '@id': `${apiPath}/page`,
    title: 'Page',
    blocks: {
      __somersault__: {
        '@type': '__somersault__',
        value: [
          { type: 'title', children: [{ text: 'Page' }] },
          listing('top', 'News Item', 'stale-top'),
          {
            type: 'column_group',
            id: 'grid',
            children: [
              {
                type: 'column',
                id: 'col-1',
                children: [{ type: 'p', children: [{ text: 'Intro' }] }],
              },
              {
                type: 'column',
                id: 'col-2',
                children: [listing('nested', 'Event', 'stale-nested')],
              },
            ],
          },
        ],
      },
    },
    blocks_layout: { items: [] },
  });

  const fakeClient = () => ({
    querystringSearch: vi.fn(async (args: any) => {
      const portalType = args.query[0].v[0];
      return {
        data: {
          items: [
            {
              '@id': `${apiPath}/fresh-${portalType.replace(' ', '-')}`,
              title: `Fresh ${portalType}`,
            },
          ],
          items_total: 1,
        },
      };
    }),
  });

  const runUtility = async (content: any, cli: any) => {
    config.settings.apiPath = apiPath;
    await resolveListingResults({ cli, content });
  };

  const findNode = (nodes: any[], id: string): any => {
    for (const node of nodes) {
      if (node.id === id) return node;
      const found = Array.isArray(node.children)
        ? findNode(node.children, id)
        : undefined;
      if (found) return found;
    }
    return undefined;
  };

  it('resolves the results of every listing in the somersault value, nested ones included', async () => {
    const content = pageWithListings();
    const cli = fakeClient();

    await runUtility(content, cli);

    const value = content.blocks.__somersault__.value;
    expect(findNode(value, 'top').items).toEqual([
      { '@id': '/fresh-News-Item', title: 'Fresh News Item' },
    ]);
    expect(findNode(value, 'nested').items).toEqual([
      { '@id': '/fresh-Event', title: 'Fresh Event' },
    ]);
    expect(cli.querystringSearch).toHaveBeenCalledTimes(2);
    expect(cli.querystringSearch).toHaveBeenCalledWith(
      expect.objectContaining({
        query: [expect.objectContaining({ v: ['Event'] })],
        sort_on: 'sortable_title',
        limit: 5,
      }),
    );
  });

  it('does not mutate the somersault value it was given', async () => {
    const content = pageWithListings();
    const original = content.blocks.__somersault__;

    await runUtility(content, fakeClient());

    expect(findNode(original.value, 'nested').items).toEqual([
      { '@id': '/stale-nested', title: 'stale-nested' },
    ]);
  });

  it('searches once for listings with the same criteria', async () => {
    const content = pageWithListings();
    const nested = findNode(content.blocks.__somersault__.value, 'nested');
    nested.querystring = findNode(
      content.blocks.__somersault__.value,
      'top',
    ).querystring;
    const cli = fakeClient();

    await runUtility(content, cli);

    expect(cli.querystringSearch).toHaveBeenCalledTimes(1);
    expect(
      findNode(content.blocks.__somersault__.value, 'nested').items,
    ).toEqual([{ '@id': '/fresh-News-Item', title: 'Fresh News Item' }]);
  });

  it('keeps the stored results of a listing whose search fails', async () => {
    const content = pageWithListings();
    const cli = fakeClient();
    cli.querystringSearch.mockImplementation(async (args: any) => {
      if (args.query[0].v[0] === 'Event') throw { status: 500 };
      return { data: { items: [{ '@id': `${apiPath}/ok` }] } };
    });

    await runUtility(content, cli);

    const value = content.blocks.__somersault__.value;
    expect(findNode(value, 'top').items).toEqual([{ '@id': '/ok' }]);
    expect(findNode(value, 'nested').items).toEqual([
      { '@id': '/stale-nested', title: 'stale-nested' },
    ]);
  });

  it('shows no results for a listing with no criteria', async () => {
    const content = pageWithListings();
    findNode(content.blocks.__somersault__.value, 'nested').querystring = {
      query: [],
    };
    const cli = fakeClient();

    await runUtility(content, cli);

    expect(cli.querystringSearch).toHaveBeenCalledTimes(1);
    expect(
      findNode(content.blocks.__somersault__.value, 'nested').items,
    ).toEqual([]);
  });

  it('caps the number of searches per page', async () => {
    const content = pageWithListings();
    const many = Array.from({ length: 40 }, (_, i) =>
      listing(`l${i}`, `Type ${i}`, `stale-${i}`),
    );
    content.blocks.__somersault__.value.push(...(many as any[]));
    const cli = fakeClient();

    await runUtility(content, cli);

    expect(cli.querystringSearch).toHaveBeenCalledTimes(MAX_LISTING_SEARCHES);
    // Past the cap a listing keeps its stored results.
    expect(findNode(content.blocks.__somersault__.value, 'l39').items).toEqual([
      { '@id': '/stale-39', title: 'stale-39' },
    ]);
  });
});
