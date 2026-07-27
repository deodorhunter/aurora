import React from 'react';
import type { BlockConfigBase } from '@plone/types';
import { ListingSchema } from './schema';

const ListingBlockInfo = {
  id: 'listing',
  title: 'Listing',
  view: React.lazy(
    () => import(/* webpackChunkName: "plone-blocks" */ './ListingBlockView'),
  ),
  category: 'common',
  blockSchema: ListingSchema,
} satisfies Partial<BlockConfigBase>;

export default ListingBlockInfo;
