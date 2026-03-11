import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('lucide-react', () => ({
  List: (props: any) => <span data-testid="list-icon" {...props} />,
  LayoutGrid: (props: any) => <span data-testid="grid-icon" {...props} />,
  Table2: (props: any) => <span data-testid="table-icon" {...props} />,
  Eye: (props: any) => <span data-testid="eye-icon" {...props} />,
  Pencil: (props: any) => <span data-testid="pencil-icon" {...props} />,
  Trash2: (props: any) => <span data-testid="trash-icon" {...props} />,
}));

import { ViewModeToggle, CardView, ListView } from './DataViews';

const columns = [
  { id: 'name', accessorKey: 'name', header: 'Name' },
  { id: 'email', accessorKey: 'email', header: 'Email' },
  { id: 'status', accessorKey: 'status', header: 'Status' },
];

const data = [
  { id: '1', name: 'Alice', email: 'alice@test.com', status: 'active' },
  { id: '2', name: 'Bob', email: 'bob@test.com', status: 'inactive' },
];

describe('ViewModeToggle', () => {
  it('renders all three mode buttons by default', () => {
    const onChange = vi.fn();
    render(<ViewModeToggle value="table" onChange={onChange} />);
    expect(screen.getByLabelText('Table View')).toBeInTheDocument();
    expect(screen.getByLabelText('Card View')).toBeInTheDocument();
    expect(screen.getByLabelText('List View')).toBeInTheDocument();
  });

  it('marks active mode with aria-pressed=true', () => {
    render(<ViewModeToggle value="cards" onChange={vi.fn()} />);
    expect(screen.getByLabelText('Card View')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByLabelText('Table View')).toHaveAttribute('aria-pressed', 'false');
  });

  it('calls onChange when a mode button is clicked', () => {
    const onChange = vi.fn();
    render(<ViewModeToggle value="table" onChange={onChange} />);
    fireEvent.click(screen.getByLabelText('List View'));
    expect(onChange).toHaveBeenCalledWith('list');
  });

  it('filters available modes', () => {
    render(
      <ViewModeToggle value="table" onChange={vi.fn()} availableModes={['table', 'list']} />
    );
    expect(screen.getByLabelText('Table View')).toBeInTheDocument();
    expect(screen.getByLabelText('List View')).toBeInTheDocument();
    expect(screen.queryByLabelText('Card View')).not.toBeInTheDocument();
  });

  it('has role="group" with aria-label', () => {
    const { container } = render(<ViewModeToggle value="table" onChange={vi.fn()} />);
    expect(container.querySelector('[role="group"]')).toHaveAttribute('aria-label', 'view mode');
  });
});

describe('CardView', () => {
  it('renders a card for each data row', () => {
    render(<CardView data={data} columns={columns} viewMode="cards" />);
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
  });

  it('displays secondary field values', () => {
    render(<CardView data={data} columns={columns} viewMode="cards" />);
    expect(screen.getByText('alice@test.com')).toBeInTheDocument();
  });

  it('calls onRowClick when a card is clicked', () => {
    const onRowClick = vi.fn();
    render(<CardView data={data} columns={columns} viewMode="cards" onRowClick={onRowClick} />);
    fireEvent.click(screen.getByText('Alice'));
    expect(onRowClick).toHaveBeenCalledWith(data[0]);
  });

  it('renders view button when onRowView is provided', () => {
    const onRowView = vi.fn();
    render(<CardView data={data} columns={columns} viewMode="cards" onRowView={onRowView} />);
    const viewBtns = screen.getAllByLabelText('view');
    expect(viewBtns).toHaveLength(2);
    fireEvent.click(viewBtns[0]);
    expect(onRowView).toHaveBeenCalledWith(data[0]);
  });

  it('renders edit button when onRowEdit is provided', () => {
    const onRowEdit = vi.fn();
    render(<CardView data={data} columns={columns} viewMode="cards" onRowEdit={onRowEdit} />);
    const editBtns = screen.getAllByLabelText('edit');
    fireEvent.click(editBtns[1]);
    expect(onRowEdit).toHaveBeenCalledWith(data[1]);
  });

  it('renders delete button when onRowDelete is provided', () => {
    const onRowDelete = vi.fn();
    render(<CardView data={data} columns={columns} viewMode="cards" onRowDelete={onRowDelete} />);
    const delBtns = screen.getAllByLabelText('delete');
    fireEvent.click(delBtns[0]);
    expect(onRowDelete).toHaveBeenCalledWith(data[0]);
  });

  it('displays boolean values as Yes/No', () => {
    const boolData = [{ id: '1', name: 'Test', active: true }];
    const boolCols = [
      { id: 'name', accessorKey: 'name', header: 'Name' },
      { id: 'active', accessorKey: 'active', header: 'Active' },
    ];
    render(<CardView data={boolData} columns={boolCols} viewMode="cards" />);
    expect(screen.getByText('Yes')).toBeInTheDocument();
  });

  it('displays null/undefined as dash', () => {
    const nullData = [{ id: '1', name: 'Test', email: null }];
    render(<CardView data={nullData} columns={columns} viewMode="cards" />);
    const dashes = screen.getAllByText('-');
    expect(dashes.length).toBeGreaterThanOrEqual(1);
  });
});

describe('ListView', () => {
  it('renders a list item for each data row', () => {
    render(<ListView data={data} columns={columns} viewMode="list" />);
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
  });

  it('shows avatar initial', () => {
    render(<ListView data={data} columns={columns} viewMode="list" />);
    expect(screen.getByText('A')).toBeInTheDocument(); // Alice's initial
    expect(screen.getByText('B')).toBeInTheDocument(); // Bob's initial
  });

  it('shows status badge for status field', () => {
    render(<ListView data={data} columns={columns} viewMode="list" />);
    expect(screen.getByText('active')).toBeInTheDocument();
    expect(screen.getByText('inactive')).toBeInTheDocument();
  });

  it('calls onRowClick when a list item is clicked', () => {
    const onRowClick = vi.fn();
    render(<ListView data={data} columns={columns} viewMode="list" onRowClick={onRowClick} />);
    fireEvent.click(screen.getByText('Alice'));
    expect(onRowClick).toHaveBeenCalledWith(data[0]);
  });

  it('renders action buttons when handlers provided', () => {
    const onRowView = vi.fn();
    const onRowEdit = vi.fn();
    const onRowDelete = vi.fn();
    render(
      <ListView
        data={data}
        columns={columns}
        viewMode="list"
        onRowView={onRowView}
        onRowEdit={onRowEdit}
        onRowDelete={onRowDelete}
      />
    );
    expect(screen.getAllByLabelText('view')).toHaveLength(2);
    expect(screen.getAllByLabelText('edit')).toHaveLength(2);
    expect(screen.getAllByLabelText('delete')).toHaveLength(2);
  });

  it('does not render action buttons when no handlers', () => {
    render(<ListView data={data} columns={columns} viewMode="list" />);
    expect(screen.queryByLabelText('view')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('edit')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('delete')).not.toBeInTheDocument();
  });

  it('shows secondary field text', () => {
    render(<ListView data={data} columns={columns} viewMode="list" />);
    expect(screen.getByText('alice@test.com')).toBeInTheDocument();
  });
});
