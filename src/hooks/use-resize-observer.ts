import { useEffect, useRef } from 'react';

type ResizeObserverCallback = (entry: ResizeObserverEntry) => void;

export function useResizeObserver(
  ref: React.RefObject<Element>,
  callback: ResizeObserverCallback
) {
  const observer = useRef<ResizeObserver>();

  useEffect(() => {
    if (ref.current) {
      observer.current = new ResizeObserver((entries) => {
        callback(entries[0]);
      });

      observer.current.observe(ref.current);
    }

    return () => {
      if (observer.current) {
        observer.current.disconnect();
      }
    };
  }, [ref, callback]);
}