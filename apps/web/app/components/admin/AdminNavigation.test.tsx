import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';

vi.mock('lucide-react', () => {
  const icon = (props: any) => <span {...props} />;
  return {
    LayoutDashboard: icon, Users: icon, Home: icon, Calendar: icon,
    MessageSquare: icon, Settings: icon, Shield: icon, FileText: icon,
    CreditCard: icon, AlertTriangle: icon, BarChart3: icon, Building: icon,
    Mail: icon, TrendingUp: icon, Package: icon, Banknote: icon,
    Zap: icon, Star: icon, Heart: icon, CheckSquare: icon,
  };
});

import { AdminNavigation } from './AdminNavigation';

const renderWithRouter = (path = '/admin') =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <AdminNavigation />
    </MemoryRouter>
  );

describe('AdminNavigation', () => {
  it('renders Admin Panel heading', () => {
    renderWithRouter();
    expect(screen.getByText('Admin Panel')).toBeInTheDocument();
  });

  it('renders aside with admin navigation aria-label', () => {
    renderWithRouter();
    expect(screen.getByRole('complementary')).toHaveAttribute('aria-label', 'Admin navigation');
  });

  it('renders nav with aria-label', () => {
    renderWithRouter();
    expect(screen.getByRole('navigation')).toHaveAttribute('aria-label', 'Main admin menu');
  });

  it('renders all category headers', () => {
    renderWithRouter();
    expect(screen.getByText('Main')).toBeInTheDocument();
    expect(screen.getByText('User Management')).toBeInTheDocument();
    expect(screen.getByText('Content Management')).toBeInTheDocument();
    expect(screen.getByText('Bookings & Payments')).toBeInTheDocument();
    expect(screen.getByText('Disputes & Moderation')).toBeInTheDocument();
    expect(screen.getByText('Insurance')).toBeInTheDocument();
    // "Notifications" appears both as category header and menu item
    const notifElements = screen.getAllByText('Notifications');
    expect(notifElements.length).toBe(2);
    // "System" appears both as category header and has System Settings menu item
    expect(screen.getByText('System')).toBeInTheDocument();
  });

  it('renders Dashboard link', () => {
    renderWithRouter();
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Dashboard').closest('a')).toHaveAttribute('href', '/admin');
  });

  it('renders Users link', () => {
    renderWithRouter();
    expect(screen.getByText('Users')).toBeInTheDocument();
    expect(screen.getByText('Users').closest('a')).toHaveAttribute('href', '/admin/entities/users');
  });

  it('renders Listings link', () => {
    renderWithRouter();
    expect(screen.getByText('Listings')).toBeInTheDocument();
  });

  it('renders Bookings link', () => {
    renderWithRouter();
    expect(screen.getByText('Bookings')).toBeInTheDocument();
  });

  it('renders Disputes link', () => {
    renderWithRouter();
    expect(screen.getByText('Disputes')).toBeInTheDocument();
  });

  it('renders System Settings and Power Operations', () => {
    renderWithRouter();
    expect(screen.getByText('System Settings')).toBeInTheDocument();
    expect(screen.getByText('Power Operations')).toBeInTheDocument();
  });

  it('highlights active link', () => {
    renderWithRouter('/admin');
    const dashboardLink = screen.getByText('Dashboard').closest('a')!;
    expect(dashboardLink.className).toContain('bg-blue-50');
    expect(dashboardLink.className).toContain('text-blue-700');
  });

  it('does not highlight inactive link', () => {
    renderWithRouter('/admin');
    const usersLink = screen.getByText('Users').closest('a')!;
    expect(usersLink.className).not.toContain('bg-blue-50');
  });

  it('highlights link for nested paths', () => {
    renderWithRouter('/admin/entities/users/123');
    const usersLink = screen.getByText('Users').closest('a')!;
    expect(usersLink.className).toContain('bg-blue-50');
  });

  it('renders footer text', () => {
    renderWithRouter();
    expect(screen.getByText('GharBatai Admin')).toBeInTheDocument();
  });

  it('renders all menu items as links', () => {
    renderWithRouter();
    const links = screen.getAllByRole('link');
    expect(links.length).toBeGreaterThanOrEqual(15);
  });
});
