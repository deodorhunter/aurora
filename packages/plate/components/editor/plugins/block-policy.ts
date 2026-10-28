import {
  createSlatePlugin,
  type NodeEntry,
  type Path,
  type SlateEditor,
  type TElement,
} from 'platejs';
import { toPlatePlugin, usePluginOption } from 'platejs/react';

export const BLOCK_POLICY_KEY = 'blockPolicy';

export type BlockPolicyContext = {
  editor: SlateEditor;
  /** The block node, including its `id`. */
  node: TElement;
  path: Path;
};

/**
 * A block settings schema as the blocks registry declares it: an object, or a
 * function of the block's data (Volto's convention). A filter receives it as
 * declared and returns the same shape.
 */
export type BlockPolicySchema = unknown;

export type BlockPolicyOptions = {
  /** Whether the editor UI offers to delete this block. `null`: always. */
  canDelete: ((context: BlockPolicyContext) => boolean) | null;
  /** Whether the editor UI offers to move (drag) this block. `null`: always. */
  canMove: ((context: BlockPolicyContext) => boolean) | null;
  /**
   * The settings schema to show for this block instance, narrowed from the
   * registry's. Return `null` to show no settings form. `null` (the option):
   * the registry's schema, unchanged.
   */
  filterSchema:
    | (<S extends BlockPolicySchema>(
        schema: S,
        context: BlockPolicyContext,
      ) => S | null)
    | null;
};

/**
 * Per-instance block policy: lets an integration narrow what the editor UI
 * offers on a given block (the Delete and Cut items of the block context
 * menu, the drag handle, the column group's delete button, the fields of the
 * block settings sidebar) without core knowing why.
 *
 * A no-op by default. Unregistered, or registered with its default options,
 * every block can be deleted and moved and shows its whole schema. Register it
 * and set its options, statically with `configure` or at runtime with
 * `editor.setOption(BlockPolicyPlugin, …)`, to opt in.
 *
 * The policy decides what the UI *offers*. It refuses nothing: keyboard
 * deletes, pastes and transforms called by other plugins still go through. An
 * integration that has to enforce a rule also guards the transforms.
 */
export const BaseBlockPolicyPlugin = createSlatePlugin({
  key: BLOCK_POLICY_KEY,
  options: {
    canDelete: null,
    canMove: null,
    filterSchema: null,
  } as BlockPolicyOptions,
});

export const BlockPolicyPlugin = toPlatePlugin(BaseBlockPolicyPlugin);

const policyOf = (editor: SlateEditor): BlockPolicyOptions | null =>
  editor.plugins?.[BLOCK_POLICY_KEY]
    ? (editor.getOptions(BaseBlockPolicyPlugin) as BlockPolicyOptions)
    : null;

const contextOf = (
  editor: SlateEditor,
  [node, path]: NodeEntry,
): BlockPolicyContext => ({ editor, node: node as TElement, path });

/**
 * Whether the UI may offer to delete every one of `entries`.
 *
 * A component passes the `policy` it got from {@link useBlockPolicy}: the
 * React Compiler memoizes a call on its arguments, and a policy read through
 * `editor` alone is not one of them, so the first answer would stick.
 */
export function canDeleteBlocks(
  editor: SlateEditor,
  entries: readonly NodeEntry[],
  policy: BlockPolicyOptions | null | undefined = policyOf(editor),
): boolean {
  const canDelete = policy?.canDelete;
  if (!canDelete) return true;
  return entries.every((entry) => canDelete(contextOf(editor, entry)));
}

/** Whether the UI may offer to move every one of `entries`. See
 * {@link canDeleteBlocks} on `policy`. */
export function canMoveBlocks(
  editor: SlateEditor,
  entries: readonly NodeEntry[],
  policy: BlockPolicyOptions | null | undefined = policyOf(editor),
): boolean {
  const canMove = policy?.canMove;
  if (!canMove) return true;
  return entries.every((entry) => canMove(contextOf(editor, entry)));
}

/**
 * The settings schema to show for the block at `entry`, or `null` for no
 * settings form.
 */
export function filterBlockSchema<S extends BlockPolicySchema>(
  editor: SlateEditor,
  schema: S,
  entry: NodeEntry,
  policy: BlockPolicyOptions | null | undefined = policyOf(editor),
): S | null {
  const filterSchema = policy?.filterSchema;
  if (!filterSchema) return schema;
  return filterSchema(schema, contextOf(editor, entry));
}

/**
 * The policy, subscribed: the calling component re-renders when an option
 * changes. `undefined` when the plugin is not registered. Pass it on to the
 * helpers above.
 */
export function useBlockPolicy(): BlockPolicyOptions | undefined {
  return usePluginOption(BlockPolicyPlugin, 'state') as
    BlockPolicyOptions | undefined;
}
