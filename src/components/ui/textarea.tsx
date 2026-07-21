import * as React from 'react';
import { cn } from '@/lib/utils';
import { useLayoutEffect, useRef } from 'react';

const Textarea = React.forwardRef<HTMLTextAreaElement, React.ComponentProps<'textarea'>>(
  ({ className, value, ...props }, ref) => {
    const localRef = useRef<HTMLTextAreaElement | null>(null);
    const combinedRef = (el: HTMLTextAreaElement) => {
      localRef.current = el;
      if (typeof ref === 'function') {
        ref(el);
      } else if (ref) {
        ref.current = el;
      }
    };
    
    useLayoutEffect(() => {
        const textarea = localRef.current;
        if(textarea) {
            // Reset height to shrink on delete
            textarea.style.height = 'auto';
            // Set height to scrollHeight
            textarea.style.height = `${textarea.scrollHeight}px`;
        }
    }, [value]);

    return (
      <textarea
        className={cn(
          'flex min-h-[40px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 overflow-y-hidden',
          className
        )}
        ref={combinedRef}
        value={value}
        {...props}
      />
    );
  }
);
Textarea.displayName = 'Textarea';

export { Textarea };
