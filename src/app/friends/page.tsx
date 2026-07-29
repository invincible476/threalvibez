'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { doc, getDoc, setDoc, onSnapshot, collection, query, where, getDocs, updateDoc, arrayUnion, arrayRemove, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { User } from '@/lib/types';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { UserAvatar } from '@/components/user-avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Check, X, UserX, UserPlus, Search, UserCheck, MessageSquare, Ban } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { useToast } from '@/hooks/use-toast';
import { useAppShell } from '@/components/app-shell';

const cardVariants = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.3, ease: 'easeOut' } },
};

function FriendsPageSkeleton() {
    return (
        <div className="p-4 sm:p-6 lg:p-8 space-y-8 max-w-4xl mx-auto">
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
    );
}

export default function FriendsPage() {
    const { user: authUser, loading: authLoading } = useAuth();
    const router = useRouter();
    const { toast } = useToast();
    const { currentUser: shellCurrentUser, allUsers: shellUsers, usersCache, handleCreateChat } = useAppShell();
    
    const [currentUser, setCurrentUser] = useState<User | null>(shellCurrentUser || null);
    const [allUsersList, setAllUsersList] = useState<User[]>([]);
    const [extraUsersMap, setExtraUsersMap] = useState<Map<string, User>>(new Map());

    // Continuous search query
    const [searchQuery, setSearchQuery] = useState('');

    const handleFriendAction = async (targetUserId: string, action: 'sendRequest' | 'acceptRequest' | 'declineRequest' | 'removeFriend' | 'cancelRequest') => {
        const activeUser = authUser && (currentUser || shellCurrentUser);
        if (!authUser || !activeUser) {
            toast({ title: 'Error', description: 'You must be logged in.', variant: 'destructive' });
            return;
        }

        if (!targetUserId) {
            toast({ title: 'Error', description: 'Invalid target user.', variant: 'destructive' });
            return;
        }

        const currentUserRef = doc(db, 'users', authUser.uid);
        const targetUserRef = doc(db, 'users', targetUserId);
        
        try {
            if (action === 'sendRequest') {
                await setDoc(currentUserRef, { friendRequestsSent: arrayUnion(targetUserId) }, { merge: true });
                await setDoc(targetUserRef, { friendRequestsReceived: arrayUnion(authUser.uid) }, { merge: true });
                toast({ title: 'Friend Request Sent', description: 'Your friend request has been sent successfully.' });
            } else if (action === 'acceptRequest') {
                await setDoc(currentUserRef, { 
                    friends: arrayUnion(targetUserId),
                    friendRequestsReceived: arrayRemove(targetUserId)
                }, { merge: true });
                await setDoc(targetUserRef, {
                    friends: arrayUnion(authUser.uid),
                    friendRequestsSent: arrayRemove(authUser.uid)
                }, { merge: true });
                toast({ title: 'Friend Added', description: 'You are now friends!' });
            } else if (action === 'declineRequest') {
                await setDoc(currentUserRef, { friendRequestsReceived: arrayRemove(targetUserId) }, { merge: true });
                await setDoc(targetUserRef, { friendRequestsSent: arrayRemove(authUser.uid) }, { merge: true });
                toast({ title: 'Request Declined' });
            } else if (action === 'removeFriend') {
                await setDoc(currentUserRef, { friends: arrayRemove(targetUserId) }, { merge: true });
                await setDoc(targetUserRef, { friends: arrayRemove(authUser.uid) }, { merge: true });
                toast({ title: 'Friend Removed' });
            } else if (action === 'cancelRequest') {
                await setDoc(currentUserRef, { friendRequestsSent: arrayRemove(targetUserId) }, { merge: true });
                await setDoc(targetUserRef, { friendRequestsReceived: arrayRemove(authUser.uid) }, { merge: true });
                toast({ title: 'Request Canceled' });
            }
        } catch(e: any) {
            console.error("Error handling friend action:", e);
            toast({ title: 'Error', description: e.message || "Something went wrong.", variant: "destructive" });
        }
    };

    // Keep currentUser synced with AppShell or direct Firestore listener
    useEffect(() => {
        if (shellCurrentUser) {
            setCurrentUser(shellCurrentUser);
        }
    }, [shellCurrentUser]);

    // Real-time listener for user profile
    useEffect(() => {
        if (!authLoading && !authUser) {
            router.push('/login');
            return;
        }
        if (!authUser) return;

        const unsub = onSnapshot(doc(db, 'users', authUser.uid), (docSnap) => {
            if (docSnap.exists()) {
                const userData = { id: docSnap.id, uid: docSnap.id, ...docSnap.data() } as User;
                setCurrentUser(userData);
            }
        });
        return () => unsub();
    }, [authUser, authLoading, router]);

    // Real-time listener for all users for continuous search
    useEffect(() => {
        const fetchInitial = async () => {
            try {
                const snap = await getDocs(query(collection(db, 'users'), limit(200)));
                const userList = snap.docs.map(docSnap => {
                    const uData = docSnap.data();
                    const targetId = uData.uid || uData.id || docSnap.id;
                    return { ...uData, id: targetId, uid: targetId } as User;
                });
                setAllUsersList(userList);
            } catch (err) {
                console.warn("Initial users fetch warning:", err);
            }
        };
        fetchInitial();

        const unsub = onSnapshot(query(collection(db, 'users'), limit(200)), (snapshot) => {
            const userList = snapshot.docs.map(docSnap => {
                const uData = docSnap.data();
                const targetId = uData.uid || uData.id || docSnap.id;
                return { ...uData, id: targetId, uid: targetId } as User;
            });
            setAllUsersList(userList);
        }, (err) => {
            console.warn("Realtime users fetch warning:", err);
        });
        return () => unsub();
    }, []);

    // Derive full user list pool from all available sources with normalized keys
    const userPool = useMemo(() => {
        const map = new Map<string, User>();

        const addUserToMap = (u: any) => {
            if (!u) return;
            const targetId = u.uid || u.id;
            if (targetId) {
                map.set(targetId, {
                    ...u,
                    id: targetId,
                    uid: targetId,
                    name: u.name || u.displayName || u.fullName || (u.email ? u.email.split('@')[0] : 'User'),
                    username: u.username || u.handle || '',
                    email: u.email || ''
                });
            }
        };

        // Add shellUsers
        (shellUsers || []).forEach(addUserToMap);
        // Add usersCache entries
        if (usersCache) {
            usersCache.forEach((u, id) => addUserToMap({ ...u, id: u.id || u.uid || id }));
        }
        // Add allUsersList
        (allUsersList || []).forEach(addUserToMap);
        // Add extraUsersMap
        extraUsersMap.forEach((u, id) => addUserToMap({ ...u, id: u.id || u.uid || id }));

        return Array.from(map.values());
    }, [shellUsers, usersCache, allUsersList, extraUsersMap]);

    const activeUser = currentUser || shellCurrentUser;

    // Derive friends, pending requests, and sent requests synchronously
    const friends = useMemo(() => {
        if (!activeUser?.friends || activeUser.friends.length === 0) return [];
        const set = new Set(activeUser.friends);
        return userPool.filter(u => set.has(u.uid) || set.has(u.id));
    }, [activeUser?.friends, userPool]);

    const requests = useMemo(() => {
        if (!activeUser?.friendRequestsReceived || activeUser.friendRequestsReceived.length === 0) return [];
        const set = new Set(activeUser.friendRequestsReceived);
        return userPool.filter(u => set.has(u.uid) || set.has(u.id));
    }, [activeUser?.friendRequestsReceived, userPool]);

    const sentRequests = useMemo(() => {
        if (!activeUser?.friendRequestsSent || activeUser.friendRequestsSent.length === 0) return [];
        const set = new Set(activeUser.friendRequestsSent);
        return userPool.filter(u => set.has(u.uid) || set.has(u.id));
    }, [activeUser?.friendRequestsSent, userPool]);

    // Fetch individual missing user documents directly by doc ID if not in memory
    useEffect(() => {
        if (!activeUser) return;

        const neededIds = [
            ...(activeUser.friends || []),
            ...(activeUser.friendRequestsReceived || []),
            ...(activeUser.friendRequestsSent || [])
        ];

        const missing = neededIds.filter(id => id && !userPool.some(u => u.uid === id || u.id === id));
        if (missing.length === 0) return;

        missing.forEach(async (id) => {
            try {
                const docSnap = await getDoc(doc(db, 'users', id));
                if (docSnap.exists()) {
                    const uData = docSnap.data();
                    const targetId = uData.uid || uData.id || docSnap.id;
                    const u = { ...uData, id: targetId, uid: targetId } as User;
                    setExtraUsersMap(prev => new Map(prev).set(targetId, u));
                }
            } catch (err) {
                console.error(`Failed to fetch user doc for ${id}:`, err);
            }
        });
    }, [activeUser, userPool]);

    // Debounced direct Firestore search fallback for users not yet in memory
    useEffect(() => {
        const rawTerm = searchQuery.trim();
        const cleanTerm = rawTerm.replace(/^@/, '');
        if (!cleanTerm || cleanTerm.length < 2) return;

        const timer = setTimeout(async () => {
            try {
                const lower = cleanTerm.toLowerCase();
                const capitalized = cleanTerm.charAt(0).toUpperCase() + cleanTerm.slice(1).toLowerCase();
                const usersRef = collection(db, 'users');

                const [byEmailExact, byEmailLower, byUsernameLower, byNameCap, byNameLower, byNameRaw] = await Promise.all([
                    getDocs(query(usersRef, where('email', '==', cleanTerm))),
                    getDocs(query(usersRef, where('email', '==', lower))),
                    getDocs(query(usersRef, where('username', '==', lower))),
                    getDocs(query(usersRef, where('name', '>=', capitalized), where('name', '<=', capitalized + '\uf8ff'))),
                    getDocs(query(usersRef, where('name', '>=', lower), where('name', '<=', lower + '\uf8ff'))),
                    getDocs(query(usersRef, where('name', '>=', cleanTerm), where('name', '<=', cleanTerm + '\uf8ff')))
                ]);

                const fetchedDocs = [
                    ...byEmailExact.docs,
                    ...byEmailLower.docs,
                    ...byUsernameLower.docs,
                    ...byNameCap.docs,
                    ...byNameLower.docs,
                    ...byNameRaw.docs
                ];

                if (fetchedDocs.length > 0) {
                    setExtraUsersMap(prev => {
                        const next = new Map(prev);
                        fetchedDocs.forEach(d => {
                            const uData = d.data();
                            const targetId = uData.uid || uData.id || d.id;
                            const u = { ...uData, id: targetId, uid: targetId } as User;
                            next.set(targetId, u);
                        });
                        return next;
                    });
                }
            } catch (err) {
                console.warn('Firestore live search query error:', err);
            }
        }, 200);

        return () => clearTimeout(timer);
    }, [searchQuery]);

    // Continuous real-time instant search calculation
    const searchResults = useMemo(() => {
        const rawTerm = searchQuery.trim().toLowerCase();
        const term = rawTerm.replace(/^@/, '');
        if (!term) return [];

        return userPool.filter(u => {
            if (u.uid === authUser?.uid || u.id === authUser?.uid) return false;

            const nameStr = (u.name || (u as any).displayName || (u as any).fullName || '').toLowerCase();
            const emailStr = (u.email || '').toLowerCase();
            const usernameStr = (u.username || (u as any).handle || '').toLowerCase();
            const emailPrefix = emailStr.split('@')[0] || '';

            return nameStr.includes(term) || emailStr.includes(term) || usernameStr.includes(term) || emailPrefix.includes(term);
        });
    }, [searchQuery, userPool, authUser?.uid]);

    if (authLoading || (!authUser && !activeUser)) {
        return <FriendsPageSkeleton />;
    }

    return (
        <motion.div 
          className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-4xl mx-auto"
          initial="initial"
          animate="animate"
          variants={{ animate: { transition: { staggerChildren: 0.1 } }}}
        >
            <motion.div variants={cardVariants}>
                <Card className="border border-border/60 shadow-lg backdrop-blur-xl bg-card/75">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-2xl font-bold font-heading">
                            <Search className="h-6 w-6 text-primary" />
                            Find & Add Friends
                        </CardTitle>
                        <CardDescription>
                            Type any letter or name to search registered users in real time.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                            <Input
                                type="search"
                                placeholder="Type to search by name, username, or email..."
                                autoComplete="off"
                                autoCorrect="off"
                                autoCapitalize="none"
                                spellCheck={false}
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-10 h-11 text-base bg-background/50"
                            />
                        </div>

                        {/* Instant Live Search Results */}
                        {searchQuery.trim().length > 0 && (
                            <div className="mt-4 space-y-2 border-t pt-4">
                                {searchResults.length > 0 ? (
                                    searchResults.map(user => {
                                        const isFriend = currentUser?.friends?.includes(user.uid);
                                        const hasSent = currentUser?.friendRequestsSent?.includes(user.uid);
                                        const hasReceived = currentUser?.friendRequestsReceived?.includes(user.uid);

                                        return (
                                            <div 
                                                key={user.uid} 
                                                className="flex items-center justify-between p-3 rounded-xl border bg-background/50 hover:bg-muted/40 transition-colors"
                                            >
                                                <div 
                                                    className="flex items-center gap-3 cursor-pointer flex-1 min-w-0"
                                                    onClick={() => router.push(`/friends/${user.uid}`)}
                                                >
                                                    <UserAvatar user={user} isFriend={isFriend} className="h-11 w-11" />
                                                    <div className="truncate">
                                                        <p className="font-semibold truncate">{user.name}</p>
                                                        <p className="text-sm text-muted-foreground truncate">
                                                            {user.username ? `@${user.username}` : user.email}
                                                        </p>
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-2">
                                                    {isFriend && (
                                                        <Button size="sm" variant="secondary" onClick={() => handleCreateChat(user)}>
                                                            <MessageSquare className="mr-1.5 h-4 w-4" />
                                                            Message
                                                        </Button>
                                                    )}

                                                    {!isFriend && !hasSent && !hasReceived && (
                                                        <Button size="sm" onClick={() => handleFriendAction(user.uid, 'sendRequest')}>
                                                            <UserPlus className="mr-1.5 h-4 w-4" />
                                                            Add Friend
                                                        </Button>
                                                    )}

                                                    {hasSent && (
                                                        <Button size="sm" variant="outline" onClick={() => handleFriendAction(user.uid, 'cancelRequest')}>
                                                            <Ban className="mr-1.5 h-4 w-4" />
                                                            Request Sent
                                                        </Button>
                                                    )}

                                                    {hasReceived && (
                                                        <Button size="sm" variant="default" onClick={() => handleFriendAction(user.uid, 'acceptRequest')}>
                                                            <Check className="mr-1.5 h-4 w-4" />
                                                            Accept Request
                                                        </Button>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })
                                ) : (
                                    <p className="text-center text-muted-foreground py-6">
                                        No users found matching "{searchQuery}".
                                    </p>
                                )}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </motion.div>

            <motion.div variants={cardVariants}>
            <Tabs defaultValue="friends">
                <TabsList className="grid w-full grid-cols-3 max-w-md mx-auto">
                    <TabsTrigger value="friends">
                        My Friends ({friends.length})
                    </TabsTrigger>
                    <TabsTrigger value="requests">
                        Requests {requests.length > 0 && `(${requests.length})`}
                    </TabsTrigger>
                    <TabsTrigger value="sent">
                        Sent ({sentRequests.length})
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="friends">
                    <Card className="mt-4">
                        <CardContent className="p-4">
                            {friends.length > 0 ? (
                                <div className="space-y-2">
                                    {friends.map(friend => (
                                        <div key={friend.uid} className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50">
                                            <div 
                                                className="flex items-center gap-3 cursor-pointer"
                                                onClick={() => router.push(`/friends/${friend.uid}`)}
                                            >
                                                <UserAvatar user={friend} isFriend={true} className="h-12 w-12"/>
                                                <div>
                                                    <p className="font-semibold">{friend.name}</p>
                                                    <p className="text-sm text-muted-foreground">{friend.email}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Button size="sm" variant="outline" onClick={() => handleCreateChat(friend)}>
                                                    <MessageSquare className="mr-1.5 h-4 w-4" />
                                                    Message
                                                </Button>
                                                <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleFriendAction(friend.uid, 'removeFriend')}>
                                                    <UserX className="h-5 w-5"/>
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-center text-muted-foreground py-8">You haven't added any friends yet. Use the search bar above to find friends!</p>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="requests">
                     <Card className="mt-4">
                        <CardContent className="p-4">
                             {requests.length > 0 ? (
                                <div className="space-y-2">
                                    {requests.map(requestUser => (
                                        <div key={requestUser.uid} className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50">
                                            <div 
                                                className="flex items-center gap-3 cursor-pointer"
                                                onClick={() => router.push(`/friends/${requestUser.uid}`)}
                                            >
                                                <UserAvatar user={requestUser} className="h-12 w-12"/>
                                                <div>
                                                    <p className="font-semibold">{requestUser.name}</p>
                                                    <p className="text-sm text-muted-foreground">{requestUser.email}</p>
                                                </div>
                                            </div>
                                            <div className="flex gap-2">
                                                <Button variant="default" size="sm" onClick={() => handleFriendAction(requestUser.uid, 'acceptRequest')}>
                                                    <Check className="mr-1 h-4 w-4"/>
                                                    Accept
                                                </Button>
                                                <Button variant="outline" size="sm" onClick={() => handleFriendAction(requestUser.uid, 'declineRequest')}>
                                                    <X className="mr-1 h-4 w-4"/>
                                                    Decline
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : <p className="text-center text-muted-foreground py-8">No pending friend requests.</p>}
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="sent">
                    <Card className="mt-4">
                        <CardContent className="p-4">
                            {sentRequests.length > 0 ? (
                                <div className="space-y-2">
                                    {sentRequests.map(sentRequestUser => (
                                        <div key={sentRequestUser.uid} className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50">
                                            <div 
                                                className="flex items-center gap-3 cursor-pointer"
                                                onClick={() => router.push(`/friends/${sentRequestUser.uid}`)}
                                            >
                                                <UserAvatar user={sentRequestUser} className="h-12 w-12"/>
                                                <div>
                                                    <p className="font-semibold">{sentRequestUser.name}</p>
                                                    <p className="text-sm text-muted-foreground">{sentRequestUser.email}</p>
                                                </div>
                                            </div>
                                            <Button variant="outline" size="sm" onClick={() => handleFriendAction(sentRequestUser.uid, 'cancelRequest')}>
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
