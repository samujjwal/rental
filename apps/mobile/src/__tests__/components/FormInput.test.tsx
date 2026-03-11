import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { FormInput, FormButton } from '../../components/FormInput';

jest.mock('../../theme', () => ({
  colors: {
    primary: '#2563EB',
    error: '#EF4444',
    destructive: '#DC2626',
    text: '#111827',
    textMuted: '#9CA3AF',
    textSecondary: '#6B7280',
    border: '#D1D5DB',
    input: '#F9FAFB',
    surface: '#FFFFFF',
  },
  typography: {
    label: { fontSize: 14, fontWeight: '600' },
    caption: { fontSize: 12 },
    button: { fontSize: 14, fontWeight: '600' },
  },
  spacing: { xs: 4, sm: 8, md: 16, lg: 24 },
  borderRadius: { md: 8 },
}));

describe('FormInput', () => {
  it('renders with label', () => {
    const { getByText } = render(<FormInput label="Email" />);
    expect(getByText('Email')).toBeTruthy();
  });

  it('renders required asterisk when required is true', () => {
    const { getByText } = render(<FormInput label="Email" required />);
    expect(getByText(' *')).toBeTruthy();
  });

  it('does not render required asterisk when required is false', () => {
    const { queryByText } = render(<FormInput label="Email" />);
    expect(queryByText(' *')).toBeNull();
  });

  it('renders error message', () => {
    const { getByText } = render(<FormInput label="Email" error="Email is required" />);
    expect(getByText('Email is required')).toBeTruthy();
  });

  it('renders helper text when no error', () => {
    const { getByText } = render(<FormInput label="Email" helper="Enter your email" />);
    expect(getByText('Enter your email')).toBeTruthy();
  });

  it('hides helper text when error is present', () => {
    const { queryByText, getByText } = render(
      <FormInput label="Email" error="Invalid" helper="Enter your email" />,
    );
    expect(getByText('Invalid')).toBeTruthy();
    expect(queryByText('Enter your email')).toBeNull();
  });

  it('renders without label', () => {
    const { getByLabelText } = render(
      <FormInput placeholder="Type here" accessibilityLabel="Input field" />,
    );
    expect(getByLabelText('Input field')).toBeTruthy();
  });

  it('renders rightIcon', () => {
    const { getByText } = render(
      <FormInput label="Password" rightIcon={<></>} />,
    );
    expect(getByText('Password')).toBeTruthy();
  });

  it('calls onChangeText', () => {
    const onChangeText = jest.fn();
    const { getByLabelText } = render(
      <FormInput label="Name" onChangeText={onChangeText} />,
    );
    fireEvent.changeText(getByLabelText('Name'), 'John');
    expect(onChangeText).toHaveBeenCalledWith('John');
  });

  it('uses label as accessibility label by default', () => {
    const { getByLabelText } = render(<FormInput label="Username" />);
    expect(getByLabelText('Username')).toBeTruthy();
  });

  it('uses custom accessibilityLabel when provided', () => {
    const { getByLabelText } = render(
      <FormInput label="Username" accessibilityLabel="Custom label" />,
    );
    expect(getByLabelText('Custom label')).toBeTruthy();
  });

  it('uses placeholder as fallback for accessibility label', () => {
    const { getByLabelText } = render(<FormInput placeholder="Enter text" />);
    expect(getByLabelText('Enter text')).toBeTruthy();
  });
});

describe('FormButton', () => {
  it('renders button with title', () => {
    const { getByText } = render(<FormButton title="Submit" onPress={jest.fn()} />);
    expect(getByText('Submit')).toBeTruthy();
  });

  it('calls onPress when tapped', () => {
    const onPress = jest.fn();
    const { getByText } = render(<FormButton title="Submit" onPress={onPress} />);
    fireEvent.press(getByText('Submit'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('shows "Loading..." when loading', () => {
    const { getByText, queryByText } = render(
      <FormButton title="Submit" onPress={jest.fn()} loading />,
    );
    expect(getByText('Loading...')).toBeTruthy();
    expect(queryByText('Submit')).toBeNull();
  });

  it('is disabled when loading', () => {
    const onPress = jest.fn();
    const { getByRole } = render(
      <FormButton title="Submit" onPress={onPress} loading />,
    );
    const button = getByRole('button');
    expect(button.props.accessibilityState.disabled).toBe(true);
  });

  it('is disabled when disabled prop is true', () => {
    const onPress = jest.fn();
    const { getByRole } = render(
      <FormButton title="Submit" onPress={onPress} disabled />,
    );
    const button = getByRole('button');
    expect(button.props.accessibilityState.disabled).toBe(true);
  });

  it('has accessible label with loading state', () => {
    const { getByLabelText } = render(
      <FormButton title="Save" onPress={jest.fn()} loading />,
    );
    expect(getByLabelText('Save, loading')).toBeTruthy();
  });

  it('has accessible label with title when not loading', () => {
    const { getByLabelText } = render(
      <FormButton title="Save" onPress={jest.fn()} />,
    );
    expect(getByLabelText('Save')).toBeTruthy();
  });

  it('renders with outline variant', () => {
    const { getByText } = render(
      <FormButton title="Cancel" onPress={jest.fn()} variant="outline" />,
    );
    expect(getByText('Cancel')).toBeTruthy();
  });

  it('renders with destructive variant', () => {
    const { getByText } = render(
      <FormButton title="Delete" onPress={jest.fn()} variant="destructive" />,
    );
    expect(getByText('Delete')).toBeTruthy();
  });

  it('renders with ghost variant', () => {
    const { getByText } = render(
      <FormButton title="More" onPress={jest.fn()} variant="ghost" />,
    );
    expect(getByText('More')).toBeTruthy();
  });

  it('renders with icon', () => {
    const { getByText } = render(
      <FormButton title="Add" onPress={jest.fn()} icon={<></>} />,
    );
    expect(getByText('Add')).toBeTruthy();
  });
});
