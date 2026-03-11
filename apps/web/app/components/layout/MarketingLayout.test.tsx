import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router';

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  Menu: (props: any) => <span data-testid="icon-menu" {...props} />,
  X: (props: any) => <span data-testid="icon-x" {...props} />,
}));

// Mock ThemeToggle
vi.mock('~/components/theme', () => ({
  ThemeToggle: ({ size }: any) => <div data-testid="theme-toggle" data-size={size} />,
}));

// Mock LanguageSelector
vi.mock('~/components/language', () => ({
  LanguageSelector: ({ size }: any) => (
    <div data-testid="language-selector" data-size={size} />
  ),
}));

// Mock Outlet
vi.mock('react-router', async () => {
  const actual = await vi.importActual<typeof import('react-router')>('react-router');
  return {
    ...actual,
    Outlet: () => <div data-testid="outlet">Outlet Content</div>,
  };
});

import { MarketingLayout } from './MarketingLayout';

function renderLayout(path = '/') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <MarketingLayout />
    </MemoryRouter>
  );
}

describe('MarketingLayout', () => {
  describe('Header', () => {
    it('renders the GharBatai logo as a link to home', () => {
      renderLayout();
      const logo = screen.getByText('GharBatai');
      expect(logo).toBeInTheDocument();
      expect(logo.closest('a')).toHaveAttribute('href', '/');
    });

    it('renders desktop navigation links', () => {
      renderLayout();
      // These links appear in both desktop nav and footer
      expect(screen.getAllByText('Browse Rentals').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('How It Works').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('Become an Owner')).toBeInTheDocument();
      expect(screen.getByText('Help')).toBeInTheDocument();
    });

    it('renders Sign In and Get Started auth links', () => {
      renderLayout();
      const signInLinks = screen.getAllByText('Sign In');
      expect(signInLinks.length).toBeGreaterThanOrEqual(1);
      expect(signInLinks[0].closest('a')).toHaveAttribute('href', '/auth/login');

      const getStartedLinks = screen.getAllByText('Get Started');
      expect(getStartedLinks.length).toBeGreaterThanOrEqual(1);
      expect(getStartedLinks[0].closest('a')).toHaveAttribute('href', '/auth/signup');
    });

    it('renders LanguageSelector and ThemeToggle', () => {
      renderLayout();
      expect(screen.getByTestId('language-selector')).toBeInTheDocument();
      expect(screen.getByTestId('theme-toggle')).toBeInTheDocument();
    });

    it('has desktop nav with aria-label', () => {
      renderLayout();
      expect(screen.getByRole('navigation', { name: 'Main navigation' })).toBeInTheDocument();
    });
  });

  describe('Mobile menu', () => {
    it('renders mobile menu toggle button', () => {
      renderLayout();
      expect(screen.getByRole('button', { name: 'Open menu' })).toBeInTheDocument();
    });

    it('opens mobile menu when toggle is clicked', () => {
      renderLayout();
      fireEvent.click(screen.getByRole('button', { name: 'Open menu' }));
      expect(screen.getByRole('navigation', { name: 'Mobile navigation' })).toBeInTheDocument();
    });

    it('shows Close menu label when menu is open', () => {
      renderLayout();
      fireEvent.click(screen.getByRole('button', { name: 'Open menu' }));
      expect(screen.getByRole('button', { name: 'Close menu' })).toBeInTheDocument();
    });

    it('renders mobile nav links', () => {
      renderLayout();
      fireEvent.click(screen.getByRole('button', { name: 'Open menu' }));
      const mobileNav = screen.getByRole('navigation', { name: 'Mobile navigation' });
      expect(mobileNav).toBeInTheDocument();
      // All 4 nav links should be present in mobile menu
      expect(mobileNav.querySelectorAll('a').length).toBeGreaterThanOrEqual(4);
    });

    it('closes mobile menu when a nav link is clicked', () => {
      renderLayout();
      fireEvent.click(screen.getByRole('button', { name: 'Open menu' }));
      expect(screen.getByRole('navigation', { name: 'Mobile navigation' })).toBeInTheDocument();
      // Click a link in mobile nav
      const mobileLinks = screen.getByRole('navigation', { name: 'Mobile navigation' }).querySelectorAll('a');
      fireEvent.click(mobileLinks[0]);
      expect(screen.queryByRole('navigation', { name: 'Mobile navigation' })).not.toBeInTheDocument();
    });
  });

  describe('Main content', () => {
    it('renders the Outlet for child routes', () => {
      renderLayout();
      expect(screen.getByTestId('outlet')).toBeInTheDocument();
    });
  });

  describe('Footer', () => {
    it('renders footer section headers', () => {
      renderLayout();
      expect(screen.getByText('Product')).toBeInTheDocument();
      expect(screen.getByText('Company')).toBeInTheDocument();
      expect(screen.getByText('Owners')).toBeInTheDocument();
      expect(screen.getByText('Legal')).toBeInTheDocument();
    });

    it('renders footer links', () => {
      renderLayout();
      expect(screen.getByText('About Us')).toBeInTheDocument();
      expect(screen.getByText('Careers')).toBeInTheDocument();
      expect(screen.getByText('Terms of Service')).toBeInTheDocument();
      expect(screen.getByText('Privacy Policy')).toBeInTheDocument();
    });

    it('renders copyright notice with current year', () => {
      renderLayout();
      const year = new Date().getFullYear();
      expect(screen.getByText(new RegExp(`${year}.*GharBatai`))).toBeInTheDocument();
    });

    it('links to correct footer pages', () => {
      renderLayout();
      expect(screen.getByText('About Us').closest('a')).toHaveAttribute('href', '/about');
      expect(screen.getByText('Terms of Service').closest('a')).toHaveAttribute('href', '/terms');
      expect(screen.getByText('Owner Guide').closest('a')).toHaveAttribute('href', '/owner-guide');
    });
  });
});
