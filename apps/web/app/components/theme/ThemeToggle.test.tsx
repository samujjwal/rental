import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ThemeToggle, ThemeSelector, useTheme, ThemeProvider } from './ThemeToggle';

// Mock matchMedia
const mockMatchMedia = vi.fn();
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: mockMatchMedia,
});

// Mock localStorage
const mockLocalStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
});

// Mock document.documentElement
const mockClassList = {
  remove: vi.fn(),
  add: vi.fn(),
};
Object.defineProperty(document, 'documentElement', {
  value: { classList: mockClassList },
});

describe('useTheme', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMatchMedia.mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });
  });

  it('returns default theme as system', () => {
    mockLocalStorage.getItem.mockReturnValue(null);

    const TestComponent = () => {
      const { theme } = useTheme();
      return <div data-testid="theme">{theme}</div>;
    };

    render(<TestComponent />);
    expect(screen.getByTestId('theme').textContent).toBe('system');
  });

  it('reads theme from localStorage', () => {
    mockLocalStorage.getItem.mockReturnValue('dark');

    const TestComponent = () => {
      const { theme } = useTheme();
      return <div data-testid="theme">{theme}</div>;
    };

    render(<TestComponent />);
    // After mount, it should read from localStorage
    waitFor(() => {
      expect(screen.getByTestId('theme').textContent).toBe('dark');
    });
  });

  it('saves theme to localStorage when setTheme is called', () => {
    mockLocalStorage.getItem.mockReturnValue(null);

    const TestComponent = () => {
      const { theme, setTheme } = useTheme();
      return (
        <div>
          <div data-testid="theme">{theme}</div>
          <button onClick={() => setTheme('dark')}>Set Dark</button>
        </div>
      );
    };

    render(<TestComponent />);
    fireEvent.click(screen.getByText('Set Dark'));

    expect(mockLocalStorage.setItem).toHaveBeenCalledWith('theme-preference', 'dark');
  });

  it('toggles theme between light and dark', () => {
    mockLocalStorage.getItem.mockReturnValue('light');

    const TestComponent = () => {
      const { theme, toggleTheme } = useTheme();
      return (
        <div>
          <div data-testid="theme">{theme}</div>
          <button onClick={toggleTheme}>Toggle</button>
        </div>
      );
    };

    render(<TestComponent />);
    fireEvent.click(screen.getByText('Toggle'));

    expect(mockLocalStorage.setItem).toHaveBeenCalledWith('theme-preference', 'dark');
  });

  it('detects dark mode correctly', () => {
    mockLocalStorage.getItem.mockReturnValue('dark');
    mockMatchMedia.mockReturnValue({
      matches: true, // prefers dark mode
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });

    const TestComponent = () => {
      const { isDark } = useTheme();
      return <div data-testid="is-dark">{isDark ? 'true' : 'false'}</div>;
    };

    render(<TestComponent />);
    waitFor(() => {
      expect(screen.getByTestId('is-dark').textContent).toBe('true');
    });
  });

  it('applies theme class to document element', () => {
    mockLocalStorage.getItem.mockReturnValue('dark');

    const TestComponent = () => {
      useTheme();
      return <div>Test</div>;
    };

    render(<TestComponent />);

    waitFor(() => {
      expect(mockClassList.remove).toHaveBeenCalledWith('light', 'dark');
      expect(mockClassList.add).toHaveBeenCalledWith('dark');
    });
  });

  it('listens for system theme changes when theme is system', () => {
    mockLocalStorage.getItem.mockReturnValue('system');
    const addEventListener = vi.fn();

    mockMatchMedia.mockReturnValue({
      matches: false,
      addEventListener,
      removeEventListener: vi.fn(),
    });

    const TestComponent = () => {
      useTheme();
      return <div>Test</div>;
    };

    render(<TestComponent />);

    expect(addEventListener).toHaveBeenCalledWith('change', expect.any(Function));
  });
});

describe('ThemeToggle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLocalStorage.getItem.mockReturnValue(null);
    mockMatchMedia.mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });
  });

  it('renders without crashing', () => {
    render(<ThemeToggle />);
    expect(screen.getByRole('switch')).toBeInTheDocument();
  });

  it('has correct aria-label', () => {
    render(<ThemeToggle />);
    const toggle = screen.getByRole('switch');
    expect(toggle).toHaveAttribute('aria-label');
  });

  it('renders all sizes', () => {
    const sizes = ['sm', 'md', 'lg'] as const;

    sizes.forEach((size) => {
      const { container } = render(<ThemeToggle size={size} />);
      expect(container.firstChild).toBeInTheDocument();
    });
  });

  it('calls toggleTheme when clicked', () => {
    render(<ThemeToggle />);
    const toggle = screen.getByRole('switch');

    fireEvent.click(toggle);

    // Should have called localStorage.setItem
    expect(mockLocalStorage.setItem).toHaveBeenCalled();
  });

  it('shows skeleton when not mounted', () => {
    // First render shows skeleton
    const { container } = render(<ThemeToggle />);
    expect(container.firstChild).toHaveClass('rounded-full');
  });
});

describe('ThemeSelector', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLocalStorage.getItem.mockReturnValue(null);
    mockMatchMedia.mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });
  });

  it('renders three theme options', () => {
    render(<ThemeSelector />);
    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(3);
  });

  it('has correct aria-label', () => {
    render(<ThemeSelector />);
    expect(screen.getByRole('radiogroup')).toHaveAttribute('aria-label', 'Theme selection');
  });

  it('shows skeleton when not mounted', () => {
    const { container } = render(<ThemeSelector />);
    // Should render skeleton placeholder
    expect(container.firstChild).toHaveClass('rounded-lg');
  });

  it('changes theme when option is clicked', () => {
    render(<ThemeSelector />);
    const darkRadio = screen.getAllByRole('radio')[1]; // Dark option

    fireEvent.click(darkRadio);

    expect(mockLocalStorage.setItem).toHaveBeenCalledWith('theme-preference', 'dark');
  });
});

describe('ThemeProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders children', () => {
    render(
      <ThemeProvider>
        <div data-testid="child">Child Content</div>
      </ThemeProvider>
    );
    expect(screen.getByTestId('child')).toBeInTheDocument();
  });

  it('applies initial theme on mount', () => {
    mockLocalStorage.getItem.mockReturnValue('light');

    render(<ThemeProvider><div /></ThemeProvider>);

    expect(mockClassList.remove).toHaveBeenCalledWith('light', 'dark');
    expect(mockClassList.add).toHaveBeenCalledWith('light');
  });

  it('uses defaultTheme when no stored preference', () => {
    mockLocalStorage.getItem.mockReturnValue(null);

    render(<ThemeProvider defaultTheme="dark"><div /></ThemeProvider>);

    expect(mockClassList.add).toHaveBeenCalledWith('dark');
  });
});
