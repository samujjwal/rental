import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

const { mockGroupCategoryFields } = vi.hoisted(() => ({
  mockGroupCategoryFields: vi.fn(),
}));

vi.mock('~/lib/api/listings', () => ({
  groupCategoryFieldDefinitions: mockGroupCategoryFields,
}));

import { CategorySpecificFields } from './CategorySpecificFields';

const textField = {
  key: 'brand',
  label: 'Brand',
  type: 'text' as const,
  required: true,
  placeholder: 'Enter brand',
};

const numberField = {
  key: 'bedrooms',
  label: 'Bedrooms',
  type: 'number' as const,
  min: 1,
  max: 10,
  unit: 'rooms',
};

const selectField = {
  key: 'fuel_type',
  label: 'Fuel Type',
  type: 'select' as const,
  options: [
    { value: 'petrol', label: 'Petrol' },
    { value: 'diesel', label: 'Diesel' },
  ],
};

const booleanField = {
  key: 'has_parking',
  label: 'Has Parking',
  type: 'boolean' as const,
};

const multiselectField = {
  key: 'amenities',
  label: 'Amenities',
  type: 'multiselect' as const,
  options: [
    { value: 'wifi', label: 'WiFi' },
    { value: 'pool', label: 'Pool' },
    { value: 'gym', label: 'Gym' },
  ],
};

describe('CategorySpecificFields', () => {
  const onChange = vi.fn();

  beforeEach(() => {
    onChange.mockClear();
    mockGroupCategoryFields.mockReset();
  });

  it('returns null when no fields for category', () => {
    mockGroupCategoryFields.mockReturnValue([]);
    const { container } = render(
      <CategorySpecificFields
        fields={[]}
        values={{}}
        onChange={onChange}
      />
    );
    expect(container.innerHTML).toBe('');
  });

  it('returns null when fields array is empty', () => {
    mockGroupCategoryFields.mockReturnValue([]);
    const { container } = render(
      <CategorySpecificFields
        fields={[]}
        values={{}}
        onChange={onChange}
      />
    );
    expect(container.innerHTML).toBe('');
  });

  it('renders section heading', () => {
    mockGroupCategoryFields.mockReturnValue([
      { label: 'Details', fields: [textField] },
    ]);
    render(
      <CategorySpecificFields
        fields={[textField]}
        values={{}}
        onChange={onChange}
      />
    );
    expect(screen.getByText('Category-Specific Details')).toBeInTheDocument();
  });

  it('renders group headers', () => {
    mockGroupCategoryFields.mockReturnValue([
      { label: 'Basic Info', fields: [textField] },
      { label: 'Room Details', fields: [numberField] },
    ]);
    render(
      <CategorySpecificFields
        fields={[textField, numberField]}
        values={{}}
        onChange={onChange}
      />
    );
    expect(screen.getByText('Basic Info')).toBeInTheDocument();
    expect(screen.getByText('Room Details')).toBeInTheDocument();
  });

  // Text field tests
  it('renders text field with label and placeholder', () => {
    mockGroupCategoryFields.mockReturnValue([
      { label: 'Details', fields: [textField] },
    ]);
    render(
      <CategorySpecificFields
        fields={[textField]}
        values={{}}
        onChange={onChange}
      />
    );
    expect(screen.getByText('Brand')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Enter brand')).toBeInTheDocument();
  });

  it('shows required asterisk for required fields', () => {
    mockGroupCategoryFields.mockReturnValue([
      { label: 'Details', fields: [textField] },
    ]);
    render(
      <CategorySpecificFields
        fields={[textField]}
        values={{}}
        onChange={onChange}
      />
    );
    expect(screen.getByText('*')).toBeInTheDocument();
  });

  it('calls onChange for text input', () => {
    mockGroupCategoryFields.mockReturnValue([
      { label: 'Details', fields: [textField] },
    ]);
    render(
      <CategorySpecificFields
        fields={[textField]}
        values={{}}
        onChange={onChange}
      />
    );
    fireEvent.change(screen.getByPlaceholderText('Enter brand'), {
      target: { value: 'Toyota' },
    });
    expect(onChange).toHaveBeenCalledWith('brand', 'Toyota');
  });

  // Number field tests
  it('renders number field with unit', () => {
    mockGroupCategoryFields.mockReturnValue([
      { label: 'Details', fields: [numberField] },
    ]);
    render(
      <CategorySpecificFields
        fields={[numberField]}
        values={{}}
        onChange={onChange}
      />
    );
    expect(screen.getByText('Bedrooms')).toBeInTheDocument();
    expect(screen.getByText('(rooms)')).toBeInTheDocument();
  });

  it('calls onChange with number value for number input', () => {
    mockGroupCategoryFields.mockReturnValue([
      { label: 'Details', fields: [numberField] },
    ]);
    render(
      <CategorySpecificFields
        fields={[numberField]}
        values={{}}
        onChange={onChange}
      />
    );
    const input = screen.getByRole('spinbutton');
    fireEvent.change(input, { target: { value: '3' } });
    expect(onChange).toHaveBeenCalledWith('bedrooms', 3);
  });

  it('calls onChange with undefined for empty number input', () => {
    mockGroupCategoryFields.mockReturnValue([
      { label: 'Details', fields: [numberField] },
    ]);
    render(
      <CategorySpecificFields
        fields={[numberField]}
        values={{ bedrooms: 5 }}
        onChange={onChange}
      />
    );
    const input = screen.getByRole('spinbutton');
    fireEvent.change(input, { target: { value: '' } });
    expect(onChange).toHaveBeenCalledWith('bedrooms', undefined);
  });

  // Select field tests
  it('renders select field with options', () => {
    mockGroupCategoryFields.mockReturnValue([
      { label: 'Details', fields: [selectField] },
    ]);
    render(
      <CategorySpecificFields
        fields={[selectField]}
        values={{}}
        onChange={onChange}
      />
    );
    expect(screen.getByText('Fuel Type')).toBeInTheDocument();
    expect(screen.getByText('Select\u2026')).toBeInTheDocument();
    expect(screen.getByText('Petrol')).toBeInTheDocument();
    expect(screen.getByText('Diesel')).toBeInTheDocument();
  });

  it('calls onChange for select field', () => {
    mockGroupCategoryFields.mockReturnValue([
      { label: 'Details', fields: [selectField] },
    ]);
    render(
      <CategorySpecificFields
        fields={[selectField]}
        values={{}}
        onChange={onChange}
      />
    );
    fireEvent.change(screen.getByRole('combobox'), {
      target: { value: 'diesel' },
    });
    expect(onChange).toHaveBeenCalledWith('fuel_type', 'diesel');
  });

  // Boolean field tests
  it('renders boolean field as checkbox', () => {
    mockGroupCategoryFields.mockReturnValue([
      { label: 'Details', fields: [booleanField] },
    ]);
    render(
      <CategorySpecificFields
        fields={[booleanField]}
        values={{}}
        onChange={onChange}
      />
    );
    expect(screen.getByText('Has Parking')).toBeInTheDocument();
    expect(screen.getByRole('checkbox')).toBeInTheDocument();
  });

  it('calls onChange for boolean toggle', () => {
    mockGroupCategoryFields.mockReturnValue([
      { label: 'Details', fields: [booleanField] },
    ]);
    render(
      <CategorySpecificFields
        fields={[booleanField]}
        values={{ has_parking: false }}
        onChange={onChange}
      />
    );
    fireEvent.click(screen.getByRole('checkbox'));
    expect(onChange).toHaveBeenCalledWith('has_parking', true);
  });

  // Multiselect field tests
  it('renders multiselect field options as chip buttons', () => {
    mockGroupCategoryFields.mockReturnValue([
      { label: 'Details', fields: [multiselectField] },
    ]);
    render(
      <CategorySpecificFields
        fields={[multiselectField]}
        values={{}}
        onChange={onChange}
      />
    );
    expect(screen.getByText('WiFi')).toBeInTheDocument();
    expect(screen.getByText('Pool')).toBeInTheDocument();
    expect(screen.getByText('Gym')).toBeInTheDocument();
  });

  it('adds value to multiselect', () => {
    mockGroupCategoryFields.mockReturnValue([
      { label: 'Details', fields: [multiselectField] },
    ]);
    render(
      <CategorySpecificFields
        fields={[multiselectField]}
        values={{ amenities: ['wifi'] }}
        onChange={onChange}
      />
    );
    // Click Pool checkbox (sr-only input inside the label)
    const poolLabel = screen.getByText('Pool');
    const checkbox = poolLabel.closest('label')!.querySelector('input')!;
    fireEvent.click(checkbox);
    expect(onChange).toHaveBeenCalledWith('amenities', ['wifi', 'pool']);
  });

  it('removes value from multiselect', () => {
    mockGroupCategoryFields.mockReturnValue([
      { label: 'Details', fields: [multiselectField] },
    ]);
    render(
      <CategorySpecificFields
        fields={[multiselectField]}
        values={{ amenities: ['wifi', 'pool'] }}
        onChange={onChange}
      />
    );
    const wifiLabel = screen.getByText('WiFi');
    const checkbox = wifiLabel.closest('label')!.querySelector('input')!;
    fireEvent.click(checkbox);
    expect(onChange).toHaveBeenCalledWith('amenities', ['pool']);
  });

  // Error display tests
  it('displays error messages', () => {
    mockGroupCategoryFields.mockReturnValue([
      { label: 'Details', fields: [textField] },
    ]);
    render(
      <CategorySpecificFields
        fields={[textField]}
        values={{}}
        onChange={onChange}
        errors={{ brand: 'Brand is required' }}
      />
    );
    expect(screen.getByText('Brand is required')).toBeInTheDocument();
  });

  it('displays existing values in text field', () => {
    mockGroupCategoryFields.mockReturnValue([
      { label: 'Details', fields: [textField] },
    ]);
    render(
      <CategorySpecificFields
        fields={[textField]}
        values={{ brand: 'Honda' }}
        onChange={onChange}
      />
    );
    expect(screen.getByDisplayValue('Honda')).toBeInTheDocument();
  });

  it('displays existing value in select field', () => {
    mockGroupCategoryFields.mockReturnValue([
      { label: 'Details', fields: [selectField] },
    ]);
    render(
      <CategorySpecificFields
        fields={[selectField]}
        values={{ fuel_type: 'diesel' }}
        onChange={onChange}
      />
    );
    expect((screen.getByRole('combobox') as HTMLSelectElement).value).toBe('diesel');
  });
});
