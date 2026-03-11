import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import type { UseFormRegister } from 'react-hook-form';

vi.mock('lucide-react', () => ({
  TrendingUp: (props: Record<string, unknown>) => <svg data-testid="trending-icon" {...props} />,
}));

function createMockRegister(): Mock<any> & UseFormRegister<any> {
  return vi.fn((name: string, options?: Record<string, unknown>) => ({
    name,
    onChange: vi.fn(),
    onBlur: vi.fn(),
    ref: vi.fn(),
  })) as unknown as Mock<any> & UseFormRegister<any>;
}

import { PricingStep } from './PricingStep';

const priceSuggestion = {
  sampleSize: 15,
  averagePrice: 30,
  medianPrice: 25,
  suggestedRange: { low: 20, high: 40 },
};

describe('PricingStep', () => {
  let register: ReturnType<typeof createMockRegister>;

  beforeEach(() => {
    register = createMockRegister();
  });

  it('renders heading', () => {
    render(<PricingStep register={register} errors={{}} />);
    expect(screen.getByText('Pricing & Condition')).toBeInTheDocument();
  });

  it('renders price per day field', () => {
    render(<PricingStep register={register} errors={{}} />);
    expect(screen.getByText(/Price per Day/)).toBeInTheDocument();
    expect(register).toHaveBeenCalledWith('basePrice', expect.objectContaining({ valueAsNumber: true }));
  });

  it('renders price per week and month fields', () => {
    render(<PricingStep register={register} errors={{}} />);
    expect(screen.getByText(/Price per Week/)).toBeInTheDocument();
    expect(screen.getByText(/Price per Month/)).toBeInTheDocument();
  });

  it('renders security deposit field', () => {
    render(<PricingStep register={register} errors={{}} />);
    expect(screen.getByText(/Security Deposit/)).toBeInTheDocument();
    expect(register).toHaveBeenCalledWith('securityDeposit', expect.objectContaining({ valueAsNumber: true }));
  });

  it('renders condition select with all options', () => {
    render(<PricingStep register={register} errors={{}} />);
    expect(screen.getByText('Condition *')).toBeInTheDocument();
    expect(screen.getByText('New')).toBeInTheDocument();
    expect(screen.getByText('Like New')).toBeInTheDocument();
    expect(screen.getByText('Good')).toBeInTheDocument();
    expect(screen.getByText('Fair')).toBeInTheDocument();
    expect(screen.getByText('Poor')).toBeInTheDocument();
  });

  it('does not show price suggestion when not provided', () => {
    render(<PricingStep register={register} errors={{}} />);
    expect(screen.queryByText(/Price suggestion/)).not.toBeInTheDocument();
  });

  it('shows price suggestion banner when provided', () => {
    render(
      <PricingStep register={register} errors={{}} priceSuggestion={priceSuggestion} />
    );
    expect(screen.getByText(/Price suggestion based on 15 similar listings/)).toBeInTheDocument();
  });

  it('displays suggested range in banner', () => {
    render(
      <PricingStep register={register} errors={{}} priceSuggestion={priceSuggestion} />
    );
    expect(screen.getByText(/\$\s*20/)).toBeInTheDocument();
    expect(screen.getByText(/\$\s*40\/day/)).toBeInTheDocument();
  });

  it('renders "Use median price" button when callback provided', () => {
    const onUse = vi.fn();
    render(
      <PricingStep
        register={register}
        errors={{}}
        priceSuggestion={priceSuggestion}
        onUseSuggestedPrice={onUse}
      />
    );
    const btn = screen.getByText(/Use median price/);
    expect(btn).toBeInTheDocument();
  });

  it('calls onUseSuggestedPrice with median when clicked', () => {
    const onUse = vi.fn();
    render(
      <PricingStep
        register={register}
        errors={{}}
        priceSuggestion={priceSuggestion}
        onUseSuggestedPrice={onUse}
      />
    );
    fireEvent.click(screen.getByText(/Use median price/));
    expect(onUse).toHaveBeenCalledWith(25);
  });

  it('does not render "Use median price" button when callback not provided', () => {
    render(
      <PricingStep register={register} errors={{}} priceSuggestion={priceSuggestion} />
    );
    expect(screen.queryByText(/Use median price/)).not.toBeInTheDocument();
  });

  it('displays basePrice error', () => {
    const errors = { basePrice: { message: 'Price is required', type: 'required' } };
    render(<PricingStep register={register} errors={errors} />);
    expect(screen.getByText('Price is required')).toBeInTheDocument();
  });

  it('displays securityDeposit error', () => {
    const errors = { securityDeposit: { message: 'Deposit required', type: 'required' } };
    render(<PricingStep register={register} errors={errors} />);
    expect(screen.getByText('Deposit required')).toBeInTheDocument();
  });

  it('displays condition error', () => {
    const errors = { condition: { message: 'Select a condition', type: 'required' } };
    render(<PricingStep register={register} errors={errors} />);
    expect(screen.getByText('Select a condition')).toBeInTheDocument();
  });

  it('renders trending icon in suggestion banner', () => {
    render(
      <PricingStep register={register} errors={{}} priceSuggestion={priceSuggestion} />
    );
    expect(screen.getByTestId('trending-icon')).toBeInTheDocument();
  });

  it('handles singular listing text for sampleSize=1', () => {
    const single = { ...priceSuggestion, sampleSize: 1 };
    render(<PricingStep register={register} errors={{}} priceSuggestion={single} />);
    expect(screen.getByText(/1 similar listing$/)).toBeInTheDocument();
  });
});
