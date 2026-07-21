'use client';

import { Button } from '@/components/ui/button';
import { auth } from '@/lib/firebase';
import { signOut as firebaseSignOut } from 'firebase/auth';

export function ForceSignOutButton() {
  const handleForceSignOut = async () => {
    try {
      // Sign out from Firebase
      await firebaseSignOut(auth);
      
      // Clear IndexedDB data
      if (window.indexedDB) {
        const databases = await window.indexedDB.databases();
        for (const db of databases) {
          if (db.name?.includes('firebase')) {
            await window.indexedDB.deleteDatabase(db.name);
          }
        }
      }
      
      // Clear local and session storage
      localStorage.clear();
      sessionStorage.clear();
      
      // Reload the page to ensure clean state
      window.location.reload();
    } catch (error) {
      console.error('Error during force sign out:', error);
      // If normal sign out fails, try to clear everything anyway
      try {
        localStorage.clear();
        sessionStorage.clear();
        window.location.reload();
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