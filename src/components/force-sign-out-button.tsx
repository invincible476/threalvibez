'use client';

import { Button } from '@/components/ui/button';
import { auth } from '@/lib/firebase';
import { signOut as firebaseSignOut } from 'firebase/auth';

export function ForceSignOutButton() {
  const handleForceSignOut = async () => {
    try {
      // 1. Sign out from Firebase Auth cleanly
      if (auth.currentUser) {
        await firebaseSignOut(auth);
      }
      
      // 2. Clear local and session storage safely
      if (typeof window !== 'undefined') {
        localStorage.clear();
        sessionStorage.clear();
      }
      
      // 3. Reload the page to ensure clean state reset
      window.location.href = '/login';
    } catch (error) {
      console.error('Error during force sign out:', error);
      try {
        if (typeof window !== 'undefined') {
          localStorage.clear();
          sessionStorage.clear();
          window.location.href = '/login';
        }
      } catch (e) {
        console.error('Final cleanup failed:', e);
      }
    }
  };

  return (
    <Button 
      variant="destructive" 
      onClick={handleForceSignOut}
      className="w-full"
    >
      Force Sign Out (Clear Data)
    </Button>
  );
}