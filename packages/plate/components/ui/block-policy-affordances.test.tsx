import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  BLOCK_CONTEXT_MENU_ID,
  BlockMenuPlugin,
  BlockSelectionPlugin,
} from '@platejs/selection/react';
import {
  EventEditorStore,
  Plate,
  PlateContent,
  usePlateEditor,
} from 'platejs/react';

import { BlockMenuKit } from '../editor/plugins/block-menu-kit';
import { DndKit } from '../editor/plugins/dnd-kit';
import { ColumnKit } from '../editor/plugins/column-kit';
import {
  BlockPolicyPlugin,
  canDeleteBlocks,
  canMoveBlocks,
  filterBlockSchema,
} from '../editor/plugins/block-policy';

const p = (id: string, text: string) => ({
  type: 'p',
  id,
  children: [{ text }],
});

const value = () => [p('locked', 'Locked'), p('free', 'Free')];

/** Refuses delete and move for the paragraph called `locked`. */
const lockLocked = BlockPolicyPlugin.configure({
  options: {
    canDelete: ({ node }) => node.id !== 'locked',
    canMove: ({ node }) => node.id !== 'locked',
  },
});

let editorRef: any = null;

function Editor({
  plugins,
  initialValue = value(),
}: {
  plugins: any[];
  initialValue?: any[];
}) {
  const editor = usePlateEditor({ plugins, value: initialValue });
  editorRef = editor;
  return (
    <Plate editor={editor}>
      <PlateContent />
    </Plate>
  );
}

describe('block policy helpers', () => {
  const entryOf = (id: string) =>
    editorRef.api.node({ at: [], match: { id } }) as any;

  it('allow everything when the policy is not registered', () => {
    render(<Editor plugins={[]} />);
    const locked = entryOf('locked');

    expect(canDeleteBlocks(editorRef, [locked])).toBe(true);
    expect(canMoveBlocks(editorRef, [locked])).toBe(true);
    const schema = { properties: {} };
    expect(filterBlockSchema(editorRef, schema, locked)).toBe(schema);
  });

  it('allow everything when the policy keeps its defaults', () => {
    render(<Editor plugins={[BlockPolicyPlugin]} />);
    const locked = entryOf('locked');

    expect(canDeleteBlocks(editorRef, [locked])).toBe(true);
    expect(canMoveBlocks(editorRef, [locked])).toBe(true);
  });

  it('answer from the policy a component passes in, over the editor’s', () => {
    // Components pass the policy they subscribed to (`useBlockPolicy`): the
    // React Compiler memoizes the call on its arguments, so a policy read
    // only through `editor` would keep the first answer.
    render(<Editor plugins={[BlockPolicyPlugin]} />);
    const locked = entryOf('locked');
    const refuse = {
      canDelete: () => false,
      canMove: () => false,
      filterSchema: () => null,
    };

    expect(canDeleteBlocks(editorRef, [locked], refuse)).toBe(false);
    expect(canMoveBlocks(editorRef, [locked], refuse)).toBe(false);
    expect(filterBlockSchema(editorRef, {}, locked, refuse)).toBeNull();
  });

  it('answer for every entry when the policy is set', () => {
    render(<Editor plugins={[lockLocked]} />);

    expect(canDeleteBlocks(editorRef, [entryOf('free')])).toBe(true);
    expect(
      canDeleteBlocks(editorRef, [entryOf('free'), entryOf('locked')]),
    ).toBe(false);
    expect(canMoveBlocks(editorRef, [entryOf('locked')])).toBe(false);
  });
});

describe('block context menu', () => {
  // jsdom defines `ontouchstart`, and the menu is not rendered on a touch
  // device (`useIsTouchDevice`).
  let ontouchstart: PropertyDescriptor | undefined;
  beforeAll(() => {
    ontouchstart = Object.getOwnPropertyDescriptor(window, 'ontouchstart');
    delete (window as any).ontouchstart;
  });
  afterAll(() => {
    if (ontouchstart)
      Object.defineProperty(window, 'ontouchstart', ontouchstart);
  });

  const openMenuOn = async (id: string) => {
    act(() => {
      editorRef.getApi(BlockSelectionPlugin).blockSelection.set(id);
    });
    const target = document.querySelector(`[data-block-id="${id}"]`)!;
    fireEvent.contextMenu(target, { clientX: 10, clientY: 10 });
    act(() => {
      editorRef
        .getApi(BlockMenuPlugin)
        .blockMenu.show(BLOCK_CONTEXT_MENU_ID, { x: 10, y: 10 });
    });
    return screen.findByRole('menu');
  };

  it('offers Delete and Cut on a block the policy allows deleting', async () => {
    render(<Editor plugins={[...BlockMenuKit, lockLocked]} />);
    await openMenuOn('free');

    expect(screen.getByRole('menuitem', { name: 'Delete' })).toBeVisible();
    expect(screen.getByRole('menuitem', { name: 'Cut' })).toBeVisible();
  });

  it('does not offer Delete or Cut on a block the policy refuses to delete', async () => {
    render(<Editor plugins={[...BlockMenuKit, lockLocked]} />);
    await openMenuOn('locked');

    expect(screen.queryByRole('menuitem', { name: 'Delete' })).toBeNull();
    expect(screen.queryByRole('menuitem', { name: 'Cut' })).toBeNull();
    // The rest of the menu is still there.
    expect(screen.getByRole('menuitem', { name: 'Copy' })).toBeVisible();
  });

  it('offers Delete on every block without a policy', async () => {
    render(<Editor plugins={[...BlockMenuKit]} />);
    await openMenuOn('locked');

    expect(screen.getByRole('menuitem', { name: 'Delete' })).toBeVisible();
  });
});

describe('drag handle', () => {
  const handleOf = (id: string) =>
    document
      .querySelector(`[data-block-id="${id}"]`)
      ?.closest('.group')
      ?.querySelector('[role="button"]') ?? null;

  it('is offered on every block without a policy', () => {
    render(<Editor plugins={[...BlockMenuKit, ...DndKit]} />);

    expect(handleOf('locked')).not.toBeNull();
    expect(handleOf('free')).not.toBeNull();
  });

  it('is not offered on a block the policy refuses to move', () => {
    render(<Editor plugins={[...BlockMenuKit, ...DndKit, lockLocked]} />);

    expect(handleOf('locked')).toBeNull();
    expect(handleOf('free')).not.toBeNull();
  });

  it('follows a policy set after the editor mounted', () => {
    render(
      <Editor plugins={[...BlockMenuKit, ...DndKit, BlockPolicyPlugin]} />,
    );
    expect(handleOf('locked')).not.toBeNull();

    act(() => {
      editorRef.setOption(
        BlockPolicyPlugin,
        'canMove',
        ({ node }: any) => node.id !== 'locked',
      );
    });

    expect(handleOf('locked')).toBeNull();
  });
});

describe('column group delete button', () => {
  const group = (id: string) => ({
    type: 'column_group',
    id,
    children: [
      {
        type: 'column',
        id: `${id}-a`,
        width: '50%',
        children: [p(`${id}-p1`, 'A')],
      },
      {
        type: 'column',
        id: `${id}-b`,
        width: '50%',
        children: [p(`${id}-p2`, 'B')],
      },
    ],
  });

  const columnGrips = () =>
    document.querySelectorAll('svg.lucide-grip-horizontal').length;

  it('offers a drag handle on each column without a policy', () => {
    render(
      <Editor
        plugins={[...DndKit, ...ColumnKit]}
        initialValue={[group('g')]}
      />,
    );

    expect(columnGrips()).toBe(2);
  });

  it('offers no column drag handle where the policy refuses the move', () => {
    render(
      <Editor
        plugins={[
          ...DndKit,
          ...ColumnKit,
          BlockPolicyPlugin.configure({
            options: { canMove: ({ node }) => node.id !== 'g-a' },
          }),
        ]}
        initialValue={[group('g')]}
      />,
    );

    expect(columnGrips()).toBe(1);
  });

  const deleteButton = () =>
    document.querySelector('svg.lucide-trash2, svg.lucide-trash-2');

  // The toolbar opens for the last focused editor; jsdom does not focus a
  // contenteditable, so record the focus the way Plate's focus handler does.
  const focusIn = (path: number[]) =>
    act(() => {
      EventEditorStore.set('last', editorRef.id);
      editorRef.tf.select({ path, offset: 0 });
    });

  it('is offered on a column group without a policy', async () => {
    render(
      <Editor
        plugins={[...DndKit, ...ColumnKit]}
        initialValue={[group('g')]}
      />,
    );
    focusIn([0, 0, 0, 0]);

    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(deleteButton()).not.toBeNull();
  });

  it('is not offered on a column group the policy refuses to delete', async () => {
    render(
      <Editor
        plugins={[
          ...DndKit,
          ...ColumnKit,
          BlockPolicyPlugin.configure({
            options: { canDelete: ({ node }) => node.id !== 'g' },
          }),
        ]}
        initialValue={[group('g')]}
      />,
    );
    focusIn([0, 0, 0, 0]);

    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(deleteButton()).toBeNull();
  });
});
