import dynamic from 'next/dynamic';
import { Suspense } from 'react';
import { hasReducedMotion, isLowEndDevice } from '@/utils/performance';

// Conditionally load animations based on device capabilities
const shouldLoadAnimations = !hasReducedMotion() && !isLowEndDevice();

// Dynamic imports for background components
export const DynamicGalaxyBackground = dynamic(
  () => shouldLoadAnimations 
    ? import('@/components/galaxy-background').then(mod => mod.GalaxyBackground)
    : Promise.resolve(() => null),
  {
    ssr: false,
    loading: () => null
  }
);

export const DynamicAuraBackground = dynamic(
  () => shouldLoadAnimations 
    ? import('@/components/aura-background').then(mod => mod.AuraBackground)
    : Promise.resolve(() => null),
  {
    ssr: false,
    loading: () => null
  }
);

export const DynamicGradientBackground = dynamic(
  () => shouldLoadAnimations 
    ? import('@/components/gradient-glow-background').then(mod => mod.GradientGlowBackground)
    : Promise.resolve(() => null),
  {
    ssr: false,
    loading: () => null
  }
);

export const DynamicGridBackground = dynamic(
  () => shouldLoadAnimations 
    ? import('@/components/grid-background').then(mod => mod.GridBackground)
    : Promise.resolve(() => null),
  {
    ssr: false,
    loading: () => null
  }
);