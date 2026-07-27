import { z } from 'zod';

const query = z.object({
  i: z.string(),
  o: z.string(),
  v: z.union([z.string(), z.array(z.string())]),
});

// The numeric parameters are accepted as numbers as well as strings: the
// Querystring widget stores them as numbers (`parseInt` on its own inputs),
// while `QuerystringParameter` types them as strings. Both reach here, and the
// backend takes either.
const numeric = z.union([z.string(), z.number()]).optional();

export const querystringSearchDataSchema = z.object({
  b_start: numeric,
  b_size: numeric,
  limit: numeric,
  sort_on: z.string().optional(),
  sort_order: z.string().optional(),
  fullobjects: z.boolean().optional(),
  query: z.array(query),
  post: z.boolean().optional(),
});
