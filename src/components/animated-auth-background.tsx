
'use client';

/**
 * AnimatedAuthBackground renders a container with CSS-animated pseudo-elements
 * to create a subtle, floating blob effect. This component is purely presentational
 * and all animation logic is handled in `src/app/auth-background.css`.
 */
export function AnimatedAuthBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden="true">
      <div className="absolute -top-40 -left-40 h-96 w-96 rounded-full bg-purple-600/20 blur-3xl animate-pulse" />
      <div className="absolute top-1/3 -right-20 h-96 w-96 rounded-full bg-blue-600/20 blur-3xl animate-pulse delay-1000" />
      <div className="absolute -bottom-40 left-1/3 h-96 w-96 rounded-full bg-pink-600/15 blur-3xl animate-pulse delay-700" />
    </div>
  );
}
