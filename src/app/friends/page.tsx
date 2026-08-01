'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { doc, setDoc, onSnapshot, collection, query, limit, arrayUnion, arrayRemove } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { User } from '@/lib/types';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { UserAvatar } from '@/components/user-avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Check, X, UserX, UserPlus, Search, MessageSquare, Ban, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { useToast } from '@/hooks/use-toast';
import { useAppShell } from '@/components/app-shell';
import { normalizeUser, matchesUserSearch, searchUsers, fetchMissingUsers, sortSearchResults } from '@/lib/user-service';
import { cn } from '@/lib/utils';

const cardVariants = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.3, ease: 'easeOut' } },
};

function FriendsPageSkeleton() {
    return (
        <div className="space-y-3 pt-4">
            {[...Array(5)].map((_, i) => (
                <div key={`friends-skel-${i}`} className="flex items-center gap-3 px-4 py-3">
                    <div className="h-10 w-10 rounded-full bg-muted animate-pulse shrink-0" />
                    <div className="flex-1 min-w-0 space-y-1.5">
                        <div className="h-4 w-28 bg-muted rounded animate-pulse" />
                        <div className="h-3 w-40 bg-muted rounded animate-pulse" />
                    </div>
                    <div className="h-8 w-20 bg-muted rounded-lg animate-pulse shrink-0" />
                </div>
            ))}
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

    // Debounced remote search effect
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

        userPool.forEach(u => {
            if (matchesUserSearch(u, clean, authUser?.uid)) {
                map.set(u.uid, u);
            }
        });

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

    const isSearchActive = searchQuery.trim().length > 0;

    return (
        <motion.div 
          className="flex flex-col w-full min-w-0 pb-20"
          initial="initial"
          animate="animate"
          variants={{ animate: { transition: { staggerChildren: 0.07 } }}}
        >
            {/* Search Bar — clean, borderless, full-width */}
            <motion.div variants={cardVariants} className="px-4 pt-4 pb-2">
                <div className="relative w-full">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                    <Input
                        type="search"
                        placeholder="Search friends or usernames..."
                        autoComplete="off"
                        autoCorrect="off"
                        autoCapitalize="none"
                        spellCheck={false}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9 pr-9 h-10 w-full truncate border-none bg-card rounded-xl text-sm text-foreground placeholder:text-muted-foreground"
                    />
                    {isSearching && (
                        <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-violet-400" />
                    )}
                </div>
            </motion.div>

            {/* Search results */}
            {isSearchActive && (
                <motion.div variants={cardVariants} className="flex flex-col w-full min-w-0">
                    {searchResults.length > 0 ? (
                        searchResults.map(user => {
                            const isFriend = activeUser?.friends?.includes(user.uid);
                            const hasSent = activeUser?.friendRequestsSent?.includes(user.uid);
                            const hasReceived = activeUser?.friendRequestsReceived?.includes(user.uid);

                            return (
                                <div
                                    key={user.uid}
                                    className="flex items-center gap-3 px-4 py-3 border-b border-border/40 w-full min-w-0 overflow-x-hidden"
                                >
                                    <div
                                        className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer"
                                        onClick={() => router.push(`/friends/${user.uid}`)}
                                    >
                                        <UserAvatar user={user} hasStory={user.hasActiveStory} storyViewed={user.storyViewed} isFriend={!!isFriend} className="h-10 w-10 shrink-0" />
                                        <div className="flex-1 min-w-0">
                                            <p className="font-semibold text-sm text-foreground truncate">{user.name}</p>
                                            <p className="text-xs text-muted-foreground truncate">
                                                {user.username ? `@${user.username}` : user.email}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2 shrink-0">
                                        {isFriend && (
                                            <Button
                                                size="sm"
                                                variant="secondary"
                                                className="px-3 py-1.5 h-8 text-xs shrink-0"
                                                disabled={startingChatUserId === user.uid}
                                                onClick={() => handleMessageUser(user)}
                                            >
                                                {startingChatUserId === user.uid ? (
                                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                ) : (
                                                    <MessageSquare className="h-3.5 w-3.5" />
                                                )}
                                            </Button>
                                        )}
                                        {!isFriend && !hasSent && !hasReceived && (
                                            <Button
                                                size="sm"
                                                className="px-3 py-1.5 h-8 text-xs shrink-0"
                                                onClick={() => handleFriendAction(user.uid, 'sendRequest')}
                                            >
                                                <UserPlus className="h-3.5 w-3.5" />
                                            </Button>
                                        )}
                                        {hasSent && (
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                className="px-3 py-1.5 h-8 text-xs border-border shrink-0"
                                                onClick={() => handleFriendAction(user.uid, 'cancelRequest')}
                                            >
                                                <Ban className="h-3.5 w-3.5" />
                                            </Button>
                                        )}
                                        {hasReceived && (
                                            <Button
                                                size="sm"
                                                className="px-3 py-1.5 h-8 text-xs shrink-0"
                                                onClick={() => handleFriendAction(user.uid, 'acceptRequest')}
                                            >
                                                <Check className="h-3.5 w-3.5" />
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            );
                        })
                    ) : (
                        <p className="text-center text-xs text-muted-foreground py-8 px-4">
                            {isSearching
                                ? 'Searching...'
                                : `No users found for "${searchQuery}".`}
                        </p>
                    )}
                </motion.div>
            )}

            {/* Tabs: friends / requests / sent — hidden during search */}
            {!isSearchActive && (
                <motion.div variants={cardVariants} className="px-4 pt-2">
                    <Tabs defaultValue="friends">
                        <TabsList className="grid w-full grid-cols-3">
                            <TabsTrigger value="friends" className="text-xs">
                                Friends ({friends.length})
                            </TabsTrigger>
                            <TabsTrigger value="requests" className="text-xs">
                                Requests {requests.length > 0 && `(${requests.length})`}
                            </TabsTrigger>
                            <TabsTrigger value="sent" className="text-xs">
                                Sent ({sentRequests.length})
                            </TabsTrigger>
                        </TabsList>

                        {/* MY FRIENDS */}
                        <TabsContent value="friends" className="mt-3">
                            {friends.length > 0 ? (
                                <div className="flex flex-col divide-y divide-zinc-800/40 rounded-xl border border-border/50 bg-card/40 overflow-hidden">
                                    {friends.map(friend => (
                                        <div
                                            key={friend.uid}
                                            className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors w-full min-w-0 overflow-x-hidden"
                                        >
                                            <div
                                                className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer"
                                                onClick={() => router.push(`/friends/${friend.uid}`)}
                                            >
                                                <UserAvatar user={friend} hasStory={friend.hasActiveStory} storyViewed={friend.storyViewed} isFriend={true} className="h-10 w-10 shrink-0" />
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-semibold text-sm text-foreground truncate">{friend.name}</p>
                                                    <p className="text-xs text-muted-foreground truncate">{friend.email}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2 shrink-0">
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    className="px-3 py-1.5 h-8 text-xs border-border shrink-0"
                                                    disabled={startingChatUserId === friend.uid}
                                                    onClick={() => handleMessageUser(friend)}
                                                >
                                                    {startingChatUserId === friend.uid ? (
                                                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                    ) : (
                                                        <MessageSquare className="h-3.5 w-3.5" />
                                                    )}
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    className="w-8 h-8 p-0 flex items-center justify-center text-muted-foreground hover:text-red-400 hover:bg-red-400/10 shrink-0"
                                                    onClick={() => handleFriendAction(friend.uid, 'removeFriend')}
                                                >
                                                    <UserX className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-center text-xs text-muted-foreground py-10">
                                    No friends yet. Use the search bar above to find people!
                                </p>
                            )}
                        </TabsContent>

                        {/* INCOMING REQUESTS */}
                        <TabsContent value="requests" className="mt-3">
                            {requests.length > 0 ? (
                                <div className="flex flex-col divide-y divide-zinc-800/40 rounded-xl border border-border/50 bg-card/40 overflow-hidden">
                                    {requests.map(requestUser => (
                                        <div
                                            key={requestUser.uid}
                                            className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors w-full min-w-0 overflow-x-hidden"
                                        >
                                            <div
                                                className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer"
                                                onClick={() => router.push(`/friends/${requestUser.uid}`)}
                                            >
                                                <UserAvatar user={requestUser} hasStory={requestUser.hasActiveStory} storyViewed={requestUser.storyViewed} className="h-10 w-10 shrink-0" />
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-semibold text-sm text-foreground truncate">{requestUser.name}</p>
                                                    <p className="text-xs text-muted-foreground truncate">{requestUser.email}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2 shrink-0">
                                                <Button
                                                    size="sm"
                                                    className="h-8 px-3 text-xs shrink-0"
                                                    onClick={() => handleFriendAction(requestUser.uid, 'acceptRequest')}
                                                >
                                                    <Check className="h-3.5 w-3.5" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    className="w-8 h-8 p-0 flex items-center justify-center text-muted-foreground hover:text-red-400 hover:bg-red-400/10 shrink-0"
                                                    onClick={() => handleFriendAction(requestUser.uid, 'declineRequest')}
                                                >
                                                    <X className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-center text-xs text-muted-foreground py-10">No pending friend requests.</p>
                            )}
                        </TabsContent>

                        {/* SENT REQUESTS */}
                        <TabsContent value="sent" className="mt-3">
                            {sentRequests.length > 0 ? (
                                <div className="flex flex-col divide-y divide-zinc-800/40 rounded-xl border border-border/50 bg-card/40 overflow-hidden">
                                    {sentRequests.map(sentRequestUser => (
                                        <div
                                            key={sentRequestUser.uid}
                                            className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors w-full min-w-0 overflow-x-hidden"
                                        >
                                            <div
                                                className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer"
                                                onClick={() => router.push(`/friends/${sentRequestUser.uid}`)}
                                            >
                                                <UserAvatar user={sentRequestUser} hasStory={sentRequestUser.hasActiveStory} storyViewed={sentRequestUser.storyViewed} className="h-10 w-10 shrink-0" />
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-semibold text-sm text-foreground truncate">{sentRequestUser.name}</p>
                                                    <p className="text-xs text-muted-foreground truncate">{sentRequestUser.email}</p>
                                                </div>
                                            </div>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="h-8 px-3 text-xs border-border shrink-0"
                                                onClick={() => handleFriendAction(sentRequestUser.uid, 'cancelRequest')}
                                            >
                                                <Ban className="h-3.5 w-3.5" />
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-center text-xs text-muted-foreground py-10">No sent friend requests.</p>
                            )}
                        </TabsContent>
                    </Tabs>
                </motion.div>
            )}
        </motion.div>
    );
}
