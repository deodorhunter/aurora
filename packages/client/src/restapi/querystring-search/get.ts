import { apiRequest, type ApiRequestParams } from '../../api';
import { z } from 'zod';
import { querystringSearchDataSchema } from '../../validation/querystring-search';
import type { QuerystringSearchResponse } from '@plone/types';
import type PloneClient from '../../client';
import type { RequestResponse } from '../types';

export type QuerystringSearchArgs = z.infer<typeof querystringSearchDataSchema>;

export async function querystringSearch(
  this: PloneClient,
  args: QuerystringSearchArgs,
): Promise<RequestResponse<QuerystringSearchResponse>> {
  // `post` selects the transport; everything else is part of the search and
  // has to reach the backend. The previous cut destructured `{ query, post }`
  // and validated `{ query }` alone, so `sort_on` / `sort_order` / `limit` /
  // `b_size` / `b_start` / `fullobjects` were accepted by the schema, typed on
  // the argument, and then silently dropped — a Listing configured as "the 5
  // most recent news items" searched unsorted and unbounded.
  const { post, ...searchArgs } = querystringSearchDataSchema.parse(args);
  const { query, ...params } = searchArgs;

  if (post) {
    const options: ApiRequestParams = {
      data: { query, ...params },
      config: this.config,
    };

    return apiRequest('post', '/@querystring-search', options);
  }

  // Over GET the parameters ride *inside* the `query` blob, not beside it:
  // `@querystring-search?query={…}&limit=2` ignores the sibling completely
  // (verified against plone.restapi — 9 results with `limit` beside the blob,
  // 2 with it inside). Only the POST body takes them at the top level.
  const encodedQuery = encodeURIComponent(JSON.stringify({ query, ...params }));

  const options: ApiRequestParams = {
    config: this.config,
    params: {
      ...(encodedQuery && { query: encodedQuery }),
    },
  };

  return apiRequest('get', '/@querystring-search', options);
}
