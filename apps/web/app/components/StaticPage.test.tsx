import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MemoryRouter } from 'react-router';

import { StaticPage } from './StaticPage';

function renderStaticPage(props: Parameters<typeof StaticPage>[0]) {
  return render(
    <MemoryRouter>
      <StaticPage {...props} />
    </MemoryRouter>
  );
}

describe('StaticPage', () => {
  it('renders title as h1', () => {
    renderStaticPage({ title: 'About Us', description: 'Info' });
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('About Us');
  });

  it('renders description', () => {
    renderStaticPage({ title: 'Title', description: 'A description of the page' });
    expect(screen.getByText('A description of the page')).toBeInTheDocument();
  });

  it('renders "Back to home" link', () => {
    renderStaticPage({ title: 'Title', description: 'Desc' });
    const link = screen.getByText('Back to Home');
    expect(link.closest('a')).toHaveAttribute('href', '/');
  });

  it('does not render CTA when not provided', () => {
    renderStaticPage({ title: 'Title', description: 'Desc' });
    const links = screen.getAllByRole('link');
    // Only "Back to home" link
    expect(links).toHaveLength(1);
  });

  it('renders CTA link when provided', () => {
    renderStaticPage({
      title: 'Title',
      description: 'Desc',
      callToAction: { label: 'Get Started', href: '/signup' },
    });
    const cta = screen.getByText('Get Started');
    expect(cta.closest('a')).toHaveAttribute('href', '/signup');
  });

  it('has full height background', () => {
    const { container } = renderStaticPage({ title: 'T', description: 'D' });
    expect(container.firstChild).toHaveClass('min-h-screen');
  });

  it('centers content', () => {
    const { container } = renderStaticPage({ title: 'T', description: 'D' });
    expect(container.querySelector('.text-center')).toBeInTheDocument();
  });

  it('constrains content width', () => {
    const { container } = renderStaticPage({ title: 'T', description: 'D' });
    expect(container.querySelector('.max-w-2xl')).toBeInTheDocument();
  });
});
