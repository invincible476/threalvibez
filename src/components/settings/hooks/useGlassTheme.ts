import { useState, useEffect } from 'react';
import { useAppearance } from '@/components/providers/appearance-provider';

const useGlassTheme = () => {
  const { 
    glassBlur: blurStrength, 
    setGlassBlur: setBlurStrength, 
    isGlassEnabled, 
    setIsGlassEnabled 
  } = useAppearance();

  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  return {
    blurStrength,
    setBlurStrength,
    isGlassEnabled,
    setIsGlassEnabled,
    isMounted,
  };
};

export default useGlassTheme;
