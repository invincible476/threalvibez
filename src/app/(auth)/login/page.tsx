'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import React, { useState, useEffect } from 'react';
import { auth } from '@/lib/firebase';
import { authService } from '@/lib/auth-service';
import { sendPasswordResetEmail, browserLocalPersistence, setPersistence } from 'firebase/auth';
import { Button } from '@/components/ui/button';
import {
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { Toaster } from '@/components/ui/toaster';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import type { User } from '@/lib/types';


const formSchema = z.object({
  email: z.string().email({ message: 'Invalid email address.' }),
  password: z
    .string()
    .min(6, { message: 'Password must be at least 6 characters.' }),
});

export default function LoginPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    setLoading(true);
    
    // Clear any existing error states
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('auth_error');
      localStorage.removeItem('lastAuthError');
    }
    
    try {
      // Clear any existing auth state first
      if (auth.currentUser) {
        await auth.signOut();
      }
      
      // Attempt to sign in
      const user = await authService.signInWithEmail(values.email, values.password);
      
      if (!user) {
        throw new Error('No user returned from sign in');
      }
      
      // Verify the session is valid
      const token = await user.getIdToken(true);
      if (!token) {
        throw new Error('Failed to obtain valid session token');
      }
      
      // Success! Redirect to home
      console.log('Login successful, redirecting to home');
      router.push('/');
    } catch (e: any) {
        console.error("Login submission error:", e);
        console.error("Error code:", e.code);
        console.error("Error message:", e.message);
        
        let errorMessage = 'An unexpected error occurred. Please try again.';
        form.reset();
        
        // Handle specific Firebase auth error codes
        switch (e.code) {
          case 'auth/user-not-found':
            errorMessage = 'The email address you entered is not registered. Please check your email or click "Sign up" to create a new account.';
            break;
          case 'auth/wrong-password':
            errorMessage = 'The password you entered is incorrect. You can click "Forgot your password?" to reset it.';
            break;
          case 'auth/invalid-credential':
            console.error('Invalid credential error details:', e);
            await auth.signOut();
            
            // Clear session data
            if (typeof window !== 'undefined') {
              localStorage.clear();
              sessionStorage.clear();
              
              try {
                const databases = await window.indexedDB.databases();
                await Promise.all(
                  databases
                    .filter(db => db.name?.includes('firebase'))
                    .filter((db): db is { name: string } => db.name !== undefined)
                    .map(db => window.indexedDB.deleteDatabase(db.name))
                );
              } catch (dbError) {
                console.error('Error clearing IndexedDB:', dbError);
              }
              
              document.cookie.split(';').forEach(c => {
                document.cookie = c
                  .replace(/^ +/, '')
                  .replace(/=.*/, `=;expires=${new Date().toUTCString()};path=/`);
              });
            }
            
            errorMessage = 'Your session has expired. The page will refresh in a moment - please try logging in again.';
            
            setTimeout(() => {
              window.location.href = '/login';
            }, 1500);
            break;
          case 'auth/invalid-email':
            errorMessage = 'This email address is not valid. Please make sure you entered a correct email address (e.g., name@example.com).';
            break;
          case 'auth/user-disabled':
            errorMessage = 'This account has been disabled. If you believe this is a mistake, please contact support for assistance.';
            break;
          case 'auth/too-many-requests':
            errorMessage = 'Access temporarily blocked due to multiple failed attempts. You can:\n1. Wait a few minutes and try again\n2. Click "Forgot your password?" to reset your password\n3. Try signing in with Google instead';
            break;
          case 'auth/network-request-failed':
            errorMessage = 'Unable to connect to the server. Please check that:\n1. Your internet connection is working\n2. You are not in airplane mode\n3. Your firewall is not blocking the connection';
            break;
          default:
            if (e.message) {
              errorMessage = `Login failed: ${e.message}. Please try again or contact support if the problem persists.`;
            }
        }
        
        toast({
            title: 'Login Failed',
            description: errorMessage,
            variant: 'destructive',
        });
    } finally {
        setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    const email = form.getValues('email');
    if (!email) {
      toast({
        title: 'Email required',
        description: 'Please enter your email address first.',
        variant: 'destructive',
      });
      return;
    }

    try {
      // Get the current domain for the reset URL
      const currentDomain = typeof window !== 'undefined' ? window.location.origin : 
        process.env.REPLIT_DOMAINS ? `https://${process.env.REPLIT_DOMAINS}` :
        'https://2b711deb-9881-4c8e-9864-f2078ec28923-00-1z7caopfvm8sp.picard.replit.dev';
      
      // Configure action code settings for the password reset email
      const actionCodeSettings = {
        url: `${currentDomain}/reset-password`,
        handleCodeInApp: false, // We want to handle the reset in the web app, not mobile
      };

      // Ensure auth is properly initialized
      if (!auth) {
        throw new Error('Authentication is not initialized');
      }
      
      // Log auth configuration for debugging
      console.log('Auth configuration:', {
        isInitialized: !!auth,
        hasAuthDomain: !!auth.config?.authDomain,
        currentDomain: window.location.hostname
      });

      // Use Firebase's built-in sendPasswordResetEmail method
      await sendPasswordResetEmail(auth, email, actionCodeSettings);
      
      toast({
        title: 'Password reset email sent',
        description: 'Check your email for a link to reset your password. If you don\'t see it, check your spam folder.',
      });
    } catch (error: any) {
      console.error('Password reset error:', error);
      
      let errorMessage = 'Failed to send password reset email. Please try again.';
      
      // Handle specific Firebase auth error codes
      switch (error.code) {
        case 'auth/user-not-found':
          errorMessage = 'No account found with this email address. Please check your email or create a new account.';
          break;
        case 'auth/invalid-email':
          errorMessage = 'Please enter a valid email address.';
          break;
        case 'auth/too-many-requests':
          errorMessage = 'Too many reset requests. Please wait a few minutes before trying again.';
          break;
        case 'auth/network-request-failed':
          errorMessage = 'Network error. Please check your connection and try again.';
          break;
        default:
          if (error.message) {
            errorMessage = error.message;
          }
      }
      
      toast({
        title: 'Error sending reset email',
        description: errorMessage,
        variant: 'destructive',
      });
    }
  };

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    
    // Clear any existing error states
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('auth_error');
      localStorage.removeItem('lastAuthError');
    }
    
    try {
      // Clear existing auth state first
      if (auth.currentUser) {
        await auth.signOut();
        // Wait for auth state to clear
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      // Set persistence to LOCAL before sign-in
      await setPersistence(auth, browserLocalPersistence);
      
      // Prevent automatic reload and set up loading state
      if (typeof window !== 'undefined') {
        const loadingToast = toast({
          title: 'Signing in...',
          description: 'Please wait while we securely log you in.',
        });

        window.onbeforeunload = (e) => {
          e.preventDefault();
          e.returnValue = '';
        };

        // Clean up toast after 3 seconds
        setTimeout(() => loadingToast.dismiss(), 3000);
      }

      const user = await authService.signInWithGoogle();
      
      // If user is null, it means we're being redirected
      if (!user) {
        // Show loading message since we're about to redirect
        toast({
          title: 'Redirecting to Google',
          description: 'Please complete sign in with Google...',
        });
        return; // Don't continue since we're being redirected
      }

      // Re-enable automatic reload after successful login
      if (typeof window !== 'undefined') {
        window.onbeforeunload = null;
      }
    
      console.log('Google sign-in successful:', user.uid);
      router.push('/');
    } catch (e: any) {
      // Re-enable automatic reload on error
      if (typeof window !== 'undefined') {
        window.onbeforeunload = null;
      }

      console.error("Google Sign-In error:", {
        error: e,
        code: e.code,
        message: e.message,
        stack: e.stack
      });
      let errorMessage = 'An unexpected error occurred. Please try again.';
      
      switch (e.code) {
        case 'auth/popup-closed-by-user':
          errorMessage = 'Google sign-in was cancelled. Please try again.';
          break;
        case 'auth/popup-blocked':
          errorMessage = 'Popup was blocked. Please allow popups for this site and try again.';
          break;
        case 'auth/invalid-credential':
          errorMessage = 'Sign-in failed. Please clear your browser cache and try again.';
          // Clear auth state for next attempt
          if (auth) {
            await auth.signOut();
          }
          break;
        case 'auth/network-request-failed':
          errorMessage = 'Network error. Please check your internet connection and try again.';
          break;
        case 'auth/cancelled-popup-request':
          errorMessage = 'Another popup is already open. Please close it and try again.';
          break;
        case 'auth/argument-error':
          // Clear all storage and reload
          if (typeof window !== 'undefined') {
            localStorage.clear();
            sessionStorage.clear();
            // Clear IndexedDB
            try {
              const databases = await window.indexedDB.databases();
              await Promise.all(
                databases
                  .filter(db => db.name?.includes('firebase'))
                  .map(db => window.indexedDB.deleteDatabase(db.name || ''))
              );
            } catch (dbError) {
              console.error('Error clearing IndexedDB:', dbError);
            }
          }
          errorMessage = 'Authentication error. Please try again after the page reloads.';
          setTimeout(() => window.location.reload(), 1500);
          break;
        default:
          if (e.message) {
            errorMessage = e.message;
          }
      }
      
      toast({
        title: 'Error signing in with Google',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setGoogleLoading(false);
    }
  };

  // Cleanup loading states when component unmounts
  useEffect(() => {
    return () => {
      setLoading(false);
      setGoogleLoading(false);
    };
  }, []);


  return (
    <>
      <Toaster />
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <Card className="bg-transparent border-0 shadow-none">
            <CardHeader className="space-y-1 text-center">
              <CardTitle className="text-2xl">Welcome Back</CardTitle>
              <CardDescription>
                Enter your email below to log in to your account
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem className="grid gap-2">
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="m@example.com"
                        {...field}
                        disabled={loading || googleLoading}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem className="grid gap-2">
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <Input type="password" {...field} disabled={loading || googleLoading} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
            <CardFooter className="flex flex-col gap-4">
              <Button className="w-full" type="submit" disabled={loading || googleLoading}>
                {loading ? 'Logging in...' : 'Login'}
              </Button>

              <div className="text-center">
                <Button
                  type="button"
                  variant="link"
                  className="text-sm text-muted-foreground hover:text-primary"
                  onClick={() => handleForgotPassword()}
                  disabled={loading || googleLoading}
                >
                  Forgot your password?
                </Button>
              </div>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">
                    Or continue with
                  </span>
                </div>
              </div>

              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={handleGoogleSignIn}
                disabled={loading || googleLoading}
              >
                {googleLoading ? (
                  'Signing in...'
                ) : (
                  <>
                    <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                      <path
                        fill="currentColor"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="currentColor"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="currentColor"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                      />
                      <path
                        fill="currentColor"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      />
                    </svg>
                    Continue with Google
                  </>
                )}
              </Button>

              <div className="text-center text-sm text-muted-foreground">
                Don't have an account?{' '}
                <Link
                  href="/signup"
                  className={cn(
                    "font-medium text-primary underline-offset-4 hover:underline",
                    (loading || googleLoading) && "pointer-events-none opacity-50"
                  )}
                  aria-disabled={loading || googleLoading}
                  tabIndex={loading || googleLoading ? -1 : 0}
                >
                  Sign up
                </Link>
              </div>
            </CardFooter>
          </Card>
        </form>
      </Form>
    </>
  );
}