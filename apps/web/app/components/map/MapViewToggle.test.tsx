import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

vi.mock('lucide-react', () => ({
  Map: (props: Record<string, unknown>) => <svg data-testid="map-icon" {...props} />,
  List: (props: Record<string, unknown>) => <svg data-testid="list-icon" {...props} />,
}));

import { MapViewToggle } from './MapViewToggle';

describe('MapViewToggle', () => {
  it('renders list and map buttons', () => {
    render(<MapViewToggle view="list" onViewChange={vi.fn()} />);
    expect(screen.getByText('List')).toBeInTheDocument();
    expect(screen.getByText('Map')).toBeInTheDocument();
  });

  it('renders list and map icons', () => {
    render(<MapViewToggle view="list" onViewChange={vi.fn()} />);
    expect(screen.getByTestId('list-icon')).toBeInTheDocument();
    expect(screen.getByTestId('map-icon')).toBeInTheDocument();
  });

  it('highlights list button when view is "list"', () => {
    render(<MapViewToggle view="list" onViewChange={vi.fn()} />);
    const listBtn = screen.getByText('List').closest('button');
    expect(listBtn!.className).toContain('bg-blue-600');
  });

  it('highlights map button when view is "map"', () => {
    render(<MapViewToggle view="map" onViewChange={vi.fn()} />);
    const mapBtn = screen.getByText('Map').closest('button');
    expect(mapBtn!.className).toContain('bg-blue-600');
  });

  it('does not highlight map button when view is "list"', () => {
    render(<MapViewToggle view="list" onViewChange={vi.fn()} />);
    const mapBtn = screen.getByText('Map').closest('button');
    expect(mapBtn!.className).not.toContain('bg-blue-600');
  });

  it('calls onViewChange with "list" when list clicked', () => {
    const onViewChange = vi.fn();
    render(<MapViewToggle view="map" onViewChange={onViewChange} />);
    fireEvent.click(screen.getByText('List'));
    expect(onViewChange).toHaveBeenCalledWith('list');
  });

  it('calls onViewChange with "map" when map clicked', () => {
    const onViewChange = vi.fn();
    render(<MapViewToggle view="list" onViewChange={onViewChange} />);
    fireEvent.click(screen.getByText('Map'));
    expect(onViewChange).toHaveBeenCalledWith('map');
  });

  it('applies custom className', () => {
    const { container } = render(
      <MapViewToggle view="list" onViewChange={vi.fn()} className="mt-4" />
    );
    expect(container.firstChild).toHaveClass('mt-4');
  });

  it('buttons are type="button"', () => {
    render(<MapViewToggle view="list" onViewChange={vi.fn()} />);
    const buttons = screen.getAllByRole('button');
    buttons.forEach(btn => expect(btn).toHaveAttribute('type', 'button'));
  });
});
