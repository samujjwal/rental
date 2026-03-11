import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// Mock framer-motion
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
}));

// Mock accessibility
vi.mock('~/lib/accessibility', () => ({
  prefersReducedMotion: () => false,
}));

// Mock Skeleton
vi.mock('./skeleton', () => ({
  Skeleton: ({ className, animation }: any) => (
    <div data-testid="skeleton" className={className} data-animation={animation} />
  ),
}));

import { OptimizedImage, ImageGallery, Avatar } from './OptimizedImage';

describe('OptimizedImage', () => {
  it('renders a container div', () => {
    const { container } = render(<OptimizedImage src="/test.jpg" alt="Test" />);
    expect(container.firstElementChild).toBeInTheDocument();
  });

  it('shows skeleton while loading by default', () => {
    render(<OptimizedImage src="/test.jpg" alt="Test" />);
    expect(screen.getByTestId('skeleton')).toBeInTheDocument();
  });

  it('hides skeleton when showSkeleton is false', () => {
    render(<OptimizedImage src="/test.jpg" alt="Test" showSkeleton={false} />);
    expect(screen.queryByTestId('skeleton')).not.toBeInTheDocument();
  });

  it('renders img with correct src and alt when priority', () => {
    render(<OptimizedImage src="/photo.jpg" alt="Photo" priority />);
    const img = screen.getByAltText('Photo');
    expect(img).toHaveAttribute('src', '/photo.jpg');
    expect(img).toHaveAttribute('loading', 'eager');
  });

  it('uses lazy loading when not priority', () => {
    render(<OptimizedImage src="/photo.jpg" alt="Photo" />);
    // With priority=false by default, the image may not render until IntersectionObserver fires.
    // Since we're not mocking IntersectionObserver, img may not be in DOM.
    // But we can verify the container renders.
    expect(screen.queryByAltText('Photo')).toBeNull(); // not in view yet
  });

  it('calls onLoadComplete when image loads', () => {
    const onLoadComplete = vi.fn();
    render(
      <OptimizedImage src="/photo.jpg" alt="Photo" priority onLoadComplete={onLoadComplete} />
    );
    const img = screen.getByAltText('Photo');
    fireEvent.load(img);
    expect(onLoadComplete).toHaveBeenCalledTimes(1);
  });

  it('shows error fallback when image fails to load', () => {
    const onError = vi.fn();
    render(
      <OptimizedImage src="/broken.jpg" alt="Broken" priority onError={onError} />
    );
    const img = screen.getByAltText('Broken');
    fireEvent.error(img);
    expect(onError).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Failed to load')).toBeInTheDocument();
  });

  it('shows custom fallback on error', () => {
    render(
      <OptimizedImage
        src="/broken.jpg"
        alt="Broken"
        priority
        fallback={<span>Custom Error</span>}
      />
    );
    fireEvent.error(screen.getByAltText('Broken'));
    expect(screen.getByText('Custom Error')).toBeInTheDocument();
  });

  it('applies aspect ratio class', () => {
    const { container } = render(
      <OptimizedImage src="/test.jpg" alt="Test" aspectRatio="16/9" />
    );
    expect(container.querySelector('.aspect-video')).toBeTruthy();
  });

  it('applies custom className', () => {
    const { container } = render(
      <OptimizedImage src="/test.jpg" alt="Test" className="custom-img" />
    );
    expect(container.querySelector('.custom-img')).toBeTruthy();
  });

  it('sets width and height style when provided', () => {
    const { container } = render(
      <OptimizedImage src="/test.jpg" alt="Test" width={200} height={150} />
    );
    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper.style.width).toBe('200px');
    expect(wrapper.style.height).toBe('150px');
  });
});

describe('ImageGallery', () => {
  const images = [
    { src: '/img1.jpg', alt: 'Image 1' },
    { src: '/img2.jpg', alt: 'Image 2' },
    { src: '/img3.jpg', alt: 'Image 3' },
  ];

  it('renders correct number of images', () => {
    const { container } = render(<ImageGallery images={images} />);
    // Each image creates an OptimizedImage container
    const imgContainers = container.querySelectorAll('.rounded-lg');
    expect(imgContainers).toHaveLength(3);
  });

  it('applies column classes', () => {
    const { container } = render(<ImageGallery images={images} columns={2} />);
    expect(container.querySelector('.sm\\:grid-cols-2')).toBeTruthy();
  });

  it('applies gap classes', () => {
    const { container } = render(<ImageGallery images={images} gap="lg" />);
    expect(container.querySelector('.gap-6')).toBeTruthy();
  });

  it('applies custom className', () => {
    const { container } = render(
      <ImageGallery images={images} className="gallery-custom" />
    );
    expect(container.querySelector('.gallery-custom')).toBeTruthy();
  });
});

describe('Avatar', () => {
  it('renders initials when no src provided', () => {
    render(<Avatar alt="John Doe" name="John Doe" />);
    expect(screen.getByText('JD')).toBeInTheDocument();
  });

  it('renders first char of alt when no name or src', () => {
    render(<Avatar alt="admin" />);
    expect(screen.getByText('A')).toBeInTheDocument();
  });

  it('renders image when src is provided', () => {
    render(<Avatar src="/avatar.jpg" alt="User" />);
    const img = screen.getByAltText('User');
    expect(img).toHaveAttribute('src', '/avatar.jpg');
  });

  it('falls back to initials on image error', () => {
    render(<Avatar src="/broken.jpg" alt="Jane" name="Jane Smith" />);
    const img = screen.getByAltText('Jane');
    fireEvent.error(img);
    expect(screen.getByText('JS')).toBeInTheDocument();
  });

  it('falls back to initials when src is null', () => {
    render(<Avatar src={null} alt="Test" name="Test User" />);
    expect(screen.getByText('TU')).toBeInTheDocument();
  });

  it('applies size classes', () => {
    const { container: xs } = render(<Avatar alt="A" size="xs" />);
    expect(xs.querySelector('.w-6')).toBeTruthy();

    const { container: xl } = render(<Avatar alt="A" size="xl" />);
    expect(xl.querySelector('.w-16')).toBeTruthy();
  });

  it('applies custom className', () => {
    const { container } = render(<Avatar alt="A" className="custom-avatar" />);
    expect(container.querySelector('.custom-avatar')).toBeTruthy();
  });

  it('truncates initials to 2 characters', () => {
    render(<Avatar alt="A" name="John Michael Doe Third" />);
    // getInitials takes first char of each word: J M D T -> sliced to JM
    expect(screen.getByText('JM')).toBeInTheDocument();
  });
});
