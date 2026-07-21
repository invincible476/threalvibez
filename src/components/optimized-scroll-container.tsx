import React, { useEffect, useRef, useState } from 'react';
import { useInView } from 'react-intersection-observer';
import { cn } from '@/lib/utils';
import { debounce } from 'lodash';

interface OptimizedScrollContainerProps {
  children: React.ReactNode;
  className?: string;
  onScroll?: (event: React.UIEvent<HTMLDivElement>) => void;
  onEndReached?: () => void;
  endReachedThreshold?: number;
  scrollRestoration?: boolean;
  scrollRestorationKey?: string;
}

export function OptimizedScrollContainer({
  children,
  className,
  onScroll,
  onEndReached,
  endReachedThreshold = 100,
  scrollRestoration = false,
  scrollRestorationKey = 'scroll-position',
}: OptimizedScrollContainerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { ref: endRef, inView } = useInView({
    threshold: 0,
    rootMargin: `${endReachedThreshold}px`,
  });

  const [isScrolling, setIsScrolling] = useState(false);

  // Debounced scroll handler
  const debouncedScroll = useRef(
    debounce((event: React.UIEvent<HTMLDivElement>) => {
      onScroll?.(event);
      setIsScrolling(false);
    }, 100)
  ).current;

  // Handle scroll events
  const handleScroll = (event: React.UIEvent<HTMLDivElement>) => {
    setIsScrolling(true);
    debouncedScroll(event);

    // Save scroll position if scrollRestoration is enabled
    if (scrollRestoration && containerRef.current) {
      const position = containerRef.current.scrollTop;
      sessionStorage.setItem(scrollRestorationKey, position.toString());
    }
  };

  // Restore scroll position
  useEffect(() => {
    if (scrollRestoration && containerRef.current) {
      const savedPosition = sessionStorage.getItem(scrollRestorationKey);
      if (savedPosition) {
        containerRef.current.scrollTop = parseInt(savedPosition, 10);
      }
    }
  }, [scrollRestoration, scrollRestorationKey]);

  // Handle reaching the end of the scroll
  useEffect(() => {
    if (inView && onEndReached) {
      onEndReached();
    }
  }, [inView, onEndReached]);

  // Clean up debounced function
  useEffect(() => {
    return () => {
      debouncedScroll.cancel();
    };
  }, [debouncedScroll]);

  return (
    <div
      ref={containerRef}
      className={cn(
        'overflow-auto overscroll-contain',
        isScrolling && 'pointer-events-none',
        className
      )}
      onScroll={handleScroll}
      style={{
        WebkitOverflowScrolling: 'touch',
        willChange: isScrolling ? 'transform' : 'auto',
      }}
    >
      {children}
      <div ref={endRef} className="h-px" />
    </div>
  );
}