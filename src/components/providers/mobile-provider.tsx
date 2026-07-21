
'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

// Use a more generic name for the hook
function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(false);
  
  useEffect(() => {
    const media = window.matchMedia(query);
    setMatches(media.matches); // Initial state

    // Use the more efficient matchMedia listener
    const listener = (e: MediaQueryListEvent) => setMatches(e.matches);
    media.addListener(listener); // More efficient than resize event
    
    return () => media.removeListener(listener);
  }, [query]); // Remove matches dependency to prevent unnecessary re-renders
  
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
    // Try to get saved setting from multiple storage options
    const getSavedSetting = () => {
      try {
        // Try IndexedDB first for better persistence
        const dbRequest = window.indexedDB.open('vibez-settings', 1);
        
        dbRequest.onerror = () => {
          console.warn('IndexedDB access failed, falling back to localStorage');
        };

        dbRequest.onupgradeneeded = (event: IDBVersionChangeEvent) => {
          const target = event.target as IDBRequest;
          const db = target.result as IDBDatabase;
          if (!db.objectStoreNames.contains('settings')) {
            db.createObjectStore('settings', { keyPath: 'id' });
          }
        };

        // Try localStorage as fallback
        const saved = localStorage.getItem('mobile_redesign');
        if (saved !== null) {
          try {
            // Persist to IndexedDB for next time
            const db = (dbRequest as IDBOpenDBRequest).result;
            const transaction = db.transaction(['settings'], 'readwrite');
            const store = transaction.objectStore('settings');
            store.put({ id: 'mobile_redesign', value: saved === 'true' });
          } catch (dbError) {
            console.warn('Failed to persist to IndexedDB:', dbError);
          }
          return saved === 'true';
        }

        // Default to true if no saved setting
        return true;
      } catch (error) {
        console.warn('Storage access failed:', error);
        return true;
      }
    };

    const isEnabled = getSavedSetting();
    setMobileDesignState(isEnabled);
    
    // Ensure body dataset is set
    try {
      document.body.dataset.mobile = isEnabled ? "true" : "false";
    } catch (error) {
      console.warn('Failed to set body dataset:', error);
    }

    // Handle resize with debouncing
    let resizeTimer: NodeJS.Timeout;
    const handleResize = () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        setDimensions({
          width: window.innerWidth || document.documentElement.clientWidth,
          height: window.innerHeight || document.documentElement.clientHeight
        });
      }, 250); // Debounce resize events
    };

    // Handle visibility change for mobile browsers
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        const currentSetting = getSavedSetting();
        if (isMobileDesign !== currentSetting) {
          setMobileDesignState(currentSetting);
          document.body.dataset.mobile = currentSetting ? "true" : "false";
        }
      }
    };

    window.addEventListener('resize', handleResize);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    handleResize(); // Initial call
    
    return () => {
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      clearTimeout(resizeTimer);
    };
  }, [isMobileDesign]);

  const setIsMobileDesign = (enabled: boolean) => {
    setMobileDesignState(enabled);
    localStorage.setItem('mobile_redesign', String(enabled));
    document.body.dataset.mobile = enabled ? "true" : "false";
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
