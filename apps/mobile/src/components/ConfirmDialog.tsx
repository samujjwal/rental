import React from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { colors, typography, spacing, borderRadius, shadows } from '../theme';

interface ConfirmDialogProps {
  visible: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  visible,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  destructive = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel} accessibilityViewIsModal={true}>
      <View style={styles.overlay}>
          <View style={styles.dialog} accessibilityRole="alert">
          <Text style={styles.title} accessibilityRole="header">{title}</Text>
          <Text style={styles.message}>{message}</Text>
          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={onCancel}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={cancelText}
            >
              <Text style={styles.cancelText}>{cancelText}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.button,
                destructive ? styles.destructiveButton : styles.confirmButton,
              ]}
              onPress={onConfirm}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={confirmText}
              accessibilityHint={destructive ? 'This action cannot be undone' : undefined}
            >
              <Text style={styles.confirmText}>{confirmText}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  dialog: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    width: '100%',
    maxWidth: 340,
    ...shadows.lg,
  },
  title: {
    ...typography.h3,
    marginBottom: spacing.sm,
  },
  message: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  button: {
    flex: 1,
    paddingVertical: spacing.sm + 4,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cancelText: {
    ...typography.button,
    color: colors.text,
  },
  confirmButton: {
    backgroundColor: colors.primary,
  },
  destructiveButton: {
    backgroundColor: colors.destructive,
  },
  confirmText: {
    ...typography.button,
    color: '#FFFFFF',
  },
});
