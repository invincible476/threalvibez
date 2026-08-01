
'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { authService } from '@/lib/auth-service';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import React, { useState } from 'react';

import { auth, db } from '@/lib/firebase';
import { sendVerificationRequest, verifyEmailCode } from '@/utils/email-service';
import { registerDeviceSecurely } from '@/utils/device-auth';
import { Button } from '@/components/ui/button';
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
// Separate import for react-firebase-hooks to avoid conflicts
import { useCreateUserWithEmailAndPassword } from 'react-firebase-hooks/auth';
import { useSignInWithGoogle } from 'react-firebase-hooks/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';

const formSchema = z.object({
  name: z.string().min(2, { message: 'Name must be at least 2 characters.' }),
  email: z.string().email({ message: 'Invalid email address.' }),
  password: z
    .string()
    .min(6, { message: 'Password must be at least 6 characters.' }),
});


export default function SignupPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [
    createUserWithEmailAndPasswordHook,
    user,
    loading,
    error
  ] = useCreateUserWithEmailAndPassword(auth!);
  const [
    signInWithGoogleHook,
    googleUser,
    googleLoading,
    googleError
  ] = useSignInWithGoogle(auth!);
  
  // Email verification states
  const [showVerification, setShowVerification] = useState(false);
  const [verificationCodeInput, setVerificationCodeInput] = useState('');
  const [verificationEmail, setVerificationEmail] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [isSendingCode, setIsSendingCode] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      email: '',
      password: '',
    },
  });


  const handleSendVerificationCode = async (email: string) => {
    if (isSendingCode || isVerifying || loading || googleLoading) return;
    setIsSendingCode(true);
    try {
      const success = await sendVerificationRequest(email);
      if (success) {
        setVerificationEmail(email);
        setVerificationCodeInput('');
        setShowVerification(true);
        toast({ title: 'Verification Code Sent!', description: `Please check your email (${email}) for your 6-digit code.` });
      } else {
        toast({ title: 'Error', description: 'Failed to send verification code to your email. Please check the address and try again.', variant: 'destructive' });
      }
    } catch (error) {
      console.error('Error sending verification code:', error);
      toast({ title: 'Error', description: 'Failed to request verification code. Please try again.', variant: 'destructive' });
    } finally {
      setIsSendingCode(false);
    }
  };

  const handleVerifyCode = async (e?: React.MouseEvent) => {
    e?.preventDefault();
    if (isVerifying || isSendingCode || loading || googleLoading) return;
    if (!verificationCodeInput.trim()) {
      toast({ title: 'Error', description: 'Please enter the verification code.', variant: 'destructive' });
      return;
    }

    setIsVerifying(true);
    try {
      // Get form data before verification
      const formData = form.getValues();
      console.log('Form data:', { email: verificationEmail, name: formData.name });
      
      // Verify the code first
      const result = await verifyEmailCode(verificationEmail, verificationCodeInput);
      console.log('Verification result:', result);
      
      if (!result.success) {
        toast({ 
          title: 'Invalid code', 
          description: result.message || 'The verification code is incorrect or has expired. Please try again.', 
          variant: 'destructive' 
        });
        // Clear the input for retry
        setVerificationCodeInput('');
        return;
      }

      console.log('Creating account with:', verificationEmail);
      
      // Create the account using the auth service
      const user = await authService.createAccount(
        verificationEmail,
        formData.password,
        formData.name
      );

      if (user?.uid && typeof window !== 'undefined') {
        sessionStorage.setItem(`emailVerified_${user.uid}`, 'true');
        localStorage.setItem(`emailVerified_${user.uid}`, 'true');
        sessionStorage.setItem(`lastVerificationCheck_${user.uid}`, Date.now().toString());
        localStorage.setItem('sessionUser', user.uid);
        localStorage.setItem('lastLogin', Date.now().toString());
      }
      
      toast({
        title: 'Account created!',
        description: 'Your account has been created and verified successfully.'
      });

      router.replace('/');

    } catch (error: any) {
      console.error('Error during verification/signup:', error);
      
      // Attempt to clean up if we have a partial user creation
      try {
        if (auth?.currentUser) {
          await auth.currentUser.delete();
        }
      } catch (cleanupError) {
        console.error('Error during cleanup:', cleanupError);
      }
      
      let errorMessage = 'Failed to verify code or create account.';
      let errorDetail = '';
      
      if (error.code === 'auth/email-already-in-use') {
        errorMessage = 'An account with this email already exists.';
        errorDetail = 'Please try logging in instead.';
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = 'The email address is not valid.';
        errorDetail = 'Please check the email address and try again.';
      } else if (error.code === 'auth/weak-password') {
        errorMessage = 'The password is too weak.';
        errorDetail = 'Please choose a stronger password with at least 6 characters.';
      } else if (error.code === 'auth/network-request-failed') {
        errorMessage = 'Network connection error.';
        errorDetail = 'Please check your internet connection and try again.';
      } else if (error.code === 'auth/too-many-requests') {
        errorMessage = 'Too many attempts.';
        errorDetail = 'Please wait a few minutes before trying again.';
      } else if (error.message) {
        errorDetail = error.message;
      }
      
      toast({
        title: 'Error',
        description: errorDetail ? `${errorMessage} ${errorDetail}` : errorMessage,
        variant: 'destructive'
      });
      
      // Clear verification input on error
      setVerificationCodeInput('');
      
      // If it's a serious error, go back to the main signup form
      if (error.code === 'auth/network-request-failed' || 
          error.code === 'auth/too-many-requests' ||
          error.message?.includes('failed - no user returned')) {
        setShowVerification(false);
      }
      
    } finally {
      setIsVerifying(false);
    }
  };

  // Function removed as its functionality is now in handleVerifyCode

  const handleGoogleSignup = async (e?: React.MouseEvent) => {
    e?.preventDefault();
    if (isSendingCode || isVerifying || loading || googleLoading) return;
    try {
      console.log('Starting Google signup...');
      const user = await authService.signInWithGoogle();

      if (user) {
        if (typeof window !== 'undefined') {
          sessionStorage.setItem(`emailVerified_${user.uid}`, 'true');
          localStorage.setItem(`emailVerified_${user.uid}`, 'true');
          localStorage.setItem('sessionUser', user.uid);
          localStorage.setItem('lastLogin', Date.now().toString());
        }

        // Register device securely for both new and existing users
        const deviceResult = await registerDeviceSecurely(user);
        if (!deviceResult.success) {
          console.warn('Device registration failed:', deviceResult.error);
        }

        toast({
          title: 'Welcome!',
          description: 'Successfully signed up with Google.',
        });
        router.replace('/');
      } else {
        toast({
          title: 'Redirecting to Google',
          description: 'Please complete sign up in the Google window...',
        });
      }
    } catch (error: any) {
      console.error("Google signup error:", error);
      let errorMessage = error.message || 'Failed to sign up with Google.';
      if (error.code === 'auth/popup-closed-by-user') {
        errorMessage = 'Google sign-in was cancelled.';
      }
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    }
  };

  const onSubmit = async (values: z.infer<typeof formSchema>, e?: React.BaseSyntheticEvent) => {
    e?.preventDefault();
    if (isSendingCode || isVerifying || loading || googleLoading) return;
    try {
      // Step 1: Send verification code first, before creating account
      await handleSendVerificationCode(values.email);
    } catch (error: any) {
      console.error('Error in signup:', error);
      let errorMessage = 'Failed to send verification code. Please try again.';
      if (error.code === 'auth/email-already-in-use') {
        errorMessage = 'An account with this email already exists.';
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = 'Please enter a valid email address.';
      }
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    }
  };

  if (showVerification) {
    return (
      <>
        <Card className="bg-transparent border-0 shadow-none">
          <CardHeader className="space-y-1 text-center">
            <CardTitle className="text-2xl">Verify Your Email</CardTitle>
            <CardDescription>
              We sent a 6-digit code to {verificationEmail}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-2">
              <label htmlFor="verification-code" className="text-sm font-medium">
                Verification Code
              </label>
              <Input
                id="verification-code"
                type="text"
                inputMode="numeric"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck="false"
                placeholder="000000"
                  value={verificationCodeInput}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                  // Only allow numbers
                  const value = e.target.value.replace(/\D/g, '').slice(0, 6);
                  setVerificationCodeInput(value);
                }}
                disabled={isVerifying}
                maxLength={6}
                className="text-center text-lg tracking-widest"
              />
            </div>
            
              <Button 
              onClick={handleVerifyCode} 
              disabled={isVerifying || !verificationCodeInput.trim()}
              className="w-full"
            >
              {isVerifying ? 'Verifying...' : 'Verify Email'}
            </Button>

            <div className="text-center space-y-2">
              <Button
                type="button"
                variant="link"
                onClick={() => handleSendVerificationCode(verificationEmail)}
                disabled={isVerifying}
                className="text-sm"
              >
                Resend Code
              </Button>
              <p className="text-xs text-muted-foreground">
                Didn't receive the code? Check your spam folder.
              </p>
            </div>

            <div className="text-center">
              <Button
                type="button"
                variant="link"
                onClick={() => setShowVerification(false)}
                disabled={isVerifying}
                className="text-sm"
              >
                ← Back to signup
              </Button>
            </div>
          </CardContent>
        </Card>
      </>
    );
  }

  return (
    <>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <Card className="bg-transparent border-0 shadow-none">
            <CardHeader className="space-y-1.5 text-center pb-4">
              <CardTitle className="text-2xl font-bold tracking-tight">Create an account</CardTitle>
              <CardDescription className="text-sm text-muted-foreground">
                Enter your information to create an account
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3.5 px-6">
              <FormField
                control={form.control}
                name="name"
                render={({ field }: { field: any }) => (
                  <FormItem className="grid gap-1.5">
                    <FormLabel className="text-sm font-medium">Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Your Name" {...field} disabled={loading || isSendingCode} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem className="grid gap-1.5">
                    <FormLabel className="text-sm font-medium">Email</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="m@example.com"
                        {...field}
                        disabled={loading || isSendingCode}
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
                  <FormItem className="grid gap-1.5">
                    <FormLabel className="text-sm font-medium">Password</FormLabel>
                    <FormControl>
                      <Input type="password" {...field} disabled={loading || isSendingCode}/>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
            <CardFooter className="flex flex-col gap-4 px-6 pb-6 pt-2">
              <Button className="w-full h-10 font-semibold shadow-md shadow-primary/20 transition-all hover:shadow-lg hover:shadow-primary/30 active:scale-[0.99]" type="submit" disabled={loading || googleLoading || isSendingCode}>
                {isSendingCode ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Sending verification...
                  </div>
                ) : loading ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Creating account...
                  </div>
                ) : (
                  'Create account'
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
                onClick={handleGoogleSignup}
                disabled={loading || googleLoading || isSendingCode}
              >
                {googleLoading ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    Signing up...
                  </div>
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
                Already have an account?{' '}
                <Link
                  href="/login"
                  className={cn(
                    "font-semibold text-violet-400 hover:text-violet-300 underline-offset-4 hover:underline transition-colors",
                    (loading || googleLoading || isSendingCode) && "pointer-events-none opacity-50"
                  )}
                  aria-disabled={loading || googleLoading || isSendingCode}
                  tabIndex={(loading || googleLoading || isSendingCode) ? -1 : undefined}
                >
                  Log in
                </Link>
              </div>
            </CardFooter>
          </Card>
        </form>
      </Form>
    </>
  );
}
