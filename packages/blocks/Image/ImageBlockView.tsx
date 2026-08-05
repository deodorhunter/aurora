import type {
  BlockViewProps,
  Brain,
  ContainedItem,
  Content,
  RelatedItem,
} from '@plone/types';
import config from '@plone/registry';
import Image from '@plone/layout/components/Image/Image';

function flattenToAppUrl(url: string) {
  const apiPath = config.settings.apiPath || '';
  if (!apiPath || !url) return url;

  return url.replace(`${apiPath}/`, '/').replace(apiPath, '/');
}

function isInternalUrl(url: string) {
  return url.startsWith('/') || url.includes('/++api++/');
}

function getLegacyScaledSrc(url: string, size: string) {
  const base = flattenToAppUrl(url);
  if (size === 'm') return `${base}/@@images/image/preview`;
  if (size === 's') return `${base}/@@images/image/mini`;
  return `${base}/@@images/image`;
}

/**
 * An image block with no `image_scales` rendered **nothing at all** in view
 * mode, while edit mode showed it correctly.
 *
 * `data.url` was checked for existence and then never used as a source: it was
 * passed only as the `@id` of a synthetic `item`, which `Image` treats as a
 * Plone object path to resolve scales against. Any image that is not a Plone
 * object — an externally-hosted URL — carries `image_scales: null`, so the
 * lookup yielded nothing, `Image` hit its `if (!image && !src) return null`
 * guard, and the block emitted an empty `<figure>`.
 *
 * `Image` already supports precisely this case (`if (!image && src)
 * attrs.src = src`); this view simply never passed `src`. `ImageBlockEdit` did,
 * which is why the same image appeared while editing and vanished on save —
 * the two halves of one block disagreeing about how to render the same data.
 *
 * The fallback below mirrors `ImageBlockEdit`'s exactly, deliberately: same
 * `isInternalUrl` test, same `getLegacyScaledSrc` sizing, so an internal URL
 * without scales still goes through `@@images` rather than being served
 * unscaled. Keeping the two identical is the point — they were only ever
 * broken because they differed.
 */
const ImageBlockView = (props: BlockViewProps) => {
  const { data } = props;
  const url = data.url as string | undefined;
  if (!url) return null;

  const item = data.image_scales
    ? ({
        '@id': url,
        image_field: data.image_field,
        image_scales: data.image_scales,
      } as unknown as Content | Brain | ContainedItem | RelatedItem)
    : undefined;

  return (
    <figure>
      <Image
        item={item}
        src={
          data.image_scales
            ? undefined
            : isInternalUrl(url)
              ? getLegacyScaledSrc(url, (data.size as string) || 'l')
              : url
        }
        alt={(data.alt as string) || ''}
        imageField={data.image_field as string}
      />
    </figure>
  );
};

export default ImageBlockView;
