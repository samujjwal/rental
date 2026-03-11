import React from 'react';
import { render } from '@testing-library/react-native';
import {
  Skeleton,
  ListItemSkeleton,
  CardSkeleton,
  DetailPageSkeleton,
  ListSkeleton,
  CardListSkeleton,
} from '../../components/LoadingSkeleton';

jest.mock('../../theme', () => ({
  colors: { skeleton: '#E5E7EB', card: '#fff', border: '#eee', background: '#fff' },
  borderRadius: { md: 8, lg: 12 },
  spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 },
}));

describe('LoadingSkeleton', () => {
  describe('Skeleton', () => {
    it('renders without crashing', () => {
      const { toJSON } = render(<Skeleton />);
      expect(toJSON()).toBeTruthy();
    });

    it('renders with custom dimensions', () => {
      const { toJSON } = render(<Skeleton width={100} height={50} />);
      expect(toJSON()).toBeTruthy();
    });
  });

  describe('ListItemSkeleton', () => {
    it('renders without crashing', () => {
      const { toJSON } = render(<ListItemSkeleton />);
      expect(toJSON()).toBeTruthy();
    });
  });

  describe('CardSkeleton', () => {
    it('renders without crashing', () => {
      const { toJSON } = render(<CardSkeleton />);
      expect(toJSON()).toBeTruthy();
    });
  });

  describe('DetailPageSkeleton', () => {
    it('renders without crashing', () => {
      const { toJSON } = render(<DetailPageSkeleton />);
      expect(toJSON()).toBeTruthy();
    });
  });

  describe('ListSkeleton', () => {
    it('renders default 5 items', () => {
      const { toJSON } = render(<ListSkeleton />);
      const tree = toJSON();
      // The tree should have 5 ListItemSkeleton children
      expect(tree).toBeTruthy();
      expect((tree as any).children?.length).toBe(5);
    });

    it('renders custom count', () => {
      const { toJSON } = render(<ListSkeleton count={3} />);
      const tree = toJSON();
      expect((tree as any).children?.length).toBe(3);
    });
  });

  describe('CardListSkeleton', () => {
    it('renders default 3 items', () => {
      const { toJSON } = render(<CardListSkeleton />);
      const tree = toJSON();
      expect(tree).toBeTruthy();
      expect((tree as any).children?.length).toBe(3);
    });

    it('renders custom count', () => {
      const { toJSON } = render(<CardListSkeleton count={2} />);
      const tree = toJSON();
      expect((tree as any).children?.length).toBe(2);
    });
  });
});
