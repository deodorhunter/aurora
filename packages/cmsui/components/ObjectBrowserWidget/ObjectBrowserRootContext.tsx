import { createContext, useContext } from 'react';

/**
 * Optional ambient "browse root" for the object browser.
 *
 * By default the object-browser widgets seed their picker from the edited
 * content's `@id` (Teaser's `ObjectBrowserWidget`) or the current browser URL
 * (`ImageWidget`). That breaks when the widget is mounted somewhere whose URL
 * is not a Plone content path — e.g. the Template Studio's `/~/studio/<uid>`
 * routes, where the derived path 404s in `@objectBrowserWidget`'s loader and
 * the single-fetch error crashes the app.
 *
 * An embedder can wrap a subtree in `<ObjectBrowserRootContext.Provider>` to
 * declare the path the picker should browse from (e.g. the site root `'/'`).
 * The default `undefined` preserves the existing behavior everywhere else, so
 * the normal content editor is unaffected.
 */
export const ObjectBrowserRootContext = createContext<string | undefined>(
  undefined,
);

export function useObjectBrowserRoot(): string | undefined {
  return useContext(ObjectBrowserRootContext);
}
