/**
 * Mobile component tests — Toast, StaticInfoScreen, theme constants.
 *
 * Run with: pnpm --filter @rental-portal/mobile test
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';

// ── Toast utility ──────────────────────────────────────────────

jest.mock('react-native-toast-message', () => ({
  __esModule: true,
  default: {
    show: jest.fn(),
  },
}));

import Toast from 'react-native-toast-message';
import { showSuccess, showError, showInfo } from '../../components/Toast';

describe('Toast utility', () => {
  afterEach(() => jest.clearAllMocks());

  it('showSuccess calls Toast.show with success type', () => {
    showSuccess('Done!', 'Booking confirmed');
    expect(Toast.show).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'success',
        text1: 'Done!',
        text2: 'Booking confirmed',
      }),
    );
  });

  it('showError calls Toast.show with error type', () => {
    showError('Oops', 'Something failed');
    expect(Toast.show).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'error',
        text1: 'Oops',
        text2: 'Something failed',
      }),
    );
  });

  it('showError uses default description when not provided', () => {
    showError('Oops');
    expect(Toast.show).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'error',
        text2: 'Please try again',
      }),
    );
  });

  it('showInfo calls Toast.show with info type', () => {
    showInfo('Note', 'Check your email');
    expect(Toast.show).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'info',
        text1: 'Note',
      }),
    );
  });
});

// ── StaticInfoScreen ───────────────────────────────────────────

import { StaticInfoScreen } from '../../components/StaticInfoScreen';

describe('StaticInfoScreen', () => {
  it('renders title and description', () => {
    render(
      <StaticInfoScreen title="About Us" description="We are GharBatai" />,
    );
    expect(screen.getByText('About Us')).toBeTruthy();
    expect(screen.getByText('We are GharBatai')).toBeTruthy();
  });

  it('renders CTA button when ctaLabel and onPressCta provided', () => {
    const onPress = jest.fn();
    render(
      <StaticInfoScreen
        title="Welcome"
        description="Get started"
        ctaLabel="Start Now"
        onPressCta={onPress}
      />,
    );
    const cta = screen.getByText('Start Now');
    expect(cta).toBeTruthy();
    fireEvent.press(cta);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('does NOT render CTA when ctaLabel is missing', () => {
    render(
      <StaticInfoScreen title="Info" description="Some info" />,
    );
    expect(screen.queryByText('Start Now')).toBeNull();
  });
});

// ── Theme constants ────────────────────────────────────────────

import { colors, darkColors, spacing, borderRadius } from '../../theme';

describe('Theme', () => {
  it('colors has primary defined', () => {
    expect(colors.primary).toBeDefined();
    expect(typeof colors.primary).toBe('string');
  });

  it('darkColors has background defined', () => {
    expect(darkColors.background).toBeDefined();
  });

  it('spacing values are numbers', () => {
    const values = Object.values(spacing);
    values.forEach((v) => {
      expect(typeof v).toBe('number');
    });
  });

  it('borderRadius values are numbers', () => {
    const values = Object.values(borderRadius);
    values.forEach((v) => {
      expect(typeof v).toBe('number');
    });
  });

  it('light colors differ from dark colors', () => {
    expect(colors.background).not.toBe(darkColors.background);
  });
});

// ── Config constants ───────────────────────────────────────────

import { API_BASE_URL, WEB_BASE_URL } from '../../config';

describe('Config', () => {
  it('API_BASE_URL is a valid URL', () => {
    expect(API_BASE_URL).toMatch(/^https?:\/\//);
  });

  it('WEB_BASE_URL is a valid URL', () => {
    expect(WEB_BASE_URL).toMatch(/^https?:\/\//);
  });
});
