import React, { forwardRef } from 'react';
import Image, { ImageProps } from 'next/image';
import { cn } from '@/lib/utils';

interface BlurImageProps extends Omit<ImageProps, 'height' | 'width'> {
  className?: string;
  height?: number | `${number}`;
  width?: number | `${number}`;
}

const DEFAULT_BLUR_DATA_URL = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgdmVyc2lvbj0iMS4xIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9IiNlMmU4ZjAiLz48cmVjdCBpZD0iciIgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0idXJsKCNnKSIvPjxkZWZzPjxsaW5lYXJHcmFkaWVudCBpZD0iZyI+PHN0b3Agc3RvcC1jb2xvcj0iI2UyZThmMCIgb2Zmc2V0PSIwJSIvPjxzdG9wIHN0b3AtY29sb3I9IiNmMTFmNTZjIiBvZmZzZXQ9IjUwJSIvPjxzdG9wIHN0b3AtY29sb3I9IiNlMmU4ZjAiIG9mZnNldD0iMTAwJSIvPjwvbGluZWFyR3JhZGllbnQ+PC9kZWZzPjwvc3ZnPg==';

export const BlurImage = forwardRef<HTMLImageElement, BlurImageProps>(
  ({ className, blurDataURL, ...props }, ref) => {
    return (
      <div className={cn('overflow-hidden relative', className)}>
        <Image
          ref={ref as any}
          className="w-full h-full object-cover"
          placeholder="blur"
          blurDataURL={blurDataURL || DEFAULT_BLUR_DATA_URL}
          {...props}
        />
      </div>
    );
  }
);

BlurImage.displayName = 'BlurImage';