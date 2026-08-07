'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import React, { useState, useEffect, Suspense } from 'react';
import { auth } from '@/lib/firebase';
import { authService } from '@/lib/auth-service';
import { registerDeviceSecurely } from '@/utils/device-auth';
import { sendPasswordResetEmail, browserLocalPersistence, browserSessionPersistence, setPersistence } from 'firebase/auth';
import { Button } from '@/components/ui/button';
import {
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  Card,
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
import { cn } from '@/lib/utils';
import { Mail, Lock, Eye, EyeOff, Loader2, CheckSquare, Square } from 'lucide-react';

const formSchema = z.object({
  email: z
    .string()
    .min(1, { message: 'Email address is required.' })
    .email({ message: 'Please enter a valid email address.' }),
  password: z
    .string()
    .min(1, { message: 'Password is required.' })
    .min(6, { message: 'Password must be at least 6 characters.' }),
});

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  // Check for success/notification messages from redirect params
  useEffect(() => {
    const message = searchParams.get('message');
    if (message) {
      toast({
        title: 'Notice',
        description: message,
      });
      // Replace URL quietly without reloading
      const url = new URL(window.location.href);
      url.searchParams.delete('message');
      window.history.replaceState({}, '', url.toString());
    }
  }, [searchParams, toast]);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const onSubmit = async (values: z.infer<typeof formSchema>, e?: React.BaseSyntheticEvent) => {
    e?.preventDefault();
    if (loading || googleLoading) return;
    setLoading(true);
    
    // Clear any existing stored auth error markers
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('auth_error');
      localStorage.removeItem('lastAuthError');
    }
    
    try {
      // Always set local persistence for reliable persistent logins
      await setPersistence(auth, browserLocalPersistence);

      // Attempt to sign in
      const user = await authService.signInWithEmail(values.email, values.password);
      
      if (!user) {
        throw new Error('No user returned from sign in');
      }
      
      // Update session markers
      if (typeof window !== 'undefined') {
        localStorage.setItem('sessionUser', user.uid);
        localStorage.setItem('lastLogin', Date.now().toString());
      }
      
      toast({
        title: 'Welcome back!',
        description: 'Successfully signed in.',
      });
      
      router.replace('/');
    } catch (e: any) {
        console.error("Login submission error:", e);
        
        let errorMessage = 'An unexpected error occurred. Please try again.';
        
        // Clear password on error, preserve email field for UX
        form.setValue('password', '');
        
        // Handle specific Firebase auth error codes & set field-level errors
        switch (e.code) {
          case 'auth/user-not-found':
            errorMessage = 'No account found with this email address.';
            form.setError('email', { message: errorMessage });
            break;
          case 'auth/wrong-password':
            errorMessage = 'Incorrect password. Click "Forgot password?" to reset it.';
            form.setError('password', { message: errorMessage });
            break;
          case 'auth/invalid-credential':
            errorMessage = 'Invalid email or password. Please double-check your credentials.';
            form.setError('password', { message: 'Invalid email or password.' });
            break;
          case 'auth/invalid-email':
            errorMessage = 'Please enter a valid email address.';
            form.setError('email', { message: errorMessage });
            break;
          case 'auth/user-disabled':
            errorMessage = 'This account has been disabled. Please contact support.';
            form.setError('email', { message: errorMessage });
            break;
          case 'auth/too-many-requests':
            errorMessage = 'Too many failed login attempts. Please wait a few minutes or reset your password.';
            break;
          case 'auth/network-request-failed':
            errorMessage = 'Unable to connect to the server. Please check your internet connection.';
            break;
          default:
            if (e.message) {
              errorMessage = e.message;
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

  const handleForgotPassword = async (e?: React.MouseEvent) => {
    e?.preventDefault();
    if (loading || googleLoading) return;

    const isEmailValid = await form.trigger('email');
    const email = form.getValues('email');
    
    if (!email || !isEmailValid) {
      form.setError('email', { message: 'Please enter a valid email address first.' });
      toast({
        title: 'Email required',
        description: 'Please enter a valid email address in the field above.',
        variant: 'destructive',
      });
      return;
    }

    try {
      const currentDomain = typeof window !== 'undefined' ? window.location.origin : 
        process.env.REPLIT_DOMAINS ? `https://${process.env.REPLIT_DOMAINS}` : '';
      
      const actionCodeSettings = {
        url: `${currentDomain}/reset-password`,
        handleCodeInApp: false,
      };

      if (!auth) {
        throw new Error('Authentication is not initialized');
      }

      await sendPasswordResetEmail(auth, email, actionCodeSettings);
      
      toast({
        title: 'Password reset email sent',
        description: `Check ${email} for instructions to reset your password.`,
      });
    } catch (error: any) {
      console.error('Password reset error:', error);
      let errorMessage = 'Failed to send password reset email. Please try again.';
      
      switch (error.code) {
        case 'auth/user-not-found':
          errorMessage = 'No account found with this email address.';
          form.setError('email', { message: errorMessage });
          break;
        case 'auth/invalid-email':
          errorMessage = 'Please enter a valid email address.';
          form.setError('email', { message: errorMessage });
          break;
        case 'auth/too-many-requests':
          errorMessage = 'Too many reset requests. Please wait a few minutes before trying again.';
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

  const handleGoogleSignIn = async (e?: React.MouseEvent) => {
    e?.preventDefault();
    if (loading || googleLoading) return;
    setGoogleLoading(true);
    
    try {
      await setPersistence(auth, browserLocalPersistence);
      
      const user: any = await authService.signInWithGoogle();
      
      if (!user || !user.uid) {
        toast({
          title: 'Redirecting to Google',
          description: 'Please complete sign in in the Google window...',
        });
        return;
      }

      if (typeof window !== 'undefined') {
        sessionStorage.setItem(`emailVerified_${user.uid}`, 'true');
        localStorage.setItem(`emailVerified_${user.uid}`, 'true');
        localStorage.setItem('sessionUser', user.uid);
        localStorage.setItem('lastLogin', Date.now().toString());
      }

      await registerDeviceSecurely(user);

      toast({
        title: 'Welcome!',
        description: 'Successfully signed in with Google.',
      });
      router.replace('/');
    } catch (e: any) {
      console.error("Google Sign-In error:", e);
      let errorMessage = 'An unexpected error occurred. Please try again.';
      
      switch (e.code) {
        case 'auth/api-key-not-valid':
        case 'auth/invalid-api-key':
          errorMessage = 'Firebase API key is invalid or truncated. Please set a valid NEXT_PUBLIC_FIREBASE_API_KEY in .env.';
          break;
        case 'auth/popup-closed-by-user':
          errorMessage = 'Google sign-in was cancelled. Please try again.';
          break;
        case 'auth/popup-blocked':
          errorMessage = 'Popup was blocked by your browser. Please allow popups for this site.';
          break;
        case 'auth/invalid-credential':
          errorMessage = 'Sign-in failed due to an invalid credential. Please try again.';
          if (auth) {
            await auth.signOut();
          }
          break;
        case 'auth/network-request-failed':
          errorMessage = 'Network error. Please check your connection and try again.';
          break;
        default:
          if (e.message) {
            errorMessage = e.message;
          }
      }
      
      toast({
        title: 'Google Sign-In Error',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setGoogleLoading(false);
    }
  };

  useEffect(() => {
    return () => {
      setLoading(false);
      setGoogleLoading(false);
    };
  }, []);

  return (
    <>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <Card className="bg-transparent border-0 shadow-none">
            <CardHeader className="space-y-1.5 text-center pb-4">
              <CardTitle className="text-2xl font-bold tracking-tight">Welcome Back</CardTitle>
              <CardDescription className="text-sm text-muted-foreground">
                Enter your credentials to access your account
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 px-6">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem className="grid gap-1.5">
                    <FormLabel className="text-sm font-medium">Email</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                        <Input
                          type="email"
                          placeholder="name@example.com"
                          autoComplete="email"
                          className="pl-9 bg-background/50 backdrop-blur-sm border-border/70 focus:border-primary transition-colors"
                          {...field}
                          disabled={loading || googleLoading}
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem className="grid gap-1.5">
                    <div className="flex items-center justify-between">
                      <FormLabel className="text-sm font-medium">Password</FormLabel>
                      <Button
                        type="button"
                        variant="link"
                        tabIndex={-1}
                        className="p-0 h-auto text-xs text-violet-400 hover:text-violet-300 font-medium hover:underline transition-colors"
                        onClick={handleForgotPassword}
                        disabled={loading || googleLoading}
                      >
                        Forgot password?
                      </Button>
                    </div>
                    <FormControl>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                        <Input
                          type={showPassword ? 'text' : 'password'}
                          placeholder="••••••••"
                          autoComplete="current-password"
                          className="pl-9 pr-10 bg-background/50 backdrop-blur-sm border-border/70 focus:border-primary transition-colors"
                          {...field}
                          disabled={loading || googleLoading}
                        />
                        <button
                          type="button"
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus:outline-none transition-colors"
                          onClick={() => setShowPassword(!showPassword)}
                          disabled={loading || googleLoading}
                          aria-label={showPassword ? 'Hide password' : 'Show password'}
                        >
                          {showPassword ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex items-center justify-between pt-1">
                <button
                  type="button"
                  onClick={() => setRememberMe(!rememberMe)}
                  className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors select-none"
                  disabled={loading || googleLoading}
                >
                  {rememberMe ? (
                    <CheckSquare className="h-4 w-4 text-primary" />
                  ) : (
                    <Square className="h-4 w-4 text-muted-foreground" />
                  )}
                  <span>Remember me on this device</span>
                </button>
              </div>
            </CardContent>

            <CardFooter className="flex flex-col gap-4 px-6 pb-6 pt-2">
              <Button
                className="w-full h-10 font-semibold shadow-md shadow-primary/20 transition-all hover:shadow-lg hover:shadow-primary/30 active:scale-[0.99]"
                type="submit"
                disabled={loading || googleLoading}
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Logging in...
                  </span>
                ) : (
                  'Login'
                )}
              </Button>

              <div className="relative my-1 flex items-center justify-center">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-border/60" />
                </div>
                <span className="relative z-10 bg-card px-3 py-0.5 text-xs text-muted-foreground font-medium rounded-full border border-border/50 shadow-sm">
                  Or continue with
                </span>
              </div>

              <Button
                type="button"
                variant="outline"
                className="w-full h-10 bg-background/40 hover:bg-background/80 border-border/70 font-medium transition-all"
                onClick={handleGoogleSignIn}
                disabled={loading || googleLoading}
              >
                {googleLoading ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Signing in...
                  </span>
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

              <div className="text-center text-sm text-muted-foreground pt-1 pb-2">
                Don&apos;t have an account?{' '}
                <Link
                  href="/signup"
                  className={cn(
                    "font-semibold text-violet-400 hover:text-violet-300 underline-offset-4 hover:underline transition-colors",
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

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}