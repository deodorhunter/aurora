import {
  data,
  RouterContextProvider,
  type LoaderFunctionArgs,
} from 'react-router';
import { ploneClientContext } from '@plone/aurora/app/middleware.server';
import type { Brain, Query } from '@plone/types';

export interface QuerystringSearchResult {
  items: Brain[];
  items_total: number;
}

function parseQuery(raw: string | null): Query[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((c) => c && typeof c.i === 'string' && typeof c.o === 'string')
      .map((c) => ({
        i: c.i,
        o: c.o,
        v: Array.isArray(c.v) ? c.v.map(String) : String(c.v ?? ''),
      }));
  } catch {
    return [];
  }
}

/**
 * The display parameters that ride alongside the query. Forwarded so the
 * editor's result preview matches what the block will actually render — a
 * Listing capped at 5 and sorted by date must preview as 5, in that order,
 * or the preview quietly contradicts the settings above it.
 */
function parseParams(searchParams: URLSearchParams) {
  const sort_on = searchParams.get('sort_on') ?? undefined;
  const sort_order = searchParams.get('sort_order') ?? undefined;
  const limit = searchParams.get('limit') ?? undefined;
  const b_size = searchParams.get('b_size') ?? undefined;
  return {
    ...(sort_on ? { sort_on } : {}),
    ...(sort_order ? { sort_order } : {}),
    ...(limit ? { limit } : {}),
    ...(b_size ? { b_size } : {}),
  };
}

export async function loader({
  request,
  context,
}: LoaderFunctionArgs<RouterContextProvider>) {
  const cli = context.get(ploneClientContext);

  const url = new URL(request.url);
  const query = parseQuery(url.searchParams.get('query'));

  const empty: QuerystringSearchResult = { items: [], items_total: 0 };

  if (query.length === 0) {
    return data(empty, {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const { data: results } = await cli.querystringSearch({
      query,
      ...parseParams(url.searchParams),
      post: true,
    });

    return data(
      {
        items: results?.items ?? [],
        items_total: results?.items_total ?? 0,
      } satisfies QuerystringSearchResult,
      {
        headers: { 'Content-Type': 'application/json' },
      },
    );
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to fetch querystring-search results:', error);
    return data(empty, {
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
