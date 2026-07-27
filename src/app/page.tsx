
'use client';

import { ChatLayout } from '@/components/chat-layout';
import { useAuth } from '@/hooks/use-auth';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading || !user) return;

    // Refresh token timestamp for active user session
    user.getIdToken().then(() => {
      localStorage.setItem('lastLogin', Date.now().toString());
      localStorage.setItem('sessionUser', user.uid);
    }).catch(error => {
      console.error('Session token refresh failed:', error);
    });
  }, [user, loading]);

  // Show loading state while checking auth
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Don't render anything if no user (redirect will happen)
  if (!user) {
    return null;
  }
  
  return <ChatLayout />;
}
