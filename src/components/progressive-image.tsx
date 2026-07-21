import React, { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { BlurImage } from '@/components/blur-image';

interface ProgressiveImageProps extends Omit<React.ComponentPropsWithoutRef<typeof BlurImage>, 'src' | 'alt'> {
  src: string;
  fallbackSrc?: string;
  lowQualitySrc?: string;
  alt: string;
  width: number | `${number}`;
  height: number | `${number}`;
  className?: string;
  onLoad?: () => void;
  priority?: boolean;
}

export function ProgressiveImage({
  src,
  fallbackSrc,
  lowQualitySrc,
  alt,
  className,
  onLoad,
  priority = false,
  width,
  height,
  ...props
}: ProgressiveImageProps) {
  const [isLoading, setIsLoading] = useState(!priority);
  const [error, setError] = useState(false);
  const imageRef = useRef<HTMLImageElement>(null);
  const [currentSrc, setCurrentSrc] = useState(lowQualitySrc || src);

  useEffect(() => {
    if (priority) return;

    const img = new Image();
    img.src = src;

    img.onload = () => {
      setCurrentSrc(src);
      setIsLoading(false);
      onLoad?.();
    };

    img.onerror = () => {
      setError(true);
      setIsLoading(false);
      if (fallbackSrc) {
        setCurrentSrc(fallbackSrc);
      }
    };

    return () => {
      img.onload = null;
      img.onerror = null;
    };
  }, [src, fallbackSrc, onLoad, priority]);

  if (error && !fallbackSrc) {
    return <div className="bg-gray-200 rounded animate-pulse" {...props} />;
  }

  return (
    <BlurImage
      ref={imageRef}
      src={currentSrc}
      alt={alt}
      width={width}
      height={height}
      className={cn(
        'transition-opacity duration-300 ease-in-out',
        isLoading ? 'opacity-50 blur-sm' : 'opacity-100 blur-0',
        className
      )}
      {...props}
    />
  );
}