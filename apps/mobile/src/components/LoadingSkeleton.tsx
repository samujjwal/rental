import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, ViewStyle, DimensionValue } from 'react-native';
import { colors, borderRadius, spacing } from '../theme';

interface SkeletonProps {
  width?: DimensionValue;
  height?: DimensionValue;
  borderRadiusSize?: number;
  style?: ViewStyle;
}

function Skeleton({
  width = '100%',
  height = 16,
  borderRadiusSize = borderRadius.md,
  style,
}: SkeletonProps) {
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius: borderRadiusSize,
          backgroundColor: colors.skeleton,
          opacity,
        },
        style,
      ]}
    />
  );
}

export function ListItemSkeleton() {
  return (
    <View style={styles.listItem}>
      <Skeleton width={56} height={56} borderRadiusSize={borderRadius.lg} />
      <View style={styles.listItemContent}>
        <Skeleton width="70%" height={16} />
        <Skeleton width="50%" height={12} style={{ marginTop: spacing.xs }} />
      </View>
    </View>
  );
}

export function CardSkeleton() {
  return (
    <View style={styles.card}>
      <Skeleton width="100%" height={180} borderRadiusSize={borderRadius.lg} />
      <View style={{ padding: spacing.md }}>
        <Skeleton width="80%" height={18} />
        <Skeleton width="60%" height={14} style={{ marginTop: spacing.sm }} />
        <Skeleton width="40%" height={14} style={{ marginTop: spacing.sm }} />
      </View>
    </View>
  );
}

export function DetailPageSkeleton() {
  return (
    <View style={styles.detailPage}>
      <Skeleton width="100%" height={250} borderRadiusSize={0} />
      <View style={{ padding: spacing.md }}>
        <Skeleton width="90%" height={24} />
        <Skeleton width="60%" height={16} style={{ marginTop: spacing.sm }} />
        <Skeleton width="100%" height={1} style={{ marginVertical: spacing.md }} />
        <Skeleton width="100%" height={80} style={{ marginTop: spacing.sm }} />
        <Skeleton width="100%" height={80} style={{ marginTop: spacing.sm }} />
      </View>
    </View>
  );
}

export function ListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <View style={styles.list}>
      {Array.from({ length: count }).map((_, i) => (
        <ListItemSkeleton key={i} />
      ))}
    </View>
  );
}

export function CardListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <View style={styles.list}>
      {Array.from({ length: count }).map((_, i) => (
        <CardSkeleton key={i} />
      ))}
    </View>
  );
}

export { Skeleton };

const styles = StyleSheet.create({
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    gap: spacing.md,
  },
  listItemContent: {
    flex: 1,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
    overflow: 'hidden',
  },
  detailPage: {
    flex: 1,
    backgroundColor: colors.background,
  },
  list: {
    paddingVertical: spacing.sm,
  },
});
