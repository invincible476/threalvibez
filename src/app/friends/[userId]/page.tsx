'use client';

import React, { useState, useEffect, use } from 'react';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { User } from '@/lib/types';
import { UserAvatar } from '@/components/user-avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/hooks/use-auth';
import { useAppShell } from '@/components/app-shell';
import { MessageSquare, UserPlus, UserCheck, UserX } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';

export default function UserProfilePage({ params }: { params: Promise<{ userId: string }> | { userId: string } }) {
  const resolvedParams = params && 'then' in params ? use(params) : params;
  const userId = resolvedParams?.userId;
  const [profileUser, setProfileUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const { user: authUser } = useAuth();
  const [currentUserProfile, setCurrentUserProfile] = useState<User | null>(null);
  const { handleCreateChat, handleFriendAction } = useAppShell();
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    const fetchUser = async () => {
      if (!userId) return;
      try {
        const userDoc = await getDoc(doc(db, 'users', userId));
        if (userDoc.exists()) {
          setProfileUser({ id: userDoc.id, ...userDoc.data() } as User);
        }
      } catch (error) {
        console.error('Error fetching user:', error);
        toast({
          title: 'Error',
          description: 'Failed to load user profile',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };
    fetchUser();
  }, [userId, toast]);

  useEffect(() => {
    if (!authUser?.uid) return;
    const unsub = onSnapshot(doc(db, 'users', authUser.uid), (docSnapshot) => {
      if (docSnapshot.exists()) {
        setCurrentUserProfile({ id: docSnapshot.id, ...docSnapshot.data() } as User);
      }
    });
    return () => unsub();
  }, [authUser?.uid]);

  if (loading) {
    return (
      <div className="container max-w-2xl mx-auto p-4 animate-pulse">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-4">
              <div className="h-24 w-24 rounded-full bg-muted"></div>
              <div className="space-y-2">
                <div className="h-6 w-48 bg-muted rounded"></div>
                <div className="h-4 w-32 bg-muted rounded"></div>
              </div>
            </div>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (!profileUser) {
    return (
      <div className="container max-w-2xl mx-auto p-4">
        <Card>
          <CardHeader>
            <CardTitle>User not found</CardTitle>
            <CardDescription>This user profile does not exist or has been deleted.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const isFriend = currentUserProfile?.friends?.includes(profileUser.uid);
  const hasSentRequest = currentUserProfile?.friendRequestsSent?.includes(profileUser.uid);
  const hasReceivedRequest = currentUserProfile?.friendRequestsReceived?.includes(profileUser.uid);
  const isBlocked = currentUserProfile?.blockedUsers?.includes(profileUser.uid);
  const isCurrentUser = authUser?.uid === profileUser.uid;

  const [startingChat, setStartingChat] = useState(false);

  const handleStartChat = async () => {
    if (profileUser) {
      try {
        setStartingChat(true);
        await handleCreateChat(profileUser);
        router.push('/');
      } catch (err) {
        console.error("Error starting chat:", err);
      } finally {
        setStartingChat(false);
      }
    }
  };

  return (
    <div className="container max-w-2xl mx-auto p-4">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <UserAvatar 
              user={profileUser} 
              className="h-24 w-24" 
              isFriend={isFriend}
            />
            <div>
              <CardTitle>{profileUser.name}</CardTitle>
              <CardDescription>{profileUser.email}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 flex-wrap">
            {!isCurrentUser && (
              <>
                <Button onClick={handleStartChat} disabled={startingChat}>
                  <MessageSquare className="mr-2 h-4 w-4" />
                  {startingChat ? 'Opening Chat...' : 'Message'}
                </Button>
                
                {!isFriend && !hasSentRequest && !hasReceivedRequest && !isBlocked && (
                  <Button onClick={() => handleFriendAction(profileUser.uid, 'sendRequest')}>
                    <UserPlus className="mr-2 h-4 w-4" />
                    Add Friend
                  </Button>
                )}

                {hasSentRequest && (
                  <Button variant="outline" onClick={() => handleFriendAction(profileUser.uid, 'cancelRequest')}>
                    <UserX className="mr-2 h-4 w-4" />
                    Cancel Request
                  </Button>
                )}

                {hasReceivedRequest && (
                  <Button onClick={() => handleFriendAction(profileUser.uid, 'acceptRequest')}>
                    <UserCheck className="mr-2 h-4 w-4" />
                    Accept Request
                  </Button>
                )}

                {isFriend && (
                  <Button 
                    variant="outline" 
                    onClick={() => handleFriendAction(profileUser.uid, 'removeFriend')}
                  >
                    <UserX className="mr-2 h-4 w-4" />
                    Remove Friend
                  </Button>
                )}
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}