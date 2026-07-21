
import React from 'react';
import { cn } from '@/lib/utils';

interface CardsGridProps {
  children: React.ReactNode;
  className?: string;
}

const CardsGrid: React.FC<CardsGridProps> = ({ children, className }) => {
  return (
    <div className={cn("grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-6", className)}>
      {children}
    </div>
  );
};

export { CardsGrid };
