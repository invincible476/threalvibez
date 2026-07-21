
import React from 'react';
import { GlassCard } from '@/components/ui/cards/GlassCard';
import { cn } from '@/lib/utils';

interface SettingsCardProps {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}

const SettingsCard: React.FC<SettingsCardProps> = ({ title, description, children, className }) => {
  return (
    <GlassCard className={cn("p-6", className)}>
      <div className="mb-4">
        <h3 className="text-lg font-bold font-heading">{title}</h3>
        {description && <p className="text-sm text-muted-foreground mt-1">{description}</p>}
      </div>
      <div className="space-y-4">
        {children}
      </div>
    </GlassCard>
  );
};

export { SettingsCard };
