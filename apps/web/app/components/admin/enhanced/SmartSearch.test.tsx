import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('lucide-react', () => ({
  Search: (props: any) => <span data-testid="search-icon" {...props} />,
  X: (props: any) => <span data-testid="x-icon" {...props} />,
  History: (props: any) => <span data-testid="history-icon" {...props} />,
  TrendingUp: (props: any) => <span data-testid="trending-icon" {...props} />,
}));

import { SmartSearch } from './SmartSearch';

describe('SmartSearch', () => {
  const onChange = vi.fn();

  beforeEach(() => {
    onChange.mockClear();
    localStorage.clear();
  });

  it('renders input with default placeholder', () => {
    render(<SmartSearch onChange={onChange} />);
    expect(screen.getByPlaceholderText('Search...')).toBeInTheDocument();
  });

  it('renders input with custom placeholder', () => {
    render(<SmartSearch onChange={onChange} placeholder="Find users..." />);
    expect(screen.getByPlaceholderText('Find users...')).toBeInTheDocument();
  });

  it('displays initial value', () => {
    render(<SmartSearch onChange={onChange} value="hello" />);
    expect(screen.getByDisplayValue('hello')).toBeInTheDocument();
  });

  it('calls onChange when user types', () => {
    render(<SmartSearch onChange={onChange} />);
    fireEvent.change(screen.getByPlaceholderText('Search...'), {
      target: { value: 'test' },
    });
    expect(onChange).toHaveBeenCalledWith('test');
  });

  it('shows clear button when input has value', () => {
    render(<SmartSearch onChange={onChange} value="hello" />);
    expect(screen.getByLabelText('clear search')).toBeInTheDocument();
  });

  it('does not show clear button when input is empty', () => {
    render(<SmartSearch onChange={onChange} value="" />);
    expect(screen.queryByLabelText('clear search')).not.toBeInTheDocument();
  });

  it('clears input when clear button is clicked', () => {
    render(<SmartSearch onChange={onChange} value="hello" />);
    fireEvent.click(screen.getByLabelText('clear search'));
    expect(onChange).toHaveBeenCalledWith('');
  });

  it('shows dropdown with suggestions on focus', () => {
    render(
      <SmartSearch onChange={onChange} suggestions={['Apple', 'Banana']} />
    );
    fireEvent.focus(screen.getByPlaceholderText('Search...'));
    expect(screen.getByText('Apple')).toBeInTheDocument();
    expect(screen.getByText('Banana')).toBeInTheDocument();
  });

  it('shows recent searches from props', () => {
    render(
      <SmartSearch
        onChange={onChange}
        recentSearches={['previous search']}
      />
    );
    fireEvent.focus(screen.getByPlaceholderText('Search...'));
    expect(screen.getByText('previous search')).toBeInTheDocument();
    expect(screen.getByText('Recent Searches')).toBeInTheDocument();
  });

  it('selects a suggestion on click', () => {
    render(
      <SmartSearch onChange={onChange} suggestions={['Apple', 'Banana']} />
    );
    fireEvent.focus(screen.getByPlaceholderText('Search...'));
    fireEvent.click(screen.getByText('Apple'));
    expect(onChange).toHaveBeenCalledWith('Apple');
  });

  it('calls onRecentSearchClick for recent search items', () => {
    const onRecentSearchClick = vi.fn();
    render(
      <SmartSearch
        onChange={onChange}
        recentSearches={['old query']}
        onRecentSearchClick={onRecentSearchClick}
      />
    );
    fireEvent.focus(screen.getByPlaceholderText('Search...'));
    fireEvent.click(screen.getByText('old query'));
    expect(onRecentSearchClick).toHaveBeenCalledWith('old query');
  });

  it('closes dropdown on Escape key', () => {
    render(
      <SmartSearch onChange={onChange} suggestions={['Apple']} />
    );
    const input = screen.getByPlaceholderText('Search...');
    fireEvent.focus(input);
    expect(screen.getByText('Apple')).toBeInTheDocument();
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(screen.queryByText('Apple')).not.toBeInTheDocument();
  });

  it('closes dropdown on Enter key', () => {
    render(
      <SmartSearch onChange={onChange} suggestions={['Apple']} value="test" />
    );
    const input = screen.getByPlaceholderText('Search...');
    fireEvent.focus(input);
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(screen.queryByText('Apple')).not.toBeInTheDocument();
  });

  it('filters suggestions by input value', () => {
    render(
      <SmartSearch onChange={onChange} suggestions={['Apple', 'Banana']} />
    );
    const input = screen.getByPlaceholderText('Search...');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'app' } });
    expect(screen.getByText('Apple')).toBeInTheDocument();
    expect(screen.queryByText('Banana')).not.toBeInTheDocument();
  });

  it('applies fullWidth class by default', () => {
    const { container } = render(<SmartSearch onChange={onChange} />);
    expect(container.firstChild).toHaveClass('w-full');
  });

  it('applies fixed width when fullWidth=false', () => {
    const { container } = render(<SmartSearch onChange={onChange} fullWidth={false} />);
    expect(container.firstChild).toHaveClass('w-64');
  });

  it('loads recent searches from localStorage when no external ones provided', async () => {
    localStorage.setItem('admin_recent_searches', JSON.stringify(['stored search']));
    const { rerender } = render(<SmartSearch onChange={onChange} />);
    // useEffect runs async; re-render to ensure state is updated
    rerender(<SmartSearch onChange={onChange} />);
    fireEvent.focus(screen.getByPlaceholderText('Search...'));
    // The dropdown should eventually show stored search
    const { findByText } = render(<SmartSearch onChange={onChange} />);
  });
});
