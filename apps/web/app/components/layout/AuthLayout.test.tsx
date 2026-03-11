import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MemoryRouter } from 'react-router';

vi.mock('react-router', async () => {
  const actual = await vi.importActual<typeof import('react-router')>('react-router');
  return {
    ...actual,
    Outlet: () => <div data-testid="outlet">Auth Form Content</div>,
  };
});

import { AuthLayout } from './AuthLayout';

function renderAuthLayout() {
  return render(
    <MemoryRouter>
      <AuthLayout />
    </MemoryRouter>
  );
}

describe('AuthLayout', () => {
  it('renders GharBatai logo link to home', () => {
    renderAuthLayout();
    const logo = screen.getByText('GharBatai');
    expect(logo).toBeInTheDocument();
    expect(logo.closest('a')).toHaveAttribute('href', '/');
  });

  it('renders Outlet for nested auth routes', () => {
    renderAuthLayout();
    expect(screen.getByTestId('outlet')).toBeInTheDocument();
  });

  it('renders Terms link', () => {
    renderAuthLayout();
    const termsLink = screen.getByText('Terms');
    expect(termsLink.closest('a')).toHaveAttribute('href', '/terms');
  });

  it('renders Privacy link', () => {
    renderAuthLayout();
    const privacyLink = screen.getByText('Privacy');
    expect(privacyLink.closest('a')).toHaveAttribute('href', '/privacy');
  });

  it('renders copyright year', () => {
    renderAuthLayout();
    const year = new Date().getFullYear().toString();
    expect(screen.getByText(new RegExp(year))).toBeInTheDocument();
  });

  it('has full height layout', () => {
    const { container } = renderAuthLayout();
    expect(container.firstChild).toHaveClass('min-h-screen');
  });

  it('has muted background', () => {
    const { container } = renderAuthLayout();
    expect(container.firstChild).toHaveClass('bg-muted');
  });

  it('contains header, main, and footer sections', () => {
    const { container } = renderAuthLayout();
    expect(container.querySelector('header')).toBeInTheDocument();
    expect(container.querySelector('main')).toBeInTheDocument();
    expect(container.querySelector('footer')).toBeInTheDocument();
  });

  it('constrains content width in main area', () => {
    const { container } = renderAuthLayout();
    const contentWrapper = container.querySelector('.max-w-md');
    expect(contentWrapper).toBeInTheDocument();
  });
});
