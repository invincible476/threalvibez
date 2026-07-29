'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { doc, setDoc, onSnapshot, collection, query, limit, arrayUnion, arrayRemove } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { User } from '@/lib/types';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { UserAvatar } from '@/components/user-avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Check, X, UserX, UserPlus, Search, MessageSquare, Ban, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { useToast } from '@/hooks/use-toast';
import { useAppShell } from '@/components/app-shell';
import { normalizeUser, matchesUserSearch, searchUsers, fetchMissingUsers, sortSearchResults } from '@/lib/user-service';

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
    
    const [currentUser, setCurrentUser] = useState<User | null>(shellCurrentUser ? normalizeUser(shellCurrentUser) : null);
    const [allUsersList, setAllUsersList] = useState<User[]>([]);
    const [extraUsersMap, setExtraUsersMap] = useState<Map<string, User>>(new Map());

    // Search query & remote fetch states
    const [searchQuery, setSearchQuery] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const [remoteResults, setRemoteResults] = useState<User[]>([]);
    const [startingChatUserId, setStartingChatUserId] = useState<string | null>(null);

    const handleMessageUser = async (targetUser: User) => {
        try {
            setStartingChatUserId(targetUser.uid);
            await handleCreateChat(targetUser);
            router.push('/');
        } catch (err) {
            console.error("Error starting chat:", err);
        } finally {
            setStartingChatUserId(null);
        }
    };

    // Sync currentUser with AppShell
    useEffect(() => {
        if (shellCurrentUser) {
            setCurrentUser(normalizeUser(shellCurrentUser));
        }
    }, [shellCurrentUser]);

    // Real-time listener for current user profile
    useEffect(() => {
        if (!authLoading && !authUser) {
            router.push('/login');
            return;
        }
        if (!authUser) return;

        const unsub = onSnapshot(doc(db, 'users', authUser.uid), (docSnap) => {
            if (docSnap.exists()) {
                setCurrentUser(normalizeUser(docSnap.data(), docSnap.id));
            }
        });
        return () => unsub();
    }, [authUser, authLoading, router]);

    // Background real-time listener for user snapshot
    useEffect(() => {
        const unsub = onSnapshot(query(collection(db, 'users'), limit(500)), (snapshot) => {
            const userList = snapshot.docs.map(docSnap => normalizeUser(docSnap.data(), docSnap.id));
            setAllUsersList(userList);
        }, (err) => {
            console.warn("Realtime users fetch notice:", err);
        });
        return () => unsub();
    }, []);

    // Derive full user pool
    const userPool = useMemo(() => {
        const map = new Map<string, User>();

        const add = (u: any) => {
            if (!u) return;
            const norm = normalizeUser(u);
            if (norm.uid) map.set(norm.uid, norm);
        };

        (shellUsers || []).forEach(add);
        if (usersCache) usersCache.forEach(add);
        (allUsersList || []).forEach(add);
        extraUsersMap.forEach(add);

        return Array.from(map.values());
    }, [shellUsers, usersCache, allUsersList, extraUsersMap]);

    // Ref to access current userPool in async search without triggering re-render loops
    const userPoolRef = useRef<User[]>(userPool);
    useEffect(() => {
        userPoolRef.current = userPool;
    }, [userPool]);

    const activeUser = currentUser || (shellCurrentUser ? normalizeUser(shellCurrentUser) : null);

    // Derive friends, pending requests, and sent requests
    const friends = useMemo(() => {
        if (!activeUser?.friends || activeUser.friends.length === 0) return [];
        const poolMap = new Map<string, User>();
        userPool.forEach(u => {
            if (u.uid) poolMap.set(u.uid, u);
            if (u.id) poolMap.set(u.id, u);
        });
        return activeUser.friends.map(id => {
            return poolMap.get(id) || normalizeUser({ id, uid: id, name: 'Loading...', email: '' });
        });
    }, [activeUser?.friends, userPool]);

    const requests = useMemo(() => {
        if (!activeUser?.friendRequestsReceived || activeUser.friendRequestsReceived.length === 0) return [];
        const poolMap = new Map<string, User>();
        userPool.forEach(u => {
            if (u.uid) poolMap.set(u.uid, u);
            if (u.id) poolMap.set(u.id, u);
        });
        return activeUser.friendRequestsReceived.map(id => {
            return poolMap.get(id) || normalizeUser({ id, uid: id, name: 'Friend Request', email: 'Loading user details...' });
        });
    }, [activeUser?.friendRequestsReceived, userPool]);

    const sentRequests = useMemo(() => {
        if (!activeUser?.friendRequestsSent || activeUser.friendRequestsSent.length === 0) return [];
        const poolMap = new Map<string, User>();
        userPool.forEach(u => {
            if (u.uid) poolMap.set(u.uid, u);
            if (u.id) poolMap.set(u.id, u);
        });
        return activeUser.friendRequestsSent.map(id => {
            return poolMap.get(id) || normalizeUser({ id, uid: id, name: 'Sent Request', email: 'Loading user details...' });
        });
    }, [activeUser?.friendRequestsSent, userPool]);

    // Fetch missing user documents for friends/requests
    useEffect(() => {
        if (!activeUser) return;

        const neededIds = [
            ...(activeUser.friends || []),
            ...(activeUser.friendRequestsReceived || []),
            ...(activeUser.friendRequestsSent || [])
        ].filter(Boolean);

        if (neededIds.length === 0) return;

        fetchMissingUsers(neededIds, userPoolRef.current).then(missingUsers => {
            if (missingUsers.length > 0) {
                setExtraUsersMap(prev => {
                    const next = new Map(prev);
                    missingUsers.forEach(u => next.set(u.uid, u));
                    return next;
                });
            }
        });
    }, [activeUser?.friends, activeUser?.friendRequestsReceived, activeUser?.friendRequestsSent]);

    // Debounced remote search effect (depends ONLY on searchQuery and authUser.uid)
    useEffect(() => {
        const clean = searchQuery.trim().replace(/^@/, '');
        if (!clean) {
            setRemoteResults([]);
            setIsSearching(false);
            return;
        }

        setIsSearching(true);
        const timer = setTimeout(async () => {
            try {
                const results = await searchUsers(clean, userPoolRef.current, authUser?.uid);
                setRemoteResults(results);
            } catch (err) {
                console.warn("Remote search notice:", err);
            } finally {
                setIsSearching(false);
            }
        }, 150);

        return () => clearTimeout(timer);
    }, [searchQuery, authUser?.uid]);

    // Combine local pool matches AND remote query results safely
    const searchResults = useMemo(() => {
        const clean = searchQuery.trim().replace(/^@/, '');
        if (!clean) return [];

        const map = new Map<string, User>();

        // 1. Instant local matches from pool
        userPool.forEach(u => {
            if (matchesUserSearch(u, clean, authUser?.uid)) {
                map.set(u.uid, u);
            }
        });

        // 2. Direct remote query matches (essential for Vercel when local pool is limited)
        remoteResults.forEach(u => {
            if (matchesUserSearch(u, clean, authUser?.uid)) {
                map.set(u.uid, u);
            }
        });

        return sortSearchResults(Array.from(map.values()), clean);
    }, [searchQuery, userPool, remoteResults, authUser?.uid]);

    // Optimistic friend action handler
    const handleFriendAction = async (targetUserId: string, action: 'sendRequest' | 'acceptRequest' | 'declineRequest' | 'removeFriend' | 'cancelRequest') => {
        if (!authUser || !activeUser) {
            toast({ title: 'Error', description: 'You must be logged in.', variant: 'destructive' });
            return;
        }

        if (!targetUserId) {
            toast({ title: 'Error', description: 'Invalid target user.', variant: 'destructive' });
            return;
        }

        // Optimistic UI update
        setCurrentUser(prev => {
            if (!prev) return prev;
            const updated = { ...prev };
            const friendsSet = new Set(updated.friends || []);
            const sentSet = new Set(updated.friendRequestsSent || []);
            const receivedSet = new Set(updated.friendRequestsReceived || []);

            if (action === 'sendRequest') {
                sentSet.add(targetUserId);
            } else if (action === 'acceptRequest') {
                friendsSet.add(targetUserId);
                receivedSet.delete(targetUserId);
                sentSet.delete(targetUserId);
            } else if (action === 'declineRequest') {
                receivedSet.delete(targetUserId);
            } else if (action === 'removeFriend') {
                friendsSet.delete(targetUserId);
            } else if (action === 'cancelRequest') {
                sentSet.delete(targetUserId);
            }

            return {
                ...updated,
                friends: Array.from(friendsSet),
                friendRequestsSent: Array.from(sentSet),
                friendRequestsReceived: Array.from(receivedSet),
            };
        });

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
                            Type any letter, name, username, or email to search registered users in real time.
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
                                className="pl-10 pr-10 h-11 text-base bg-background/50"
                            />
                            {isSearching && (
                                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 animate-spin text-primary" />
                            )}
                        </div>

                        {/* Instant Live Search Results */}
                        {searchQuery.trim().length > 0 && (
                            <div className="mt-4 space-y-2 border-t pt-4">
                                {searchResults.length > 0 ? (
                                    searchResults.map(user => {
                                        const isFriend = activeUser?.friends?.includes(user.uid);
                                        const hasSent = activeUser?.friendRequestsSent?.includes(user.uid);
                                        const hasReceived = activeUser?.friendRequestsReceived?.includes(user.uid);

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
                                                        <Button size="sm" variant="secondary" disabled={startingChatUserId === user.uid} onClick={() => handleMessageUser(user)}>
                                                            {startingChatUserId === user.uid ? (
                                                                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                                                            ) : (
                                                                <MessageSquare className="mr-1.5 h-4 w-4" />
                                                            )}
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
                                        {isSearching ? 'Searching registered users...' : `No users found matching "${searchQuery}".`}
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
                                                <Button size="sm" variant="outline" disabled={startingChatUserId === friend.uid} onClick={() => handleMessageUser(friend)}>
                                                    {startingChatUserId === friend.uid ? (
                                                        <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                                                    ) : (
                                                        <MessageSquare className="mr-1.5 h-4 w-4" />
                                                    )}
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
