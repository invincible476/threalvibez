'use client';

import { auth } from '@/lib/firebase';
import { signOut as firebaseSignOut, Auth, getRedirectResult, User } from 'firebase/auth';
import React, { createContext, ReactNode, useEffect, useState, useRef } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { usePathname, useRouter } from 'next/navigation';
import { VibezLogo } from '../vibez-logo';
import { GalaxyBackground } from '../galaxy-background';
import { getDoc, doc, updateDoc, serverTimestamp, DocumentData } from 'firebase/firestore';
import { db, setupPresence } from '@/lib/firebase';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  error?: Error;
  signOut: () => Promise<void>;
  auth: Auth;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AUTH_ROUTES = ['/login', '/signup', '/verify-email'];

function LoadingScreen() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-black relative">
      <GalaxyBackground />
      <div className="relative z-10">
        <VibezLogo />
      </div>
    </div>
  );
}

// Validate session
function validateSession(user: User | null): boolean {
  if (!user) return false;
  
  const lastLogin = localStorage.getItem('lastLogin');
  const sessionUser = localStorage.getItem('sessionUser');
  
  // If no previous session exists, create one
  if (!lastLogin || !sessionUser) {
    localStorage.setItem('lastLogin', Date.now().toString());
    localStorage.setItem('sessionUser', user.uid);
    return true;
  }
  
  // Allow different user to log in
  if (sessionUser !== user.uid) {
    localStorage.setItem('lastLogin', Date.now().toString());
    localStorage.setItem('sessionUser', user.uid);
    return true;
  }
  
  // Check if session is within 30 days
  const loginTime = parseInt(lastLogin, 10);
  const now = Date.now();
  const sessionAge = now - loginTime;
  const maxAge = 30 * 24 * 60 * 60 * 1000; // 30 days
  
  // Refresh session timestamp if still valid
  if (sessionAge < maxAge) {
    localStorage.setItem('lastLogin', now.toString());
    return true;
  }
  
  return false;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, authLoading, error] = useAuthState(auth);
  const [isProcessingRedirect, setIsProcessingRedirect] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  // Navigation state management
  const navigationInProgress = useRef(false);
  const lastRedirectTime = useRef(Date.now());
  const REDIRECT_COOLDOWN = 2000; // 2 second cooldown between redirects
  const VERIFICATION_CHECK_COOLDOWN = 300000; // 5 minutes between verification checks
  
  // Initialize Firebase auth state
  useEffect(() => {
    const clearAuthState = () => {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('lastLogin');
        localStorage.removeItem('sessionUser');
        // Clear IndexedDB auth data
        const req = indexedDB.deleteDatabase('firebaseLocalStorageDb');
        req.onsuccess = () => console.log('Cleared IndexedDB auth data');
      }
    };

    // Attempt to restore auth state, clear if invalid
    if (auth.currentUser && !validateSession(auth.currentUser)) {
      clearAuthState();
      auth.signOut().catch(console.error);
    }

    // Check for redirect result only if we expect one
    const pendingRedirect = sessionStorage.getItem('expectingRedirect');
    if (pendingRedirect) {
      setIsProcessingRedirect(true);
      getRedirectResult(auth)
        .catch((error) => {
          console.error('Error processing redirect:', error);
          if (error.code === 'auth/argument-error') {
            clearAuthState();
          }
        })
        .finally(() => {
          sessionStorage.removeItem('expectingRedirect');
          setIsProcessingRedirect(false);
        });
    }
  }, []);

  useEffect(() => {
    const isAuthRoute = AUTH_ROUTES.includes(pathname || '');
    const isLoading = authLoading || isProcessingRedirect;

    const handleAuth = async () => {
      if (isLoading || navigationInProgress.current) return;

      // Prevent rapid redirects
      const now = Date.now();
      if (now - lastRedirectTime.current < REDIRECT_COOLDOWN) {
        return;
      }

      // Early return if we can't determine auth state yet
      if (auth.currentUser === null && !user && !authLoading) {
        console.log('Auth state undetermined, redirecting to login');
        if (!isAuthRoute) {
          lastRedirectTime.current = now;
          navigationInProgress.current = true;
          router.replace('/login');
          setTimeout(() => { navigationInProgress.current = false; }, 100);
        }
        return;
      }

      // Handle authentication routes
      if (user && isAuthRoute && pathname !== '/verify-email') {
        lastRedirectTime.current = now;
        navigationInProgress.current = true;
        router.replace('/');
        setTimeout(() => { navigationInProgress.current = false; }, 100);
        return;
      }

      if (!user && !isAuthRoute) {
        lastRedirectTime.current = now;
        navigationInProgress.current = true;
        router.replace('/login');
        setTimeout(() => { navigationInProgress.current = false; }, 100);
        return;
      }

      // Handle email verification
      if (user && !isAuthRoute && pathname !== '/verify-email') {
        try {
          // Use cached verification status when possible
          const cachedStatus = sessionStorage.getItem(`emailVerified_${user.uid}`);
          if (cachedStatus === 'true') return;
          
          // Check if we should verify again
          const now = Date.now();
          const lastVerificationCheck = parseInt(sessionStorage.getItem(`lastVerificationCheck_${user.uid}`) || '0');
          
          if (now - lastVerificationCheck < VERIFICATION_CHECK_COOLDOWN) {
            return; // Skip verification check if done recently
          }
          
          sessionStorage.setItem(`lastVerificationCheck_${user.uid}`, now.toString());
          
          // Get user document
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          const userData = userDoc.data() as DocumentData | undefined;
          
          // Consider email verified if either Firebase auth or Firestore says so
          const isVerified = user.emailVerified || userData?.emailVerified;
          sessionStorage.setItem(`emailVerified_${user.uid}`, isVerified.toString());

          if (isVerified) {
            // Update Firestore if needed
            if (user.emailVerified && !userData?.emailVerified) {
              await updateDoc(doc(db, 'users', user.uid), {
                emailVerified: true,
                verifiedAt: serverTimestamp(),
                lastUpdated: serverTimestamp()
              });
            }
            return;
          }

          // Handle unverified user - only redirect if not in a navigation cooldown
          const lastVerifyRedirect = parseInt(sessionStorage.getItem(`lastVerifyRedirect_${user.uid}`) || '0');
          if (now - lastVerifyRedirect >= REDIRECT_COOLDOWN && !navigationInProgress.current) {
            sessionStorage.setItem(`lastVerifyRedirect_${user.uid}`, now.toString());
            lastRedirectTime.current = now;
            navigationInProgress.current = true;
            router.replace(`/verify-email?email=${encodeURIComponent(user.email || '')}`);
            setTimeout(() => { navigationInProgress.current = false; }, 500); // Increased timeout
          }
        } catch (error) {
          console.error('Error checking email verification:', error);
          // On error, use cached status if available
          const cachedStatus = sessionStorage.getItem(`emailVerified_${user.uid}`);
          if (cachedStatus === 'true') return;
          // Otherwise, assume verified to prevent constant redirects
          sessionStorage.setItem(`emailVerified_${user.uid}`, 'true');
        }
      }
    };

    handleAuth();
  }, [user, authLoading, isProcessingRedirect, pathname, router]);

  // Setup presence system when user logs in
  useEffect(() => {
    if (user?.uid) {
      setupPresence(user.uid);
    }
  }, [user?.uid]);

  const signOut = async () => {
    if (user?.uid) {
      try {
        await updateDoc(doc(db, 'users', user.uid), {
          status: 'offline',
          lastSeen: serverTimestamp()
        });
      } catch (error) {
        console.error('Error updating offline status:', error);
      }
    }
    await firebaseSignOut(auth);
  };

  const isLoading = authLoading || isProcessingRedirect;
  const isAuthRoute = AUTH_ROUTES.includes(pathname || '');

  // Only show loading screen during initial auth check
  if (isLoading && !navigationInProgress.current) {
    return <LoadingScreen />;
  }

  // Don't render children until auth is initialized
  if (!auth) {
    return null;
  }

  return (
    <AuthContext.Provider value={{ user: user ?? null, loading: authLoading, error, signOut, auth }}>
      {children}
    </AuthContext.Provider>
  );
}