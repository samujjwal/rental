import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { AIListingAssistant } from '~/components/listings/AIListingAssistant';
import { useTranslation } from 'react-i18next';

// Mock the translation hook
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, defaultValue?: string) => defaultValue || key,
  }),
}));

// Mock the AI API
vi.mock('~/lib/api/ai', () => ({
  aiApi: {
    generateListingSuggestions: vi.fn(),
    getMarketInsights: vi.fn(),
  },
}));

import { aiApi } from '~/lib/api/ai';

describe('AIListingAssistant', () => {
  const mockOnSuggestionApply = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock AI API responses
    vi.mocked(aiApi.generateListingSuggestions).mockResolvedValue({
      suggestions: [
        {
          type: 'title',
          field: 'title',
          suggestion: 'Premium Camera for Rent - Excellent Condition',
          confidence: 0.85,
          reasoning: 'Titles with category and condition keywords perform better'
        },
        {
          type: 'pricing',
          field: 'basePrice',
          suggestion: '5000',
          confidence: 0.8,
          reasoning: 'Based on market data for electronics in your area'
        }
      ]
    });

    vi.mocked(aiApi.getMarketInsights).mockResolvedValue({
      category: 'electronics',
      averagePrice: 5000,
      priceRange: { min: 2000, max: 15000 },
      demand: 'high',
      popularFeatures: ['Warranty', 'Original packaging', 'Accessories included'],
      seasonalTrends: ['Higher demand during holiday seasons', 'New releases drive up prices'],
      competitorCount: 45
    });
  });

  const mockListingData = {
    title: '',
    description: '',
    category: 'electronics',
    location: {
      address: 'Test Address',
      city: 'Kathmandu',
      state: 'Bagmati',
      country: 'Nepal',
      postalCode: '44600',
      coordinates: { lat: 27.7172, lng: 85.3240 }
    },
    basePrice: undefined,
  };

  it('renders AI assistant header', () => {
    render(
      <AIListingAssistant
        listingData={mockListingData}
        category="electronics"
        onSuggestionApply={mockOnSuggestionApply}
      />
    );

    expect(screen.getByText('AI Assistant')).toBeInTheDocument();
    expect(screen.getByText('Suggestions')).toBeInTheDocument();
    expect(screen.getByText('Market Insights')).toBeInTheDocument();
  });

  it('generates suggestions when listing data changes', async () => {
    render(
      <AIListingAssistant
        listingData={mockListingData}
        category="electronics"
        onSuggestionApply={mockOnSuggestionApply}
      />
    );

    await waitFor(() => {
      expect(aiApi.generateListingSuggestions).toHaveBeenCalledWith({
        currentData: mockListingData,
        category: 'electronics'
      });
    });
  });

  it('fetches market insights when category changes', async () => {
    render(
      <AIListingAssistant
        listingData={mockListingData}
        category="electronics"
        onSuggestionApply={mockOnSuggestionApply}
      />
    );

    await waitFor(() => {
      expect(aiApi.getMarketInsights).toHaveBeenCalledWith('electronics');
    });
  });

  it('displays suggestions correctly', async () => {
    render(
      <AIListingAssistant
        listingData={mockListingData}
        category="electronics"
        onSuggestionApply={mockOnSuggestionApply}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Premium Camera for Rent - Excellent Condition')).toBeInTheDocument();
      expect(screen.getByText('5000')).toBeInTheDocument();
      expect(screen.getByText('85% confidence')).toBeInTheDocument();
      expect(screen.getByText('80% confidence')).toBeInTheDocument();
    });
  });

  it('applies suggestions when clicked', async () => {
    render(
      <AIListingAssistant
        listingData={mockListingData}
        category="electronics"
        onSuggestionApply={mockOnSuggestionApply}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('AI Suggestions')).toBeInTheDocument();
    });

    // Click the first apply button
    const applyButtons = screen.getAllByText('Apply');
    expect(applyButtons.length).toBeGreaterThan(0);
    fireEvent.click(applyButtons[0]);

    expect(mockOnSuggestionApply).toHaveBeenCalled();
  });

  it('shows market insights correctly', async () => {
    render(
      <AIListingAssistant
        listingData={mockListingData}
        category="electronics"
        onSuggestionApply={mockOnSuggestionApply}
      />
    );

    // Switch to insights tab
    const insightsTab = screen.getByText('Market Insights');
    fireEvent.click(insightsTab);

    await waitFor(() => {
      expect(screen.getByText('Market Demand')).toBeInTheDocument();
      expect(screen.getByText('HIGH')).toBeInTheDocument();
      expect(screen.getByText('$5,000')).toBeInTheDocument();
      expect(screen.getByText('$2,000')).toBeInTheDocument();
      expect(screen.getByText('$15,000')).toBeInTheDocument();
    });
  });

  it('shows popular features', async () => {
    render(
      <AIListingAssistant
        listingData={mockListingData}
        category="electronics"
        onSuggestionApply={mockOnSuggestionApply}
      />
    );

    // Switch to insights tab
    const insightsTab = screen.getByText('Market Insights');
    fireEvent.click(insightsTab);

    await waitFor(() => {
      expect(screen.getByText('Popular Features')).toBeInTheDocument();
      expect(screen.getByText('Warranty')).toBeInTheDocument();
      expect(screen.getByText('Original packaging')).toBeInTheDocument();
      expect(screen.getByText('Accessories included')).toBeInTheDocument();
    });
  });

  it('shows seasonal trends', async () => {
    render(
      <AIListingAssistant
        listingData={mockListingData}
        category="electronics"
        onSuggestionApply={mockOnSuggestionApply}
      />
    );

    // Switch to insights tab
    const insightsTab = screen.getByText('Market Insights');
    fireEvent.click(insightsTab);

    await waitFor(() => {
      expect(screen.getByText('Seasonal Trends')).toBeInTheDocument();
      expect(screen.getByText('Higher demand during holiday seasons')).toBeInTheDocument();
      expect(screen.getByText('New releases drive up prices')).toBeInTheDocument();
    });
  });

  it('shows competition information', async () => {
    render(
      <AIListingAssistant
        listingData={mockListingData}
        category="electronics"
        onSuggestionApply={mockOnSuggestionApply}
      />
    );

    // Switch to insights tab
    const insightsTab = screen.getByText('Market Insights');
    fireEvent.click(insightsTab);

    await waitFor(() => {
      expect(screen.getByText('Competition')).toBeInTheDocument();
      expect(screen.getByText('45')).toBeInTheDocument();
      expect(screen.getByText('similar listings in your area')).toBeInTheDocument();
    });
  });

  it('handles different demand levels', async () => {
    vi.mocked(aiApi.getMarketInsights).mockResolvedValue({
      category: 'furniture',
      averagePrice: 3000,
      priceRange: { min: 1000, max: 8000 },
      demand: 'medium',
      popularFeatures: ['Assembly included'],
      seasonalTrends: ['Higher demand during moving seasons'],
      competitorCount: 32
    });

    render(
      <AIListingAssistant
        listingData={{ ...mockListingData, category: 'furniture' }}
        category="furniture"
        onSuggestionApply={mockOnSuggestionApply}
      />
    );

    // Switch to insights tab
    const insightsTab = screen.getByText('Market Insights');
    fireEvent.click(insightsTab);

    await waitFor(() => {
      expect(screen.getByText('MEDIUM')).toBeInTheDocument();
    });
  });

  it('shows loading state while generating suggestions', () => {
    vi.mocked(aiApi.generateListingSuggestions).mockImplementation(() => new Promise(() => {}));

    render(
      <AIListingAssistant
        listingData={mockListingData}
        category="electronics"
        onSuggestionApply={mockOnSuggestionApply}
      />
    );

    expect(screen.getByText('Generating AI suggestions...')).toBeInTheDocument();
  });

  it('shows no suggestions message when no data', () => {
    vi.mocked(aiApi.generateListingSuggestions).mockResolvedValue({ suggestions: [] });

    render(
      <AIListingAssistant
        listingData={{}}
        category=""
        onSuggestionApply={mockOnSuggestionApply}
      />
    );

    expect(screen.getByText('Add more details to get AI suggestions')).toBeInTheDocument();
  });

  it('handles suggestion regeneration', async () => {
    render(
      <AIListingAssistant
        listingData={mockListingData}
        category="electronics"
        onSuggestionApply={mockOnSuggestionApply}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Regenerate Suggestions')).toBeInTheDocument();
    });

    const regenerateButton = screen.getByText('Regenerate Suggestions');
    fireEvent.click(regenerateButton);

    expect(aiApi.generateListingSuggestions).toHaveBeenCalledTimes(2);
  });

  it('handles API errors gracefully', async () => {
    vi.mocked(aiApi.generateListingSuggestions).mockRejectedValue(new Error('API Error'));

    render(
      <AIListingAssistant
        listingData={mockListingData}
        category="electronics"
        onSuggestionApply={mockOnSuggestionApply}
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/AI Suggestions/)).toBeInTheDocument();
      expect(screen.getByText('This feature is not yet available in this environment.')).toBeInTheDocument();
    });
  });

  it('marks applied suggestions', async () => {
    render(
      <AIListingAssistant
        listingData={mockListingData}
        category="electronics"
        onSuggestionApply={mockOnSuggestionApply}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Premium Camera for Rent - Excellent Condition')).toBeInTheDocument();
    });

    const applyButton = screen.getAllByText('Apply')[0];
    fireEvent.click(applyButton);

    // Should show checkmark for applied suggestion
    await waitFor(() => {
      expect(mockOnSuggestionApply).toHaveBeenCalled();
    });
  });

  it('shows confidence indicators with correct colors', async () => {
    render(
      <AIListingAssistant
        listingData={mockListingData}
        category="electronics"
        onSuggestionApply={mockOnSuggestionApply}
      />
    );

    await waitFor(() => {
      const highConfidence = screen.getByText('85% confidence');
      const mediumConfidence = screen.getByText('80% confidence');
      
      expect(highConfidence).toBeInTheDocument();
      expect(mediumConfidence).toBeInTheDocument();
    });
  });

  it('handles empty category gracefully', async () => {
    render(
      <AIListingAssistant
        listingData={mockListingData}
        category=""
        onSuggestionApply={mockOnSuggestionApply}
      />
    );

    await waitFor(() => {
      expect(aiApi.getMarketInsights).not.toHaveBeenCalled();
    });
  });
});
