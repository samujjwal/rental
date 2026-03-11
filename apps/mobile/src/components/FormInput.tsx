import React, { useState, forwardRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TextInputProps,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { colors, typography, spacing, borderRadius } from '../theme';

interface FormInputProps extends TextInputProps {
  label?: string;
  error?: string;
  helper?: string;
  required?: boolean;
  rightIcon?: React.ReactNode;
  containerStyle?: object;
}

export const FormInput = forwardRef<TextInput, FormInputProps>(
  ({ label, error, helper, required, rightIcon, containerStyle, style, ...props }, ref) => {
    const [isFocused, setIsFocused] = useState(false);

    return (
      <View style={[styles.container, containerStyle]}>
        {label && (
          <Text style={styles.label}>
            {label}
            {required && <Text style={styles.required}> *</Text>}
          </Text>
        )}
        <View style={styles.inputWrapper}>
          <TextInput
            ref={ref}
            style={[
              styles.input,
              isFocused && styles.inputFocused,
              error && styles.inputError,
              rightIcon ? styles.inputWithIcon : undefined,
              style,
            ]}
            placeholderTextColor={colors.textMuted}
            accessibilityLabel={props.accessibilityLabel || label || props.placeholder}
            accessibilityRole="text"
            accessibilityState={{ disabled: !!props.editable && !props.editable }}
            accessibilityHint={error ? `Error: ${error}` : helper}
            onFocus={(e) => {
              setIsFocused(true);
              props.onFocus?.(e);
            }}
            onBlur={(e) => {
              setIsFocused(false);
              props.onBlur?.(e);
            }}
            {...props}
          />
          {rightIcon && <View style={styles.rightIcon}>{rightIcon}</View>}
        </View>
        {error && <Text style={styles.error}>{error}</Text>}
        {helper && !error && <Text style={styles.helper}>{helper}</Text>}
      </View>
    );
  }
);

FormInput.displayName = 'FormInput';

interface FormButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'outline' | 'destructive' | 'ghost';
  disabled?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
}

export function FormButton({
  title,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  icon,
}: FormButtonProps) {
  const buttonStyle = [
    styles.button,
    variant === 'outline' && styles.buttonOutline,
    variant === 'destructive' && styles.buttonDestructive,
    variant === 'ghost' && styles.buttonGhost,
    (disabled || loading) && styles.buttonDisabled,
  ];

  const textStyle = [
    styles.buttonText,
    variant === 'outline' && styles.buttonOutlineText,
    variant === 'ghost' && styles.buttonGhostText,
  ];

  return (
    <TouchableOpacity
      style={buttonStyle}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={loading ? `${title}, loading` : title}
      accessibilityState={{ disabled: disabled || loading }}
    >
      {icon}
      <Text style={textStyle}>{loading ? 'Loading...' : title}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.md,
  },
  label: {
    ...typography.label,
    marginBottom: spacing.xs,
  },
  required: {
    color: colors.error,
  },
  inputWrapper: {
    position: 'relative',
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 4,
    fontSize: 16,
    color: colors.text,
    backgroundColor: colors.input,
  },
  inputFocused: {
    borderColor: colors.primary,
    borderWidth: 2,
  },
  inputError: {
    borderColor: colors.error,
  },
  inputWithIcon: {
    paddingRight: 44,
  },
  rightIcon: {
    position: 'absolute',
    right: spacing.sm,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    width: 32,
  },
  error: {
    ...typography.caption,
    color: colors.error,
    marginTop: spacing.xs,
  },
  helper: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.sm + 4,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  buttonText: {
    color: '#FFFFFF',
    ...typography.button,
  },
  buttonOutline: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.primary,
  },
  buttonOutlineText: {
    color: colors.primary,
  },
  buttonDestructive: {
    backgroundColor: colors.destructive,
  },
  buttonGhost: {
    backgroundColor: 'transparent',
  },
  buttonGhostText: {
    color: colors.primary,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
});
