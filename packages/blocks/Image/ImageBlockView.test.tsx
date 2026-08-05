import '@testing-library/jest-dom';
import { describe, expect, test, beforeAll, vi } from 'vitest';
import { render } from '@testing-library/react';
import config from '@plone/registry';
import ImageBlockView from './ImageBlockView';

/**
 * `Image` is stubbed rather than rendered for real, and that is the right
 * boundary for this file: the bug being pinned here was never inside `Image`
 * — which has supported a plain `src` all along — but in what `ImageBlockView`
 * *passed* to it. Asserting on the props is asserting on the defect.
 *
 * (Rendering the real one would also drag in a router: `Image` reads the root
 * route's loader for the site's allowed scales, and `react-router` is not a
 * dependency of this package.)
 */
vi.mock('@plone/layout/components/Image/Image', () => ({
  default: ({ src, item, alt }: { src?: string; item?: unknown; alt: string }) => (
    <img src={src} alt={alt} data-has-item={item ? 'yes' : 'no'} />
  ),
}));

beforeAll(() => {
  config.settings = {
    ...(config.settings ?? {}),
    apiPath: 'http://localhost:8080/Plone',
  };
});

describe('ImageBlockView', () => {
  // The regression this file exists for: an image whose URL is not a Plone
  // object carries no `image_scales`, and the block used to render an empty
  // <figure> — `url` was passed only as a scale-lookup `@id`, never as a
  // source. Edit mode showed the same image correctly, so the two halves of
  // one block disagreed about how to render identical data.
  test('gives an externally hosted image its url as src', () => {
    const { container } = render(
      <ImageBlockView
        data={{
          '@type': 'image',
          url: 'https://picsum.photos/800/600',
          alt: 'A photo',
        }}
      />,
    );

    const img = container.querySelector('img');
    expect(img).toHaveAttribute('src', 'https://picsum.photos/800/600');
    expect(img).toHaveAttribute('alt', 'A photo');
    // No scales means no synthetic item to look them up against.
    expect(img).toHaveAttribute('data-has-item', 'no');
  });

  test('routes an internal url without scales through @@images, honouring size', () => {
    const { container } = render(
      <ImageBlockView
        data={{ '@type': 'image', url: '/an-image', size: 'm' }}
      />,
    );

    expect(container.querySelector('img')).toHaveAttribute(
      'src',
      '/an-image/@@images/image/preview',
    );
  });

  test('treats an absolute api-path url as external — matching edit mode', () => {
    // Not an endorsement, a pin. `isInternalUrl` only recognises a leading `/`
    // or an `/++api++/` segment, so a fully-qualified URL pointing at this very
    // site is served raw instead of through `@@images`, unscaled. That is
    // exactly what `ImageBlockEdit` does with the same input, and keeping the
    // two identical is the whole point of this view's fallback — the original
    // bug was the two halves disagreeing. Worth fixing, but as its own change
    // to the shared helper, in both files at once.
    const { container } = render(
      <ImageBlockView
        data={{
          '@type': 'image',
          url: 'http://localhost:8080/Plone/an-image',
          size: 'm',
        }}
      />,
    );

    expect(container.querySelector('img')).toHaveAttribute(
      'src',
      'http://localhost:8080/Plone/an-image',
    );
  });

  test('defers to scale resolution when the image is a real Plone object', () => {
    const { container } = render(
      <ImageBlockView
        data={{
          '@type': 'image',
          url: '/an-image',
          image_field: 'image',
          image_scales: { image: [{ download: 'x.jpeg', width: 800 }] },
        }}
      />,
    );

    const img = container.querySelector('img');
    // `src` must stay undefined here, or it would override the scale/srcSet
    // machinery `Image` builds from the item.
    expect(img).not.toHaveAttribute('src');
    expect(img).toHaveAttribute('data-has-item', 'yes');
  });

  test('renders nothing without a url', () => {
    const { container } = render(<ImageBlockView data={{ '@type': 'image' }} />);
    expect(container.querySelector('figure')).toBeNull();
  });
});
