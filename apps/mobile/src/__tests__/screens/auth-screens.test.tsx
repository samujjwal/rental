import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { SignupScreen } from '../../screens/SignupScreen';
import { ForgotPasswordScreen } from '../../screens/ForgotPasswordScreen';

/* ── mocks ── */

const mockSignUp = jest.fn();
const mockRequestPasswordReset = jest.fn();
const mockNavigate = jest.fn();
const mockReplace = jest.fn();

jest.mock('../../api/authContext', () => ({
  useAuth: () => ({
    signUp: mockSignUp,
    user: null,
    isLoading: false,
  }),
}));

jest.mock('../../api/client', () => ({
  mobileClient: {
    requestPasswordReset: (...a: any[]) => mockRequestPasswordReset(...a),
  },
}));

const nav = { navigate: mockNavigate, replace: mockReplace, goBack: jest.fn(), setOptions: jest.fn() } as any;
const route = (params = {}) => ({ params }) as any;

beforeEach(() => jest.clearAllMocks());

/* ═══════════════════════════════ SignupScreen ═══════════════════════════════ */

describe('SignupScreen', () => {
  it('renders all input fields and heading', () => {
    render(<SignupScreen navigation={nav} route={route()} />);
    expect(screen.getByText('Create account')).toBeTruthy();
    expect(screen.getByPlaceholderText('First name')).toBeTruthy();
    expect(screen.getByPlaceholderText('Last name')).toBeTruthy();
    expect(screen.getByPlaceholderText('Email')).toBeTruthy();
    expect(screen.getByPlaceholderText('Password')).toBeTruthy();
  });

  it('calls signUp with correct payload and navigates home', async () => {
    mockSignUp.mockResolvedValueOnce({ user: { id: '1' } });
    render(<SignupScreen navigation={nav} route={route()} />);

    fireEvent.changeText(screen.getByPlaceholderText('First name'), 'Ram');
    fireEvent.changeText(screen.getByPlaceholderText('Last name'), 'Sharma');
    fireEvent.changeText(screen.getByPlaceholderText('Email'), 'ram@test.np');
    fireEvent.changeText(screen.getByPlaceholderText('Password'), 'secret123');
    fireEvent.press(screen.getByText('Sign Up'));

    await waitFor(() => {
      expect(mockSignUp).toHaveBeenCalledWith({
        email: 'ram@test.np',
        password: 'secret123',
        firstName: 'Ram',
        lastName: 'Sharma',
      });
      expect(mockReplace).toHaveBeenCalledWith('Main');
    });
  });

  it('shows error on failed signup', async () => {
    mockSignUp.mockRejectedValueOnce(new Error('conflict'));
    render(<SignupScreen navigation={nav} route={route()} />);

    fireEvent.changeText(screen.getByPlaceholderText('Email'), 'dup@test.np');
    fireEvent.changeText(screen.getByPlaceholderText('Password'), 'password123');
    fireEvent.press(screen.getByText('Sign Up'));

    await waitFor(() => {
      expect(screen.getByText('Signup failed. Please review your details.')).toBeTruthy();
    });
  });

  it('shows loading text while creating account', async () => {
    mockSignUp.mockImplementation(() => new Promise(() => {}));
    render(<SignupScreen navigation={nav} route={route()} />);

    fireEvent.changeText(screen.getByPlaceholderText('Email'), 'test@example.np');
    fireEvent.changeText(screen.getByPlaceholderText('Password'), 'password123');
    fireEvent.press(screen.getByText('Sign Up'));

    await waitFor(() => {
      expect(screen.getByText('Creating...')).toBeTruthy();
    });
  });

  it('navigates to Login screen', () => {
    render(<SignupScreen navigation={nav} route={route()} />);
    fireEvent.press(screen.getByText('Already have an account? Sign in'));
    expect(mockNavigate).toHaveBeenCalledWith('Login');
  });
});

/* ═══════════════════════════ ForgotPasswordScreen ═══════════════════════════ */

describe('ForgotPasswordScreen', () => {
  it('renders heading and description', () => {
    render(<ForgotPasswordScreen navigation={nav} route={route()} />);
    expect(screen.getByText('Forgot password')).toBeTruthy();
    expect(screen.getByText(/Enter your email address/)).toBeTruthy();
  });

  it('shows validation when email is empty', async () => {
    render(<ForgotPasswordScreen navigation={nav} route={route()} />);
    fireEvent.press(screen.getByText('Send reset link'));

    await waitFor(() => {
      expect(screen.getByText('Please enter your email.')).toBeTruthy();
    });
    expect(mockRequestPasswordReset).not.toHaveBeenCalled();
  });

  it('sends reset link and shows success message', async () => {
    mockRequestPasswordReset.mockResolvedValueOnce({});
    render(<ForgotPasswordScreen navigation={nav} route={route()} />);

    fireEvent.changeText(screen.getByPlaceholderText('Email'), 'ram@test.np');
    fireEvent.press(screen.getByText('Send reset link'));

    await waitFor(() => {
      expect(mockRequestPasswordReset).toHaveBeenCalledWith('ram@test.np');
      expect(screen.getByText('Check your email for a password reset link.')).toBeTruthy();
    });
  });

  it('shows error on failure', async () => {
    mockRequestPasswordReset.mockRejectedValueOnce(new Error('network'));
    render(<ForgotPasswordScreen navigation={nav} route={route()} />);

    fireEvent.changeText(screen.getByPlaceholderText('Email'), 'fail@test.np');
    fireEvent.press(screen.getByText('Send reset link'));

    await waitFor(() => {
      expect(screen.getByText('Unable to send reset link. Please try again.')).toBeTruthy();
    });
  });

  it('shows loading text while sending', async () => {
    mockRequestPasswordReset.mockImplementation(() => new Promise(() => {}));
    render(<ForgotPasswordScreen navigation={nav} route={route()} />);

    fireEvent.changeText(screen.getByPlaceholderText('Email'), 'ram@test.np');
    fireEvent.press(screen.getByText('Send reset link'));

    await waitFor(() => {
      expect(screen.getByText('Sending...')).toBeTruthy();
    });
  });

  it('navigates back to Login', () => {
    render(<ForgotPasswordScreen navigation={nav} route={route()} />);
    fireEvent.press(screen.getByText('Back to login'));
    expect(mockNavigate).toHaveBeenCalledWith('Login');
  });
});
