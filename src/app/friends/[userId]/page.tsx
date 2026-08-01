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
import { MessageSquare, UserPlus, UserCheck, UserX, Shield, Ban } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';

export default function UserProfilePage({ params }: { params: Promise<{ userId: string }> | { userId: string } }) {
  const resolvedParams = params && 'then' in params ? use(params) : params;
  const userId = resolvedParams?.userId;
  const [profileUser, setProfileUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const { user: authUser } = useAuth();
  const [currentUserProfile, setCurrentUserProfile] = useState<User | null>(null);
  const { handleCreateChat, handleFriendAction, handleBlockUser } = useAppShell();
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
              <div className="flex items-center gap-2">
                <CardTitle>{profileUser.name}</CardTitle>
                {profileUser.isPrivate && (
                  <span title="Private Account">
                    <Shield className="h-4 w-4 text-muted-foreground" />
                  </span>
                )}
              </div>
              <CardDescription>{profileUser.username ? `@${profileUser.username}` : profileUser.email}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {profileUser.isPrivate && !isFriend && !isCurrentUser ? (
            <div className="p-4 rounded-xl bg-muted/40 border border-border flex flex-col items-center text-center gap-2 py-6">
              <div className="p-3 bg-background rounded-full border border-border">
                <Shield className="h-6 w-6 text-muted-foreground" />
              </div>
              <div>
                <h4 className="font-semibold text-sm">This Account is Private</h4>
                <p className="text-xs text-muted-foreground mt-0.5 max-w-sm">
                  Add this user as a friend to view their full profile bio and social links.
                </p>
              </div>
            </div>
          ) : (
            <>
              {profileUser.about && (
                <div className="space-y-1">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">About</h4>
                  <p className="text-sm text-foreground/80 leading-relaxed">{profileUser.about}</p>
                </div>
              )}

              {(profileUser.instagramUrl || profileUser.instagramHandle || (profileUser as any).instagram) && (
                <div className="pt-1">
                  <a
                    href={
                      profileUser.instagramUrl && profileUser.instagramUrl.startsWith('http')
                        ? profileUser.instagramUrl
                        : `https://instagram.com/${(profileUser.instagramHandle || profileUser.instagramUrl || (profileUser as any).instagram || '').replace(/^@/, '').trim()}`
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-3 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-800/80 hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-800 dark:text-zinc-200 text-sm font-medium transition-colors w-fit"
                  >
                    <svg className="h-4 w-4 shrink-0 text-pink-500" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 0C8.74 0 8.333.015 7.053.072 5.775.132 4.905.333 4.14.63c-.789.306-1.459.717-2.126 1.384S.935 3.35.63 4.14C.333 4.905.131 5.775.072 7.053.012 8.333 0 8.74 0 12s.015 3.667.072 4.947c.06 1.277.261 2.148.558 2.913.306.788.717 1.459 1.384 2.126.667.666 1.336 1.079 2.126 1.384.766.296 1.636.499 2.913.558C8.333 23.988 8.74 24 12 24s3.667-.015 4.947-.072c1.277-.06 2.148-.262 2.913-.558.788-.306 1.459-.718 2.126-1.384.666-.667 1.079-1.335 1.384-2.126.296-.765.499-1.636.558-2.913.06-1.28.072-1.687.072-4.947s-.015-3.667-.072-4.947c-.06-1.277-.262-2.149-.558-2.913-.306-.789-.718-1.459-1.384-2.126C21.319 1.347 20.651.935 19.86.63c-.765-.297-1.636-.499-2.913-.558C15.667.012 15.26 0 12 0zm0 2.16c3.203 0 3.585.016 4.85.071 1.17.055 1.805.249 2.227.415.562.217.96.477 1.382.896.419.42.679.819.896 1.381.164.422.36 1.057.413 2.227.057 1.266.07 1.646.07 4.85s-.015 3.585-.074 4.85c-.061 1.17-.256 1.805-.421 2.227-.224.562-.479.96-.897 1.382-.419.419-.824.679-1.38.896-.42.164-1.065.36-2.235.413-1.274.057-1.649.07-4.859.07-3.211 0-3.586-.015-4.859-.074-1.171-.061-1.816-.256-2.236-.421-.569-.224-.96-.479-1.379-.897-.421-.419-.69-.824-.9-1.38-.165-.42-.359-1.065-.42-2.235-.045-1.26-.061-1.649-.061-4.844 0-3.196.016-3.586.061-4.861.061-1.17.255-1.814.42-2.234.21-.57.479-.96.9-1.381.419-.419.81-.689 1.379-.898.42-.166 1.051-.361 2.221-.421 1.275-.045 1.65-.06 4.859-.06l.045.03zm0 3.678c-3.405 0-6.162 2.76-6.162 6.162 0 3.405 2.76 6.162 6.162 6.162 3.405 0 6.162-2.76 6.162-6.162 0-3.405-2.76-6.162-6.162-6.162zM12 16c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4zm7.846-10.405c0 .795-.646 1.44-1.44 1.44-.795 0-1.44-.646-1.44-1.44 0-.794.646-1.439 1.44-1.439.793-.001 1.44.645 1.44 1.439z"/>
                    </svg>
                    <span>
                      {profileUser.instagramHandle ||
                        (profileUser.instagramUrl?.startsWith('http')
                          ? `@${profileUser.instagramUrl.match(/instagram\.com\/([^/?#]+)/i)?.[1] || 'profile'}`
                          : profileUser.instagramUrl
                          ? `@${profileUser.instagramUrl.replace(/^@/, '').trim()}`
                          : 'View Instagram Profile')}
                    </span>
                  </a>
                </div>
              )}
            </>
          )}

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

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant={isBlocked ? "outline" : "destructive"}>
                      <Ban className="mr-2 h-4 w-4" />
                      {isBlocked ? 'Unblock User' : 'Block User'}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="bg-card border-border text-foreground">
                    <AlertDialogHeader>
                      <AlertDialogTitle>{isBlocked ? 'Unblock User?' : 'Block User?'}</AlertDialogTitle>
                      <AlertDialogDescription className="text-muted-foreground text-xs">
                        {isBlocked 
                          ? `If you unblock ${profileUser.name}, they will be able to message you and see your profile.`
                          : `You will no longer see messages or chats from ${profileUser.name}. They will not be notified.`
                        }
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel className="bg-muted text-foreground border-none">Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => handleBlockUser(profileUser.uid, !!isBlocked)}
                        className={isBlocked ? "bg-violet-600 hover:bg-violet-700 text-white" : "bg-destructive hover:bg-destructive/90 text-white"}
                      >
                        {isBlocked ? 'Unblock' : 'Block Account'}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}