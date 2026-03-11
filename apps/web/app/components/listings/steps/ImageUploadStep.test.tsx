import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('lucide-react', () => ({
  Upload: (props: Record<string, unknown>) => <svg data-testid="upload-icon" {...props} />,
  X: (props: Record<string, unknown>) => <svg data-testid="x-icon" {...props} />,
}));

import { ImageUploadStep } from './ImageUploadStep';

describe('ImageUploadStep', () => {
  const defaultProps = {
    imageUrls: [] as string[],
    onUpload: vi.fn(),
    onRemove: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders heading', () => {
    render(<ImageUploadStep {...defaultProps} />);
    expect(screen.getByText('Upload Images')).toBeInTheDocument();
  });

  it('renders upload area with instruction text', () => {
    render(<ImageUploadStep {...defaultProps} />);
    expect(screen.getByText(/Upload up to 10 images/)).toBeInTheDocument();
  });

  it('renders upload icon', () => {
    render(<ImageUploadStep {...defaultProps} />);
    expect(screen.getByTestId('upload-icon')).toBeInTheDocument();
  });

  it('renders "Choose Files" label', () => {
    render(<ImageUploadStep {...defaultProps} />);
    expect(screen.getByText('Choose Files')).toBeInTheDocument();
  });

  it('has hidden file input with accept image/*', () => {
    const { container } = render(<ImageUploadStep {...defaultProps} />);
    const input = container.querySelector('input[type="file"]');
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute('accept', 'image/*');
    expect(input).toHaveAttribute('multiple');
    expect(input).toHaveClass('hidden');
  });

  it('calls onUpload when file is selected', () => {
    const onUpload = vi.fn();
    const { container } = render(
      <ImageUploadStep {...defaultProps} onUpload={onUpload} />
    );
    const input = container.querySelector('input[type="file"]')!;
    fireEvent.change(input);
    expect(onUpload).toHaveBeenCalledTimes(1);
  });

  it('does not show image previews when no images', () => {
    render(<ImageUploadStep {...defaultProps} />);
    expect(screen.queryByTestId('image-preview')).not.toBeInTheDocument();
  });

  it('renders image previews for each URL', () => {
    render(
      <ImageUploadStep
        {...defaultProps}
        imageUrls={['img1.jpg', 'img2.jpg', 'img3.jpg']}
      />
    );
    const previews = screen.getAllByTestId('image-preview');
    expect(previews).toHaveLength(3);
  });

  it('renders images with correct alt text', () => {
    render(
      <ImageUploadStep
        {...defaultProps}
        imageUrls={['img1.jpg', 'img2.jpg']}
      />
    );
    expect(screen.getByAltText('Upload 1')).toBeInTheDocument();
    expect(screen.getByAltText('Upload 2')).toBeInTheDocument();
  });

  it('renders remove button for each image', () => {
    render(
      <ImageUploadStep
        {...defaultProps}
        imageUrls={['img1.jpg', 'img2.jpg']}
      />
    );
    const removeButtons = screen.getAllByTestId('x-icon');
    expect(removeButtons).toHaveLength(2);
  });

  it('calls onRemove with correct index when remove button clicked', () => {
    const onRemove = vi.fn();
    render(
      <ImageUploadStep
        {...defaultProps}
        onRemove={onRemove}
        imageUrls={['img1.jpg', 'img2.jpg', 'img3.jpg']}
      />
    );
    // Click remove on second image (index 1)
    const removeButtons = screen.getAllByRole('button');
    fireEvent.click(removeButtons[1]);
    expect(onRemove).toHaveBeenCalledWith(1);
  });

  it('does not display error when no error prop', () => {
    render(<ImageUploadStep {...defaultProps} />);
    const errorElements = document.querySelectorAll('.text-destructive');
    expect(errorElements).toHaveLength(0);
  });

  it('displays error message', () => {
    render(<ImageUploadStep {...defaultProps} error="File too large" />);
    expect(screen.getByText('File too large')).toBeInTheDocument();
  });

  it('renders upload area with test id', () => {
    render(<ImageUploadStep {...defaultProps} />);
    expect(screen.getByTestId('image-upload-area')).toBeInTheDocument();
  });

  it('renders in grid layout when images present', () => {
    const { container } = render(
      <ImageUploadStep {...defaultProps} imageUrls={['img1.jpg']} />
    );
    expect(container.querySelector('.grid.grid-cols-3')).toBeInTheDocument();
  });
});
