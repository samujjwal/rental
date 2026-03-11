import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router';

const { IconMock } = vi.hoisted(() => ({
  IconMock: (props: any) => <span data-testid="lucide-icon" {...props} />,
}));

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  Menu: IconMock,
  X: IconMock,
  LayoutDashboard: IconMock,
  Calendar: IconMock,
  Heart: IconMock,
  MessageCircle: IconMock,
  Star: IconMock,
  Settings: IconMock,
  Plus: IconMock,
  Package: IconMock,
  CalendarDays: IconMock,
  Banknote: IconMock,
  TrendingUp: IconMock,
  BarChart3: IconMock,
  Bell: IconMock,
  Building2: IconMock,
  AlertTriangle: IconMock,
}));

// Mock ThemeToggle
vi.mock('~/components/theme', () => ({
  ThemeToggle: ({ size }: any) => <div data-testid="theme-toggle" data-size={size} />,
}));

import { DashboardSidebar, type SidebarSection } from './DashboardSidebar';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const MockIcon = ((props: any) => <span data-testid="mock-icon" {...props} />) as any;

const testSections: SidebarSection[] = [
  {
    title: 'Main',
    items: [
      { href: '/dashboard', label: 'Overview', icon: MockIcon },
      { href: '/dashboard/listings', label: 'Listings', icon: MockIcon, badge: 5 },
    ],
  },
  {
    title: 'Settings',
    items: [
      { href: '/dashboard/settings', label: 'Settings', icon: MockIcon },
    ],
  },
];

function renderSidebar(pathname = '/dashboard', sections = testSections) {
  return render(
    <MemoryRouter initialEntries={[pathname]}>
      <DashboardSidebar sections={sections} />
    </MemoryRouter>
  );
}

describe('DashboardSidebar', () => {
  it('renders section titles', () => {
    renderSidebar();
    expect(screen.getByText('Main')).toBeInTheDocument();
    // "Settings" appears as both section title and nav item
    expect(screen.getAllByText('Settings').length).toBeGreaterThanOrEqual(1);
  });

  it('renders all nav items as links', () => {
    renderSidebar();
    expect(screen.getAllByText('Overview').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Listings').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Settings').length).toBeGreaterThanOrEqual(1);
  });

  it('renders badge value when provided', () => {
    renderSidebar();
    expect(screen.getAllByText('5').length).toBeGreaterThanOrEqual(1);
  });

  it('renders section without title if title is undefined', () => {
    const sections: SidebarSection[] = [
      {
        items: [{ href: '/test', label: 'No Title Section', icon: MockIcon }],
      },
    ];
    renderSidebar('/test', sections);
    expect(screen.getAllByText('No Title Section').length).toBeGreaterThanOrEqual(1);
  });

  it('highlights active link based on current pathname', () => {
    renderSidebar('/dashboard');
    // The active link should have bg-primary class
    const overviewLinks = screen.getAllByText('Overview');
    const activeLink = overviewLinks.find((el) =>
      el.closest('a')?.className.includes('bg-primary')
    );
    expect(activeLink).toBeTruthy();
  });

  it('highlights link when pathname starts with item href', () => {
    renderSidebar('/dashboard/listings/123');
    const listingsLinks = screen.getAllByText('Listings');
    const activeLink = listingsLinks.find((el) =>
      el.closest('a')?.className.includes('bg-primary')
    );
    expect(activeLink).toBeTruthy();
  });

  it('renders mobile toggle button with correct aria-label', () => {
    renderSidebar();
    expect(
      screen.getByRole('button', { name: 'Open navigation menu' })
    ).toBeInTheDocument();
  });

  it('opens mobile drawer when toggle is clicked', () => {
    renderSidebar();
    fireEvent.click(screen.getByRole('button', { name: 'Open navigation menu' }));
    expect(
      screen.getByRole('dialog', { name: 'Navigation menu' })
    ).toBeInTheDocument();
  });

  it('closes mobile drawer when close button is clicked', () => {
    renderSidebar();
    fireEvent.click(screen.getByRole('button', { name: 'Open navigation menu' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Close navigation menu' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('closes mobile drawer on Escape key', () => {
    renderSidebar();
    fireEvent.click(screen.getByRole('button', { name: 'Open navigation menu' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('closes mobile drawer when backdrop is clicked', () => {
    renderSidebar();
    fireEvent.click(screen.getByRole('button', { name: 'Open navigation menu' }));
    const backdrop = screen.getByRole('dialog').parentElement!.querySelector('[aria-hidden="true"]');
    expect(backdrop).toBeInTheDocument();
    fireEvent.click(backdrop!);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('sets body overflow to hidden when mobile drawer is open', () => {
    renderSidebar();
    fireEvent.click(screen.getByRole('button', { name: 'Open navigation menu' }));
    expect(document.body.style.overflow).toBe('hidden');
  });

  it('restores body overflow when mobile drawer closes', () => {
    renderSidebar();
    fireEvent.click(screen.getByRole('button', { name: 'Open navigation menu' }));
    expect(document.body.style.overflow).toBe('hidden');
    fireEvent.click(screen.getByRole('button', { name: 'Close navigation menu' }));
    expect(document.body.style.overflow).toBe('');
  });

  it('renders ThemeToggle', () => {
    renderSidebar();
    expect(screen.getAllByTestId('theme-toggle').length).toBeGreaterThanOrEqual(1);
  });

  it('renders separator between sections', () => {
    const { container } = renderSidebar();
    // border-b separator divs between sections
    const separators = container.querySelectorAll('.border-b');
    expect(separators.length).toBeGreaterThanOrEqual(1);
  });

  it('applies custom className', () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <DashboardSidebar sections={testSections} className="custom-class" />
      </MemoryRouter>
    );
    const aside = container.querySelector('aside.custom-class');
    expect(aside).toBeInTheDocument();
  });

  it('renders desktop sidebar as aside element', () => {
    const { container } = renderSidebar();
    const asides = container.querySelectorAll('aside');
    // Should have at least desktop aside
    expect(asides.length).toBeGreaterThanOrEqual(1);
  });
});
