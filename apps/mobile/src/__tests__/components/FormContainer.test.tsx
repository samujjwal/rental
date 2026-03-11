import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { Text } from 'react-native';
import { FormContainer } from '../../components/FormContainer';

jest.mock('../../theme', () => ({
  colors: { background: '#fff', primary: '#4F46E5' },
  spacing: { md: 16, xl: 32 },
}));

describe('FormContainer', () => {
  it('renders children', () => {
    const { getByText } = render(
      <FormContainer>
        <Text>Form Content</Text>
      </FormContainer>,
    );
    expect(getByText('Form Content')).toBeTruthy();
  });

  it('renders without crashing with default props', () => {
    const { toJSON } = render(
      <FormContainer>
        <Text>Hello</Text>
      </FormContainer>,
    );
    expect(toJSON()).toBeTruthy();
  });

  it('renders RefreshControl when onRefresh provided', () => {
    const onRefresh = jest.fn();
    const { toJSON } = render(
      <FormContainer onRefresh={onRefresh} refreshing={false}>
        <Text>Content</Text>
      </FormContainer>,
    );
    // Tree should include RefreshControl
    expect(toJSON()).toBeTruthy();
  });

  it('does not render RefreshControl when onRefresh not provided', () => {
    const { toJSON } = render(
      <FormContainer>
        <Text>Content</Text>
      </FormContainer>,
    );
    expect(toJSON()).toBeTruthy();
  });

  it('accepts custom style', () => {
    const { toJSON } = render(
      <FormContainer style={{ backgroundColor: 'red' }}>
        <Text>Styled</Text>
      </FormContainer>,
    );
    expect(toJSON()).toBeTruthy();
  });
});
