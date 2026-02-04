import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { cn } from '~/lib/utils';
import { prefersReducedMotion } from '~/lib/accessibility';
import { Skeleton } from './skeleton';

export interface OptimizedImageProps
    extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'onLoad' | 'onError'> {
    src: string;
    alt: string;
    width?: number;
    height?: number;
    priority?: boolean;
    fallback?: React.ReactNode;
    aspectRatio?: 'auto' | 'square' | '4/3' | '16/9' | '3/2' | '21/9';
    objectFit?: 'cover' | 'contain' | 'fill' | 'none' | 'scale-down';
    showSkeleton?: boolean;
    onLoadComplete?: () => void;
    onError?: () => void;
}

const aspectRatioClasses = {
    auto: '',
    square: 'aspect-square',
    '4/3': 'aspect-[4/3]',
    '16/9': 'aspect-video',
    '3/2': 'aspect-[3/2]',
    '21/9': 'aspect-[21/9]',
};

/**
 * OptimizedImage - Lazy-loaded image with skeleton and fade-in
 * 
 * Features:
 * - Lazy loading with Intersection Observer
 * - Skeleton placeholder during load
 * - Fade-in animation on load
 * - Priority loading for above-fold images
 * - Fallback for failed loads
 * - Aspect ratio support
 * - Respects reduced motion preferences
 */
export function OptimizedImage({
    src,
    alt,
    width,
    height,
    priority = false,
    fallback,
    aspectRatio = 'auto',
    objectFit = 'cover',
    showSkeleton = true,
    className,
    onLoadComplete,
    onError,
    ...props
}: OptimizedImageProps) {
    const [isLoading, setIsLoading] = useState(true);
    const [hasError, setHasError] = useState(false);
    const [isInView, setIsInView] = useState(priority);
    const imgRef = useRef<HTMLImageElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const shouldReduceMotion = prefersReducedMotion();

    useEffect(() => {
        if (priority) {
            setIsInView(true);
            return;
        }

        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setIsInView(true);
                    observer.disconnect();
                }
            },
            {
                rootMargin: '200px',
                threshold: 0,
            }
        );

        if (containerRef.current) {
            observer.observe(containerRef.current);
        }

        return () => observer.disconnect();
    }, [priority]);

    const handleLoad = () => {
        setIsLoading(false);
        onLoadComplete?.();
    };

    const handleError = () => {
        setIsLoading(false);
        setHasError(true);
        onError?.();
    };

    const objectFitClasses = {
        cover: 'object-cover',
        contain: 'object-contain',
        fill: 'object-fill',
        none: 'object-none',
        'scale-down': 'object-scale-down',
    };

    return (
        <div
            ref={containerRef}
            className={cn(
                'relative overflow-hidden bg-muted',
                aspectRatioClasses[aspectRatio],
                className
            )}
            style={{
                width: width ? `${width}px` : undefined,
                height: height ? `${height}px` : undefined,
            }}
        >
            {/* Skeleton placeholder */}
            {isLoading && showSkeleton && (
                <Skeleton className="absolute inset-0 w-full h-full" animation="pulse" />
            )}

            {/* Error fallback */}
            {hasError && (
                <div className="absolute inset-0 flex items-center justify-center bg-muted">
                    {fallback || (
                        <div className="text-center text-muted-foreground p-4">
                            <svg
                                className="w-8 h-8 mx-auto mb-2 opacity-50"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={1.5}
                                    d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                                />
                            </svg>
                            <span className="text-xs">Failed to load</span>
                        </div>
                    )}
                </div>
            )}

            {/* Image */}
            {isInView && !hasError && (
                <motion.div
                    className="w-full h-full"
                    initial={shouldReduceMotion ? {} : { opacity: 0, scale: 1.05 }}
                    animate={
                        isLoading
                            ? {}
                            : shouldReduceMotion
                                ? { opacity: 1 }
                                : { opacity: 1, scale: 1 }
                    }
                    transition={{ duration: 0.4, ease: 'easeOut' }}
                >
                    <img
                        ref={imgRef}
                        src={src}
                        alt={alt}
                        width={width}
                        height={height}
                        loading={priority ? 'eager' : 'lazy'}
                        decoding="async"
                        onLoad={handleLoad}
                        onError={handleError}
                        className={cn(
                            'w-full h-full transition-opacity duration-300',
                            objectFitClasses[objectFit],
                            isLoading ? 'opacity-0' : 'opacity-100'
                        )}
                        {...props}
                    />
                </motion.div>
            )}
        </div>
    );
}

/**
 * ImageGallery - A gallery of optimized images with lightbox support
 */
export interface ImageGalleryProps {
    images: Array<{ src: string; alt: string }>;
    columns?: 1 | 2 | 3 | 4;
    gap?: 'sm' | 'md' | 'lg';
    aspectRatio?: OptimizedImageProps['aspectRatio'];
    className?: string;
}

export function ImageGallery({
    images,
    columns = 3,
    gap = 'md',
    aspectRatio = '4/3',
    className,
}: ImageGalleryProps) {
    const columnClasses = {
        1: 'grid-cols-1',
        2: 'grid-cols-1 sm:grid-cols-2',
        3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
        4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4',
    };

    const gapClasses = {
        sm: 'gap-2',
        md: 'gap-4',
        lg: 'gap-6',
    };

    return (
        <div className={cn('grid', columnClasses[columns], gapClasses[gap], className)}>
            {images.map((image, index) => (
                <OptimizedImage
                    key={`${image.src}-${index}`}
                    src={image.src}
                    alt={image.alt}
                    aspectRatio={aspectRatio}
                    priority={index < 4}
                    className="rounded-lg"
                />
            ))}
        </div>
    );
}

/**
 * Avatar - Optimized avatar image with fallback initials
 */
export interface AvatarProps {
    src?: string | null;
    alt: string;
    name?: string;
    size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
    className?: string;
}

const avatarSizes = {
    xs: 'w-6 h-6 text-xs',
    sm: 'w-8 h-8 text-sm',
    md: 'w-10 h-10 text-sm',
    lg: 'w-12 h-12 text-base',
    xl: 'w-16 h-16 text-lg',
};

export function Avatar({ src, alt, name, size = 'md', className }: AvatarProps) {
    const [hasError, setHasError] = useState(false);

    const getInitials = (name: string) => {
        return name
            .split(' ')
            .map((n) => n[0])
            .join('')
            .toUpperCase()
            .slice(0, 2);
    };

    const showFallback = !src || hasError;

    return (
        <div
            className={cn(
                'relative rounded-full overflow-hidden bg-muted flex items-center justify-center',
                avatarSizes[size],
                className
            )}
        >
            {showFallback ? (
                <span className="font-medium text-muted-foreground">
                    {name ? getInitials(name) : alt.charAt(0).toUpperCase()}
                </span>
            ) : (
                <img
                    src={src}
                    alt={alt}
                    className="w-full h-full object-cover"
                    onError={() => setHasError(true)}
                />
            )}
        </div>
    );
}

export default OptimizedImage;
