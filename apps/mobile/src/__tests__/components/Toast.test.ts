jest.mock('react-native-toast-message', () => ({
  show: jest.fn(),
}));

import Toast from 'react-native-toast-message';
import { showSuccess, showError, showInfo, showApiError } from '../../components/Toast';

describe('Toast Helpers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('showSuccess', () => {
    it('shows success toast with message', () => {
      showSuccess('Done!');
      expect(Toast.show).toHaveBeenCalledWith({
        type: 'success',
        text1: 'Done!',
        text2: undefined,
        visibilityTime: 3000,
        position: 'top',
      });
    });

    it('shows success toast with description', () => {
      showSuccess('Saved', 'Your changes were saved');
      expect(Toast.show).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'success',
          text1: 'Saved',
          text2: 'Your changes were saved',
        }),
      );
    });
  });

  describe('showError', () => {
    it('shows error toast with default description', () => {
      showError('Failed');
      expect(Toast.show).toHaveBeenCalledWith({
        type: 'error',
        text1: 'Failed',
        text2: 'Please try again',
        visibilityTime: 4000,
        position: 'top',
      });
    });

    it('shows error toast with custom description', () => {
      showError('Error', 'Network timeout');
      expect(Toast.show).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'error',
          text1: 'Error',
          text2: 'Network timeout',
        }),
      );
    });

    it('has longer visibilityTime than success', () => {
      showError('Error');
      const call = (Toast.show as jest.Mock).mock.calls[0][0];
      expect(call.visibilityTime).toBe(4000);
    });
  });

  describe('showInfo', () => {
    it('shows info toast', () => {
      showInfo('Heads up');
      expect(Toast.show).toHaveBeenCalledWith({
        type: 'info',
        text1: 'Heads up',
        text2: undefined,
        visibilityTime: 3000,
        position: 'top',
      });
    });

    it('shows info toast with description', () => {
      showInfo('Update', 'New version available');
      expect(Toast.show).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'info',
          text2: 'New version available',
        }),
      );
    });
  });

  describe('showApiError', () => {
    it('shows error from Error instance', () => {
      showApiError(new Error('Network error'));
      expect(Toast.show).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'error',
          text1: 'Something went wrong',
          text2: 'Network error',
        }),
      );
    });

    it('shows error from string', () => {
      showApiError('Custom error string');
      expect(Toast.show).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'error',
          text1: 'Something went wrong',
          text2: 'Custom error string',
        }),
      );
    });

    it('shows fallback message for unknown error types', () => {
      showApiError({ code: 500 });
      expect(Toast.show).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'error',
          text1: 'Something went wrong',
          text2: 'Something went wrong',
        }),
      );
    });

    it('uses custom fallback message', () => {
      showApiError(null, 'Custom fallback');
      expect(Toast.show).toHaveBeenCalledWith(
        expect.objectContaining({
          text1: 'Custom fallback',
          text2: 'Custom fallback',
        }),
      );
    });

    it('uses Error.message over fallback', () => {
      showApiError(new Error('Specific error'), 'Generic fallback');
      expect(Toast.show).toHaveBeenCalledWith(
        expect.objectContaining({
          text2: 'Specific error',
        }),
      );
    });
  });
});
