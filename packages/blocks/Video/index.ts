import React from 'react';
import type { BlockConfigBase } from '@plone/types';
import { VideoSchema } from './schema';

const VideoBlockInfo = {
  id: 'video',
  title: 'Video',
  view: React.lazy(
    () => import(/* webpackChunkName: "plone-blocks" */ './VideoBlockView'),
  ),
  category: 'media',
  blockSchema: VideoSchema,
  allowedPeertubeInstances: [] as string[],
} satisfies Partial<BlockConfigBase> & {
  allowedPeertubeInstances?: string[];
};

export default VideoBlockInfo;
