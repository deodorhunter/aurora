import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { createRoutesStub, type ActionFunctionArgs } from 'react-router';
import { atom } from 'jotai';
import config from '@plone/registry';
import type { WidgetsConfig } from '@plone/types';
import { SOMERSAULT_KEY } from '@plone/plate/constants';
import ContentForm from './ContentForm';

// The Plate editor cannot run in jsdom. Stubbing it is also the situation
// under test: while the Content tab is selected the Blocks tab's panel, and
// with it Plate's title binding, is not mounted at all.
vi.mock('../BlockEditor/BlocksEditor', () => ({
  default: () => <div>blocks editor</div>,
}));
vi.mock('../Sidebar/Sidebar', () => ({
  default: () => null,
  sidebarAtom: atom(false),
}));
vi.mock('@plone/icons/svg/checkbox.svg?react', () => ({ default: () => null }));
vi.mock('@plone/icons/svg/close.svg?react', () => ({ default: () => null }));
vi.mock('@plone/icons/svg/settings.svg?react', () => ({ default: () => null }));
vi.mock('@plone/layout/components/Pluggable', () => ({
  Plug: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

function TextWidget(props: {
  name: string;
  label?: string;
  value?: unknown;
  onChange: (value: unknown) => void;
}) {
  return (
    <label>
      {props.label}
      <input
        name={props.name}
        value={(props.value as string) ?? ''}
        onChange={(e) => props.onChange(e.target.value)}
      />
    </label>
  );
}

beforeAll(() => {
  config.set('widgets', {} as WidgetsConfig);
  config.registerDefaultWidget(TextWidget as never);
});

afterEach(cleanup);

const schema = {
  title: 'Page',
  fieldsets: [{ id: 'default', title: 'Default', fields: ['title'] }],
  properties: { title: { title: 'Title', type: 'string' } },
  required: ['title'],
};

const somersault = (value: unknown[]) => ({
  [SOMERSAULT_KEY]: { '@type': SOMERSAULT_KEY, value },
});

function mount(blocks: Record<string, unknown>) {
  const submitted: Record<string, any>[] = [];
  const content = {
    '@id': '/a-page',
    '@type': 'Document',
    title: 'Old title',
    blocks,
    blocks_layout: { items: Object.keys(blocks) },
  };
  const Stub = createRoutesStub([
    {
      path: '/@@edit/*',
      action: async ({ request }: ActionFunctionArgs) => {
        submitted.push(await request.json());
        return null;
      },
      Component: () => (
        <ContentForm
          content={content as never}
          path="/a-page"
          schema={schema}
          heading="Edit"
          submitMethod="patch"
        />
      ),
    },
  ]);
  render(<Stub initialEntries={['/@@edit/a-page']} />);
  return submitted;
}

async function saveTitleFromContentTab(title: string) {
  fireEvent.click(await screen.findByRole('tab', { name: /content/i }));
  const field = await screen.findByRole('textbox', { name: /title/i });
  expect(screen.queryByText('blocks editor')).toBeNull();
  fireEvent.change(field, { target: { value: title } });
  fireEvent.click(screen.getByRole('button', { name: /save/i }));
}

const titleNode = {
  type: 'title',
  id: 't1',
  blockWidth: 'default',
  children: [{ text: 'Old title' }],
};
const paragraph = { type: 'p', id: 'p1', children: [{ text: 'Body' }] };

describe('ContentForm: the title edited on the Content tab', () => {
  it('is written into the title block of the saved blocks', async () => {
    const submitted = mount(somersault([titleNode, paragraph]));

    await saveTitleFromContentTab('New title');

    await waitFor(() => expect(submitted).toHaveLength(1));
    const [values] = submitted;
    expect(values.title).toBe('New title');
    expect(values.blocks[SOMERSAULT_KEY].value).toEqual([
      // Only the text changes: the node keeps its id and its other props.
      { ...titleNode, children: [{ text: 'New title' }] },
      paragraph,
    ]);
  });

  it('leaves blocks without a root title block as they are', async () => {
    const blocks = somersault([paragraph]);
    const submitted = mount(blocks);

    await saveTitleFromContentTab('New title');

    await waitFor(() => expect(submitted).toHaveLength(1));
    expect(submitted[0].blocks).toEqual(blocks);
  });
});
