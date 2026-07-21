
import { useState, useEffect } from 'react';
import { useTheme } from 'next-themes';

const useGlassTheme = () => {
  const { theme } = useTheme();
  const [blurStrength, setBlurStrength] = useState(10);
  const [isGlassEnabled, setIsGlassEnabled] = useState(true);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    // This effect runs only on the client, after initial render
    setIsMounted(true);
    
    const savedBlur = localStorage.getItem('glass-blur');
    const savedGlassEnabled = localStorage.getItem('glass-enabled');

    if (savedBlur) setBlurStrength(parseInt(savedBlur, 10));
    if (savedGlassEnabled) setIsGlassEnabled(savedGlassEnabled === 'true');
  }, []);

  useEffect(() => {
    // This effect also runs only on the client, after isMounted is true
    if (!isMounted) return;

    // Apply CSS variables to the root element
    const root = document.documentElement;
    root.style.setProperty('--glass-blur', `${blurStrength}px`);
    
    if (!isGlassEnabled) {
      root.style.setProperty('--glass-bg', 'hsl(var(--card))');
      document.body.classList.add('glass-lite');
    } else {
      document.body.classList.remove('glass-lite');
      if (theme === 'dark' || theme === 'amoled') {
        root.style.setProperty('--glass-bg', 'rgba(30,30,30,0.5)');
      } else {
        root.style.setProperty('--glass-bg', 'rgba(255,255,255,0.6)');
      }
    }

    // Save settings to localStorage
    localStorage.setItem('glass-blur', blurStrength.toString());
    localStorage.setItem('glass-enabled', isGlassEnabled.toString());
  }, [blurStrength, isGlassEnabled, theme, isMounted]);

  return {
    blurStrength,
    setBlurStrength,
    isGlassEnabled,
    setIsGlassEnabled,
    isMounted,
  };
};

export default useGlassTheme;
