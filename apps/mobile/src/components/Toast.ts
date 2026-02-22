import Toast from 'react-native-toast-message';

export function showSuccess(message: string, description?: string) {
  Toast.show({
    type: 'success',
    text1: message,
    text2: description,
    visibilityTime: 3000,
    position: 'top',
  });
}

export function showError(message: string, description?: string) {
  Toast.show({
    type: 'error',
    text1: message,
    text2: description || 'Please try again',
    visibilityTime: 4000,
    position: 'top',
  });
}

export function showInfo(message: string, description?: string) {
  Toast.show({
    type: 'info',
    text1: message,
    text2: description,
    visibilityTime: 3000,
    position: 'top',
  });
}

/**
 * Show error toast from API error responses
 */
export function showApiError(error: unknown, fallbackMessage = 'Something went wrong') {
  const message =
    error instanceof Error ? error.message : typeof error === 'string' ? error : fallbackMessage;
  showError(fallbackMessage, message);
}
