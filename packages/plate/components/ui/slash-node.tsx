import * as React from 'react';

import type { PlateElementProps } from 'platejs/react';

import { SlashPlugin } from '@platejs/slash-command/react';
import {
  type TComboboxInputElement,
  type TRange,
  ElementApi,
  RangeApi,
} from 'platejs';
import type { PlateEditor } from 'platejs/react';
import { PlateElement } from 'platejs/react';
import { useTranslation } from '../editor/plugins/i18n';
import { TITLE_BLOCK_TYPE } from '../editor/plugins/title';
import {
  resolveSlashMenuGroups,
  type SlashMenuConfig,
} from '../editor/plugins/slash-menu';

import {
  InlineCombobox,
  InlineComboboxContent,
  InlineComboboxEmpty,
  InlineComboboxGroup,
  InlineComboboxGroupLabel,
  InlineComboboxInput,
  InlineComboboxItem,
} from './inline-combobox';

/**
 * Put the caret back where the insert left it, once the focus handoff has
 * settled.
 *
 * Picking a slash-menu item runs three things in a row, and the third undoes
 * the first two:
 *
 *  1. `InlineComboboxItem` calls `removeInput()` — the slash-input node, which
 *     is where the DOM selection lives, is deleted. The DOM selection goes with
 *     it, the `<input>` unmounts, and focus falls back to `<body>`. Slate hears
 *     the resulting `selectionchange` and sets `editor.selection = null`.
 *  2. The item's own handler inserts the block. `insertBlock` selects it, so
 *     `editor.selection` is now correct — and, measured, stays correct through
 *     the end of the handler.
 *  3. `DOMEditor.focus` (retried over the next few animation frames) focuses
 *     the editable. A `contenteditable` focused with no DOM selection gets the
 *     browser's default caret — the **start of the document** — and Slate syncs
 *     that back over the selection from step 2.
 *
 * So the node is inserted in the right place but the caret ends up in the
 * document's first block, taking anything that tracks selection with it. Two
 * frames is the earliest point at which step 3 has finished and a re-select
 * sticks; measured against a 10-node document, the caret is stable from there
 * on (checked again at +200ms and +600ms).
 *
 * The guard is what keeps this from being a caret-stealer: if the selection at
 * that point is already the one we want, or the user has moved it somewhere
 * else in the ~32ms since, nothing is written.
 */
function restoreCaret(editor: PlateEditor, at: TRange) {
  const isDocumentStart = (range: TRange) => {
    const start = editor.api.start([]);
    return !!start && RangeApi.equals(range, { anchor: start, focus: start });
  };

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const current = editor.selection;
      // Nothing to fix.
      if (current && RangeApi.equals(current, at)) return;
      // Any caret other than the document-start one step 3 leaves behind is
      // the user's, not ours.
      if (current && !isDocumentStart(current)) return;
      editor.tf.select(at);
    });
  });
}

export function SlashInputElement(
  props: PlateElementProps<TComboboxInputElement>,
) {
  const { editor, element } = props;
  const menuConfig = (
    editor.getOptions(SlashPlugin as any) as
      { menu?: SlashMenuConfig } | undefined
  )?.menu;
  const { t } = useTranslation();

  const hasTitleBlock = editor.children.some(
    (child) => ElementApi.isElement(child) && child.type === TITLE_BLOCK_TYPE,
  );

  const groups = React.useMemo(() => {
    return resolveSlashMenuGroups(editor, menuConfig, {
      hasTitleBlock,
      t,
    });
  }, [editor, hasTitleBlock, menuConfig, t]);

  return (
    <PlateElement {...props} as="span">
      <InlineCombobox element={element} trigger="/">
        <InlineComboboxInput />

        <InlineComboboxContent>
          <InlineComboboxEmpty>
            {t('plate.slashMenu.noResults', { defaultValue: 'No results' })}
          </InlineComboboxEmpty>

          {groups.map(({ group, label: groupLabel, items }) => (
            <InlineComboboxGroup key={group}>
              <InlineComboboxGroupLabel>
                {groupLabel ?? group}
              </InlineComboboxGroupLabel>

              {items.map(
                ({ focusEditor, icon, keywords, label, value, onSelect }) => (
                  <InlineComboboxItem
                    key={value}
                    value={value}
                    onClick={() => {
                      onSelect(editor, value);
                      if (focusEditor === false) return;
                      // The caret the insert just placed on the new node. It
                      // is correct right now and wrong two frames from now —
                      // hence the restore below.
                      const at = editor.selection;
                      editor.tf.focus();
                      if (!at) return;
                      restoreCaret(editor, at);
                    }}
                    label={label}
                    /**
                     * Pinned to false, with each item's real intent honoured in
                     * `onClick` above (`focusEditor === false` returns early).
                     *
                     * `InlineComboboxItem` runs `removeInput(focusEditor)`
                     * *before* this `onClick`, so leaving it true focuses the
                     * editor before the item has inserted anything — see
                     * `restoreCaret` for the full sequence and why the caret
                     * ends up in the document's first block either way.
                     * Focusing after the insert is half the fix; `restoreCaret`
                     * is the other half.
                     */
                    focusEditor={false}
                    group={group}
                    keywords={keywords}
                  >
                    <div className="mr-2 text-muted-foreground">{icon}</div>
                    {label ?? value}
                  </InlineComboboxItem>
                ),
              )}
            </InlineComboboxGroup>
          ))}
        </InlineComboboxContent>
      </InlineCombobox>

      {props.children}
    </PlateElement>
  );
}
