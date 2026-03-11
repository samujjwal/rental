import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

vi.mock('sonner', () => ({
  Toaster: (props: Record<string, unknown>) => (
    <div
      data-testid="toaster"
      data-position={props.position}
      data-expand={String(props.expand)}
      data-rich-colors={String(props.richColors)}
      data-close-button={String(props.closeButton)}
      data-duration={props.duration}
    />
  ),
}));

import { ToastManager } from './toast-manager';

describe('ToastManager', () => {
  it('renders without crashing', () => {
    render(<ToastManager />);
    expect(screen.getByTestId('toaster')).toBeInTheDocument();
  });

  it('sets position to top-right', () => {
    render(<ToastManager />);
    expect(screen.getByTestId('toaster')).toHaveAttribute('data-position', 'top-right');
  });

  it('sets expand to false', () => {
    render(<ToastManager />);
    expect(screen.getByTestId('toaster')).toHaveAttribute('data-expand', 'false');
  });

  it('enables rich colors', () => {
    render(<ToastManager />);
    expect(screen.getByTestId('toaster')).toHaveAttribute('data-rich-colors', 'true');
  });

  it('enables close button', () => {
    render(<ToastManager />);
    expect(screen.getByTestId('toaster')).toHaveAttribute('data-close-button', 'true');
  });

  it('sets duration to 4000ms', () => {
    render(<ToastManager />);
    expect(screen.getByTestId('toaster')).toHaveAttribute('data-duration', '4000');
  });
});
