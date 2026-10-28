import { act, fireEvent, render, screen } from '@testing-library/react';
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import {
  createPlatePlugin,
  Plate,
  PlateContent,
  usePlateEditor,
} from 'platejs/react';
import config from '@plone/registry';
import { PLONE_BLOCK_TYPE } from '@plone/helpers';
import type { FormWidgetProps } from '@plone/types';
import { BlockSelectionPlugin } from '@plone/plate/components/editor';
import { BlockPolicyPlugin } from '@plone/plate/components/editor/plugins/block-policy';
import { SidebarPlugin } from './SidebarPlugin';

vi.mock('@plone/quanta', () => ({
  Accordion: ({ children }: any) => <section>{children}</section>,
  AccordionItem: ({ children }: any) => <div>{children}</div>,
  AccordionPanel: ({ children }: any) => <div>{children}</div>,
  AccordionItemTrigger: ({ children }: any) => <h3>{children}</h3>,
}));

const InputWidget = ({ label, value, onChange }: FormWidgetProps<string>) => (
  <label>
    {label}
    <input
      aria-label={label}
      value={value ?? ''}
      onChange={(event) => onChange(event.target.value)}
    />
  </label>
);

// A Plone block is a void element; the adapter's rendering is irrelevant here.
const PloneBlockStubPlugin = createPlatePlugin({
  key: PLONE_BLOCK_TYPE,
  node: { isElement: true, isVoid: true },
});

const imageSchema = {
  fieldsets: [{ id: 'default', title: 'Default', fields: ['alt'] }],
  properties: { alt: { title: 'Alt text' } },
  required: [],
};

const teaserSchema = {
  fieldsets: [
    { id: 'default', title: 'Default', fields: ['headline', 'href'] },
  ],
  properties: { headline: { title: 'Headline' }, href: { title: 'Link' } },
  required: [],
};

beforeAll(() => {
  config.registerDefaultWidget(InputWidget);
  (config as any).blocks = {
    ...(config as any).blocks,
    blocksConfig: {
      ...(config as any).blocks?.blocksConfig,
      image: { id: 'image', blockSchema: imageSchema },
      teaser: {
        id: 'teaser',
        blockSchema: ({ formData }: { formData: Record<string, unknown> }) =>
          formData ? teaserSchema : teaserSchema,
      },
    },
  };
});

let sidebar: HTMLElement;
beforeEach(() => {
  sidebar = document.createElement('div');
  sidebar.id = 'sidebar';
  document.body.appendChild(sidebar);
});
afterEach(() => {
  sidebar.remove();
});

const image = (id: string, alt = '') => ({
  type: PLONE_BLOCK_TYPE,
  id,
  '@type': 'image',
  alt,
  children: [{ text: '' }],
});

const nestedValue = () => [
  {
    type: 'column_group',
    id: 'group',
    children: [
      {
        type: 'column',
        id: 'col-1',
        width: '50%',
        children: [image('nested-img')],
      },
      {
        type: 'column',
        id: 'col-2',
        width: '50%',
        children: [{ type: 'p', id: 'para', children: [{ text: 'hello' }] }],
      },
    ],
  },
  image('top-img'),
];

let editorRef: any = null;

function Editor({ value, plugins = [] }: { value: any[]; plugins?: any[] }) {
  const editor = usePlateEditor({
    plugins: [
      PloneBlockStubPlugin,
      BlockSelectionPlugin,
      SidebarPlugin,
      ...plugins,
    ],
    value,
  });
  editorRef = editor;
  return (
    <Plate editor={editor}>
      <PlateContent />
    </Plate>
  );
}

const selectIn = (path: number[]) =>
  act(() => {
    editorRef.tf.select({ path, offset: 0 });
  });

const blockSelect = (id: string) =>
  act(() => {
    editorRef.getApi(BlockSelectionPlugin).blockSelection.set(id);
  });

// Moves the caret with a raw operation: `tf.select` would clear the block
// selection (BlockSelectionPlugin overrides `setSelection`), and the sidebar
// only re-resolves on an editor change.
const moveCaretTo = (path: number[]) =>
  act(() => {
    editorRef.apply({
      type: 'set_selection',
      properties: editorRef.selection,
      newProperties: {
        anchor: { path, offset: 0 },
        focus: { path, offset: 0 },
      },
    });
  });

// The form renders a tick after the editor change; let it, before asserting
// that nothing rendered.
const settle = () =>
  act(() => new Promise((resolve) => setTimeout(resolve, 50)));

describe('SidebarPlugin', () => {
  it('shows the settings of an image nested in a column group', async () => {
    render(<Editor value={nestedValue()} />);
    // column_group > column > image > text
    selectIn([0, 0, 0, 0]);

    expect(sidebar).toContainElement(await screen.findByLabelText('Alt text'));
  });

  it('writes an edit to the nested image node, not to the group', async () => {
    render(<Editor value={nestedValue()} />);
    selectIn([0, 0, 0, 0]);

    fireEvent.change(await screen.findByLabelText('Alt text'), {
      target: { value: 'A hero' },
    });

    const group = editorRef.children[0];
    expect(group.children[0].children[0].alt).toBe('A hero');
    expect(group.alt).toBeUndefined();
    expect(group.children[0].alt).toBeUndefined();
    expect(editorRef.children[1].alt).toBe('');
  });

  it('still shows the settings of a top-level image', async () => {
    render(<Editor value={nestedValue()} />);
    selectIn([1, 0]);

    fireEvent.change(await screen.findByLabelText('Alt text'), {
      target: { value: 'Top' },
    });

    expect(editorRef.children[1].alt).toBe('Top');
    expect(editorRef.children[0].children[0].children[0].alt).toBe('');
  });

  it('shows nothing for text inside a column that is not a Plone block', async () => {
    render(<Editor value={nestedValue()} />);
    selectIn([0, 1, 0, 0]);
    await settle();

    expect(screen.queryByLabelText('Alt text')).toBeNull();
    expect(sidebar).toBeEmptyDOMElement();
  });

  it('shows nothing when the column group itself is block-selected', async () => {
    render(<Editor value={nestedValue()} />);
    // The group is what is selected; the caret is left in its nested image.
    blockSelect('group');
    moveCaretTo([0, 0, 0, 0]);
    await settle();

    expect(screen.queryByLabelText('Alt text')).toBeNull();
    expect(sidebar).toBeEmptyDOMElement();
  });

  it('shows the settings of a block-selected nested image', async () => {
    render(<Editor value={nestedValue()} />);
    blockSelect('nested-img');
    moveCaretTo([0, 1, 0, 0]);

    fireEvent.change(await screen.findByLabelText('Alt text'), {
      target: { value: 'Picked' },
    });

    expect(editorRef.children[0].children[0].children[0].alt).toBe('Picked');
    expect(editorRef.children[0].alt).toBeUndefined();
  });

  describe('with a block policy', () => {
    const teaser = (id: string) => ({
      type: PLONE_BLOCK_TYPE,
      id,
      '@type': 'teaser',
      headline: 'Hello',
      href: '/a',
      children: [{ text: '' }],
    });

    /** Keeps only `headline` on the block called `locked`. */
    const narrowLocked = (schema: any, { node }: { node: any }) => {
      if (node.id !== 'locked') return schema;
      const resolve = (resolved: any) => ({
        ...resolved,
        fieldsets: resolved.fieldsets.map((fieldset: any) => ({
          ...fieldset,
          fields: fieldset.fields.filter((f: string) => f === 'headline'),
        })),
        properties: { headline: resolved.properties.headline },
      });
      return typeof schema === 'function'
        ? (args: any) => resolve(schema(args))
        : resolve(schema);
    };

    it('shows the whole schema when the policy is registered with its defaults', async () => {
      render(
        <Editor value={[teaser('locked')]} plugins={[BlockPolicyPlugin]} />,
      );
      selectIn([0, 0]);

      expect(await screen.findByLabelText('Headline')).toBeInTheDocument();
      expect(screen.getByLabelText('Link')).toBeInTheDocument();
    });

    it('shows the fields the filter keeps for this block instance', async () => {
      render(
        <Editor
          value={[teaser('locked'), teaser('free')]}
          plugins={[
            BlockPolicyPlugin.configure({
              options: { filterSchema: narrowLocked as any },
            }),
          ]}
        />,
      );
      selectIn([0, 0]);

      expect(await screen.findByLabelText('Headline')).toBeInTheDocument();
      expect(screen.queryByLabelText('Link')).toBeNull();
    });

    it('leaves another instance of the same block type alone', async () => {
      render(
        <Editor
          value={[teaser('locked'), teaser('free')]}
          plugins={[
            BlockPolicyPlugin.configure({
              options: { filterSchema: narrowLocked as any },
            }),
          ]}
        />,
      );
      selectIn([1, 0]);

      expect(await screen.findByLabelText('Link')).toBeInTheDocument();
    });

    it('passes the filter the block node with its id and path', async () => {
      const filterSchema = vi.fn((schema: any) => schema);
      render(
        <Editor
          value={nestedValue()}
          plugins={[
            BlockPolicyPlugin.configure({
              options: { filterSchema: filterSchema as any },
            }),
          ]}
        />,
      );
      selectIn([0, 0, 0, 0]);
      await screen.findByLabelText('Alt text');

      expect(filterSchema).toHaveBeenCalledWith(
        imageSchema,
        expect.objectContaining({
          node: expect.objectContaining({ id: 'nested-img' }),
          path: [0, 0, 0],
        }),
      );
    });

    it('shows no form when the filter returns null', async () => {
      render(
        <Editor
          value={nestedValue()}
          plugins={[
            BlockPolicyPlugin.configure({
              options: { filterSchema: (() => null) as any },
            }),
          ]}
        />,
      );
      selectIn([1, 0]);
      await settle();

      expect(screen.queryByLabelText('Alt text')).toBeNull();
      expect(sidebar).toBeEmptyDOMElement();
    });

    it('applies a filter set while the form is open', async () => {
      render(
        <Editor value={[teaser('locked')]} plugins={[BlockPolicyPlugin]} />,
      );
      selectIn([0, 0]);
      expect(await screen.findByLabelText('Link')).toBeInTheDocument();

      act(() => {
        editorRef.setOption(BlockPolicyPlugin, 'filterSchema', narrowLocked);
      });
      await settle();

      expect(screen.getByLabelText('Headline')).toBeInTheDocument();
      expect(screen.queryByLabelText('Link')).toBeNull();
    });
  });
});
