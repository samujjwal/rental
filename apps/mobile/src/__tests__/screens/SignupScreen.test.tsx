import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { SignupScreen } from '../../screens/SignupScreen';

const mockSignUp = jest.fn();
const mockReplace = jest.fn();
const mockNavigate = jest.fn();

jest.mock('../../api/authContext', () => ({
  useAuth: () => ({
    signUp: mockSignUp,
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

describe('SignupScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders all input fields', () => {
    render(<SignupScreen navigation={mockNavigation} route={mockRoute} />);
    expect(screen.getByPlaceholderText('First name')).toBeTruthy();
    expect(screen.getByPlaceholderText('Last name')).toBeTruthy();
    expect(screen.getByPlaceholderText('Email')).toBeTruthy();
    expect(screen.getByPlaceholderText('Password')).toBeTruthy();
  });

  it('renders the heading', () => {
    render(<SignupScreen navigation={mockNavigation} route={mockRoute} />);
    expect(screen.getByText('Create account')).toBeTruthy();
  });

  it('shows error for invalid email', async () => {
    render(<SignupScreen navigation={mockNavigation} route={mockRoute} />);
    fireEvent.changeText(screen.getByPlaceholderText('First name'), 'John');
    fireEvent.changeText(screen.getByPlaceholderText('Last name'), 'Doe');
    fireEvent.changeText(screen.getByPlaceholderText('Email'), 'bad-email');
    fireEvent.changeText(screen.getByPlaceholderText('Password'), 'password123');
    fireEvent.press(screen.getByText('Sign Up'));

    await waitFor(() => {
      expect(screen.getByText(/valid email/i)).toBeTruthy();
    });
  });

  it('shows error for short password', async () => {
    render(<SignupScreen navigation={mockNavigation} route={mockRoute} />);
    fireEvent.changeText(screen.getByPlaceholderText('First name'), 'John');
    fireEvent.changeText(screen.getByPlaceholderText('Last name'), 'Doe');
    fireEvent.changeText(screen.getByPlaceholderText('Email'), 'john@test.com');
    fireEvent.changeText(screen.getByPlaceholderText('Password'), '123');
    fireEvent.press(screen.getByText('Sign Up'));

    await waitFor(() => {
      expect(screen.getByText(/at least/i)).toBeTruthy();
    });
  });

  it('calls signUp and navigates on success', async () => {
    mockSignUp.mockResolvedValueOnce({ user: { id: '1' }, accessToken: 'tok' });

    render(<SignupScreen navigation={mockNavigation} route={mockRoute} />);
    fireEvent.changeText(screen.getByPlaceholderText('First name'), 'John');
    fireEvent.changeText(screen.getByPlaceholderText('Last name'), 'Doe');
    fireEvent.changeText(screen.getByPlaceholderText('Email'), 'john@test.com');
    fireEvent.changeText(screen.getByPlaceholderText('Password'), 'password123');
    fireEvent.press(screen.getByText('Sign Up'));

    await waitFor(() => {
      expect(mockSignUp).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'john@test.com',
          firstName: 'John',
          lastName: 'Doe',
        }),
      );
      expect(mockReplace).toHaveBeenCalledWith('Main');
    });
  });

  it('shows error on signup failure', async () => {
    mockSignUp.mockRejectedValueOnce(new Error('Email already exists'));

    render(<SignupScreen navigation={mockNavigation} route={mockRoute} />);
    fireEvent.changeText(screen.getByPlaceholderText('First name'), 'John');
    fireEvent.changeText(screen.getByPlaceholderText('Last name'), 'Doe');
    fireEvent.changeText(screen.getByPlaceholderText('Email'), 'john@test.com');
    fireEvent.changeText(screen.getByPlaceholderText('Password'), 'password123');
    fireEvent.press(screen.getByText('Sign Up'));

    await waitFor(() => {
      expect(screen.getByText(/failed|error/i)).toBeTruthy();
    });
  });

  it('shows loading state while signing up', async () => {
    mockSignUp.mockImplementation(() => new Promise(() => {}));

    render(<SignupScreen navigation={mockNavigation} route={mockRoute} />);
    fireEvent.changeText(screen.getByPlaceholderText('First name'), 'John');
    fireEvent.changeText(screen.getByPlaceholderText('Last name'), 'Doe');
    fireEvent.changeText(screen.getByPlaceholderText('Email'), 'john@test.com');
    fireEvent.changeText(screen.getByPlaceholderText('Password'), 'password123');
    fireEvent.press(screen.getByText('Sign Up'));

    await waitFor(() => {
      expect(screen.getByText(/creating|signing/i)).toBeTruthy();
    });
  });
});
