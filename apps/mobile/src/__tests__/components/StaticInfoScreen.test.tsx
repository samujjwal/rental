import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { StaticInfoScreen } from '../../components/StaticInfoScreen';

describe('StaticInfoScreen', () => {
  it('renders title and description', () => {
    const { getByText } = render(
      <StaticInfoScreen title="Welcome" description="This is a description" />,
    );
    expect(getByText('Welcome')).toBeTruthy();
    expect(getByText('This is a description')).toBeTruthy();
  });

  it('renders CTA button when ctaLabel and onPressCta provided', () => {
    const onPress = jest.fn();
    const { getByText } = render(
      <StaticInfoScreen
        title="Title"
        description="Desc"
        ctaLabel="Get Started"
        onPressCta={onPress}
      />,
    );
    expect(getByText('Get Started')).toBeTruthy();
  });

  it('calls onPressCta when CTA button pressed', () => {
    const onPress = jest.fn();
    const { getByText } = render(
      <StaticInfoScreen
        title="Title"
        description="Desc"
        ctaLabel="Click Me"
        onPressCta={onPress}
      />,
    );
    fireEvent.press(getByText('Click Me'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('does not render CTA when ctaLabel is missing', () => {
    const { queryByText } = render(
      <StaticInfoScreen title="Title" description="Desc" onPressCta={jest.fn()} />,
    );
    // No button should be visible since ctaLabel is undefined
    expect(queryByText('Get Started')).toBeNull();
  });

  it('does not render CTA when onPressCta is missing', () => {
    const { queryByText } = render(
      <StaticInfoScreen title="Title" description="Desc" ctaLabel="Go" />,
    );
    // ctaLabel without onPressCta should not render
    expect(queryByText('Go')).toBeNull();
  });
});
