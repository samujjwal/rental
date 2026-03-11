import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('framer-motion', () => ({
  motion: {
    img: vi.fn(({ children, custom, variants, initial, animate, exit, transition, ...rest }: any) => {
      return <img {...rest} />;
    }),
    div: vi.fn(({ children, custom, variants, initial, animate, exit, transition, ...rest }: any) => {
      return <div {...rest}>{children}</div>;
    }),
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('lucide-react', () => ({
  ChevronLeft: (props: Record<string, unknown>) => <svg data-testid="chevron-left" {...props} />,
  ChevronRight: (props: Record<string, unknown>) => <svg data-testid="chevron-right" {...props} />,
  X: (props: Record<string, unknown>) => <svg data-testid="x-icon" {...props} />,
  ZoomIn: (props: Record<string, unknown>) => <svg data-testid="zoom-in-icon" {...props} />,
  Expand: (props: Record<string, unknown>) => <svg data-testid="expand-icon" {...props} />,
}));

vi.mock('~/lib/utils', () => ({
  cn: (...args: any[]) => args.filter(Boolean).join(' '),
}));

import { ListingGallery } from './ListingGallery';

const images = ['/img1.jpg', '/img2.jpg', '/img3.jpg'];

describe('ListingGallery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders "No images available" when images is empty', () => {
    render(<ListingGallery images={[]} title="Test" />);
    expect(screen.getByText('No images available')).toBeInTheDocument();
  });

  it('renders image with correct alt text', () => {
    render(<ListingGallery images={images} title="Camera" />);
    expect(screen.getByAltText('Camera - Image 1 of 3')).toBeInTheDocument();
  });

  it('renders carousel region with label', () => {
    render(<ListingGallery images={images} title="Camera" />);
    expect(screen.getByRole('region', { name: /Image gallery for Camera/ })).toBeInTheDocument();
  });

  it('shows navigation arrows for multiple images', () => {
    render(<ListingGallery images={images} title="Camera" />);
    expect(screen.getByLabelText('Previous image')).toBeInTheDocument();
    expect(screen.getByLabelText('Next image')).toBeInTheDocument();
  });

  it('does not show arrows for single image', () => {
    render(<ListingGallery images={['/img1.jpg']} title="Camera" />);
    expect(screen.queryByLabelText('Previous image')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Next image')).not.toBeInTheDocument();
  });

  it('shows image counter badge', () => {
    render(<ListingGallery images={images} title="Camera" />);
    expect(screen.getByText('1 / 3')).toBeInTheDocument();
  });

  it('renders fullscreen button', () => {
    render(<ListingGallery images={images} title="Camera" />);
    expect(screen.getByLabelText('View fullscreen')).toBeInTheDocument();
  });

  it('renders thumbnail strip for multiple images', () => {
    render(<ListingGallery images={images} title="Camera" />);
    const tabs = screen.getAllByRole('tab');
    expect(tabs).toHaveLength(3);
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
  });

  it('navigates to next image on Next click', () => {
    render(<ListingGallery images={images} title="Camera" />);
    fireEvent.click(screen.getByLabelText('Next image'));
    expect(screen.getByText('2 / 3')).toBeInTheDocument();
  });

  it('navigates to previous image wrapping around', () => {
    render(<ListingGallery images={images} title="Camera" />);
    fireEvent.click(screen.getByLabelText('Previous image'));
    expect(screen.getByText('3 / 3')).toBeInTheDocument();
  });

  it('navigates via thumbnail click', () => {
    render(<ListingGallery images={images} title="Camera" />);
    const tabs = screen.getAllByRole('tab');
    fireEvent.click(tabs[2]);
    expect(screen.getByText('3 / 3')).toBeInTheDocument();
  });

  it('responds to keyboard ArrowRight', () => {
    render(<ListingGallery images={images} title="Camera" />);
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    });
    expect(screen.getByText('2 / 3')).toBeInTheDocument();
  });

  it('responds to keyboard ArrowLeft', () => {
    render(<ListingGallery images={images} title="Camera" />);
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
    });
    expect(screen.getByText('3 / 3')).toBeInTheDocument();
  });

  it('opens lightbox on image click', () => {
    render(<ListingGallery images={images} title="Camera" />);
    // Click on the main image area (the cursor-zoom-in div)
    const mainImage = screen.getByAltText('Camera - Image 1 of 3');
    fireEvent.click(mainImage.closest('[class*="cursor-zoom-in"]')!);
    expect(screen.getByLabelText('Close fullscreen view')).toBeInTheDocument();
  });

  it('closes lightbox on Escape key', () => {
    render(<ListingGallery images={images} title="Camera" />);
    const mainImage = screen.getByAltText('Camera - Image 1 of 3');
    fireEvent.click(mainImage.closest('[class*="cursor-zoom-in"]')!);
    expect(screen.getByLabelText('Close fullscreen view')).toBeInTheDocument();
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(screen.queryByLabelText('Close fullscreen view')).not.toBeInTheDocument();
  });

  it('opens lightbox via fullscreen button', () => {
    render(<ListingGallery images={images} title="Camera" />);
    fireEvent.click(screen.getByLabelText('View fullscreen'));
    expect(screen.getByRole('dialog', { name: /Fullscreen image viewer/ })).toBeInTheDocument();
  });

  it('uses dot indicators for more than 10 images', () => {
    const manyImages = Array.from({ length: 12 }, (_, i) => `/img${i}.jpg`);
    render(<ListingGallery images={manyImages} title="Gallery" />);
    // Should NOT have tablist (no thumbnail strip)
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
    // Should have dot indicators with aria labels
    expect(screen.getByLabelText('Go to image 1')).toBeInTheDocument();
  });
});
