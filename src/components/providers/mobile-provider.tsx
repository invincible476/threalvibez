'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(false);
  
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const media = window.matchMedia(query);
      setMatches(media.matches);

      const listener = (e: MediaQueryListEvent) => setMatches(e.matches);
      
      if (typeof media.addEventListener === 'function') {
        media.addEventListener('change', listener);
        return () => media.removeEventListener('change', listener);
      } else if (typeof media.addListener === 'function') {
        media.addListener(listener);
        return () => media.removeListener(listener);
      }
    } catch (e) {
      console.warn('matchMedia error:', e);
    }
  }, [query]);
  
  return matches;
}

interface MobileDesignContextType {
  isMobileDesign: boolean;
  setIsMobileDesign: (isMobile: boolean) => void;
  isMobileView: boolean;
  width: number;
  height: number;
}

const MobileDesignContext = createContext<MobileDesignContextType | undefined>(undefined);

export function MobileProvider({ children }: { children: ReactNode }) {
  const [isMobileDesign, setMobileDesignState] = useState(true);
  const isMobile = useMediaQuery('(max-width: 768px)');
  
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const getSavedSetting = (): boolean => {
      try {
        if (typeof window === 'undefined') return true;
        const saved = localStorage.getItem('mobile_redesign');
        if (saved !== null) {
          return saved === 'true';
        }
        return true;
      } catch (error) {
        console.warn('Storage access failed:', error);
        return true;
      }
    };

    const isEnabled = getSavedSetting();
    setMobileDesignState(isEnabled);
    
    try {
      if (document?.body) {
        document.body.dataset.mobile = isEnabled ? "true" : "false";
      }
    } catch (error) {
      console.warn('Failed to set body dataset:', error);
    }

    let resizeTimer: NodeJS.Timeout;
    const handleResize = () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        try {
          setDimensions({
            width: window.innerWidth || document.documentElement.clientWidth || 0,
            height: window.innerHeight || document.documentElement.clientHeight || 0
          });
        } catch (e) {
          console.warn('Resize calculation error:', e);
        }
      }, 250);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        const currentSetting = getSavedSetting();
        if (isMobileDesign !== currentSetting) {
          setMobileDesignState(currentSetting);
          try {
            if (document?.body) {
              document.body.dataset.mobile = currentSetting ? "true" : "false";
            }
          } catch (e) {
            console.warn('Failed to set body dataset on visibility change:', e);
          }
        }
      }
    };

    window.addEventListener('resize', handleResize);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    handleResize();
    
    return () => {
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      clearTimeout(resizeTimer);
    };
  }, [isMobileDesign]);

  const setIsMobileDesign = (enabled: boolean) => {
    setMobileDesignState(enabled);
    try {
      localStorage.setItem('mobile_redesign', String(enabled));
    } catch (e) {
      console.warn('Failed to write to localStorage:', e);
    }
    try {
      if (document?.body) {
        document.body.dataset.mobile = enabled ? "true" : "false";
      }
    } catch (e) {
      console.warn('Failed to set body dataset:', e);
    }
  };

  const isMobileView = isMobile && isMobileDesign;

  return (
    <MobileDesignContext.Provider value={{ isMobileDesign, setIsMobileDesign, isMobileView, ...dimensions }}>
      {children}
    </MobileDesignContext.Provider>
  );
}

export function useMobileDesign() {
  const context = useContext(MobileDesignContext);
  if (context === undefined) {
    throw new Error('useMobileDesign must be used within a MobileProvider');
  }
  return context;
}
