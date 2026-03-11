import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { ForgotPasswordScreen } from '../../screens/ForgotPasswordScreen';

const mockNavigate = jest.fn();

jest.mock('../../api/client', () => ({
  mobileClient: {
    requestPasswordReset: jest.fn(),
  },
}));

const mockNavigation = {
  navigate: mockNavigate,
  replace: jest.fn(),
  goBack: jest.fn(),
  setOptions: jest.fn(),
} as any;

const mockRoute = { params: {} } as any;

describe('ForgotPasswordScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders email input', () => {
    render(<ForgotPasswordScreen navigation={mockNavigation} route={mockRoute} />);
    expect(screen.getByPlaceholderText(/email/i)).toBeTruthy();
  });

  it('renders heading', () => {
    render(<ForgotPasswordScreen navigation={mockNavigation} route={mockRoute} />);
    expect(screen.getByText('Forgot password')).toBeTruthy();
  });
});
