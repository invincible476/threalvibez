
'use client';

/**
 * AnimatedAuthBackground renders a container with CSS-animated pseudo-elements
 * to create a subtle, floating blob effect. This component is purely presentational
 * and all animation logic is handled in `src/app/auth-background.css`.
 */
export function AnimatedAuthBackground() {
  return (
    <div className="blob-container" aria-hidden="true">
        {/* This div is used to provide two more pseudo-elements for animation */}
        <div></div>
    </div>
  );
}
