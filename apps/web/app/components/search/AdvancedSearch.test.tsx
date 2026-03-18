import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import { AdvancedSearch } from '~/components/search/AdvancedSearch';

// Mock the translation hook
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, defaultValue?: string) => defaultValue || key,
  }),
}));

// Mock the listings API
vi.mock('~/lib/api/listings', () => ({
  listingsApi: {
    search: vi.fn(),
    getCategories: vi.fn(),
  },
}));

// Mock the auth store
vi.mock('~/lib/store/auth', () => ({
  useAuthStore: () => ({
    user: { id: 'user-123' },
    accessToken: 'test-token'
  }),
}));

// Mock React Router
vi.mock('react-router', () => ({
  useNavigate: () => vi.fn(),
  useSearchParams: () => [new URLSearchParams(), vi.fn()],
}));

describe('AdvancedSearch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders without crashing', () => {
    render(
      <AdvancedSearch />
    );

    // Component should render without throwing an error
    expect(document.body).toBeInTheDocument();
  });

  it('has search functionality', () => {
    render(
      <AdvancedSearch />
    );

    // Check for any input element (search input)
    const input = screen.getByRole('textbox');
    expect(input).toBeInTheDocument();
  });

  it('displays trending content', async () => {
    render(
      <AdvancedSearch />
    );

    // Should show some trending content
    const trendingTexts = screen.getAllByText(/trending/i);
    expect(trendingTexts.length).toBeGreaterThan(0);
  });
});
