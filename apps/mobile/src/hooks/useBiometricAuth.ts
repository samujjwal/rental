import { useState, useEffect, useCallback } from 'react';
import * as LocalAuthentication from 'expo-local-authentication';
import { Alert } from 'react-native';
import { authStore } from '../api/authStore';

export interface BiometricAuthState {
  /** True when the hardware sensor is present AND at least one enrollment exists. */
  isAvailable: boolean;
  /** True when the user has opted in to biometric unlock for this app. */
  isEnabled: boolean;
  /** Human-readable label for the strongest available sensor (e.g. "Face ID"). */
  biometricLabel: string;
  /** Prompt the user with the biometric sensor. Resolves true on success. */
  authenticate: () => Promise<boolean>;
  /** Persist the user's opt-in preference and enable biometric unlock. */
  enable: () => Promise<void>;
  /** Clear the opt-in preference (does not delete stored credentials). */
  disable: () => Promise<void>;
}

async function getBiometricLabel(): Promise<string> {
  const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
  if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
    return 'Face ID';
  }
  if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
    return 'Fingerprint';
  }
  return 'Biometric';
}

export function useBiometricAuth(): BiometricAuthState {
  const [isAvailable, setIsAvailable] = useState(false);
  const [isEnabled, setIsEnabled] = useState(false);
  const [biometricLabel, setBiometricLabel] = useState('Biometric');

  useEffect(() => {
    let active = true;

    async function init() {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      const available = hasHardware && isEnrolled;
      const enabled = available ? await authStore.isBiometricEnabled() : false;
      const label = available ? await getBiometricLabel() : 'Biometric';

      if (active) {
        setIsAvailable(available);
        setIsEnabled(enabled);
        setBiometricLabel(label);
      }
    }

    init();
    return () => { active = false; };
  }, []);

  const authenticate = useCallback(async (): Promise<boolean> => {
    if (!isAvailable) return false;

    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: `Sign in with ${biometricLabel}`,
      cancelLabel: 'Use password instead',
      disableDeviceFallback: false,
    });

    return result.success;
  }, [isAvailable, biometricLabel]);

  const enable = useCallback(async (): Promise<void> => {
    await authStore.setBiometricEnabled(true);
    setIsEnabled(true);
  }, []);

  const disable = useCallback(async (): Promise<void> => {
    await authStore.setBiometricEnabled(false);
    setIsEnabled(false);
  }, []);

  return { isAvailable, isEnabled, biometricLabel, authenticate, enable, disable };
}

/**
 * Called after a successful password login.
 * If biometric is available but not yet enabled, prompts the user to opt in.
 */
export async function offerBiometricEnrollment(
  biometricLabel: string,
  onEnable: () => Promise<void>,
): Promise<void> {
  const alreadyEnabled = await authStore.isBiometricEnabled();
  if (alreadyEnabled) return;

  const hasHardware = await LocalAuthentication.hasHardwareAsync();
  const isEnrolled = await LocalAuthentication.isEnrolledAsync();
  if (!hasHardware || !isEnrolled) return;

  Alert.alert(
    `Enable ${biometricLabel}?`,
    `Sign in faster next time using ${biometricLabel} instead of your password.`,
    [
      { text: 'Not now', style: 'cancel' },
      {
        text: 'Enable',
        onPress: async () => {
          await onEnable();
        },
      },
    ],
  );
}
