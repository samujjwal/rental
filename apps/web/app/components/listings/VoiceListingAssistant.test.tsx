import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('lucide-react', () => ({
  Mic: (props: Record<string, unknown>) => <svg data-testid="mic-icon" {...props} />,
  MicOff: (props: Record<string, unknown>) => <svg data-testid="mic-off-icon" {...props} />,
}));

import { VoiceListingAssistant } from './VoiceListingAssistant';

const baseCategories = [
  { id: 'cat-1', name: 'Electronics' },
  { id: 'cat-2', name: 'Furniture' },
];

// Mock SpeechRecognition
class MockSpeechRecognition {
  lang = '';
  continuous = false;
  interimResults = false;
  onstart: (() => void) | null = null;
  onresult: ((event: any) => void) | null = null;
  onend: (() => void) | null = null;
  onerror: (() => void) | null = null;
  
  start() {
    this.onstart?.();
  }
  stop() {
    this.onend?.();
  }
  
  simulateResult(transcript: string) {
    this.onresult?.({
      results: [[{ transcript }]],
    });
  }
  
  simulateError() {
    this.onerror?.();
  }
}

let lastCreatedRecognition: MockSpeechRecognition;

describe('VoiceListingAssistant', () => {
  beforeEach(() => {
    // Use a real class so `new` works
    (window as any).SpeechRecognition = class extends MockSpeechRecognition {
      constructor() {
        super();
        // eslint-disable-next-line @typescript-eslint/no-this-alias
        lastCreatedRecognition = this;
      }
    };
  });

  afterEach(() => {
    delete (window as any).SpeechRecognition;
    delete (window as any).webkitSpeechRecognition;
  });

  it('renders when SpeechRecognition is supported', () => {
    render(<VoiceListingAssistant categories={baseCategories} onSetField={vi.fn()} />);
    expect(screen.getByText('Voice assistant')).toBeInTheDocument();
  });

  it('returns null when SpeechRecognition is not supported', () => {
    delete (window as any).SpeechRecognition;
    const { container } = render(
      <VoiceListingAssistant categories={baseCategories} onSetField={vi.fn()} />
    );
    expect(container.innerHTML).toBe('');
  });

  it('shows Speak button initially', () => {
    render(<VoiceListingAssistant categories={baseCategories} onSetField={vi.fn()} />);
    expect(screen.getByText('Speak')).toBeInTheDocument();
    expect(screen.getByTestId('mic-icon')).toBeInTheDocument();
  });

  it('shows Stop button while listening', () => {
    render(<VoiceListingAssistant categories={baseCategories} onSetField={vi.fn()} />);
    fireEvent.click(screen.getByText('Speak'));
    expect(screen.getByText('Stop')).toBeInTheDocument();
    expect(screen.getByTestId('mic-off-icon')).toBeInTheDocument();
  });

  it('shows Listening... status when started', () => {
    render(<VoiceListingAssistant categories={baseCategories} onSetField={vi.fn()} />);
    fireEvent.click(screen.getByText('Speak'));
    expect(screen.getByText('Listening...')).toBeInTheDocument();
  });

  it('sets title from voice command', () => {
    const onSetField = vi.fn();
    render(<VoiceListingAssistant categories={baseCategories} onSetField={onSetField} />);
    fireEvent.click(screen.getByText('Speak'));
    act(() => lastCreatedRecognition.simulateResult('title My Great Camera'));
    expect(onSetField).toHaveBeenCalledWith('title', 'My Great Camera');
    expect(screen.getByText('Updated title.')).toBeInTheDocument();
  });

  it('sets description from voice command', () => {
    const onSetField = vi.fn();
    render(<VoiceListingAssistant categories={baseCategories} onSetField={onSetField} />);
    fireEvent.click(screen.getByText('Speak'));
    act(() => lastCreatedRecognition.simulateResult('description A nice rental item'));
    expect(onSetField).toHaveBeenCalledWith('description', 'A nice rental item');
  });

  it('sets base price from voice command', () => {
    const onSetField = vi.fn();
    render(<VoiceListingAssistant categories={baseCategories} onSetField={onSetField} />);
    fireEvent.click(screen.getByText('Speak'));
    act(() => lastCreatedRecognition.simulateResult('price per day 45'));
    expect(onSetField).toHaveBeenCalledWith('basePrice', 45);
  });

  it('sets category from voice command', () => {
    const onSetField = vi.fn();
    render(<VoiceListingAssistant categories={baseCategories} onSetField={onSetField} />);
    fireEvent.click(screen.getByText('Speak'));
    act(() => lastCreatedRecognition.simulateResult('category electronics'));
    expect(onSetField).toHaveBeenCalledWith('category', 'cat-1');
    expect(screen.getByText('Set category to Electronics.')).toBeInTheDocument();
  });

  it('shows not recognized for unknown category', () => {
    render(<VoiceListingAssistant categories={baseCategories} onSetField={vi.fn()} />);
    fireEvent.click(screen.getByText('Speak'));
    act(() => lastCreatedRecognition.simulateResult('category nonexistent'));
    expect(screen.getByText('Category not recognized.')).toBeInTheDocument();
  });

  it('calls onNextStep for "next step" command', () => {
    const onNextStep = vi.fn();
    render(
      <VoiceListingAssistant categories={baseCategories} onSetField={vi.fn()} onNextStep={onNextStep} />
    );
    fireEvent.click(screen.getByText('Speak'));
    act(() => lastCreatedRecognition.simulateResult('next step'));
    expect(onNextStep).toHaveBeenCalled();
  });

  it('calls onPrevStep for "previous step" command', () => {
    const onPrevStep = vi.fn();
    render(
      <VoiceListingAssistant categories={baseCategories} onSetField={vi.fn()} onPrevStep={onPrevStep} />
    );
    fireEvent.click(screen.getByText('Speak'));
    act(() => lastCreatedRecognition.simulateResult('previous step'));
    expect(onPrevStep).toHaveBeenCalled();
  });

  it('enables instant booking from voice', () => {
    const onSetField = vi.fn();
    render(<VoiceListingAssistant categories={baseCategories} onSetField={onSetField} />);
    fireEvent.click(screen.getByText('Speak'));
    act(() => lastCreatedRecognition.simulateResult('instant booking on'));
    expect(onSetField).toHaveBeenCalledWith('instantBooking', true);
  });

  it('disables instant booking from voice', () => {
    const onSetField = vi.fn();
    render(<VoiceListingAssistant categories={baseCategories} onSetField={onSetField} />);
    fireEvent.click(screen.getByText('Speak'));
    act(() => lastCreatedRecognition.simulateResult('instant booking off'));
    expect(onSetField).toHaveBeenCalledWith('instantBooking', false);
  });

  it('sets security deposit from voice', () => {
    const onSetField = vi.fn();
    render(<VoiceListingAssistant categories={baseCategories} onSetField={onSetField} />);
    fireEvent.click(screen.getByText('Speak'));
    act(() => lastCreatedRecognition.simulateResult('security deposit 500'));
    expect(onSetField).toHaveBeenCalledWith('securityDeposit', 500);
  });

  it('sets city from voice command', () => {
    const onSetField = vi.fn();
    render(<VoiceListingAssistant categories={baseCategories} onSetField={onSetField} />);
    fireEvent.click(screen.getByText('Speak'));
    act(() => lastCreatedRecognition.simulateResult('city Kathmandu'));
    expect(onSetField).toHaveBeenCalledWith('location.city', 'Kathmandu');
  });

  it('shows last heard transcript', () => {
    render(<VoiceListingAssistant categories={baseCategories} onSetField={vi.fn()} />);
    fireEvent.click(screen.getByText('Speak'));
    act(() => lastCreatedRecognition.simulateResult('title Hello'));
    expect(screen.getByText(/Heard: "title Hello"/)).toBeInTheDocument();
  });

  it('shows command not recognized for unknown input', () => {
    render(<VoiceListingAssistant categories={baseCategories} onSetField={vi.fn()} />);
    fireEvent.click(screen.getByText('Speak'));
    act(() => lastCreatedRecognition.simulateResult('random gibberish'));
    expect(screen.getByText('Command not recognized.')).toBeInTheDocument();
  });

  it('shows error status on voice error', () => {
    render(<VoiceListingAssistant categories={baseCategories} onSetField={vi.fn()} />);
    fireEvent.click(screen.getByText('Speak'));
    act(() => lastCreatedRecognition.simulateError());
    expect(screen.getByText('Voice input failed. Please try again.')).toBeInTheDocument();
  });

  it('shows instruction text', () => {
    render(<VoiceListingAssistant categories={baseCategories} onSetField={vi.fn()} />);
    expect(screen.getByText(/Say commands like/)).toBeInTheDocument();
  });
});
