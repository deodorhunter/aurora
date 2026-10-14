import { withTitleText } from '@plone/plate/components/editor/plugins/title';
import { SOMERSAULT_KEY } from '@plone/plate/constants';

type Values = {
  title?: unknown;
  blocks?: Record<string, unknown> | null;
};

/**
 * The form values as they are to be saved, with the title block carrying the
 * `title` field's text.
 *
 * Plate's title binding (`plugins/title.tsx`) keeps the two in step, but only
 * while the blocks editor is mounted, and the Blocks tab's panel is unmounted
 * while the Content tab is shown. A title edited there and saved from there
 * reached `title` and left the title block, which is what the page renders as
 * its heading, with its old text. The field is the one to keep: whenever the
 * editor is mounted the binding has already copied the title block into it.
 *
 * Only the text of an existing root title node changes; values without one
 * come back unchanged, as they do when nothing differs.
 */
export function syncTitleBlock<T extends Values>(values: T): T {
  const { title, blocks } = values;
  if (typeof title !== 'string' || !blocks) return values;

  const somersault = blocks[SOMERSAULT_KEY] as { value?: unknown } | undefined;
  if (!somersault || !Array.isArray(somersault.value)) return values;

  const value = withTitleText(somersault.value, title);
  if (value === somersault.value) return values;

  return {
    ...values,
    blocks: { ...blocks, [SOMERSAULT_KEY]: { ...somersault, value } },
  };
}
