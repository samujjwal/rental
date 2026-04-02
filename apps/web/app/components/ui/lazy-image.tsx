import React, { useState, useEffect, useRef, useCallback } from 'react';
import { cn } from '~/lib/utils';
import { Skeleton } from '~/components/ui/skeleton';

/**
 * Lazy Image Component with Progressive Loading
 * 
 * Implements lazy loading with blur-up technique and intersection observer
 * for optimal performance and user experience.
 */

interface LazyImageProps {
  src: string;
  alt: string;
  className?: string;
  containerClassName?: string;
  placeholderSrc?: string;
  aspectRatio?: string;
  objectFit?: 'cover' | 'contain' | 'fill' | 'none' | 'scale-down';
  priority?: boolean;
  onLoad?: () => void;
  onError?: () => void;
  fallbackSrc?: string;
  sizes?: string;
}

export function LazyImage({
  src,
  alt,
  className,
  containerClassName,
  placeholderSrc,
  aspectRatio = '16/9',
  objectFit = 'cover',
  priority = false,
  onLoad,
  onError,
  fallbackSrc = '/images/placeholder.png',
  sizes = '(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw'
}: LazyImageProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isInView, setIsInView] = useState(priority);
  const [currentSrc, setCurrentSrc] = useState(placeholderSrc || '');
  const [hasError, setHasError] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Intersection Observer for lazy loading
  useEffect(() => {
    if (priority) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsInView(true);
            observer.disconnect();
          }
        });
      },
      {
        rootMargin: '50px 0px',
        threshold: 0.01
      }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, [priority]);

  // Load image when in view
  useEffect(() => {
    if (!isInView) return;

    const img = new Image();

    img.onload = () => {
      setCurrentSrc(src);
      setIsLoaded(true);
      setHasError(false);
      onLoad?.();
    };

    img.onerror = () => {
      setHasError(true);
      setCurrentSrc(fallbackSrc);
      setIsLoaded(true);
      onError?.();
    };

    img.src = src;
  }, [src, isInView, fallbackSrc, onLoad, onError]);

  const objectFitClasses = {
    cover: 'object-cover',
    contain: 'object-contain',
    fill: 'object-fill',
    none: 'object-none',
    'scale-down': 'object-scale-down'
  };

  return (
    <div
      ref={containerRef}
      className={cn(
        'relative overflow-hidden bg-muted',
        containerClassName
      )}
      style={{ aspectRatio }}
    >
      {/* Skeleton placeholder */}
      {!isLoaded && (
        <Skeleton
          className="absolute inset-0 w-full h-full"
          animation="pulse"
        />
      )}

      {/* Low quality placeholder */}
      {placeholderSrc && !isLoaded && (
        <img
          src={placeholderSrc}
          alt=""
          className={cn(
            'absolute inset-0 w-full h-full blur-sm scale-110',
            objectFitClasses[objectFit]
          )}
          aria-hidden="true"
        />
      )}

      {/* Main image */}
      <img
        ref={imgRef}
        src={currentSrc}
        alt={alt}
        loading={priority ? 'eager' : 'lazy'}
        sizes={sizes}
        className={cn(
          'absolute inset-0 w-full h-full transition-all duration-500',
          objectFitClasses[objectFit],
          isLoaded ? 'opacity-100 blur-0 scale-100' : 'opacity-0 blur-sm scale-105',
          hasError && 'grayscale',
          className
        )}
      />

      {/* Error overlay */}
      {hasError && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted">
          <span className="text-muted-foreground text-sm">Failed to load image</span>
        </div>
      )}
    </div>
  );
}

interface LazyImageGalleryProps {
  images: Array<{
    src: string;
    alt: string;
    placeholderSrc?: string;
  }>;
  className?: string;
  containerClassName?: string;
  aspectRatio?: string;
  columns?: 1 | 2 | 3 | 4;
  gap?: 'sm' | 'md' | 'lg';
  priorityCount?: number;
  onImageClick?: (index: number) => void;
}

export function LazyImageGallery({
  images,
  className,
  containerClassName,
  aspectRatio = '16/9',
  columns = 3,
  gap = 'md',
  priorityCount = 3,
  onImageClick
}: LazyImageGalleryProps) {
  const gapClasses = {
    sm: 'gap-2',
    md: 'gap-4',
    lg: 'gap-6'
  };

  const columnClasses = {
    1: 'grid-cols-1',
    2: 'grid-cols-2',
    3: 'grid-cols-2 md:grid-cols-3',
    4: 'grid-cols-2 md:grid-cols-4'
  };

  return (
    <div className={cn(
      'grid',
      columnClasses[columns],
      gapClasses[gap],
      containerClassName
    )}>
      {images.map((image, index) => (
        <div
          key={index}
          className={cn(
            'cursor-pointer transition-transform hover:scale-[1.02]',
            className
          )}
          onClick={() => onImageClick?.(index)}
        >
          <LazyImage
            src={image.src}
            alt={image.alt}
            placeholderSrc={image.placeholderSrc}
            aspectRatio={aspectRatio}
            priority={index < priorityCount}
          />
        </div>
      ))}
    </div>
  );
}

interface ProgressiveImageProps extends LazyImageProps {
  lowResSrc: string;
  highResSrc: string;
  blurAmount?: number;
}

export function ProgressiveImage({
  lowResSrc,
  highResSrc,
  blurAmount = 20,
  className,
  containerClassName,
  aspectRatio = '16/9',
  objectFit = 'cover',
  alt,
  onLoad,
  onError,
  fallbackSrc
}: ProgressiveImageProps) {
  const [isLowResLoaded, setIsLowResLoaded] = useState(false);
  const [isHighResLoaded, setIsHighResLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [currentSrc, setCurrentSrc] = useState(lowResSrc);

  // Load high-res after low-res
  useEffect(() => {
    if (!isLowResLoaded) return;

    const img = new Image();

    img.onload = () => {
      setCurrentSrc(highResSrc);
      setIsHighResLoaded(true);
      setHasError(false);
      onLoad?.();
    };

    img.onerror = () => {
      if (!hasError) {
        setHasError(true);
        setCurrentSrc(fallbackSrc || lowResSrc);
        onError?.();
      }
    };

    img.src = highResSrc;
  }, [isLowResLoaded, highResSrc, lowResSrc, fallbackSrc, hasError, onLoad, onError]);

  const objectFitClasses = {
    cover: 'object-cover',
    contain: 'object-contain',
    fill: 'object-fill',
    none: 'object-none',
    'scale-down': 'object-scale-down'
  };

  return (
    <div
      className={cn(
        'relative overflow-hidden bg-muted',
        containerClassName
      )}
      style={{ aspectRatio }}
    >
      {/* Skeleton */}
      {!isLowResLoaded && (
        <Skeleton
          className="absolute inset-0 w-full h-full"
          animation="pulse"
        />
      )}

      {/* Progressive image */}
      <img
        src={currentSrc}
        alt={alt}
        loading="lazy"
        onLoad={() => setIsLowResLoaded(true)}
        onError={() => {
          if (!hasError) {
            setHasError(true);
            setCurrentSrc(fallbackSrc || lowResSrc);
          }
        }}
        className={cn(
          'absolute inset-0 w-full h-full transition-all duration-700',
          objectFitClasses[objectFit],
          isLowResLoaded ? 'opacity-100' : 'opacity-0',
          !isHighResLoaded && isLowResLoaded && `blur-[${blurAmount}px]`,
          isHighResLoaded && 'blur-0',
          hasError && 'grayscale',
          className
        )}
      />

      {/* Error state */}
      {hasError && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted">
          <span className="text-muted-foreground text-sm">Failed to load image</span>
        </div>
      )}
    </div>
  );
}

// Hook for batch image preloading
export function useImagePreloader() {
  const preloadImages = useCallback((urls: string[]): Promise<void[]> => {
    return Promise.all(
      urls.map(url => {
        return new Promise<void>((resolve, reject) => {
          const img = new Image();
          img.onload = () => resolve();
          img.onerror = () => reject(new Error(`Failed to load ${url}`));
          img.src = url;
        });
      })
    );
  }, []);

  return { preloadImages };
}

// Hook for intersection observer based lazy loading
export function useIntersectionObserver(
  options: IntersectionObserverInit = {}
): [React.RefObject<HTMLDivElement | null>, boolean] {
  const [isIntersecting, setIsIntersecting] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsIntersecting(true);
          observer.disconnect();
        }
      },
      {
        rootMargin: '50px 0px',
        threshold: 0.01,
        ...options
      }
    );

    observer.observe(element);

    return () => observer.disconnect();
  }, [options]);

  return [ref, isIntersecting];
}

export default {
  LazyImage,
  LazyImageGallery,
  ProgressiveImage,
  useImagePreloader,
  useIntersectionObserver
};
