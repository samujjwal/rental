import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import type { UseFormRegister } from 'react-hook-form';

function createMockRegister(): Mock<any> & UseFormRegister<any> {
  return vi.fn((name: string, options?: Record<string, unknown>) => ({
    name,
    onChange: vi.fn(),
    onBlur: vi.fn(),
    ref: vi.fn(),
  })) as unknown as Mock<any> & UseFormRegister<any>;
}

import { LocationStep } from './LocationStep';

describe('LocationStep', () => {
  let register: ReturnType<typeof createMockRegister>;

  beforeEach(() => {
    register = createMockRegister();
  });

  it('renders heading', () => {
    render(<LocationStep register={register} errors={{}} />);
    expect(screen.getByText('Location')).toBeInTheDocument();
  });

  it('renders address field', () => {
    render(<LocationStep register={register} errors={{}} />);
    expect(screen.getByText('Address *')).toBeInTheDocument();
    expect(register).toHaveBeenCalledWith('location.address');
  });

  it('renders city field', () => {
    render(<LocationStep register={register} errors={{}} />);
    expect(screen.getByText('City *')).toBeInTheDocument();
    expect(register).toHaveBeenCalledWith('location.city');
  });

  it('renders state field', () => {
    render(<LocationStep register={register} errors={{}} />);
    expect(screen.getByText('State *')).toBeInTheDocument();
    expect(register).toHaveBeenCalledWith('location.state');
  });

  it('renders country field', () => {
    render(<LocationStep register={register} errors={{}} />);
    expect(screen.getByText('Country *')).toBeInTheDocument();
    expect(register).toHaveBeenCalledWith('location.country');
  });

  it('renders postal code field', () => {
    render(<LocationStep register={register} errors={{}} />);
    expect(screen.getByText('Postal Code *')).toBeInTheDocument();
    expect(register).toHaveBeenCalledWith('location.postalCode');
  });

  it('renders latitude and longitude fields', () => {
    render(<LocationStep register={register} errors={{}} />);
    expect(screen.getByText('Latitude *')).toBeInTheDocument();
    expect(screen.getByText('Longitude *')).toBeInTheDocument();
    expect(register).toHaveBeenCalledWith('location.coordinates.lat', expect.objectContaining({ valueAsNumber: true }));
    expect(register).toHaveBeenCalledWith('location.coordinates.lng', expect.objectContaining({ valueAsNumber: true }));
  });

  it('displays address error', () => {
    const errors = { location: { address: { message: 'Address required', type: 'required' } } };
    render(<LocationStep register={register} errors={errors} />);
    expect(screen.getByText('Address required')).toBeInTheDocument();
  });

  it('displays city error', () => {
    const errors = { location: { city: { message: 'City required', type: 'required' } } };
    render(<LocationStep register={register} errors={errors} />);
    expect(screen.getByText('City required')).toBeInTheDocument();
  });

  it('displays state error', () => {
    const errors = { location: { state: { message: 'State required', type: 'required' } } };
    render(<LocationStep register={register} errors={errors} />);
    expect(screen.getByText('State required')).toBeInTheDocument();
  });

  it('displays country error', () => {
    const errors = { location: { country: { message: 'Country needed', type: 'required' } } };
    render(<LocationStep register={register} errors={errors} />);
    expect(screen.getByText('Country needed')).toBeInTheDocument();
  });

  it('displays postal code error', () => {
    const errors = { location: { postalCode: { message: 'Invalid postal code', type: 'pattern' } } };
    render(<LocationStep register={register} errors={errors} />);
    expect(screen.getByText('Invalid postal code')).toBeInTheDocument();
  });

  it('does not show errors when errors object is empty', () => {
    const { container } = render(<LocationStep register={register} errors={{}} />);
    expect(container.querySelectorAll('.text-destructive')).toHaveLength(0);
  });

  it('renders all 7 input fields', () => {
    const { container } = render(<LocationStep register={register} errors={{}} />);
    const inputs = container.querySelectorAll('input');
    expect(inputs).toHaveLength(7);
  });
});
