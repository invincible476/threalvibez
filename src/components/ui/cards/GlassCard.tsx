'use client';

import React from 'react';
import { motion, MotionProps } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useAppearance } from '@/components/providers/appearance-provider';

interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary';
  blurStrength?: number; // 0-30 override
  accent?: string; // e.g., 'hsl(var(--primary))'
  as?: any;
  className?: string;
}

const GlassCard = React.forwardRef<HTMLDivElement, GlassCardProps & MotionProps>(
  ({ 
    children, 
    variant = 'primary', 
    blurStrength, 
    accent, 
    as: Component = motion.div, 
    className, 
    style,
    ...props 
  }, ref) => {
    const { isGlassEnabled, glassBlur, glassOpacity } = useAppearance();

    const effectiveBlur = blurStrength ?? glassBlur;
    const effectiveOpacity = glassOpacity / 100;
    const isGlassActive = isGlassEnabled && effectiveBlur > 0;

    const cardStyle: React.CSSProperties = {
      ...style,
      backdropFilter: isGlassActive ? `blur(${effectiveBlur}px)` : 'none',
      WebkitBackdropFilter: isGlassActive ? `blur(${effectiveBlur}px)` : 'none',
      backgroundColor: isGlassActive 
        ? `rgba(20, 16, 35, ${effectiveOpacity})` 
        : 'hsl(var(--card))',
      boxShadow: accent ? `0 8px 24px ${accent}` : undefined,
    };

    return (
      <Component
        ref={ref}
        style={cardStyle}
        className={cn(
          'rounded-xl border border-border/60 text-card-foreground',
          'transition-all duration-200',
          className
        )}
        {...props}
      >
        {children}
      </Component>
    );
  }
);

GlassCard.displayName = 'GlassCard';

export { GlassCard };
