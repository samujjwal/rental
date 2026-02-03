import { useRef, useState, useEffect, useCallback, CSSProperties } from 'react';

export interface VirtualListProps<T> {
    items: T[];
    itemHeight: number;
    containerHeight: number;
    renderItem: (item: T, index: number) => React.ReactNode;
    overscan?: number;
    className?: string;
    onEndReached?: () => void;
    endReachedThreshold?: number;
}

/**
 * Virtual List Component
 * Renders only visible items for optimal performance with large lists
 */
export function VirtualList<T>({
    items,
    itemHeight,
    containerHeight,
    renderItem,
    overscan = 3,
    className = '',
    onEndReached,
    endReachedThreshold = 0.8,
}: VirtualListProps<T>) {
    const [scrollTop, setScrollTop] = useState(0);
    const containerRef = useRef<HTMLDivElement>(null);

    const totalHeight = items.length * itemHeight;
    const visibleCount = Math.ceil(containerHeight / itemHeight);
    const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
    const endIndex = Math.min(items.length, startIndex + visibleCount + overscan * 2);
    const visibleItems = items.slice(startIndex, endIndex);

    const handleScroll = useCallback(
        (e: React.UIEvent<HTMLDivElement>) => {
            const target = e.currentTarget;
            setScrollTop(target.scrollTop);

            // Check if near end
            if (onEndReached) {
                const scrollPercentage =
                    (target.scrollTop + target.clientHeight) / target.scrollHeight;
                if (scrollPercentage >= endReachedThreshold) {
                    onEndReached();
                }
            }
        },
        [onEndReached, endReachedThreshold]
    );

    return (
        <div
            ref={containerRef}
            onScroll={handleScroll}
            className={`overflow-auto ${className}`}
            style={{ height: containerHeight }}
        >
            <div style={{ height: totalHeight, position: 'relative' }}>
                {visibleItems.map((item, index) => {
                    const actualIndex = startIndex + index;
                    return (
                        <div
                            key={actualIndex}
                            style={{
                                position: 'absolute',
                                top: actualIndex * itemHeight,
                                height: itemHeight,
                                width: '100%',
                            }}
                        >
                            {renderItem(item, actualIndex)}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

/**
 * Virtual Grid Component
 * Renders only visible items in a grid layout
 */
export interface VirtualGridProps<T> {
    items: T[];
    itemHeight: number;
    itemWidth: number;
    containerHeight: number;
    containerWidth: number;
    renderItem: (item: T, index: number) => React.ReactNode;
    gap?: number;
    overscan?: number;
    className?: string;
}

export function VirtualGrid<T>({
    items,
    itemHeight,
    itemWidth,
    containerHeight,
    containerWidth,
    renderItem,
    gap = 16,
    overscan = 3,
    className = '',
}: VirtualGridProps<T>) {
    const [scrollTop, setScrollTop] = useState(0);

    const columnsCount = Math.floor((containerWidth + gap) / (itemWidth + gap));
    const rowsCount = Math.ceil(items.length / columnsCount);
    const totalHeight = rowsCount * (itemHeight + gap) - gap;

    const visibleRowsCount = Math.ceil(containerHeight / (itemHeight + gap));
    const startRow = Math.max(0, Math.floor(scrollTop / (itemHeight + gap)) - overscan);
    const endRow = Math.min(rowsCount, startRow + visibleRowsCount + overscan * 2);

    const visibleItems: Array<{ item: T; index: number; row: number; col: number }> = [];

    for (let row = startRow; row < endRow; row++) {
        for (let col = 0; col < columnsCount; col++) {
            const index = row * columnsCount + col;
            if (index < items.length) {
                visibleItems.push({
                    item: items[index],
                    index,
                    row,
                    col,
                });
            }
        }
    }

    const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
        setScrollTop(e.currentTarget.scrollTop);
    }, []);

    return (
        <div
            onScroll={handleScroll}
            className={`overflow-auto ${className}`}
            style={{ height: containerHeight }}
        >
            <div style={{ height: totalHeight, position: 'relative' }}>
                {visibleItems.map(({ item, index, row, col }) => (
                    <div
                        key={index}
                        style={{
                            position: 'absolute',
                            top: row * (itemHeight + gap),
                            left: col * (itemWidth + gap),
                            height: itemHeight,
                            width: itemWidth,
                        }}
                    >
                        {renderItem(item, index)}
                    </div>
                ))}
            </div>
        </div>
    );
}
