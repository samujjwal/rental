import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { FilterPresets } from './FilterPresets';

/**
 * FilterPresets component tests
 * Note: Complex localStorage save operations are difficult to test reliably in the test environment
 * due to async state management. These tests focus on UI interactions and basic functionality.
 */
describe('FilterPresets', () => {
  const mockOnApplyPreset = vi.fn();
  const storageKey = 'test-filters';

  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
  });

  const defaultProps = {
    currentFilters: { category: 'cars', location: 'kathmandu' },
    onApplyPreset: mockOnApplyPreset,
    storageKey,
  };

  describe('Rendering', () => {
    it('should render save button when filters are active', () => {
      render(<FilterPresets {...defaultProps} />);
      expect(screen.getByText('Save Filters')).toBeInTheDocument();
    });

    it('should not render save button when no active filters', () => {
      render(<FilterPresets {...defaultProps} currentFilters={{}} />);
      expect(screen.queryByText('Save Filters')).not.toBeInTheDocument();
    });

    it('should handle empty filters object', () => {
      render(<FilterPresets {...defaultProps} currentFilters={{}} />);
      expect(screen.queryByText('Save Filters')).not.toBeInTheDocument();
    });
  });

  describe('Save Dialog', () => {
    it('should open save dialog when save button clicked', async () => {
      render(<FilterPresets {...defaultProps} />);
      fireEvent.click(screen.getByText('Save Filters'));

      expect(await screen.findByText('Save Filter Preset')).toBeInTheDocument();
    });

    it('should show filter count in save dialog', async () => {
      render(<FilterPresets {...defaultProps} />);
      fireEvent.click(screen.getByText('Save Filters'));

      expect(await screen.findByText(/2 filters will be saved/i)).toBeInTheDocument();
    });

    it('should close dialog on cancel', async () => {
      render(<FilterPresets {...defaultProps} />);
      fireEvent.click(screen.getByText('Save Filters'));

      expect(await screen.findByText('Save Filter Preset')).toBeInTheDocument();

      fireEvent.click(screen.getByText('Cancel'));

      await waitFor(() => {
        expect(screen.queryByText('Save Filter Preset')).not.toBeInTheDocument();
      });
    });

    it('should have save button disabled when preset name is empty', async () => {
      render(<FilterPresets {...defaultProps} />);
      fireEvent.click(screen.getByText('Save Filters'));

      await screen.findByText('Save Filter Preset');

      const saveButton = screen.getByRole('button', { name: /Save Preset/i });
      expect(saveButton).toBeDisabled();
    });
  });

  describe('LocalStorage', () => {
    it('should handle corrupted localStorage data', async () => {
      localStorage.setItem(`filter_presets_${storageKey}`, 'invalid json');

      render(<FilterPresets {...defaultProps} currentFilters={{}} />);

      // Component should render without crashing
      await waitFor(() => {
        expect(screen.queryByText('Presets')).not.toBeInTheDocument();
      });
    });
  });
});
