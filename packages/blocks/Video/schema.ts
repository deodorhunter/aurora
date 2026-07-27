import type { JSONSchema } from '@plone/types';

/**
 * Video block schema.
 *
 * `VideoBlockView` reads `data.url` (YouTube / Vimeo / PeerTube / a file in the
 * site) and `data.align`, but the block registered no `blockSchema`, so neither
 * could be set from a settings form — the block could only ever be added and
 * left blank.
 *
 * Both fields are served by widgets Aurora already registers: the default text
 * field for the URL (external URLs are the common case, and the object browser
 * cannot express them), and the `align` widget for placement.
 */
export function VideoSchema(): JSONSchema {
  return {
    title: 'Video',
    fieldsets: [
      {
        id: 'default',
        title: 'Default',
        fields: ['url', 'align'],
      },
    ],
    properties: {
      url: {
        title: 'Video URL',
        description:
          'A YouTube, Vimeo or PeerTube link, or the URL of a video in this site.',
      },
      align: {
        title: 'Alignment',
        widget: 'align',
        default: 'center',
        actions: ['left', 'right', 'center'],
        styleField: true,
      },
    },
    required: [],
  };
}

export default VideoSchema;
