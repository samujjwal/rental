import { useState, useEffect, useRef, ImgHTMLAttributes } from 'react';
import { Skeleton } from '~/components/ui/skeleton';

export interface LazyImageProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, 'loading'> {
    src: string;
    alt: string;
    fallbackSrc?: string;
    aspectRatio?: number;
    showSkeleton?: boolean;
    skeletonClassName?: string;
    onLoad?: () => void;
    onError?: () => void;
    threshold?: number;
    rootMargin?: string;
}

/**
 * Lazy Loading Image Component
 * Uses Intersection Observer for optimal performance
 */
export function LazyImage({
    src,
    alt,
    fallbackSrc = '/images/placeholder.jpg',
    aspectRatio,
    showSkeleton = true,
    skeletonClassName,
    onLoad,
    onError,
    threshold = 0.1,
    rootMargin = '50px',
    className = '',
    ...props
}: LazyImageProps) {
    const [isLoaded, setIsLoaded] = useState(false);
    const [isInView, setIsInView] = useState(false);
    const [hasError, setHasError] = useState(false);
    const imgRef = useRef<HTMLImageElement>(null);

    // Intersection Observer for lazy loading
    useEffect(() => {
        if (!imgRef.current) return;

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
                threshold,
                rootMargin,
            }
        );

        observer.observe(imgRef.current);

        return () => {
            observer.disconnect();
        };
    }, [threshold, rootMargin]);

    const handleLoad = () => {
        setIsLoaded(true);
        onLoad?.();
    };

    const handleError = () => {
        setHasError(true);
        onError?.();
    };

    const imageSrc = hasError ? fallbackSrc : src;
    const shouldLoad = isInView || isLoaded;

    return (
        <div
            ref={imgRef}
            className={`relative overflow-hidden ${className}`}
            style={aspectRatio ? { paddingBottom: `${(1 / aspectRatio) * 100}%` } : undefined}
        >
            {showSkeleton && !isLoaded && (
                <Skeleton
                    className={`absolute inset-0 ${skeletonClassName || ''}`}
                    variant="rectangular"
                />
            )}

            {shouldLoad && (
                <img
                    src={imageSrc}
                    alt={alt}
                    onLoad={handleLoad}
                    onError={handleError}
                    className={`
            ${aspectRatio ? 'absolute inset-0 w-full h-full object-cover' : ''}
            ${isLoaded ? 'opacity-100' : 'opacity-0'}
            transition-opacity duration-300
            ${className}
          `}
                    loading="lazy"
                    decoding="async"
                    {...props}
                />
            )}
        </div>
    );
}

/**
 * Lazy Background Image Component
 */
export interface LazyBackgroundImageProps {
    src: string;
    fallbackSrc?: string;
    children?: React.ReactNode;
    className?: string;
    threshold?: number;
    rootMargin?: string;
}

export function LazyBackgroundImage({
    src,
    fallbackSrc = '/images/placeholder.jpg',
    children,
    className = '',
    threshold = 0.1,
    rootMargin = '50px',
}: LazyBackgroundImageProps) {
    const [isInView, setIsInView] = useState(false);
    const [hasError, setHasError] = useState(false);
    const divRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!divRef.current) return;

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
                threshold,
                rootMargin,
            }
        );

        observer.observe(divRef.current);

        return () => {
            observer.disconnect();
        };
    }, [threshold, rootMargin]);

    // Preload image
    useEffect(() => {
        if (!isInView) return;

        const img = new Image();
        img.src = src;
        img.onerror = () => setHasError(true);
    }, [isInView, src]);

    const backgroundImage = isInView ? (hasError ? fallbackSrc : src) : 'none';

    return (
        <div
            ref={divRef}
            className={className}
            style={{
                backgroundImage: `url(${backgroundImage})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
            }}
        >
            {children}
        </div>
    );
}
