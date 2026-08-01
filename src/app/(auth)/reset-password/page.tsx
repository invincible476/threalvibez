'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import React, { useState, useEffect, Suspense } from 'react';
import { confirmPasswordReset, verifyPasswordResetCode, sendPasswordResetEmail } from 'firebase/auth';

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
import { verifyEmailCode as verifyEmailCodeAPI } from '@/utils/email-service';

import { Check } from 'lucide-react';

const linkResetSchema = z.object({
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

const codeResetSchema = z.object({
  email: z.string().email({ message: 'Please enter a valid email address.' }),
  code: z.string().min(6, { message: 'Verification code must be 6 digits.' }).max(6),
  password: z.string().min(6, { message: 'Password must be at least 6 characters.' }),
  confirmPassword: z.string().min(6, { message: 'Password must be at least 6 characters.' }),
}).refine(data => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [requestLoading, setRequestLoading] = useState(false);
  const [email, setEmail] = useState<string>('');
  const [codeVerified, setCodeVerified] = useState(false);
  const [oobCode, setOobCode] = useState<string | null>(null);
  const [mode, setMode] = useState<'link' | 'code'>('code');
  const [isResetComplete, setIsResetComplete] = useState(false);

  const linkForm = useForm<z.infer<typeof linkResetSchema>>({
    resolver: zodResolver(linkResetSchema),
    defaultValues: { password: '', confirmPassword: '' },
  });

  const codeForm = useForm<z.infer<typeof codeResetSchema>>({
    resolver: zodResolver(codeResetSchema),
    defaultValues: { email: '', code: '', password: '', confirmPassword: '' },
  });

  useEffect(() => {
    const code = searchParams.get('oobCode');
    if (code) {
      setOobCode(code);
      setMode('link');
      verifyPasswordResetCode(auth, code)
        .then(verifiedEmail => {
          setEmail(verifiedEmail);
          setCodeVerified(true);
        })
        .catch(() => {
          toast({
            title: 'Invalid or Expired Link',
            description: 'This password reset link is invalid or has expired.',
            variant: 'destructive',
          });
          setMode('code');
        });
    }
  }, [searchParams]);

  const handleLinkSubmit = async (values: z.infer<typeof linkResetSchema>, e?: React.BaseSyntheticEvent) => {
    e?.preventDefault();
    if (!oobCode || loading) return;
    setLoading(true);
    try {
      await confirmPasswordReset(auth, oobCode, values.password);
      toast({
        title: 'Password Reset Complete',
        description: 'Your password has been updated successfully.',
      });
      setIsResetComplete(true);
    } catch (error: any) {
      let errorMessage = 'Failed to reset password. Please try again.';
      if (error.code === 'auth/weak-password') {
        errorMessage = 'Password is too weak. Please choose a stronger password.';
      } else if (error.code === 'auth/expired-action-code') {
        errorMessage = 'Reset link has expired. Please request a new code.';
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

  const handleRequestCode = async (e?: React.MouseEvent) => {
    e?.preventDefault();
    if (requestLoading || loading) return;
    const emailInput = codeForm.getValues('email');
    if (!emailInput || !emailInput.includes('@')) {
      toast({
        title: 'Invalid Email',
        description: 'Please enter your registered email address first.',
        variant: 'destructive',
      });
      return;
    }

    setRequestLoading(true);
    try {
      const response = await fetch('/api/verify-email?action=reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailInput }),
      });
      const data = await response.json();

      try {
        await sendPasswordResetEmail(auth, emailInput);
      } catch {
      }

      if (data.success) {
        toast({
          title: 'Reset Code Sent',
          description: `A 6-digit password reset code has been sent to ${emailInput}.`,
        });
      } else {
        toast({
          title: 'Notice',
          description: data.error || 'Check your email for reset instructions.',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to send reset code. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setRequestLoading(false);
    }
  };

  const handleCodeSubmit = async (values: z.infer<typeof codeResetSchema>, e?: React.BaseSyntheticEvent) => {
    e?.preventDefault();
    if (loading) return;
    setLoading(true);
    try {
      const verifyResult = await verifyEmailCodeAPI(values.email, values.code);

      if (!verifyResult.success) {
        toast({
          title: 'Verification Failed',
          description: verifyResult.message || 'Invalid or expired 6-digit reset code.',
          variant: 'destructive',
        });
        setLoading(false);
        return;
      }

      toast({
        title: 'Password Reset Complete',
        description: 'Your password has been updated successfully.',
      });
      setIsResetComplete(true);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to complete password reset.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  if (isResetComplete) {
    return (
      <Card className="bg-transparent border-0 shadow-none text-center">
        <CardHeader className="space-y-4 text-center p-6">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500 ring-1 ring-emerald-500/30">
            <Check className="h-7 w-7" />
          </div>
          <CardTitle className="text-2xl font-bold font-heading text-foreground">
            Password Reset Complete
          </CardTitle>
          <CardDescription className="text-muted-foreground text-sm max-w-sm mx-auto leading-relaxed">
            Your password has been updated successfully. You can now close this browser tab, open the Vibez mobile app, and sign in with your new credentials.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (mode === 'link' && !codeVerified) {
    return (
      <Card className="bg-transparent border-0 shadow-none">
        <CardHeader className="space-y-1 text-center">
          <CardTitle className="text-2xl font-bold">Verifying Reset Link</CardTitle>
          <CardDescription>Validating password reset link...</CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center p-6">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-transparent border-0 shadow-none">
      <CardHeader className="space-y-1 text-center">
        <CardTitle className="text-2xl font-bold">Reset Password</CardTitle>
        <CardDescription>
          {mode === 'link'
            ? `Enter a new password for ${email}`
            : 'Enter your email and 6-digit verification code'}
        </CardDescription>
      </CardHeader>

        {mode === 'link' ? (
          <Form {...linkForm}>
            <form onSubmit={linkForm.handleSubmit(handleLinkSubmit)}>
              <CardContent className="space-y-4">
                <FormField
                  control={linkForm.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>New Password</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="Enter new password" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={linkForm.control}
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Confirm Password</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="Confirm new password" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
              <CardFooter className="flex flex-col space-y-4">
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? 'Resetting Password...' : 'Reset Password'}
                </Button>
                <div className="text-center text-sm text-muted-foreground">
                  <Link href="/login" className="text-primary hover:underline">
                    Back to Login
                  </Link>
                </div>
              </CardFooter>
            </form>
          </Form>
        ) : (
          <Form {...codeForm}>
            <form onSubmit={codeForm.handleSubmit(handleCodeSubmit)}>
              <CardContent className="space-y-4">
                <FormField
                  control={codeForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Account Email</FormLabel>
                      <div className="flex gap-2">
                        <FormControl>
                          <Input type="email" placeholder="name@example.com" {...field} />
                        </FormControl>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={handleRequestCode}
                          disabled={requestLoading}
                        >
                          {requestLoading ? 'Sending...' : 'Get Code'}
                        </Button>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={codeForm.control}
                  name="code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>6-Digit Reset Code</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Enter 6-digit code"
                          maxLength={6}
                          className="text-center font-mono tracking-widest text-lg"
                          {...field}
                          onChange={(e) => field.onChange(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={codeForm.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>New Password</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="Enter new password" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={codeForm.control}
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Confirm New Password</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="Confirm new password" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
              <CardFooter className="flex flex-col space-y-4">
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? 'Submitting...' : 'Reset Password'}
                </Button>
                <div className="text-center text-sm text-muted-foreground">
                  <Link href="/login" className="text-primary hover:underline">
                    Back to Login
                  </Link>
                </div>
              </CardFooter>
            </form>
          </Form>
        )}
      </Card>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}