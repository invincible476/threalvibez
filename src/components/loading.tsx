import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizes = {
  sm: 'w-4 h-4',
  md: 'w-6 h-6',
  lg: 'w-8 h-8',
};

export function LoadingSpinner({ size = 'md', className }: LoadingSpinnerProps) {
  return (
    <div className={cn('flex items-center justify-center', className)}>
      <motion.div
        className={cn(
          'border-t-2 border-b-2 border-current rounded-full',
          sizes[size]
        )}
        animate={{ rotate: 360 }}
        transition={{
          duration: 0.8,
          ease: 'linear',
          repeat: Infinity,
        }}
      />
    </div>
  );
}

interface LoadingSkeletonProps {
  className?: string;
  variant?: 'text' | 'circular' | 'rectangular';
  animation?: 'pulse' | 'wave';
}

export function LoadingSkeleton({
  className,
  variant = 'text',
  animation = 'pulse',
}: LoadingSkeletonProps) {
  const baseClasses = 'bg-gray-200 dark:bg-gray-700';
  const animationClasses = animation === 'pulse' ? 'animate-pulse' : 'animate-shimmer';

  const variantClasses = {
    text: 'h-4 w-full rounded',
    circular: 'rounded-full',
    rectangular: 'rounded-md',
  };

  return (
    <div
      className={cn(
        baseClasses,
        variantClasses[variant],
        animationClasses,
        className
      )}
    />
  );
}

interface LoadingOverlayProps {
  show: boolean;
  message?: string;
  transparent?: boolean;
}

export function LoadingOverlay({ show, message, transparent }: LoadingOverlayProps) {
  if (!show) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className={cn(
        'fixed inset-0 z-50 flex items-center justify-center',
        transparent ? 'bg-white/50 dark:bg-black/50' : 'bg-white dark:bg-gray-900'
      )}
    >
      <div className="text-center">
        <LoadingSpinner size="lg" className="mb-4" />
        {message && (
          <p className="text-sm text-gray-600 dark:text-gray-400">{message}</p>
        )}
      </div>
    </motion.div>
  );
}