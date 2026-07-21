
import React from 'react';
import { motion, MotionProps } from 'framer-motion';
import { cn } from '@/lib/utils';

interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary';
  blurStrength?: number; // 0-20
  accent?: string; // e.g., 'hsl(var(--primary))'
  as?: any;
  className?: string;
}

const GlassCard = React.forwardRef<HTMLDivElement, GlassCardProps & MotionProps>(
  ({ 
    children, 
    variant = 'primary', 
    blurStrength = 10, 
    accent, 
    as: Component = motion.div, 
    className, 
    ...props 
  }, ref) => {

    const cardStyle: React.CSSProperties = {
      '--glass-blur': `${blurStrength}px`,
      '--glass-accent-glow': accent ? `0 8px 24px ${accent}` : 'none',
    } as React.CSSProperties;

    return (
      <Component
        ref={ref}
        style={cardStyle}
        className={cn(
          'rounded-lg border',
          'bg-[var(--glass-bg)] border-[var(--glass-border)] text-[var(--text-on-glass)]',
          'backdrop-blur-[var(--glass-blur)]',
          '[--glass-bg:rgba(255,255,255,0.04)] [--glass-border:rgba(255,255,255,0.06)] [--text-on-glass:rgba(255,255,255,0.92)]',
          'dark:[--glass-bg:rgba(30,30,30,0.5)] dark:[--glass-border:rgba(255,255,255,0.1)] dark:[--text-on-glass:rgba(255,255,255,0.95)]',
          'shadow-[var(--glass-accent-glow)]',
          'transition-colors duration-300',
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
