import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('lucide-react', () => ({
  Save: (props: Record<string, unknown>) => <svg data-testid="save-icon" {...props} />,
  X: (props: Record<string, unknown>) => <svg data-testid="x-icon" {...props} />,
  ArrowLeft: (props: Record<string, unknown>) => <svg data-testid="arrow-left" {...props} />,
  ArrowRight: (props: Record<string, unknown>) => <svg data-testid="arrow-right" {...props} />,
  Check: (props: Record<string, unknown>) => <svg data-testid="check-icon" {...props} />,
  Loader2: (props: Record<string, unknown>) => <svg data-testid="loader-icon" {...props} />,
  AlertCircle: (props: Record<string, unknown>) => <svg data-testid="alert-icon" {...props} />,
  CheckCircle: (props: Record<string, unknown>) => <svg data-testid="check-circle" {...props} />,
}));

import { EnhancedForm, type FieldConfig, type FormStep } from './EnhancedForm';

const textField: FieldConfig = {
  name: 'title',
  label: 'Title',
  type: 'text',
  placeholder: 'Enter title',
};

const requiredField: FieldConfig = {
  name: 'name',
  label: 'Name',
  type: 'text',
  required: true,
};

const selectField: FieldConfig = {
  name: 'status',
  label: 'Status',
  type: 'select',
  options: [
    { value: 'active', label: 'Active' },
    { value: 'draft', label: 'Draft' },
  ],
};

const numberField: FieldConfig = {
  name: 'price',
  label: 'Price',
  type: 'number',
  placeholder: 'Enter price',
};

const booleanField: FieldConfig = {
  name: 'featured',
  label: 'Featured',
  type: 'boolean',
};

describe('EnhancedForm', () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders with title', () => {
    render(<EnhancedForm fields={[textField]} onSubmit={vi.fn()} title="Create Listing" />);
    expect(screen.getByText('Create Listing')).toBeInTheDocument();
  });

  it('renders text field with label', () => {
    render(<EnhancedForm fields={[textField]} onSubmit={vi.fn()} />);
    expect(screen.getByText('Title')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Enter title')).toBeInTheDocument();
  });

  it('renders required indicator', () => {
    render(<EnhancedForm fields={[requiredField]} onSubmit={vi.fn()} />);
    expect(screen.getByText('*')).toBeInTheDocument();
  });

  it('renders select field with options', () => {
    render(<EnhancedForm fields={[selectField]} onSubmit={vi.fn()} />);
    expect(screen.getByText('Status')).toBeInTheDocument();
    expect(screen.getByText('Select...')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByText('Draft')).toBeInTheDocument();
  });

  it('renders number field', () => {
    render(<EnhancedForm fields={[numberField]} onSubmit={vi.fn()} />);
    expect(screen.getByText('Price')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Enter price')).toBeInTheDocument();
  });

  it('renders boolean toggle', () => {
    render(<EnhancedForm fields={[booleanField]} onSubmit={vi.fn()} />);
    expect(screen.getByText('Featured')).toBeInTheDocument();
    expect(screen.getByRole('switch')).toBeInTheDocument();
  });

  it('renders submit button with custom label', () => {
    render(<EnhancedForm fields={[textField]} onSubmit={vi.fn()} submitLabel="Save" />);
    expect(screen.getByText('Save')).toBeInTheDocument();
  });

  it('renders cancel button when onCancel provided', () => {
    render(<EnhancedForm fields={[textField]} onSubmit={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByText('Cancel')).toBeInTheDocument();
  });

  it('calls onCancel when cancel clicked', () => {
    const onCancel = vi.fn();
    render(<EnhancedForm fields={[textField]} onSubmit={vi.fn()} onCancel={onCancel} />);
    fireEvent.click(screen.getByText('Cancel'));
    expect(onCancel).toHaveBeenCalled();
  });

  it('calls onSubmit on form submit', async () => {
    const onSubmit = vi.fn();
    render(<EnhancedForm fields={[textField]} onSubmit={onSubmit} submitLabel="Save" />);
    fireEvent.click(screen.getByText('Save'));
    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalled();
    });
  });

  it('shows success toast on successful submit', async () => {
    const onSubmit = vi.fn();
    render(<EnhancedForm fields={[textField]} onSubmit={onSubmit} submitLabel="Save" />);
    fireEvent.click(screen.getByText('Save'));
    await waitFor(() => {
      expect(screen.getByText('Form submitted successfully!')).toBeInTheDocument();
    });
  });

  it('shows error toast on submit failure', async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error('Save failed'));
    render(<EnhancedForm fields={[textField]} onSubmit={onSubmit} submitLabel="Save" />);
    fireEvent.click(screen.getByText('Save'));
    await waitFor(() => {
      expect(screen.getByText('Save failed')).toBeInTheDocument();
    });
  });

  it('disables submit in view mode', () => {
    render(<EnhancedForm fields={[textField]} onSubmit={vi.fn()} mode="view" submitLabel="Save" />);
    expect(screen.getByText('Save').closest('button')).toBeDisabled();
  });

  it('auto-saves after field changes when enabled', async () => {
    vi.useFakeTimers();
    const onAutoSave = vi.fn().mockResolvedValue(undefined);

    render(
      <EnhancedForm
        fields={[textField]}
        onSubmit={vi.fn()}
        enableAutoSave
        autoSaveInterval={1000}
        onAutoSave={onAutoSave}
      />
    );

    await act(async () => {
      fireEvent.change(screen.getByPlaceholderText('Enter title'), {
        target: { value: 'Updated title' },
      });
      await vi.advanceTimersByTimeAsync(1000);
    });

    expect(onAutoSave).toHaveBeenCalledWith(expect.objectContaining({ title: 'Updated title' }));
  });

  it('does not auto-save in view mode', async () => {
    vi.useFakeTimers();
    const onAutoSave = vi.fn().mockResolvedValue(undefined);

    render(
      <EnhancedForm
        fields={[textField]}
        onSubmit={vi.fn()}
        mode="view"
        enableAutoSave
        autoSaveInterval={1000}
        onAutoSave={onAutoSave}
        initialData={{ title: 'Read only title' }}
      />
    );

    await vi.advanceTimersByTimeAsync(1000);

    expect(onAutoSave).not.toHaveBeenCalled();
  });

  describe('stepped layout', () => {
    const steps: FormStep[] = [
      { id: 'step1', title: 'Basic Info', fields: [textField] },
      { id: 'step2', title: 'Details', fields: [numberField], description: 'Fill in details' },
    ];

    it('renders step indicators', () => {
      render(<EnhancedForm steps={steps} layout="steps" onSubmit={vi.fn()} />);
      expect(screen.getByText('Basic Info')).toBeInTheDocument();
      expect(screen.getByText('Details')).toBeInTheDocument();
    });

    it('shows Next button on first step', () => {
      render(<EnhancedForm steps={steps} layout="steps" onSubmit={vi.fn()} />);
      expect(screen.getByText('Next')).toBeInTheDocument();
      expect(screen.queryByText('Back')).not.toBeInTheDocument();
    });

    it('shows Back button on second step after Next', () => {
      render(<EnhancedForm steps={steps} layout="steps" onSubmit={vi.fn()} />);
      fireEvent.click(screen.getByText('Next'));
      expect(screen.getByText('Back')).toBeInTheDocument();
    });

    it('shows step description when present', () => {
      render(<EnhancedForm steps={steps} layout="steps" onSubmit={vi.fn()} />);
      fireEvent.click(screen.getByText('Next'));
      expect(screen.getByText('Fill in details')).toBeInTheDocument();
    });

    it('shows submit button on last step', () => {
      render(<EnhancedForm steps={steps} layout="steps" onSubmit={vi.fn()} submitLabel="Save" />);
      fireEvent.click(screen.getByText('Next'));
      expect(screen.getByText('Save')).toBeInTheDocument();
    });
  });

  describe('initial data', () => {
    it('populates fields with initial data', () => {
      render(
        <EnhancedForm
          fields={[textField]}
          initialData={{ title: 'My Camera' }}
          onSubmit={vi.fn()}
        />
      );
      const input = screen.getByPlaceholderText('Enter title') as HTMLInputElement;
      expect(input.value).toBe('My Camera');
    });
  });
});
