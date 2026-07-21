import React, { forwardRef } from 'react';
import Image, { ImageProps } from 'next/image';
import { cn } from '@/lib/utils';

interface BlurImageProps extends Omit<ImageProps, 'height' | 'width'> {
  className?: string;
  height?: number | `${number}`;
  width?: number | `${number}`;
}

export const BlurImage = forwardRef<HTMLImageElement, BlurImageProps>(
  ({ className, ...props }, ref) => {
    return (
      <div className={cn('overflow-hidden relative', className)}>
        <Image
          ref={ref as any}
          className="w-full h-full object-cover"
          placeholder="blur"
          blurDataURL={`data:image/svg+xml;base64,${Buffer.from(
            `<svg width="100" height="100" version="1.1" xmlns="http://www.w3.org/2000/svg">
              <rect width="100%" height="100%" fill="#e2e8f0"/>
              <rect id="r" width="100%" height="100%" fill="url(#g)"/>
              <defs>
                <linearGradient id="g">
                  <stop stop-color="#e2e8f0" offset="0%"/>
                  <stop stop-color="#f1f5f9" offset="50%"/>
                  <stop stop-color="#e2e8f0" offset="100%"/>
                </linearGradient>
              </defs>
            </svg>`
          ).toString('base64')}`}
          {...props}
        />
      </div>
    );
  }
);

BlurImage.displayName = 'BlurImage';