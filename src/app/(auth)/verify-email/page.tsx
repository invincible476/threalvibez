'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import React, { useState, useEffect, useRef } from 'react';
import { sendEmailVerification, User } from 'firebase/auth';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';

import { auth, db } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import {
  Card,
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
import { sendVerificationRequest, verifyEmailCode as verifyEmailCodeAPI } from '@/utils/email-service';

const formSchema = z.object({
  code: z.string().min(6, { message: 'Verification code must be 6 digits.' }).max(6),
});

// Generate a 6-digit verification code
const generateVerificationCode = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

export default function VerifyEmailPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  // user-typed input
  const [verificationCodeInput, setVerificationCodeInput] = useState<string>('');
  // store the sent code in a ref (not shown directly in the input)
  const sentVerificationCodeRef = useRef<string | null>(null);
  const [userEmail, setUserEmail] = useState<string>('');

  useEffect(() => {
    // Get email from URL params
    const email = searchParams.get('email');
    
    if (!email) {
      toast({
        title: 'Error',
        description: 'Missing email information. Please try logging in again.',
        variant: 'destructive',
      });
      router.push('/login');
      return;
    }
    
    setUserEmail(email);

    // Automatically send verification code when page loads
    sendVerificationEmail(email)
      .then(() => {
        toast({
          title: 'Verification Code Sent',
          description: 'Please check your email for the verification code.',
        });
      })
      .catch(error => {
        console.error('Error sending initial verification code:', error);
        toast({
          title: 'Error',
          description: 'Failed to send verification code. Please try again or contact support.',
          variant: 'destructive',
        });
      });
  }, [searchParams, router, toast]);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      code: '',
    },
  });

  // Request the server to send a verification code to the given email
  const sendVerificationEmail = async (email: string) => {
    const user = auth.currentUser;
    if (!user) {
      throw new Error('No authenticated user found');
    }
    
    if (user.email !== email) {
      throw new Error('Email mismatch. Please try logging in again.');
    }

    const success = await sendVerificationRequest(email);
    if (!success) throw new Error('Failed to request verification code');
    return true;
  };

  const resendCode = async () => {
    setResendLoading(true);
    try {
      await sendVerificationEmail(userEmail);
      setVerificationCodeInput('');
      toast({ title: 'Code Sent', description: 'A new verification code has been sent to your email.' });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to send verification code. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setResendLoading(false);
    }
  };

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (loading) return; // Prevent double submission
    setLoading(true);
    
    try {
      const user = auth.currentUser;
      if (!user) {
        toast({
          title: 'Error',
          description: 'No authenticated user found. Please try logging in again.',
          variant: 'destructive',
        });
        router.push('/login');
        return;
      }

      // Try to verify the code
      const response = await verifyEmailCodeAPI(userEmail, values.code);
      
      if (response.success) {
        try {
          // Clear any cached verification status
          localStorage.removeItem(`emailVerified_${user.uid}`);
          localStorage.removeItem(`lastVerificationCheck_${user.uid}`);

          // Update user document with optimistic concurrency
          const userDocRef = doc(db, 'users', user.uid);
          await updateDoc(userDocRef, {
            emailVerified: true,
            verifiedAt: serverTimestamp(),
            lastUpdated: serverTimestamp()
          });
          
          // Reload the user to get the latest token
          await user.reload();
          
          // Cache the new verification status
          localStorage.setItem(`emailVerified_${user.uid}`, 'true');
          localStorage.setItem(`lastVerificationCheck_${user.uid}`, Date.now().toString());
        } catch (error) {
          toast({
            title: 'Verification Issue',
            description: 'Your email was verified but there was an issue updating your profile. Please try logging in again.',
            variant: 'destructive',
          });

          // If we can't update the profile, sign out and redirect to login
          setTimeout(async () => {
            await auth.signOut();
            router.push('/login?message=Please sign in again to complete verification');
          }, 2000);
        }
      } else {
        toast({
          title: 'Auth State Error',
          description: 'Please sign in again to complete verification.',
          variant: 'destructive',
        });
        router.push('/login');
        // Invalid code response with specific message from server
        toast({ 
          title: 'Verification Failed', 
          description: response.message || 'The verification code is incorrect or has expired. Please try again or request a new code.',
          variant: 'destructive' 
        });
        
        // Clear the input field for retry
        setVerificationCodeInput('');
        form.reset();
      }
    } catch (error) {
      console.error('Verification error:', error);
      toast({
        title: 'Verification Failed',
        description: error instanceof Error ? error.message : 'Unable to verify code. Please try again or request a new code.',
        variant: 'destructive',
      });
      
      // Clear the input field
      setVerificationCodeInput('');
      form.reset();
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Toaster />
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <Card>
            <CardHeader className="text-center">
              <CardTitle>Verify Your Email</CardTitle>
              <CardDescription>
                We've sent a 6-digit verification code to <strong>{userEmail}</strong>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Verification Code</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Enter 6-digit code"
                        maxLength={6}
                        className="text-center text-2xl font-mono tracking-widest"
                        {...field}
                        value={verificationCodeInput}
                        onChange={(e) => {
                          const value = e.target.value.replace(/\D/g, '').slice(0, 6);
                          setVerificationCodeInput(value);
                          field.onChange(value);
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
            <CardFooter className="flex flex-col space-y-4">
              <Button 
                type="submit" 
                className="w-full relative" 
                disabled={loading || form.watch('code').length !== 6}
              >
                {loading ? (
                  <>
                    <span className="opacity-0">Verify Email</span>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="h-5 w-5 border-2 border-t-transparent border-white rounded-full animate-spin"></div>
                    </div>
                  </>
                ) : (
                  'Verify Email'
                )}
              </Button>
              
              <div className="text-center space-y-2">
                <p className="text-sm text-muted-foreground">
                  Didn't receive the code?
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={resendCode}
                  disabled={resendLoading}
                >
                  {resendLoading ? 'Sending...' : 'Resend Code'}
                </Button>
              </div>

              <div className="text-center">
                <Link
                  href="/login"
                  className="text-sm text-muted-foreground hover:text-primary underline"
                >
                  Back to Login
                </Link>
              </div>
            </CardFooter>
          </Card>
        </form>
      </Form>
    </>
  );
}