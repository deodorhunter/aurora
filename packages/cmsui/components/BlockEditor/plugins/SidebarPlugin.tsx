import * as React from 'react';
import { createPortal } from 'react-dom';
import {
  BlockSelectionPlugin,
  createPlatePlugin,
  ElementApi,
  useEditorRef,
  useEditorSelector,
} from '@plone/plate/components/editor';
import {
  filterBlockSchema,
  useBlockPolicy,
} from '@plone/plate/components/editor/plugins/block-policy';
import { PLONE_BLOCK_TYPE } from '@plone/helpers';
import type { BlockConfigBase } from '@plone/types';
import config from '@plone/registry';
import BlockSettingsForm from '../BlockSettingsForm';

type SelectedNativeBlock = {
  key: string;
  node: any;
  path: number[];
  data: Record<string, unknown> & { '@type': string };
  schema: BlockConfigBase['blockSchema'];
};

const isPloneBlockElement = (node: unknown) =>
  ElementApi.isElement(node) && node.type === PLONE_BLOCK_TYPE;

/**
 * The nearest Plone block at or above `path`.
 *
 * A Plone block is not always a top-level node: layout elements such as a
 * column group nest it (`column_group > column > ploneBlock`). Taking the
 * outermost block there lands on the group, which is not a Plone block, and
 * the sidebar shows no form for the block the user actually selected.
 */
const findPloneBlockAt = (
  editor: any,
  path: number[] | undefined,
): [any, number[]] | null => {
  if (!Array.isArray(path)) return null;
  for (let depth = path.length; depth > 0; depth -= 1) {
    const entry = editor.api.node(path.slice(0, depth));
    if (entry && isPloneBlockElement(entry[0])) return entry;
  }
  return null;
};

const getBlockSelectionEntries = (
  editor: any,
  options: { selectionFallback?: boolean } = {},
): [any, number[]][] =>
  editor
    .getApi(BlockSelectionPlugin)
    ?.blockSelection?.getNodes?.({ ...options, sort: true }) ?? [];

const getPloneBlockFromBlockSelection = (
  editor: any,
): [any, number[]] | null => {
  const entries = getBlockSelectionEntries(editor, { selectionFallback: true });

  for (let index = entries.length - 1; index >= 0; index -= 1) {
    const [node, path] = entries[index];
    if (isPloneBlockElement(node)) return [node, path];
  }

  return null;
};

const getPloneBlockFromActiveElement = (
  editor: any,
): [any, number[]] | null => {
  if (typeof document === 'undefined') return null;

  const activeElement = document.activeElement as HTMLElement | null;
  const blockElement = activeElement?.closest?.('[data-slate-node="element"]');
  if (!blockElement) return null;

  try {
    const node = editor.api.toSlateNode(blockElement);
    if (!node) return null;
    return findPloneBlockAt(editor, editor.api.findPath(node));
  } catch {
    return null;
  }
};

const getPloneBlockFromSelection = (editor: any): [any, number[]] | null =>
  findPloneBlockAt(editor, editor.selection?.anchor?.path);

/**
 * Whether the user block-selected a container of `path` (a column group, say)
 * rather than the Plone block inside it. Selecting the container itself shows
 * no form, as before nested blocks were resolved: the caret may still sit in
 * one of its children, and that child is not what was selected.
 */
const isInsideBlockSelectedContainer = (editor: any, path: number[]) =>
  getBlockSelectionEntries(editor).some(
    ([, selectedPath]) =>
      selectedPath.length < path.length &&
      selectedPath.every((index, depth) => path[depth] === index),
  );

const getSelectedNativeBlock = (editor: any): SelectedNativeBlock | null => {
  const entry =
    getPloneBlockFromBlockSelection(editor) ??
    getPloneBlockFromActiveElement(editor) ??
    getPloneBlockFromSelection(editor);
  if (!entry) return null;

  const [node, path] = entry;
  if (!isPloneBlockElement(node)) return null;
  if (isInsideBlockSelectedContainer(editor, path)) return null;

  const blockType = node['@type'];
  if (typeof blockType !== 'string') return null;

  const blockConfig = (
    config.blocks.blocksConfig as unknown as Record<string, BlockConfigBase>
  )?.[blockType];
  if (!blockConfig?.blockSchema) return null;

  const data = { ...node } as Record<string, unknown>;
  delete data.id;
  delete data.type;
  delete data.children;

  return {
    key: path.join('-'),
    node,
    path,
    data: {
      ...data,
      '@type': blockType,
    },
    schema: blockConfig.blockSchema,
  };
};

export function SidebarAfterEditable() {
  const editor = useEditorRef();
  const selectedNativeBlock = useEditorSelector(getSelectedNativeBlock, []);
  // An integration may narrow the schema per block instance, or hide the
  // form, through the block policy (a no-op unless one is registered).
  // Subscribing re-renders the form when the policy changes.
  const policy = useBlockPolicy();
  const schema = React.useMemo(
    () =>
      selectedNativeBlock
        ? filterBlockSchema(
            editor,
            selectedNativeBlock.schema,
            [selectedNativeBlock.node, selectedNativeBlock.path],
            policy,
          )
        : null,
    [editor, selectedNativeBlock, policy],
  );

  const onFormDataChange = React.useCallback(
    (next: Record<string, unknown>) => {
      if (!selectedNativeBlock) return;
      const patch = { ...next };
      delete patch.id;
      delete patch.type;
      delete patch.children;
      editor.tf.setNodes(patch as any, { at: selectedNativeBlock.path });
    },
    [editor, selectedNativeBlock],
  );

  const sidebar =
    typeof document === 'undefined' ? null : document.getElementById('sidebar');

  if (!sidebar) return null;
  if (!selectedNativeBlock || !schema) return null;

  return createPortal(
    <BlockSettingsForm
      key={selectedNativeBlock.key}
      schema={schema}
      formData={selectedNativeBlock.data}
      onFormDataChange={onFormDataChange}
    />,
    sidebar,
  );
}

export const SidebarPlugin = createPlatePlugin({
  key: 'cmsui-sidebar',
  render: {
    afterEditable: SidebarAfterEditable,
  },
});
