import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

vi.mock('lucide-react', () => ({
  CheckCircle: (props: Record<string, unknown>) => <svg data-testid="check-circle-icon" {...props} />,
}));

vi.mock('~/lib/utils', () => ({
  cn: (...args: any[]) => args.filter(Boolean).join(' '),
}));

import { ListingStepIndicator } from './ListingStepIndicator';

const steps = [
  { id: 1, name: 'Details' },
  { id: 2, name: 'Location' },
  { id: 3, name: 'Pricing' },
  { id: 4, name: 'Images' },
];

describe('ListingStepIndicator', () => {
  it('renders all step names', () => {
    render(<ListingStepIndicator steps={steps} currentStep={1} />);
    expect(screen.getByText('Details')).toBeInTheDocument();
    expect(screen.getByText('Location')).toBeInTheDocument();
    expect(screen.getByText('Pricing')).toBeInTheDocument();
    expect(screen.getByText('Images')).toBeInTheDocument();
  });

  it('displays step numbers for future steps', () => {
    render(<ListingStepIndicator steps={steps} currentStep={1} />);
    // Steps 2, 3, 4 should show their numbers
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
  });

  it('displays step number for current step', () => {
    render(<ListingStepIndicator steps={steps} currentStep={2} />);
    // Step 2 is current, should show number
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('shows check icon for completed steps', () => {
    render(<ListingStepIndicator steps={steps} currentStep={3} />);
    // Steps 1 and 2 are completed (currentStep > step.id)
    const checkIcons = screen.getAllByTestId('check-circle-icon');
    expect(checkIcons).toHaveLength(2);
  });

  it('shows no check icon when on first step', () => {
    render(<ListingStepIndicator steps={steps} currentStep={1} />);
    expect(screen.queryByTestId('check-circle-icon')).not.toBeInTheDocument();
  });

  it('shows all check icons when past all steps', () => {
    render(<ListingStepIndicator steps={steps} currentStep={5} />);
    const checkIcons = screen.getAllByTestId('check-circle-icon');
    expect(checkIcons).toHaveLength(4);
  });

  it('renders connector lines between steps', () => {
    const { container } = render(
      <ListingStepIndicator steps={steps} currentStep={1} />
    );
    // 4 steps = 3 connector lines (index < steps.length - 1)
    const connectors = container.querySelectorAll('[style*="min-width"]');
    expect(connectors).toHaveLength(3);
  });

  it('applies completed style to connectors for passed steps', () => {
    const { container } = render(
      <ListingStepIndicator steps={steps} currentStep={3} />
    );
    const connectors = container.querySelectorAll('[style*="min-width"]');
    // Steps 1 and 2 completed → connectors after steps 1 and 2 are success-colored
    expect(connectors[0].className).toContain('bg-success');
    expect(connectors[1].className).toContain('bg-success');
    expect(connectors[2].className).toContain('bg-muted');
  });

  it('applies current step style to the active step circle', () => {
    const { container } = render(
      <ListingStepIndicator steps={steps} currentStep={2} />
    );
    const circles = container.querySelectorAll('.rounded-full');
    // Step 2 (index 1) should have primary styling
    expect(circles[1].className).toContain('bg-primary');
  });

  it('applies muted style to future step circles', () => {
    const { container } = render(
      <ListingStepIndicator steps={steps} currentStep={1} />
    );
    const circles = container.querySelectorAll('.rounded-full');
    // Steps 2, 3, 4 (indices 1, 2, 3) should have muted styling
    expect(circles[1].className).toContain('bg-muted');
    expect(circles[2].className).toContain('bg-muted');
    expect(circles[3].className).toContain('bg-muted');
  });

  it('works with a single step', () => {
    const singleStep = [{ id: 1, name: 'Only Step' }];
    render(<ListingStepIndicator steps={singleStep} currentStep={1} />);
    expect(screen.getByText('Only Step')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('works with two steps', () => {
    const twoSteps = [
      { id: 1, name: 'First' },
      { id: 2, name: 'Second' },
    ];
    const { container } = render(
      <ListingStepIndicator steps={twoSteps} currentStep={1} />
    );
    expect(screen.getByText('First')).toBeInTheDocument();
    expect(screen.getByText('Second')).toBeInTheDocument();
    const connectors = container.querySelectorAll('[style*="min-width"]');
    expect(connectors).toHaveLength(1);
  });

  it('completed step circle has bg-success class', () => {
    const { container } = render(
      <ListingStepIndicator steps={steps} currentStep={2} />
    );
    const circles = container.querySelectorAll('.rounded-full');
    // Step 1 is completed
    expect(circles[0].className).toContain('bg-success');
  });
});
