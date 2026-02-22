import React, { ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  RefreshControl,
  StyleSheet,
  ViewStyle,
} from 'react-native';
import { colors, spacing } from '../theme';

interface FormContainerProps {
  children: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
  style?: ViewStyle;
  contentContainerStyle?: ViewStyle;
  keyboardVerticalOffset?: number;
}

/**
 * Standard form container with KeyboardAvoidingView and optional pull-to-refresh.
 * Use this wrapper for all screens with text inputs.
 */
export function FormContainer({
  children,
  refreshing = false,
  onRefresh,
  style,
  contentContainerStyle,
  keyboardVerticalOffset = Platform.OS === 'ios' ? 88 : 0,
}: FormContainerProps) {
  return (
    <KeyboardAvoidingView
      style={[styles.container, style]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={keyboardVerticalOffset}
    >
      <ScrollView
        contentContainerStyle={[styles.scrollContent, contentContainerStyle]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        refreshControl={
          onRefresh ? (
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          ) : undefined
        }
      >
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    padding: spacing.md,
    paddingBottom: spacing.xl,
  },
});
