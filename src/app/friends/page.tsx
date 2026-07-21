
'use client';
import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { doc, onSnapshot, collection, query, where, getDocs, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { User } from '@/lib/types';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { UserAvatar } from '@/components/user-avatar';
import { Button } from '@/components/ui/button';
import { Check, X, UserX, Send, Ban } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { useToast } from '@/hooks/use-toast';

const cardVariants = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.3, ease: 'easeOut' } },
};

function FriendsPageSkeleton() {
    return (
        <div className="p-4 sm:p-6 lg:p-8 space-y-8">
             <Card>
                <CardContent className="p-4">
                    <div className="h-10 bg-muted rounded-md animate-pulse w-full max-w-md mx-auto" />
                    <div className="mt-6 space-y-4">
                        {[...Array(3)].map((_, i) => (
                            <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-muted/50 animate-pulse">
                                <div className="flex items-center gap-3">
                                    <div className="h-12 w-12 rounded-full bg-muted" />
                                    <div>
                                        <div className="h-5 w-24 bg-muted rounded-md"/>
                                        <div className="h-4 w-32 bg-muted rounded-md mt-1"/>
                                    </div>
                                </div>
                                <div className="h-8 w-20 bg-muted rounded-md"/>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}

export default function FriendsPage() {
    const { user: authUser, loading: authLoading } = useAuth();
    const router = useRouter();
    const { toast } = useToast();
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [friends, setFriends] = useState<User[]>([]);
    const [requests, setRequests] = useState<User[]>([]);
    const [sentRequests, setSentRequests] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);

    const handleFriendAction = async (targetUserId: string, action: 'acceptRequest' | 'declineRequest' | 'removeFriend' | 'cancelRequest') => {
        if (!authUser || !currentUser) {
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
                    friendRequestsSent: arrayRemove(currentUser.uid)
                });
                toast({ title: 'Friend Added', description: 'You are now friends!' });
            } else if (action === 'declineRequest') {
                await updateDoc(currentUserRef, { friendRequestsReceived: arrayRemove(targetUserId) });
                await updateDoc(targetUserRef, { friendRequestsSent: arrayRemove(currentUser.uid) });
                toast({ title: 'Request Declined' });
            } else if (action === 'removeFriend') {
                await updateDoc(currentUserRef, { friends: arrayRemove(targetUserId) });
                await updateDoc(targetUserRef, { friends: arrayRemove(currentUser.uid) });
                toast({ title: 'Friend Removed' });
            } else if (action === 'cancelRequest') {
                await updateDoc(currentUserRef, { friendRequestsSent: arrayRemove(targetUserId) });
                await updateDoc(targetUserRef, { friendRequestsReceived: arrayRemove(currentUser.uid) });
                toast({ title: 'Request Canceled' });
            }
        } catch(e: any) {
            console.error("Error handling friend action:", e);
            toast({ title: 'Error', description: e.message || "Something went wrong.", variant: "destructive" });
        }
    };

    useEffect(() => {
        if (!authLoading && !authUser) {
            router.push('/login');
            return;
        }
        if (!authUser) return;

        const unsub = onSnapshot(doc(db, 'users', authUser.uid), (doc) => {
            if (doc.exists()) {
                const userData = { id: doc.id, ...doc.data() } as User;
                setCurrentUser(userData);
            }
        });
        return () => unsub();
    }, [authUser, authLoading, router]);

    useEffect(() => {
        if (!currentUser) return;
        
        setLoading(true);

        const fetchUsers = async (userIds: string[], setState: React.Dispatch<React.SetStateAction<User[]>>) => {
            if (userIds.length === 0) {
                setState([]);
                return Promise.resolve();
            };
            const usersRef = collection(db, 'users');
            const q = query(usersRef, where('uid', 'in', userIds));
            const querySnapshot = await getDocs(q);
            const userList = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User));
            setState(userList);
        };

        const friendIds = currentUser.friends || [];
        const requestIds = currentUser.friendRequestsReceived || [];
        const sentRequestIds = currentUser.friendRequestsSent || [];

        Promise.all([
            fetchUsers(friendIds, setFriends),
            fetchUsers(requestIds, setRequests),
            fetchUsers(sentRequestIds, setSentRequests)
        ]).finally(() => {
            setLoading(false);
        });

    }, [currentUser]);

    if (authLoading || loading) {
        return <FriendsPageSkeleton />;
    }

    return (
        <motion.div 
          className="p-4 sm:p-6 lg:p-8 space-y-8"
          initial="initial"
          animate="animate"
          variants={{ animate: { transition: { staggerChildren: 0.1 } }}}
        >
            <motion.div variants={cardVariants}>
            <Tabs defaultValue="friends">
                <TabsList className="grid w-full grid-cols-3 max-w-md mx-auto">
                    <TabsTrigger value="friends">My Friends</TabsTrigger>
                    <TabsTrigger value="requests">
                        Requests {requests.length > 0 && `(${requests.length})`}
                    </TabsTrigger>
                    <TabsTrigger value="sent">Sent</TabsTrigger>
                </TabsList>
                <TabsContent value="friends">
                    <Card>
                        <CardContent className="p-4">
                            {friends.length > 0 ? (
                                <div className="space-y-2">
                                    {friends.map(friend => (
                                        <div key={friend.uid} className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50">
                                            <div className="flex items-center gap-3">
                                                <UserAvatar user={friend} isFriend={true} className="h-12 w-12"/>
                                                <div>
                                                    <p className="font-semibold">{friend.name}</p>
                                                    <p className="text-sm text-muted-foreground">{friend.email}</p>
                                                </div>
                                            </div>
                                            <Button variant="outline" size="icon" onClick={() => handleFriendAction(friend.uid, 'removeFriend')}>
                                                <UserX className="h-5 w-5"/>
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            ) : <p className="text-center text-muted-foreground py-8">You haven't added any friends yet.</p>}
                        </CardContent>
                    </Card>
                </TabsContent>
                <TabsContent value="requests">
                     <Card>
                        <CardContent className="p-4">
                             {requests.length > 0 ? (
                                <div className="space-y-2">
                                    {requests.map(requestUser => (
                                        <div key={requestUser.uid} className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50">
                                            <div className="flex items-center gap-3">
                                                <UserAvatar user={requestUser} className="h-12 w-12"/>
                                                <div>
                                                    <p className="font-semibold">{requestUser.name}</p>
                                                    <p className="text-sm text-muted-foreground">{requestUser.email}</p>
                                                </div>
                                            </div>
                                            <div className="flex gap-2">
                                                <Button variant="default" size="icon" onClick={() => handleFriendAction(requestUser.uid, 'acceptRequest')}>
                                                    <Check className="h-5 w-5"/>
                                                </Button>
                                                <Button variant="destructive" size="icon" onClick={() => handleFriendAction(requestUser.uid, 'declineRequest')}>
                                                    <X className="h-5 w-5"/>
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : <p className="text-center text-muted-foreground py-8">No new friend requests.</p>}
                        </CardContent>
                    </Card>
                </TabsContent>
                <TabsContent value="sent">
                    <Card>
                        <CardContent className="p-4">
                            {sentRequests.length > 0 ? (
                                <div className="space-y-2">
                                    {sentRequests.map(sentRequestUser => (
                                        <div key={sentRequestUser.uid} className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50">
                                            <div className="flex items-center gap-3">
                                                <UserAvatar user={sentRequestUser} className="h-12 w-12"/>
                                                <div>
                                                    <p className="font-semibold">{sentRequestUser.name}</p>
                                                    <p className="text-sm text-muted-foreground">{sentRequestUser.email}</p>
                                                </div>
                                            </div>
                                            <Button variant="outline" onClick={() => handleFriendAction(sentRequestUser.uid, 'cancelRequest')}>
                                                <Ban className="mr-2 h-4 w-4" />
                                                Cancel Request
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            ) : <p className="text-center text-muted-foreground py-8">You haven't sent any friend requests.</p>}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
            </motion.div>
        </motion.div>
    );
}
