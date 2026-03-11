import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { LoginScreen } from '../../screens/LoginScreen';

const mockSignIn = jest.fn();
const mockReplace = jest.fn();
const mockNavigate = jest.fn();

jest.mock('../../api/authContext', () => ({
  useAuth: () => ({
    signIn: mockSignIn,
    user: null,
    isLoading: false,
  }),
}));

const mockNavigation = {
  navigate: mockNavigate,
  replace: mockReplace,
  goBack: jest.fn(),
  setOptions: jest.fn(),
} as any;

const mockRoute = { params: {} } as any;

describe('LoginScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders email and password fields', () => {
    render(<LoginScreen navigation={mockNavigation} route={mockRoute} />);
    expect(screen.getByPlaceholderText('Email')).toBeTruthy();
    expect(screen.getByPlaceholderText('Password')).toBeTruthy();
  });

  it('renders the heading', () => {
    render(<LoginScreen navigation={mockNavigation} route={mockRoute} />);
    expect(screen.getByText('Welcome back')).toBeTruthy();
  });

  it('calls signIn and navigates on success', async () => {
    mockSignIn.mockResolvedValueOnce({ user: { id: '1' }, accessToken: 'tok' });

    render(<LoginScreen navigation={mockNavigation} route={mockRoute} />);

    fireEvent.changeText(screen.getByPlaceholderText('Email'), 'test@example.com');
    fireEvent.changeText(screen.getByPlaceholderText('Password'), 'password123');
    fireEvent.press(screen.getByText('Sign In'));

    await waitFor(() => {
      expect(mockSignIn).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password123',
      });
      expect(mockReplace).toHaveBeenCalledWith('Main');
    });
  });

  it('shows error on failed login', async () => {
    mockSignIn.mockRejectedValueOnce(new Error('unauthorized'));

    render(<LoginScreen navigation={mockNavigation} route={mockRoute} />);

    fireEvent.changeText(screen.getByPlaceholderText('Email'), 'bad@example.com');
    fireEvent.changeText(screen.getByPlaceholderText('Password'), 'wrong');
    fireEvent.press(screen.getByText('Sign In'));

    await waitFor(() => {
      expect(screen.getByText('Login failed. Please check your credentials.')).toBeTruthy();
    });
  });

  it('shows loading text while signing in', async () => {
    mockSignIn.mockImplementation(() => new Promise(() => {})); // never resolves

    render(<LoginScreen navigation={mockNavigation} route={mockRoute} />);

    fireEvent.changeText(screen.getByPlaceholderText('Email'), 'test@example.com');
    fireEvent.changeText(screen.getByPlaceholderText('Password'), 'password123');
    fireEvent.press(screen.getByText('Sign In'));

    await waitFor(() => {
      expect(screen.getByText('Signing in...')).toBeTruthy();
    });
  });
});
