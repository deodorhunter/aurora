import { setup, teardown } from '../../utils/test';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import PloneClient from '../../client';
import { v4 as uuid } from 'uuid';

const cli = PloneClient.initialize({
  apiPath: 'http://localhost:55001/plone',
});

await cli.login({ data: { login: 'admin', password: 'secret' } });

beforeEach(async () => {
  await setup();
});

afterEach(async () => {
  await teardown();
});

describe('Querystring Search', () => {
  test('Successful get', async () => {
    const randomId = uuid();
    const contentData = {
      '@type': 'Document',
      title: `get-search${randomId}`,
    };

    await cli.createContent({ path: '/', data: contentData });

    const querystringSearchData = {
      query: [
        {
          i: 'portal_type',
          o: 'plone.app.querystring.operation.selection.any',
          v: ['Document'],
        },
      ],
    };

    const result = await cli.querystringSearch({
      query: querystringSearchData.query,
    });

    expect(result.data.items_total).toBeGreaterThan(0);
  });

  test('Successful post', async () => {
    const randomId = uuid();
    const contentData = {
      '@type': 'Document',
      title: `post-search${randomId}`,
    };

    await cli.createContent({ path: '/', data: contentData });

    const querystringSearchData = {
      query: [
        {
          i: 'portal_type',
          o: 'plone.app.querystring.operation.selection.any',
          v: ['Document'],
        },
      ],
    };

    const result = await cli.querystringSearch({
      query: querystringSearchData.query,
      post: true,
    });

    expect(result.data['@id']).toBe(
      'http://localhost:55001/plone/++api++/@querystring-search',
    );
    expect(result.data.items_total).toBeGreaterThan(0);
  });

  // Regression: every argument but `query` used to be destructured away and
  // never sent, so a Listing configured as "the 5 most recent news items"
  // searched unsorted and unbounded. The schema accepted these and the type
  // advertised them, which is what made it silent.
  describe('forwards the search parameters, not just the query', () => {
    const query = [
      {
        i: 'portal_type',
        o: 'plone.app.querystring.operation.selection.any',
        v: ['Document'],
      },
    ];

    async function seed(prefix: string) {
      for (let i = 0; i < 3; i += 1) {
        await cli.createContent({
          path: '/',
          data: { '@type': 'Document', title: `${prefix}-${uuid()}` },
        });
      }
    }

    test('limit caps the results (GET)', async () => {
      await seed('limit-get');

      const all = await cli.querystringSearch({ query });
      const limited = await cli.querystringSearch({ query, limit: 2 });

      expect(all.data.items.length).toBeGreaterThan(2);
      expect(limited.data.items).toHaveLength(2);
    });

    test('limit caps the results (POST)', async () => {
      await seed('limit-post');

      const limited = await cli.querystringSearch({ query, limit: 2, post: true });

      expect(limited.data.items).toHaveLength(2);
    });

    test('sort_order reverses the results', async () => {
      await seed('sort');

      const ascending = await cli.querystringSearch({
        query,
        sort_on: 'sortable_title',
        sort_order: 'ascending',
      });
      const descending = await cli.querystringSearch({
        query,
        sort_on: 'sortable_title',
        sort_order: 'descending',
      });

      const titles = (r: typeof ascending) => r.data.items.map((i) => i.title);
      expect(titles(descending)).toEqual([...titles(ascending)].reverse());
    });

    // The Querystring widget stores these as numbers (its inputs `parseInt`),
    // while `QuerystringParameter` types them as strings. Both arrive here.
    test('accepts the numeric parameters as strings too', async () => {
      await seed('numeric');

      const limited = await cli.querystringSearch({ query, limit: '2' });

      expect(limited.data.items).toHaveLength(2);
    });
  });
});
