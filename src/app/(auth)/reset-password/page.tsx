'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import React, { useState, useEffect, Suspense } from 'react';
import { confirmPasswordReset, verifyPasswordResetCode } from 'firebase/auth';

import { auth } from '@/lib/firebase';
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
import { cn } from '@/lib/utils';

const formSchema = z.object({
  password: z
    .string()
    .min(6, { message: 'Password must be at least 6 characters.' }),
  confirmPassword: z
    .string()
    .min(6, { message: 'Password must be at least 6 characters.' }),
}).refine(data => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState<string>('');
  const [codeVerified, setCodeVerified] = useState(false);
  const [oobCode, setOobCode] = useState<string>('');

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      password: '',
      confirmPassword: '',
    },
  });

  useEffect(() => {
    const code = searchParams.get('oobCode');
    
    if (code) {
      setOobCode(code);
      // Quick verification of the code
      verifyPasswordResetCode(auth, code)
        .then(email => {
          setEmail(email);
          setCodeVerified(true);
        })
        .catch(() => {
          toast({
            title: 'Invalid reset link',
            description: 'This password reset link is invalid or has expired.',
            variant: 'destructive',
          });
          router.replace('/login?error=invalid_reset_link');
        });
    } else {
      router.replace('/login');
    }
  }, [searchParams]);

  // No separate verification function needed

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!oobCode) {
      router.replace('/login');
      return;
    }

    setLoading(true);
    try {
      await confirmPasswordReset(auth, oobCode, values.password);
      
      // Immediately redirect to login
      router.replace('/login?message=Password reset successful. Please log in with your new password.');
    } catch (error: any) {
      console.error('Error resetting password:', error);
      let errorMessage = 'Failed to reset password. Please try again.';
      
      if (error.code === 'auth/weak-password') {
        errorMessage = 'Password is too weak. Please choose a stronger password.';
      } else if (error.code === 'auth/expired-action-code') {
        errorMessage = 'Reset link has expired. Please request a new one.';
      }
      
      toast({
        title: 'Reset failed',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  if (!codeVerified) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="w-full max-w-md mx-auto bg-white/10 backdrop-blur-lg border-white/20">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl font-bold text-white text-center">
              Verifying Reset Link
            </CardTitle>
            <CardDescription className="text-gray-300 text-center">
              Please wait while we verify your password reset link...
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen">
      <Card className="w-full max-w-md mx-auto bg-white/10 backdrop-blur-lg border-white/20">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-white text-center">
            Reset Password
          </CardTitle>
          <CardDescription className="text-gray-300 text-center">
            Enter your new password for <strong>{email}</strong>
          </CardDescription>
        </CardHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-white">New Password</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder="Enter new password"
                        className="bg-white/20 border-white/30 text-white placeholder:text-gray-300"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-white">Confirm Password</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder="Confirm new password"
                        className="bg-white/20 border-white/30 text-white placeholder:text-gray-300"
                        {...field}
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
                className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                disabled={loading}
              >
                {loading ? 'Resetting Password...' : 'Reset Password'}
              </Button>
              <div className="text-center text-sm text-gray-300">
                Remember your password?{' '}
                <Link href="/login" className="text-blue-400 hover:text-blue-300 underline">
                  Back to Login
                </Link>
              </div>
            </CardFooter>
          </form>
        </Form>
      </Card>
      <Toaster />
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
      </div>
    }>
      <ResetPasswordForm />
    </Suspense>
  );
}