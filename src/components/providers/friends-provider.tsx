
'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { doc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';
import type { User } from '@/lib/types';


interface FriendsContextType {
    friends: User[];
    friendRequests: User[];
    handleFriendAction: (targetUserId: string, action: 'acceptRequest' | 'declineRequest' | 'removeFriend') => Promise<void>;
}

const FriendsContext = createContext<FriendsContextType | undefined>(undefined);

export function FriendsProvider({ children }: { children: ReactNode }) {
  const { user: authUser } = useAuth();
  const { toast } = useToast();
  const [friends, setFriends] = useState<User[]>([]);
  const [friendRequests, setFriendRequests] = useState<User[]>([]);

  // Note: This provider does not fetch user data directly. It relies on the user object passed to it.
  // The FriendsPage will be responsible for fetching the full user objects.
  
  const handleFriendAction = useCallback(async (targetUserId: string, action: 'acceptRequest' | 'declineRequest' | 'removeFriend') => {
    if (!authUser) {
        toast({ title: 'Error', description: 'You must be logged in.', variant: 'destructive' });
        return;
    };

    const currentUserRef = doc(db, 'users', authUser.uid);
    const targetUserRef = doc(db, 'users', targetUserId);
    
    try {
        if (action === 'acceptRequest') {
            await updateDoc(currentUserRef, { 
                friends: arrayUnion(targetUserId),
                friendRequestsReceived: arrayRemove(targetUserId)
            });
            await updateDoc(targetUserRef, {
                friends: arrayUnion(authUser.uid),
                friendRequestsSent: arrayRemove(authUser.uid)
            });
            toast({ title: 'Friend Added', description: 'You are now friends!' });
        } else if (action === 'declineRequest') {
            await updateDoc(currentUserRef, { friendRequestsReceived: arrayRemove(targetUserId) });
            await updateDoc(targetUserRef, { friendRequestsSent: arrayRemove(authUser.uid) });
            toast({ title: 'Request Declined' });
        } else if (action === 'removeFriend') {
            await updateDoc(currentUserRef, { friends: arrayRemove(targetUserId) });
            await updateDoc(targetUserRef, { friends: arrayRemove(authUser.uid) });
            toast({ title: 'Friend Removed' });
        }
    } catch(e: any) {
        console.error("Error handling friend action:", e);
        toast({ title: 'Error', description: e.message || "Something went wrong.", variant: "destructive" });
    }
  }, [authUser, toast]);


  return (
    <FriendsContext.Provider value={{ friends, friendRequests, handleFriendAction }}>
      {children}
    </FriendsContext.Provider>
  );
}

export function useFriends() {
  const context = useContext(FriendsContext);
  if (context === undefined) {
    throw new Error('useFriends must be used within a FriendsProvider');
  }
  return context;
}
