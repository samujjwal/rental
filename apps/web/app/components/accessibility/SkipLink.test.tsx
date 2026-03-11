import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

import { SkipLink, SkipLinks } from './SkipLink';

describe('SkipLink', () => {
  it('renders with default label', () => {
    render(<SkipLink />);
    expect(screen.getByText('Skip to main content')).toBeInTheDocument();
  });

  it('renders with custom label', () => {
    render(<SkipLink label="Skip to navigation" />);
    expect(screen.getByText('Skip to navigation')).toBeInTheDocument();
  });

  it('links to default target id', () => {
    render(<SkipLink />);
    const link = screen.getByText('Skip to main content');
    expect(link).toHaveAttribute('href', '#main-content');
  });

  it('links to custom target id', () => {
    render(<SkipLink targetId="nav-section" />);
    const link = screen.getByText('Skip to main content');
    expect(link).toHaveAttribute('href', '#nav-section');
  });

  it('focuses target element on click', () => {
    const target = document.createElement('div');
    target.id = 'main-content';
    target.tabIndex = -1;
    target.scrollIntoView = vi.fn();
    document.body.appendChild(target);

    const focusSpy = vi.spyOn(target, 'focus');
    render(<SkipLink />);
    fireEvent.click(screen.getByText('Skip to main content'));
    expect(focusSpy).toHaveBeenCalled();

    document.body.removeChild(target);
    focusSpy.mockRestore();
  });

  it('scrolls target into view on click', () => {
    const target = document.createElement('div');
    target.id = 'scroll-target';
    const scrollSpy = vi.fn();
    target.scrollIntoView = scrollSpy;
    target.tabIndex = -1;
    document.body.appendChild(target);

    render(<SkipLink targetId="scroll-target" />);
    fireEvent.click(screen.getByText('Skip to main content'));
    expect(scrollSpy).toHaveBeenCalledWith({
      behavior: 'smooth',
      block: 'start',
    });

    document.body.removeChild(target);
  });

  it('does nothing if target element not found', () => {
    render(<SkipLink targetId="nonexistent" />);
    // Should not throw
    fireEvent.click(screen.getByText('Skip to main content'));
  });

  it('is an anchor element', () => {
    render(<SkipLink />);
    expect(screen.getByText('Skip to main content').tagName).toBe('A');
  });

  it('has sr-only class for screen reader only', () => {
    render(<SkipLink />);
    const link = screen.getByText('Skip to main content');
    expect(link.className).toContain('sr-only');
  });

  it('applies custom className', () => {
    render(<SkipLink className="extra" />);
    const link = screen.getByText('Skip to main content');
    expect(link.className).toContain('extra');
  });
});

describe('SkipLinks', () => {
  const links = [
    { targetId: 'main-content', label: 'Skip to main' },
    { targetId: 'nav', label: 'Skip to navigation' },
    { targetId: 'footer', label: 'Skip to footer' },
  ];

  it('renders all skip links', () => {
    render(<SkipLinks links={links} />);
    expect(screen.getByText('Skip to main')).toBeInTheDocument();
    expect(screen.getByText('Skip to navigation')).toBeInTheDocument();
    expect(screen.getByText('Skip to footer')).toBeInTheDocument();
  });

  it('wraps in nav with aria-label', () => {
    render(<SkipLinks links={links} />);
    expect(screen.getByRole('navigation', { name: 'Skip links' })).toBeInTheDocument();
  });

  it('renders as a list', () => {
    render(<SkipLinks links={links} />);
    const nav = screen.getByRole('navigation', { name: 'Skip links' });
    const listItems = nav.querySelectorAll('li');
    expect(listItems.length).toBe(3);
  });

  it('each link has correct href', () => {
    render(<SkipLinks links={links} />);
    expect(screen.getByText('Skip to main')).toHaveAttribute('href', '#main-content');
    expect(screen.getByText('Skip to navigation')).toHaveAttribute('href', '#nav');
    expect(screen.getByText('Skip to footer')).toHaveAttribute('href', '#footer');
  });

  it('renders empty list without errors', () => {
    render(<SkipLinks links={[]} />);
    const nav = screen.getByRole('navigation', { name: 'Skip links' });
    expect(nav.querySelectorAll('li').length).toBe(0);
  });
});
