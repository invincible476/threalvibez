
'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

// Use a more generic name for the hook
function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    const media = window.matchMedia(query);
    if (media.matches !== matches) {
      setMatches(media.matches);
    }
    const listener = () => setMatches(media.matches);
    window.addEventListener('resize', listener);
    return () => window.removeEventListener('resize', listener);
  }, [matches, query]);
  return matches;
}

interface MobileDesignContextType {
  isMobileDesign: boolean;
  setIsMobileDesign: (isMobile: boolean) => void;
  isMobileView: boolean;
  height: number;
}

const MobileDesignContext = createContext<MobileDesignContextType | undefined>(undefined);

export function MobileProvider({ children }: { children: ReactNode }) {
  const [isMobileDesign, setMobileDesignState] = useState(true);
  const isMobile = useMediaQuery('(max-width: 768px)');
  
  const [height, setHeight] = useState(0);

  useEffect(() => {
    const savedMobileDesign = localStorage.getItem('mobile_redesign');
    const isEnabled = savedMobileDesign !== null ? savedMobileDesign === 'true' : true;
    
    setMobileDesignState(isEnabled);
    document.body.dataset.mobile = isEnabled ? "true" : "false";

    const setVisualViewportHeight = () => {
        if (window.visualViewport) {
            // Use the visualViewport height which correctly accounts for the keyboard
            setHeight(window.visualViewport.height);
        } else {
            // Fallback for older browsers
            setHeight(window.innerHeight);
        }
    };

    // Initial call
    setVisualViewportHeight();

    // Attach event listeners
    const visualViewport = window.visualViewport;
    if (visualViewport) {
        visualViewport.addEventListener('resize', setVisualViewportHeight);
        return () => visualViewport.removeEventListener('resize', setVisualViewportHeight);
    } else {
        // Fallback for older browsers
         window.addEventListener('resize', setVisualViewportHeight);
        return () => window.removeEventListener('resize', setVisualViewportHeight);
    }

  }, []);

  const setIsMobileDesign = (enabled: boolean) => {
    setMobileDesignState(enabled);
    localStorage.setItem('mobile_redesign', String(enabled));
    document.body.dataset.mobile = enabled ? "true" : "false";
  };

  const isMobileView = isMobile && isMobileDesign;

  return (
    <MobileDesignContext.Provider value={{ isMobileDesign, setIsMobileDesign, isMobileView, height }}>
      {children}
    </MobileDesign-context.Provider>
  );
}

export function useMobileDesign() {
  const context = useContext(MobileDesignContext);
  if (context === undefined) {
    throw new Error('useMobileDesign must be used within a MobileProvider');
  }
  return context;
}


