
'use client';

import { ChatLayout } from '@/components/chat-layout';
import { useAuth } from '@/hooks/use-auth';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    if (!user) {
      router.replace('/login');
      return;
    }

    // Refresh token timestamp for active user session
    user.getIdToken().then(() => {
      localStorage.setItem('lastLogin', Date.now().toString());
      localStorage.setItem('sessionUser', user.uid);
    }).catch(error => {
      console.error('Session token refresh failed:', error);
    });
  }, [user, loading, router]);

  // Show loading/redirecting state while checking auth or waiting for redirect
  if (loading || !user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">{loading ? 'Loading...' : 'Redirecting to login...'}</p>
        </div>
      </div>
    );
  }
  
  return <ChatLayout />;
}
