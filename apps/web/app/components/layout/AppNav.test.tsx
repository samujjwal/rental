import { render } from '@testing-library/react';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const IconStub = vi.hoisted(() => (props: Record<string, unknown>) => <svg {...props} />);
const mocks = vi.hoisted(() => ({
  useLocation: vi.fn(),
  navigate: vi.fn(),
  getUnreadNotifications: vi.fn(),
  getUnreadMessages: vi.fn(),
}));

vi.mock('react-router', () => ({
  Link: ({ children, to, ...props }: any) => <a href={to} {...props}>{children}</a>,
  useLocation: () => mocks.useLocation(),
  useNavigate: () => mocks.navigate,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string, options?: Record<string, unknown>) => {
      if (options && typeof options.count === 'number' && fallback) {
        return fallback.replace('{{count}}', String(options.count));
      }
      return fallback || _key;
    },
  }),
}));

vi.mock('lucide-react', () => ({
  Bell: IconStub,
  Building2: IconStub,
  CreditCard: IconStub,
  Heart: IconStub,
  LogOut: IconStub,
  MessageCircle: IconStub,
  Search: IconStub,
  AlertTriangle: IconStub,
  LayoutDashboard: IconStub,
  Settings: IconStub,
  Shield: IconStub,
  User: IconStub,
  ChevronDown: IconStub,
  Plus: IconStub,
  Menu: IconStub,
  X: IconStub,
  Calendar: IconStub,
  Package: IconStub,
  Star: IconStub,
  ShieldAlert: IconStub,
}));

vi.mock('~/lib/store/auth', () => ({
  useAuthStore: () => ({
    isAuthenticated: true,
    user: {
      id: 'user-1',
      role: 'renter',
      firstName: 'Sam',
      lastName: 'User',
      email: 'sam@example.com',
    },
  }),
}));

vi.mock('~/components/theme', () => ({
  ThemeToggle: () => <button type="button">theme</button>,
}));

vi.mock('~/components/language', () => ({
  LanguageSelector: () => <button type="button">lang</button>,
}));

vi.mock('~/hooks/useScrollLock', () => ({
  useScrollLock: vi.fn(),
}));

vi.mock('~/lib/api/notifications', () => ({
  notificationsApi: {
    getUnreadCount: (...args: any[]) => mocks.getUnreadNotifications(...args),
    markAllAsRead: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('~/lib/api/messaging', () => ({
  messagingApi: {
    getUnreadCount: (...args: any[]) => mocks.getUnreadMessages(...args),
  },
}));

import { AppNav } from './AppNav';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

describe('AppNav', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.useLocation.mockReturnValue({ pathname: '/dashboard/renter' });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not overlap unread polling while a request is still pending', async () => {
    vi.useFakeTimers();

    const firstNotifications = deferred<{ count: number }>();
    const firstMessages = deferred<{ count: number }>();

    mocks.getUnreadNotifications
      .mockImplementationOnce(() => firstNotifications.promise)
      .mockResolvedValue({ count: 7 });
    mocks.getUnreadMessages
      .mockImplementationOnce(() => firstMessages.promise)
      .mockResolvedValue({ count: 4 });

    render(<AppNav />);

    expect(mocks.getUnreadNotifications).toHaveBeenCalledTimes(1);
    expect(mocks.getUnreadMessages).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });

    expect(mocks.getUnreadNotifications).toHaveBeenCalledTimes(1);
    expect(mocks.getUnreadMessages).toHaveBeenCalledTimes(1);

    await act(async () => {
      firstNotifications.resolve({ count: 5 });
      firstMessages.resolve({ count: 3 });
      await Promise.all([firstNotifications.promise, firstMessages.promise]);
    });

    expect(mocks.getUnreadNotifications).toHaveBeenCalledTimes(1);
    expect(mocks.getUnreadMessages).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });

    expect(mocks.getUnreadNotifications).toHaveBeenCalledTimes(2);
    expect(mocks.getUnreadMessages).toHaveBeenCalledTimes(2);
  });
});