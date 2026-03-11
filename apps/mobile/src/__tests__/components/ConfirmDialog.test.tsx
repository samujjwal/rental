import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { ConfirmDialog } from '../../components/ConfirmDialog';

jest.mock('../../theme', () => ({
  colors: {
    overlay: 'rgba(0,0,0,0.5)',
    card: '#fff',
    border: '#eee',
    surface: '#f5f5f5',
    primary: '#4F46E5',
    destructive: '#DC2626',
    text: '#111',
    textSecondary: '#666',
  },
  typography: {
    h3: { fontSize: 18 },
    body: { fontSize: 14 },
    button: { fontSize: 14 },
  },
  spacing: { sm: 8, lg: 24 },
  borderRadius: { md: 8, xl: 16 },
  shadows: { lg: {} },
}));

describe('ConfirmDialog', () => {
  const defaultProps = {
    visible: true,
    title: 'Delete Item',
    message: 'Are you sure you want to delete this?',
    onConfirm: jest.fn(),
    onCancel: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders title and message when visible', () => {
    const { getByText } = render(<ConfirmDialog {...defaultProps} />);
    expect(getByText('Delete Item')).toBeTruthy();
    expect(getByText('Are you sure you want to delete this?')).toBeTruthy();
  });

  it('renders default button labels', () => {
    const { getByText } = render(<ConfirmDialog {...defaultProps} />);
    expect(getByText('Cancel')).toBeTruthy();
    expect(getByText('Confirm')).toBeTruthy();
  });

  it('renders custom button labels', () => {
    const { getByText } = render(
      <ConfirmDialog {...defaultProps} confirmText="Yes, Delete" cancelText="No, Keep" />,
    );
    expect(getByText('Yes, Delete')).toBeTruthy();
    expect(getByText('No, Keep')).toBeTruthy();
  });

  it('calls onConfirm when confirm button pressed', () => {
    const onConfirm = jest.fn();
    const { getByLabelText } = render(
      <ConfirmDialog {...defaultProps} onConfirm={onConfirm} />,
    );
    fireEvent.press(getByLabelText('Confirm'));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('calls onCancel when cancel button pressed', () => {
    const onCancel = jest.fn();
    const { getByLabelText } = render(<ConfirmDialog {...defaultProps} onCancel={onCancel} />);
    fireEvent.press(getByLabelText('Cancel'));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('has destructive hint when destructive is true', () => {
    const { getByLabelText } = render(
      <ConfirmDialog {...defaultProps} destructive={true} />,
    );
    const confirmBtn = getByLabelText('Confirm');
    expect(confirmBtn.props.accessibilityHint).toBe('This action cannot be undone');
  });

  it('has no destructive hint when destructive is false', () => {
    const { getByLabelText } = render(
      <ConfirmDialog {...defaultProps} destructive={false} />,
    );
    const confirmBtn = getByLabelText('Confirm');
    expect(confirmBtn.props.accessibilityHint).toBeUndefined();
  });

  it('title has header accessibility role', () => {
    const { getByRole } = render(<ConfirmDialog {...defaultProps} />);
    expect(getByRole('header')).toBeTruthy();
  });

  it('renders dialog content inside modal', () => {
    const { getByText } = render(<ConfirmDialog {...defaultProps} />);
    // All elements are present in the tree
    expect(getByText('Delete Item')).toBeTruthy();
    expect(getByText('Are you sure you want to delete this?')).toBeTruthy();
    expect(getByText('Cancel')).toBeTruthy();
    expect(getByText('Confirm')).toBeTruthy();
  });
});
