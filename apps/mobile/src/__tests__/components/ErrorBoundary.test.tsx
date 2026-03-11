import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';
import { Text } from 'react-native';
import { ErrorBoundary } from '../../components/ErrorBoundary';

jest.mock('../../theme', () => ({
  colors: { background: '#fff', textSecondary: '#666' },
  typography: {
    h2: { fontSize: 20 },
    body: { fontSize: 14 },
  },
  spacing: { sm: 8, md: 16, lg: 24, xl: 32 },
  commonStyles: {
    button: { padding: 12 },
    buttonText: { color: '#fff' },
  },
}));

// Component that throws on demand
function ThrowingComponent({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) throw new Error('Test error');
  return <Text>Working</Text>;
}

// Suppress console.error for error boundary tests
const originalConsoleError = console.error;
beforeAll(() => {
  console.error = jest.fn();
});
afterAll(() => {
  console.error = originalConsoleError;
});

describe('ErrorBoundary', () => {
  it('renders children when no error', () => {
    const { getByText } = render(
      <ErrorBoundary>
        <Text>Hello</Text>
      </ErrorBoundary>,
    );
    expect(getByText('Hello')).toBeTruthy();
  });

  it('renders error UI when child throws', () => {
    const { getByText } = render(
      <ErrorBoundary>
        <ThrowingComponent shouldThrow={true} />
      </ErrorBoundary>,
    );
    expect(getByText('Something went wrong')).toBeTruthy();
    expect(getByText('Test error')).toBeTruthy();
  });

  it('renders custom fallback when provided', () => {
    const fallback = <Text>Custom Error</Text>;
    const { getByText } = render(
      <ErrorBoundary fallback={fallback}>
        <ThrowingComponent shouldThrow={true} />
      </ErrorBoundary>,
    );
    expect(getByText('Custom Error')).toBeTruthy();
  });

  it('renders Try Again button', () => {
    const { getByText } = render(
      <ErrorBoundary>
        <ThrowingComponent shouldThrow={true} />
      </ErrorBoundary>,
    );
    expect(getByText('Try Again')).toBeTruthy();
  });

  it('renders warning emoji', () => {
    const { getByText } = render(
      <ErrorBoundary>
        <ThrowingComponent shouldThrow={true} />
      </ErrorBoundary>,
    );
    expect(getByText('⚠️')).toBeTruthy();
  });

  it('renders fallback message for error without message', () => {
    function NoMessageError() {
      throw { notAnError: true };
    }
    const { getByText } = render(
      <ErrorBoundary>
        <NoMessageError />
      </ErrorBoundary>,
    );
    expect(getByText('An unexpected error occurred')).toBeTruthy();
  });

  it('resets error state when Try Again is pressed', () => {
    // Use a ref-like pattern to control throwing
    let shouldThrow = true;
    function ConditionalThrow() {
      if (shouldThrow) throw new Error('Boom');
      return <Text>Recovered</Text>;
    }

    const { getByText, rerender } = render(
      <ErrorBoundary>
        <ConditionalThrow />
      </ErrorBoundary>,
    );

    expect(getByText('Something went wrong')).toBeTruthy();

    // Stop throwing and press retry
    shouldThrow = false;
    fireEvent.press(getByText('Try Again'));

    expect(getByText('Recovered')).toBeTruthy();
  });
});
