import React, { useEffect, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { cn } from '@/lib/utils';
import { useResizeObserver } from '@/hooks/use-resize-observer';

interface VirtualListProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => React.ReactNode;
  itemHeight?: number;
  overscan?: number;
  className?: string;
  onEndReached?: () => void;
  endReachedThreshold?: number;
  loading?: boolean;
  loadingIndicator?: React.ReactNode;
  emptyComponent?: React.ReactNode;
  estimateSize?: (index: number) => number;
}

export function VirtualList<T>({
  items,
  renderItem,
  itemHeight = 50,
  overscan = 5,
  className,
  onEndReached,
  endReachedThreshold = 0.8,
  loading = false,
  loadingIndicator,
  emptyComponent,
  estimateSize,
}: VirtualListProps<T>) {
  const parentRef = useRef<HTMLDivElement>(null);
  const [parentHeight, setParentHeight] = useState(0);

  useResizeObserver(parentRef, (entry) => {
    setParentHeight(entry.contentRect.height);
  });

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: estimateSize || (() => itemHeight),
    overscan,
  });

  useEffect(() => {
    if (!onEndReached || loading) return;

    const scrollElement = parentRef.current;
    if (!scrollElement) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = scrollElement;
      const scrollPercentage = (scrollTop + clientHeight) / scrollHeight;

      if (scrollPercentage > endReachedThreshold) {
        onEndReached();
      }
    };

    scrollElement.addEventListener('scroll', handleScroll);
    return () => scrollElement.removeEventListener('scroll', handleScroll);
  }, [onEndReached, loading, endReachedThreshold]);

  if (items.length === 0 && !loading) {
    return emptyComponent || null;
  }

  return (
    <div
      ref={parentRef}
      className={cn('overflow-auto relative', className)}
      style={{ height: parentHeight || '100%', willChange: 'transform' }}
    >
      <div
        style={{
          height: virtualizer.getTotalSize() + 'px',
          width: '100%',
          position: 'relative',
        }}
      >
        {virtualizer.getVirtualItems().map((virtualItem) => (
          <div
            key={virtualItem.key}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: virtualItem.size + 'px',
              transform: `translateY(${virtualItem.start}px)`,
            }}
          >
            {renderItem(items[virtualItem.index], virtualItem.index)}
          </div>
        ))}
      </div>
      {loading && loadingIndicator}
    </div>
  );
}