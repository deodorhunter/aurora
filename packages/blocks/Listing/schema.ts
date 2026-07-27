import type { BlocksFormData, JSONSchema } from '@plone/types';

/**
 * Listing block schema.
 *
 * The block already had everything *but* this: a view that renders
 * `data.items`, a `querystring` field on `ListingBlockFormData`, a registered
 * `querystring` widget, and a server-side sub-request that resolves the query
 * into `items`. With no `blockSchema` there was simply no form to set the query
 * from, so a Listing could only ever be added and then left empty.
 *
 * Every field here is served by a widget Aurora already registers
 * (`querystring`, the default text field, `choices` via `Select`) — nothing
 * custom.
 */
export function ListingSchema({
  formData = {} as BlocksFormData,
}: { formData?: BlocksFormData } = {}): JSONSchema {
  const listing = formData as { headline?: string };

  return {
    title: 'Listing',
    fieldsets: [
      {
        id: 'default',
        title: 'Default',
        fields: [
          'querystring',
          'headline',
          // A heading level only means something once there is a headline to
          // render at it — mirroring how Image/Teaser reveal their dependent
          // fields (`formData.url` / `formData.overwrite`).
          ...(listing.headline ? ['headlineTag'] : []),
          'variation',
        ],
      },
    ],
    properties: {
      querystring: {
        title: 'Criteria',
        description: 'Which content this listing shows.',
        widget: 'querystring',
      },
      headline: {
        title: 'Headline',
        description: 'Optional heading rendered above the results.',
      },
      headlineTag: {
        title: 'Headline level',
        choices: [
          ['h2', 'Heading 2'],
          ['h3', 'Heading 3'],
        ],
        default: 'h2',
      },
      variation: {
        title: 'Layout',
        choices: [
          ['default', 'Title and description'],
          ['summary', 'With preview image'],
        ],
        default: 'default',
      },
    },
    required: [],
  };
}

export default ListingSchema;
