import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import type { UseFormRegister } from 'react-hook-form';

// Mock react-hook-form register function
function createMockRegister(): Mock<any> & UseFormRegister<any> {
  return vi.fn((name: string, options?: Record<string, unknown>) => ({
    name,
    onChange: vi.fn(),
    onBlur: vi.fn(),
    ref: vi.fn(),
  })) as unknown as Mock<any> & UseFormRegister<any>;
}

import { DetailsStep } from './DetailsStep';

describe('DetailsStep', () => {
  let register: ReturnType<typeof createMockRegister>;

  beforeEach(() => {
    register = createMockRegister();
  });

  it('renders heading', () => {
    render(
      <DetailsStep register={register} errors={{}} showDeliveryFields={false} />
    );
    expect(screen.getByText('Rental Details')).toBeInTheDocument();
  });

  it('renders delivery option checkboxes', () => {
    render(
      <DetailsStep register={register} errors={{}} showDeliveryFields={false} />
    );
    expect(screen.getByText('Pickup')).toBeInTheDocument();
    expect(screen.getByText('Delivery')).toBeInTheDocument();
    expect(screen.getByText('Shipping')).toBeInTheDocument();
  });

  it('registers delivery option fields', () => {
    render(
      <DetailsStep register={register} errors={{}} showDeliveryFields={false} />
    );
    expect(register).toHaveBeenCalledWith('deliveryOptions.pickup');
    expect(register).toHaveBeenCalledWith('deliveryOptions.delivery');
    expect(register).toHaveBeenCalledWith('deliveryOptions.shipping');
  });

  it('does not show delivery fields when showDeliveryFields is false', () => {
    render(
      <DetailsStep register={register} errors={{}} showDeliveryFields={false} />
    );
    expect(screen.queryByText('Delivery Radius (km)')).not.toBeInTheDocument();
    expect(screen.queryByText(/Delivery Fee/)).not.toBeInTheDocument();
  });

  it('shows delivery fields when showDeliveryFields is true', () => {
    render(
      <DetailsStep register={register} errors={{}} showDeliveryFields={true} />
    );
    expect(screen.getByText('Delivery Radius (km)')).toBeInTheDocument();
    // Currency code depends on locale config
    expect(screen.getByText(/Delivery Fee/)).toBeInTheDocument();
  });

  it('registers deliveryRadius and deliveryFee when visible', () => {
    render(
      <DetailsStep register={register} errors={{}} showDeliveryFields={true} />
    );
    expect(register).toHaveBeenCalledWith('deliveryRadius', expect.objectContaining({ valueAsNumber: true }));
    expect(register).toHaveBeenCalledWith('deliveryFee', expect.objectContaining({ valueAsNumber: true }));
  });

  it('renders minimum and maximum rental period fields', () => {
    render(
      <DetailsStep register={register} errors={{}} showDeliveryFields={false} />
    );
    expect(screen.getByText(/Minimum Rental Period/)).toBeInTheDocument();
    expect(screen.getByText(/Maximum Rental Period/)).toBeInTheDocument();
  });

  it('registers rental period fields as numbers', () => {
    render(
      <DetailsStep register={register} errors={{}} showDeliveryFields={false} />
    );
    expect(register).toHaveBeenCalledWith('minimumRentalPeriod', expect.objectContaining({ valueAsNumber: true }));
    expect(register).toHaveBeenCalledWith('maximumRentalPeriod', expect.objectContaining({ valueAsNumber: true }));
  });

  it('renders cancellation policy select', () => {
    render(
      <DetailsStep register={register} errors={{}} showDeliveryFields={false} />
    );
    expect(screen.getByText(/Cancellation Policy/)).toBeInTheDocument();
    expect(screen.getByText('Flexible')).toBeInTheDocument();
    expect(screen.getByText('Moderate')).toBeInTheDocument();
    expect(screen.getByText('Strict')).toBeInTheDocument();
  });

  it('renders rental rules textarea', () => {
    render(
      <DetailsStep register={register} errors={{}} showDeliveryFields={false} />
    );
    expect(screen.getByText('Rental Rules')).toBeInTheDocument();
    expect(register).toHaveBeenCalledWith('rules');
  });

  it('renders instant booking checkbox', () => {
    render(
      <DetailsStep register={register} errors={{}} showDeliveryFields={false} />
    );
    expect(screen.getByText(/Allow instant booking/)).toBeInTheDocument();
    expect(register).toHaveBeenCalledWith('instantBooking');
  });

  it('displays minimumRentalPeriod error message', () => {
    const errors = {
      minimumRentalPeriod: { message: 'Required field', type: 'required' },
    };
    render(
      <DetailsStep register={register} errors={errors} showDeliveryFields={false} />
    );
    expect(screen.getByText('Required field')).toBeInTheDocument();
  });

  it('does not show errors when errors object is empty', () => {
    const { container } = render(
      <DetailsStep register={register} errors={{}} showDeliveryFields={false} />
    );
    expect(container.querySelectorAll('.text-destructive')).toHaveLength(0);
  });
});
