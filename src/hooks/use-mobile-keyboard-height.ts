import { useEffect, useState } from 'react';

/**
 * Detects the visible viewport height on mobile, accounting for the on-screen keyboard.
 * Returns the current viewport height and whether the keyboard is open.
 */
export function useMobileKeyboardHeight() {
  const [viewportHeight, setViewportHeight] = useState<number>(typeof window !== 'undefined' ? window.innerHeight : 0);
  const [keyboardOpen, setKeyboardOpen] = useState(false);

  useEffect(() => {
    const updateHeight = () => {
      if (window.visualViewport) {
        setViewportHeight(window.visualViewport.height);
        // Heuristic: keyboard is open if visualViewport height is much less than window.innerHeight
        setKeyboardOpen(window.visualViewport.height < window.innerHeight - 100);
      } else {
        setViewportHeight(window.innerHeight);
        setKeyboardOpen(false);
      }
    };
    updateHeight();
    window.visualViewport?.addEventListener('resize', updateHeight);
    window.addEventListener('resize', updateHeight);
    return () => {
      window.visualViewport?.removeEventListener('resize', updateHeight);
      window.removeEventListener('resize', updateHeight);
    };
  }, []);

  return { viewportHeight, keyboardOpen };
}
