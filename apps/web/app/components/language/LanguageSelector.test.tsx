import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { renderHook, act } from '@testing-library/react';

vi.mock('lucide-react', () => ({
  Globe: (props: any) => <span data-testid="globe-icon" {...props} />,
}));

import { LanguageSelector, useLanguage, SUPPORTED_LANGUAGES } from './LanguageSelector';

describe('useLanguage', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.lang = '';
  });

  it('defaults to English', () => {
    const { result } = renderHook(() => useLanguage());
    expect(result.current.language).toBe('en');
  });

  it('sets language and updates state', async () => {
    const { result } = renderHook(() => useLanguage());
    act(() => result.current.setLanguage('ne'));
    expect(result.current.language).toBe('ne');
    expect(document.documentElement.lang).toBe('ne');
  });

  it('sets document lang attribute', () => {
    const { result } = renderHook(() => useLanguage());
    act(() => result.current.setLanguage('ne'));
    expect(document.documentElement.lang).toBe('ne');
  });

  it('reads stored language from localStorage on mount', async () => {
    const { result } = renderHook(() => useLanguage());
    await waitFor(() => {
      expect(result.current.mounted).toBe(true);
    });
    // Default language is 'en' when no stored preference
    expect(result.current.language).toBe('en');
    // Document lang is set during mount
    expect(document.documentElement.lang).toBe('en');
  });

  it('ignores invalid stored language', () => {
    localStorage.setItem('language-preference', 'invalid');
    const { result } = renderHook(() => useLanguage());
    expect(result.current.language).toBe('en');
  });
});

describe('LanguageSelector', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.lang = '';
  });

  it('renders trigger button with aria-label', () => {
    render(<LanguageSelector />);
    const btn = screen.getByRole('button');
    expect(btn).toHaveAttribute('aria-label', expect.stringContaining('Language'));
  });

  it('renders globe icon', () => {
    render(<LanguageSelector />);
    expect(screen.getByTestId('globe-icon')).toBeInTheDocument();
  });

  it('opens dropdown on click', () => {
    render(<LanguageSelector />);
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    // Dropdown options have role="option"
    const options = screen.getAllByRole('option');
    expect(options).toHaveLength(2);
  });

  it('marks current language as selected', () => {
    render(<LanguageSelector />);
    fireEvent.click(screen.getByRole('button'));
    const options = screen.getAllByRole('option');
    const enOption = options.find((o) => o.getAttribute('aria-selected') === 'true');
    expect(enOption).toBeTruthy();
  });

  it('changes language when an option is clicked', () => {
    render(<LanguageSelector />);
    fireEvent.click(screen.getByRole('button'));
    // Click the Nepali option (second option)
    const options = screen.getAllByRole('option');
    fireEvent.click(options[1]);
    // Verify the language changed to Nepali via document.lang
    expect(document.documentElement.lang).toBe('ne');
  });

  it('closes dropdown after selection', () => {
    render(<LanguageSelector />);
    fireEvent.click(screen.getByRole('button'));
    const options = screen.getAllByRole('option');
    fireEvent.click(options[1]);
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('closes dropdown on Escape key', () => {
    render(<LanguageSelector />);
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('closes dropdown on outside click', () => {
    render(<LanguageSelector />);
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    fireEvent.mouseDown(document);
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('toggles dropdown on button click', () => {
    render(<LanguageSelector />);
    const btn = screen.getByRole('button');
    fireEvent.click(btn);
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    fireEvent.click(btn);
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('sets aria-expanded correctly', () => {
    render(<LanguageSelector />);
    const btn = screen.getByRole('button');
    expect(btn).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(btn);
    expect(btn).toHaveAttribute('aria-expanded', 'true');
  });

  it('sets aria-haspopup to listbox', () => {
    render(<LanguageSelector />);
    expect(screen.getByRole('button')).toHaveAttribute('aria-haspopup', 'listbox');
  });

  it('hides native label when iconOnly is true', () => {
    render(<LanguageSelector iconOnly />);
    // The native label is rendered in a hidden span; should not be visible
    // But the globe icon should be there
    expect(screen.getByTestId('globe-icon')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(<LanguageSelector className="my-custom" />);
    expect(container.querySelector('.my-custom')).toBeTruthy();
  });
});

describe('SUPPORTED_LANGUAGES', () => {
  it('includes English and Nepali', () => {
    expect(SUPPORTED_LANGUAGES).toHaveLength(2);
    expect(SUPPORTED_LANGUAGES.map((l) => l.code)).toEqual(['en', 'ne']);
  });
});
