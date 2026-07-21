import { useEffect, useRef } from 'react';
import type { User } from '@/lib/types';
import { setupPresence } from '@/lib/presence';

export function usePresence(user: User | null | undefined) {
  const cleanupRef = useRef<(() => void) | undefined>();
  
  useEffect(() => {
    if (!user?.uid) return;
    
    setupPresence(user.uid).then(cleanup => {
      cleanupRef.current = cleanup;
    }).catch(error => {
      console.error('Error setting up presence:', error);
    });
    
    return () => {
      cleanupRef.current?.();
    };
  }, [user?.uid]);
}