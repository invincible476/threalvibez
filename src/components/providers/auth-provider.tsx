'use client';

import { auth } from '@/lib/firebase';
import { signOut as firebaseSignOut, Auth, getRedirectResult, User, onIdTokenChanged } from 'firebase/auth';
import React, { createContext, ReactNode, useEffect, useState, useRef } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { usePathname, useRouter } from 'next/navigation';
import { VibezLogo } from '../vibez-logo';
import { GalaxyBackground } from '../galaxy-background';
import { getDoc, setDoc, doc, updateDoc, serverTimestamp, DocumentData } from 'firebase/firestore';
import { db, setupPresence } from '@/lib/firebase';
import { authService } from '@/lib/auth-service';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  error?: Error;
  signOut: () => Promise<void>;
  auth: Auth;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AUTH_ROUTES = ['/login', '/signup', '/verify-email', '/reset-password'];

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
      }
    };

    // Refresh session markers when currentUser is present
    if (auth.currentUser) {
      if (typeof window !== 'undefined') {
        localStorage.setItem('lastLogin', Date.now().toString());
        localStorage.setItem('sessionUser', auth.currentUser.uid);
      }
    }

    // Check for redirect result only if we expect one or from OAuth callback
    const pendingRedirect = typeof window !== 'undefined' ? sessionStorage.getItem('expectingRedirect') : null;
    if (pendingRedirect) {
      setIsProcessingRedirect(true);
      getRedirectResult(auth)
        .then(async (result) => {
          if (result?.user) {
            await authService.ensureUserDocument(result.user);
            await setupPresence(result.user.uid);
            if (typeof window !== 'undefined') {
              localStorage.setItem('lastLogin', Date.now().toString());
              localStorage.setItem('sessionUser', result.user.uid);
            }
            router.replace('/');
          }
        })
        .catch((error) => {
          console.error('Error processing redirect:', error);
          if (error.code === 'auth/argument-error') {
            clearAuthState();
          }
        })
        .finally(() => {
          if (typeof window !== 'undefined') {
            sessionStorage.removeItem('expectingRedirect');
          }
          setIsProcessingRedirect(false);
        });
    }
  }, [router]);

  // ─── onIdTokenChanged: keep session alive past 60-minute token expiry ──────
  // Firebase silently refreshes ID tokens every ~55 minutes, but that event
  // fires onIdTokenChanged — NOT onAuthStateChanged. react-firebase-hooks'
  // useAuthState only listens to onAuthStateChanged, so without this listener
  // the provider would not react to token refreshes and could treat the user
  // as signed out after the first hour. By subscribing here we force a
  // re-render with the refreshed user object, keeping the session alive
  // indefinitely while the tab remains open.
  useEffect(() => {
    const unsubscribeToken = onIdTokenChanged(auth, (updatedUser) => {
      if (updatedUser) {
        // Refresh session markers so the redirect guard never expires them
        if (typeof window !== 'undefined') {
          localStorage.setItem('lastLogin', Date.now().toString());
          localStorage.setItem('sessionUser', updatedUser.uid);
        }
      }
    });
    return () => unsubscribeToken();
  }, []);

  useEffect(() => {
    const isAuthRoute = AUTH_ROUTES.includes(pathname || '');
    const isLoading = authLoading || isProcessingRedirect;

    const handleAuth = async () => {
      if (isLoading) return;

      // Handle authenticated user on auth routes (login, signup) -> redirect to home
      if (user && isAuthRoute && pathname !== '/verify-email') {
        if (typeof window !== 'undefined') {
          localStorage.setItem('sessionUser', user.uid);
          localStorage.setItem('lastLogin', Date.now().toString());
        }
        router.replace('/');
        return;
      }

      if (user && !isAuthRoute) {
        if (typeof window !== 'undefined') {
          localStorage.setItem('sessionUser', user.uid);
          localStorage.setItem('lastLogin', Date.now().toString());
        }
      }

      if (!user && !isAuthRoute) {
        // Allow Firebase Auth a grace period to restore session from IndexedDB/localStorage
        const hasSavedSession = typeof window !== 'undefined' && Boolean(localStorage.getItem('sessionUser'));
        if (hasSavedSession) {
          return;
        }

        lastRedirectTime.current = now;
        navigationInProgress.current = true;
        router.replace('/login');
        setTimeout(() => { navigationInProgress.current = false; }, 100);
        return;
      }

      // Handle email verification
      if (user && !isAuthRoute && pathname !== '/verify-email') {
        try {
          // Use cached verification status when possible (check both sessionStorage and localStorage)
          const cachedSessionStatus = typeof window !== 'undefined' ? sessionStorage.getItem(`emailVerified_${user.uid}`) : null;
          const cachedLocalStatus = typeof window !== 'undefined' ? localStorage.getItem(`emailVerified_${user.uid}`) : null;
          
          if (cachedSessionStatus === 'true' || cachedLocalStatus === 'true') {
            if (typeof window !== 'undefined' && cachedSessionStatus !== 'true') {
              sessionStorage.setItem(`emailVerified_${user.uid}`, 'true');
            }
            return;
          }
          
          // Check if we should verify again
          const now = Date.now();
          const lastVerificationCheck = parseInt(sessionStorage.getItem(`lastVerificationCheck_${user.uid}`) || '0');
          
          if (now - lastVerificationCheck < VERIFICATION_CHECK_COOLDOWN) {
            return; // Skip verification check if done recently
          }
          
          sessionStorage.setItem(`lastVerificationCheck_${user.uid}`, now.toString());
          
          // Get user document (or initialize with unified schema if missing)
          let userDoc = await getDoc(doc(db, 'users', user.uid));
          if (!userDoc.exists()) {
            userDoc = await authService.ensureUserDocument(user);
          }
          const userData = userDoc.data() as DocumentData | undefined;
          
          // Consider email verified if Firebase auth, local markers, or Firestore indicate so
          const isVerified = Boolean(
            user.emailVerified ||
            cachedSessionStatus === 'true' ||
            cachedLocalStatus === 'true' ||
            userData?.emailVerified !== false
          );

          if (isVerified) {
            if (typeof window !== 'undefined') {
              sessionStorage.setItem(`emailVerified_${user.uid}`, 'true');
              localStorage.setItem(`emailVerified_${user.uid}`, 'true');
            }
            // Update Firestore if needed
            if (!userData?.emailVerified) {
              await setDoc(doc(db, 'users', user.uid), {
                emailVerified: true,
                verifiedAt: serverTimestamp(),
                lastUpdated: serverTimestamp()
              }, { merge: true });
            }
            return;
          }

          // Clear cached verified state if not verified
          sessionStorage.removeItem(`emailVerified_${user.uid}`);

          // Handle unverified user - only redirect if not in a navigation cooldown
          const lastVerifyRedirect = parseInt(sessionStorage.getItem(`lastVerifyRedirect_${user.uid}`) || '0');
          if (now - lastVerifyRedirect >= REDIRECT_COOLDOWN && !navigationInProgress.current) {
            sessionStorage.setItem(`lastVerifyRedirect_${user.uid}`, now.toString());
            lastRedirectTime.current = now;
            navigationInProgress.current = true;
            router.replace(`/verify-email?email=${encodeURIComponent(user.email || '')}`);
            setTimeout(() => { navigationInProgress.current = false; }, 500);
          }
        } catch (error) {
          console.error('Error checking email verification status from Firestore:', error);
          if (user.emailVerified) {
            sessionStorage.setItem(`emailVerified_${user.uid}`, 'true');
          } else {
            sessionStorage.removeItem(`emailVerified_${user.uid}`);
          }
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