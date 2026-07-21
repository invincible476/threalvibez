import { useState, useCallback, useRef, useEffect } from 'react';
import { debounce, getPerformanceConfig } from '@/utils/performance';

const { debounceTime } = getPerformanceConfig();

interface UseOptimizedListOptions<T> {
  items: T[];
  pageSize?: number;
  threshold?: number;
  onLoadMore?: () => Promise<void>;
}

export function useOptimizedList<T>({
  items,
  pageSize = 20,
  threshold = 200,
  onLoadMore
}: UseOptimizedListOptions<T>) {
  const [visibleItems, setVisibleItems] = useState<T[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Optimized intersection observer callback
  const intersectionCallback = useCallback(
    debounce(async (entries: IntersectionObserverEntry[]) => {
      const target = entries[0];
      if (target.isIntersecting && !isLoading && onLoadMore) {
        setIsLoading(true);
        try {
          await onLoadMore();
        } finally {
          setIsLoading(false);
        }
      }
    }, debounceTime),
    [onLoadMore, isLoading]
  );

  // Set up intersection observer
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !onLoadMore) return;

    const observer = new IntersectionObserver(intersectionCallback, {
      root: null,
      rootMargin: `${threshold}px`,
      threshold: 0.1
    });

    const sentinel = container.lastElementChild;
    if (sentinel) {
      observer.observe(sentinel);
    }

    return () => observer.disconnect();
  }, [intersectionCallback, threshold]);

  // Update visible items based on window size and scroll position
  useEffect(() => {
    setVisibleItems(items.slice(0, pageSize));
  }, [items, pageSize]);

  return {
    visibleItems,
    containerRef,
    isLoading
  };
}