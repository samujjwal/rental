import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('date-fns', () => ({
  formatDistanceToNow: vi.fn(() => '5 minutes ago'),
}));

vi.mock('lucide-react', () => {
  const icon = (props: any) => <span {...props} />;
  return {
    User: icon, Package: icon, Calendar: icon, Banknote: icon,
    AlertTriangle: icon, Star: icon, MessageSquare: icon, Shield: icon,
  };
});

import { ActivityFeed, type ActivityItem } from './ActivityFeed';

const baseActivity: ActivityItem = {
  id: '1',
  type: 'user',
  action: 'New registration',
  description: 'A new user signed up.',
  timestamp: '2026-02-26T12:00:00Z',
  user: { name: 'Alice' },
};

const makeActivities = (count: number): ActivityItem[] =>
  Array.from({ length: count }, (_, i) => ({
    ...baseActivity,
    id: String(i + 1),
    action: `Action ${i + 1}`,
  }));

describe('ActivityFeed', () => {
  it('renders empty state when no activities', () => {
    render(<ActivityFeed activities={[]} />);
    expect(screen.getByText('No recent activity')).toBeInTheDocument();
  });

  it('renders activity items', () => {
    render(<ActivityFeed activities={[baseActivity]} />);
    expect(screen.getByText('New registration')).toBeInTheDocument();
    expect(screen.getByText('A new user signed up.')).toBeInTheDocument();
  });

  it('renders timestamp', () => {
    render(<ActivityFeed activities={[baseActivity]} />);
    expect(screen.getByText('5 minutes ago')).toBeInTheDocument();
  });

  it('renders user name', () => {
    render(<ActivityFeed activities={[baseActivity]} />);
    expect(screen.getByText('Alice')).toBeInTheDocument();
  });

  it('renders user avatar initial when no avatar image', () => {
    render(<ActivityFeed activities={[baseActivity]} />);
    expect(screen.getByText('A')).toBeInTheDocument();
  });

  it('renders user avatar image when provided', () => {
    const withAvatar: ActivityItem = {
      ...baseActivity,
      user: { name: 'Bob', avatar: '/bob.jpg' },
    };
    render(<ActivityFeed activities={[withAvatar]} />);
    const img = screen.getByAltText('Bob');
    expect(img).toHaveAttribute('src', '/bob.jpg');
  });

  it('falls back to System when user name is empty', () => {
    const noName: ActivityItem = {
      ...baseActivity,
      user: { name: '' },
    };
    render(<ActivityFeed activities={[noName]} />);
    expect(screen.getByText('System')).toBeInTheDocument();
  });

  it('does not render user section when no user', () => {
    const noUser: ActivityItem = {
      ...baseActivity,
      user: undefined,
    };
    render(<ActivityFeed activities={[noUser]} />);
    expect(screen.queryByText('Alice')).not.toBeInTheDocument();
  });

  it('limits displayed items to maxItems', () => {
    const activities = makeActivities(15);
    render(<ActivityFeed activities={activities} maxItems={5} />);
    expect(screen.getByText('Action 1')).toBeInTheDocument();
    expect(screen.getByText('Action 5')).toBeInTheDocument();
    expect(screen.queryByText('Action 6')).not.toBeInTheDocument();
  });

  it('shows View All button when activities exceed maxItems', () => {
    const activities = makeActivities(15);
    render(<ActivityFeed activities={activities} maxItems={5} />);
    expect(screen.getByText('View all 15 activities →')).toBeInTheDocument();
  });

  it('does not show View All when within maxItems', () => {
    const activities = makeActivities(3);
    render(<ActivityFeed activities={activities} maxItems={5} />);
    expect(screen.queryByText(/View all/)).not.toBeInTheDocument();
  });

  it('calls onViewAll when View All is clicked', () => {
    const onViewAll = vi.fn();
    const activities = makeActivities(15);
    render(<ActivityFeed activities={activities} maxItems={5} onViewAll={onViewAll} />);
    fireEvent.click(screen.getByText('View all 15 activities →'));
    expect(onViewAll).toHaveBeenCalledTimes(1);
  });

  it('hides View All when showViewAll is false', () => {
    const activities = makeActivities(15);
    render(<ActivityFeed activities={activities} maxItems={5} showViewAll={false} />);
    expect(screen.queryByText(/View all/)).not.toBeInTheDocument();
  });

  it('renders activity link when provided', () => {
    const withLink: ActivityItem = {
      ...baseActivity,
      link: '/admin/users/1',
    };
    render(<ActivityFeed activities={[withLink]} />);
    const link = screen.getByText('New registration').closest('a');
    expect(link).toHaveAttribute('href', '/admin/users/1');
  });

  it('does not wrap in link when no link', () => {
    render(<ActivityFeed activities={[baseActivity]} />);
    const link = screen.getByText('New registration').closest('a');
    expect(link).toBeNull();
  });

  it('applies severity border color', () => {
    const warning: ActivityItem = { ...baseActivity, severity: 'warning' };
    const { container } = render(<ActivityFeed activities={[warning]} />);
    expect(container.querySelector('.border-l-orange-500')).toBeTruthy();
  });

  it('applies error severity color', () => {
    const error: ActivityItem = { ...baseActivity, severity: 'error' };
    const { container } = render(<ActivityFeed activities={[error]} />);
    expect(container.querySelector('.border-l-red-500')).toBeTruthy();
  });

  it('applies custom className', () => {
    const { container } = render(
      <ActivityFeed activities={[baseActivity]} className="my-feed" />
    );
    expect(container.querySelector('.my-feed')).toBeTruthy();
  });

  it('renders different activity type icons', () => {
    const types: ActivityItem['type'][] = ['user', 'listing', 'booking', 'payment', 'dispute', 'review', 'system'];
    const activities: ActivityItem[] = types.map((type, i) => ({
      ...baseActivity,
      id: String(i),
      type,
      action: `${type} action`,
    }));
    render(<ActivityFeed activities={activities} />);
    types.forEach((type) => {
      expect(screen.getByText(`${type} action`)).toBeInTheDocument();
    });
  });
});
