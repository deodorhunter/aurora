import { describe, expect, it } from 'vitest';
import { createPlatePlugin, createPlateEditor } from 'platejs/react';

import {
  TITLE_BLOCK_TYPE,
  BaseTitleBlockPlugin,
  setTitleNodeText,
  withTitleText,
} from './title';

describe('title block plugin', () => {
  it('exposes the expected title block type key', () => {
    expect(TITLE_BLOCK_TYPE).toBe('title');
    expect(BaseTitleBlockPlugin.key).toBe(TITLE_BLOCK_TYPE);
  });
});

const titleNode = {
  type: TITLE_BLOCK_TYPE,
  id: 't1',
  blockWidth: 'default',
  children: [{ text: 'Old title' }],
};
const paragraph = { type: 'p', id: 'p1', children: [{ text: 'Body' }] };

describe('withTitleText', () => {
  it('replaces the text of the root title node, keeping its props', () => {
    expect(withTitleText([titleNode, paragraph], 'New')).toEqual([
      { ...titleNode, children: [{ text: 'New' }] },
      paragraph,
    ]);
  });

  it('flattens a title with several text runs into one', () => {
    const marked = {
      ...titleNode,
      children: [{ text: 'Old ' }, { text: 'title', bold: true }],
    };
    expect(withTitleText([marked], 'New')[0]).toEqual({
      ...titleNode,
      children: [{ text: 'New' }],
    });
  });

  it('returns the same value when there is nothing to change', () => {
    const same = [titleNode, paragraph];
    expect(withTitleText(same, 'Old title')).toBe(same);
    const untitled = [paragraph];
    expect(withTitleText(untitled, 'New')).toBe(untitled);
  });

  it('does not look for a title node below the root', () => {
    const nested = [{ type: 'column', id: 'c1', children: [titleNode] }];
    expect(withTitleText(nested, 'New')).toBe(nested);
  });
});

describe('setTitleNodeText', () => {
  // Stands in for any plugin that refuses to remove a block, such as one
  // enforcing a delete lock: it drops every removal of an element with an id.
  const RefuseRemovingBlocks = createPlatePlugin({
    key: 'refuseRemovingBlocks',
  }).overrideEditor(({ editor, tf: { removeNodes } }) => ({
    transforms: {
      removeNodes(options) {
        const at = options?.at;
        const entry = Array.isArray(at) ? editor.api.node(at) : undefined;
        if (entry && 'id' in (entry[0] as object)) return;
        return removeNodes(options);
      },
    },
  }));

  const makeEditor = (plugins: any[] = []) =>
    createPlateEditor({
      plugins: [BaseTitleBlockPlugin, ...plugins],
      value: [structuredClone(titleNode), structuredClone(paragraph)] as any,
    });

  it('rewrites the title text, keeping the node', () => {
    const editor = makeEditor();
    setTitleNodeText(editor as any, [0], editor.children[0], 'New title');
    expect(editor.children).toEqual([
      { ...titleNode, children: [{ text: 'New title' }] },
      paragraph,
    ]);
  });

  it('works when removing the title block itself would be refused', () => {
    const editor = makeEditor([RefuseRemovingBlocks]);
    setTitleNodeText(editor as any, [0], editor.children[0], 'New title');
    expect(editor.children).toEqual([
      { ...titleNode, children: [{ text: 'New title' }] },
      paragraph,
    ]);
  });

  it('writes an empty title as an empty text node', () => {
    const editor = makeEditor();
    setTitleNodeText(editor as any, [0], editor.children[0], '');
    expect(editor.children[0]).toEqual({
      ...titleNode,
      children: [{ text: '' }],
    });
  });
});
