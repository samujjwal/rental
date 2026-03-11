import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

vi.mock('~/lib/utils', () => ({
  cn: (...args: any[]) => args.filter(Boolean).join(' '),
}));

import { PageHeader } from './PageHeader';

describe('PageHeader', () => {
  it('renders title', () => {
    render(<PageHeader title="Dashboard" />);
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
  });

  it('renders title as h1', () => {
    render(<PageHeader title="My Page" />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('My Page');
  });

  it('renders description when provided', () => {
    render(<PageHeader title="Title" description="Some description" />);
    expect(screen.getByText('Some description')).toBeInTheDocument();
  });

  it('does not render description when not provided', () => {
    const { container } = render(<PageHeader title="Title" />);
    const paragraphs = container.querySelectorAll('p');
    expect(paragraphs).toHaveLength(0);
  });

  it('renders children in actions slot', () => {
    render(
      <PageHeader title="Title">
        <button>Create New</button>
      </PageHeader>
    );
    expect(screen.getByText('Create New')).toBeInTheDocument();
  });

  it('does not render actions slot when no children', () => {
    const { container } = render(<PageHeader title="Title" />);
    // No flex shrink-0 container for actions
    expect(container.querySelector('.shrink-0')).not.toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(
      <PageHeader title="Title" className="my-custom-class" />
    );
    expect(container.firstChild).toHaveClass('my-custom-class');
  });

  it('has default mb-8 margin', () => {
    const { container } = render(<PageHeader title="Title" />);
    expect(container.firstChild).toHaveClass('mb-8');
  });

  it('renders both description and children at same time', () => {
    render(
      <PageHeader title="Users" description="Manage users">
        <button>Add User</button>
      </PageHeader>
    );
    expect(screen.getByText('Manage users')).toBeInTheDocument();
    expect(screen.getByText('Add User')).toBeInTheDocument();
  });
});
