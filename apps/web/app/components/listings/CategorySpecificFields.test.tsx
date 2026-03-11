import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

const { mockGetCategoryFields, mockGroupCategoryFields } = vi.hoisted(() => ({
  mockGetCategoryFields: vi.fn(),
  mockGroupCategoryFields: vi.fn(),
}));

vi.mock('~/lib/category-fields', () => ({
  getCategoryFields: mockGetCategoryFields,
  groupCategoryFields: mockGroupCategoryFields,
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
    mockGetCategoryFields.mockReset();
    mockGroupCategoryFields.mockReset();
  });

  it('returns null when no fields for category', () => {
    mockGetCategoryFields.mockReturnValue([]);
    mockGroupCategoryFields.mockReturnValue([]);
    const { container } = render(
      <CategorySpecificFields
        categorySlug="unknown"
        values={{}}
        onChange={onChange}
      />
    );
    expect(container.innerHTML).toBe('');
  });

  it('returns null when categorySlug is null', () => {
    mockGetCategoryFields.mockReturnValue([]);
    mockGroupCategoryFields.mockReturnValue([]);
    const { container } = render(
      <CategorySpecificFields
        categorySlug={null}
        values={{}}
        onChange={onChange}
      />
    );
    expect(container.innerHTML).toBe('');
  });

  it('renders section heading', () => {
    mockGetCategoryFields.mockReturnValue([textField]);
    mockGroupCategoryFields.mockReturnValue([
      { label: 'Details', fields: [textField] },
    ]);
    render(
      <CategorySpecificFields
        categorySlug="car"
        values={{}}
        onChange={onChange}
      />
    );
    expect(screen.getByText('Category-Specific Details')).toBeInTheDocument();
  });

  it('renders group headers', () => {
    mockGetCategoryFields.mockReturnValue([textField, numberField]);
    mockGroupCategoryFields.mockReturnValue([
      { label: 'Basic Info', fields: [textField] },
      { label: 'Room Details', fields: [numberField] },
    ]);
    render(
      <CategorySpecificFields
        categorySlug="apartment"
        values={{}}
        onChange={onChange}
      />
    );
    expect(screen.getByText('Basic Info')).toBeInTheDocument();
    expect(screen.getByText('Room Details')).toBeInTheDocument();
  });

  // Text field tests
  it('renders text field with label and placeholder', () => {
    mockGetCategoryFields.mockReturnValue([textField]);
    mockGroupCategoryFields.mockReturnValue([
      { label: 'Details', fields: [textField] },
    ]);
    render(
      <CategorySpecificFields
        categorySlug="car"
        values={{}}
        onChange={onChange}
      />
    );
    expect(screen.getByText('Brand')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Enter brand')).toBeInTheDocument();
  });

  it('shows required asterisk for required fields', () => {
    mockGetCategoryFields.mockReturnValue([textField]);
    mockGroupCategoryFields.mockReturnValue([
      { label: 'Details', fields: [textField] },
    ]);
    render(
      <CategorySpecificFields
        categorySlug="car"
        values={{}}
        onChange={onChange}
      />
    );
    expect(screen.getByText('*')).toBeInTheDocument();
  });

  it('calls onChange for text input', () => {
    mockGetCategoryFields.mockReturnValue([textField]);
    mockGroupCategoryFields.mockReturnValue([
      { label: 'Details', fields: [textField] },
    ]);
    render(
      <CategorySpecificFields
        categorySlug="car"
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
    mockGetCategoryFields.mockReturnValue([numberField]);
    mockGroupCategoryFields.mockReturnValue([
      { label: 'Details', fields: [numberField] },
    ]);
    render(
      <CategorySpecificFields
        categorySlug="apartment"
        values={{}}
        onChange={onChange}
      />
    );
    expect(screen.getByText('Bedrooms')).toBeInTheDocument();
    expect(screen.getByText('(rooms)')).toBeInTheDocument();
  });

  it('calls onChange with number value for number input', () => {
    mockGetCategoryFields.mockReturnValue([numberField]);
    mockGroupCategoryFields.mockReturnValue([
      { label: 'Details', fields: [numberField] },
    ]);
    render(
      <CategorySpecificFields
        categorySlug="apartment"
        values={{}}
        onChange={onChange}
      />
    );
    const input = screen.getByRole('spinbutton');
    fireEvent.change(input, { target: { value: '3' } });
    expect(onChange).toHaveBeenCalledWith('bedrooms', 3);
  });

  it('calls onChange with undefined for empty number input', () => {
    mockGetCategoryFields.mockReturnValue([numberField]);
    mockGroupCategoryFields.mockReturnValue([
      { label: 'Details', fields: [numberField] },
    ]);
    render(
      <CategorySpecificFields
        categorySlug="apartment"
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
    mockGetCategoryFields.mockReturnValue([selectField]);
    mockGroupCategoryFields.mockReturnValue([
      { label: 'Details', fields: [selectField] },
    ]);
    render(
      <CategorySpecificFields
        categorySlug="car"
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
    mockGetCategoryFields.mockReturnValue([selectField]);
    mockGroupCategoryFields.mockReturnValue([
      { label: 'Details', fields: [selectField] },
    ]);
    render(
      <CategorySpecificFields
        categorySlug="car"
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
    mockGetCategoryFields.mockReturnValue([booleanField]);
    mockGroupCategoryFields.mockReturnValue([
      { label: 'Details', fields: [booleanField] },
    ]);
    render(
      <CategorySpecificFields
        categorySlug="apartment"
        values={{}}
        onChange={onChange}
      />
    );
    expect(screen.getByText('Has Parking')).toBeInTheDocument();
    expect(screen.getByRole('checkbox')).toBeInTheDocument();
  });

  it('calls onChange for boolean toggle', () => {
    mockGetCategoryFields.mockReturnValue([booleanField]);
    mockGroupCategoryFields.mockReturnValue([
      { label: 'Details', fields: [booleanField] },
    ]);
    render(
      <CategorySpecificFields
        categorySlug="apartment"
        values={{ has_parking: false }}
        onChange={onChange}
      />
    );
    fireEvent.click(screen.getByRole('checkbox'));
    expect(onChange).toHaveBeenCalledWith('has_parking', true);
  });

  // Multiselect field tests
  it('renders multiselect field options as chip buttons', () => {
    mockGetCategoryFields.mockReturnValue([multiselectField]);
    mockGroupCategoryFields.mockReturnValue([
      { label: 'Details', fields: [multiselectField] },
    ]);
    render(
      <CategorySpecificFields
        categorySlug="apartment"
        values={{}}
        onChange={onChange}
      />
    );
    expect(screen.getByText('WiFi')).toBeInTheDocument();
    expect(screen.getByText('Pool')).toBeInTheDocument();
    expect(screen.getByText('Gym')).toBeInTheDocument();
  });

  it('adds value to multiselect', () => {
    mockGetCategoryFields.mockReturnValue([multiselectField]);
    mockGroupCategoryFields.mockReturnValue([
      { label: 'Details', fields: [multiselectField] },
    ]);
    render(
      <CategorySpecificFields
        categorySlug="apartment"
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
    mockGetCategoryFields.mockReturnValue([multiselectField]);
    mockGroupCategoryFields.mockReturnValue([
      { label: 'Details', fields: [multiselectField] },
    ]);
    render(
      <CategorySpecificFields
        categorySlug="apartment"
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
    mockGetCategoryFields.mockReturnValue([textField]);
    mockGroupCategoryFields.mockReturnValue([
      { label: 'Details', fields: [textField] },
    ]);
    render(
      <CategorySpecificFields
        categorySlug="car"
        values={{}}
        onChange={onChange}
        errors={{ brand: 'Brand is required' }}
      />
    );
    expect(screen.getByText('Brand is required')).toBeInTheDocument();
  });

  it('displays existing values in text field', () => {
    mockGetCategoryFields.mockReturnValue([textField]);
    mockGroupCategoryFields.mockReturnValue([
      { label: 'Details', fields: [textField] },
    ]);
    render(
      <CategorySpecificFields
        categorySlug="car"
        values={{ brand: 'Honda' }}
        onChange={onChange}
      />
    );
    expect(screen.getByDisplayValue('Honda')).toBeInTheDocument();
  });

  it('displays existing value in select field', () => {
    mockGetCategoryFields.mockReturnValue([selectField]);
    mockGroupCategoryFields.mockReturnValue([
      { label: 'Details', fields: [selectField] },
    ]);
    render(
      <CategorySpecificFields
        categorySlug="car"
        values={{ fuel_type: 'diesel' }}
        onChange={onChange}
      />
    );
    expect((screen.getByRole('combobox') as HTMLSelectElement).value).toBe('diesel');
  });
});
