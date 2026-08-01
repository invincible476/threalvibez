
'use client';

import { useAuth } from '@/hooks/use-auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { motion } from 'framer-motion';
import { sendPasswordResetEmail, deleteUser } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';
import { doc, getDoc, collection, getDocs, query, where, writeBatch, runTransaction, addDoc, serverTimestamp, updateDoc, arrayRemove, onSnapshot } from 'firebase/firestore';
import React, { useState, useRef, useEffect } from 'react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Loader2, Ban, ShieldOff, UserX } from 'lucide-react';
import type { Conversation, Message, User } from '@/lib/types';
import { UserAvatar } from '@/components/user-avatar';

const cardVariants = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.3, ease: 'easeOut' } },
};

function AccountSkeleton() {
  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-5 w-72 mt-2" />
      </div>

      <Card>
        <CardHeader>
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-4 w-full max-w-md mt-2" />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-10 w-full" />
          </div>
          <div className="flex justify-end">
            <Skeleton className="h-10 w-36" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
           <Skeleton className="h-7 w-48" />
           <Skeleton className="h-4 w-full max-w-lg mt-2" />
        </CardHeader>
        <CardContent className="flex gap-2">
             <Skeleton className="h-10 w-40" />
             <Skeleton className="h-10 w-40" />
        </CardContent>
      </Card>

       <Card className="border-destructive">
        <CardHeader>
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-4 w-full max-w-lg mt-2" />
        </CardHeader>
        <CardContent>
            <Skeleton className="h-10 w-40" />
        </CardContent>
      </Card>
    </div>
  );
}

export default function AccountPage() {
    const { user, loading } = useAuth();
    const { toast } = useToast();
    const [isProcessing, setIsProcessing] = useState(false);
    const importInputRef = useRef<HTMLInputElement>(null);
    const [blockedUsersList, setBlockedUsersList] = useState<User[]>([]);
    const [unblockingUserId, setUnblockingUserId] = useState<string | null>(null);

    useEffect(() => {
        if (!user) return;
        const userRef = doc(db, 'users', user.uid);
        const unsubscribe = onSnapshot(userRef, async (snapshot) => {
            const data = snapshot.data();
            const blockedIds: string[] = Array.isArray(data?.blockedUsers) ? data.blockedUsers : [];
            
            if (blockedIds.length === 0) {
                setBlockedUsersList([]);
                return;
            }

            try {
                const fetchedUsers = await Promise.all(
                    blockedIds.map(async (bId) => {
                        const bDoc = await getDoc(doc(db, 'users', bId));
                        if (bDoc.exists()) {
                            return { uid: bDoc.id, ...bDoc.data() } as User;
                        }
                        return { uid: bId, name: 'Blocked User' } as User;
                    })
                );
                setBlockedUsersList(fetchedUsers);
            } catch (e) {
                console.error("Error fetching blocked users:", e);
            }
        });

        return () => unsubscribe();
    }, [user]);

    const handleUnblockUser = async (targetUserId: string) => {
        if (!user) return;
        setUnblockingUserId(targetUserId);
        try {
            const userRef = doc(db, 'users', user.uid);
            await updateDoc(userRef, { blockedUsers: arrayRemove(targetUserId) });
            toast({ title: 'User Unblocked', description: 'User removed from your blocked list.' });
        } catch (error: any) {
            console.error("Error unblocking user:", error);
            toast({ title: 'Error', description: error.message || 'Failed to unblock user.', variant: 'destructive' });
        } finally {
            setUnblockingUserId(null);
        }
    };

    const handlePasswordChange = async () => {
        if (!user || !user.email) {
            toast({ title: "Error", description: "Could not find user email.", variant: "destructive"});
            return;
        };
        setIsProcessing(true);
        try {
            await sendPasswordResetEmail(auth, user.email);
            toast({ title: "Success", description: "A password reset link has been sent to your email."});
        } catch (error: any) {
            console.error("Password reset error:", error);
            toast({ title: "Error", description: error.message || "Failed to send password reset email.", variant: "destructive"});
        } finally {
            setIsProcessing(false);
        }
    }

    const handleExportData = async () => {
        if (!user) return;
        setIsProcessing(true);
        try {
            const userDocRef = doc(db, 'users', user.uid);
            const userDoc = await getDoc(userDocRef);
            const userData = userDoc.data();

            const convosQuery = query(collection(db, 'conversations'), where('participants', 'array-contains', user.uid));
            const convosSnapshot = await getDocs(convosQuery);
            
            const conversationsData = await Promise.all(
                convosSnapshot.docs.map(async (convoDoc) => {
                    const messagesQuery = query(collection(convoDoc.ref, 'messages'));
                    const messagesSnapshot = await getDocs(messagesQuery);
                    const messages = messagesSnapshot.docs.map(msgDoc => msgDoc.data());
                    return { ...convoDoc.data(), messages };
                })
            );

            const exportData = {
                user: userData,
                conversations: conversationsData,
            };

            const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `vibez_export_${user.uid}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            toast({ title: "Success", description: "Your data has been exported." });

        } catch (error: any) {
            console.error("Data export error:", error);
            toast({ title: "Error", description: "Failed to export data.", variant: "destructive"});
        } finally {
            setIsProcessing(false);
        }
    }
    
    const handleImportData = async (event: React.ChangeEvent<HTMLInputElement>) => {
        if (!user) {
            toast({ title: 'Error', description: 'You must be logged in to import data.', variant: 'destructive' });
            return;
        }
        const file = event.target.files?.[0];
        if (!file) return;

        setIsProcessing(true);
        try {
            const fileContent = await file.text();
            const data = JSON.parse(fileContent);

            if (!data.conversations || !Array.isArray(data.conversations)) {
                throw new Error("Invalid import file: Missing 'conversations' array.");
            }

            const oldUserId = data.user?.uid;
            if (!oldUserId) {
                throw new Error("Invalid import file: Missing original user UID.");
            }

            for (const convo of data.conversations as (Omit<Conversation, 'id'> & { messages: Message[] })[]) {
                const newParticipants = convo.participants.map(p => p === oldUserId ? user.uid : p);

                const newConvoData = {
                    type: convo.type,
                    participants: newParticipants,
                    name: convo.name,
                    avatar: convo.avatar,
                    description: convo.description,
                    createdBy: convo.createdBy === oldUserId ? user.uid : convo.createdBy,
                    createdAt: serverTimestamp(),
                    lastMessage: null,
                    lastRead: {},
                };

                const newConvoRef = await addDoc(collection(db, 'conversations'), newConvoData);

                const messagesBatch = writeBatch(db);
                if (convo.messages && convo.messages.length > 0) {
                    let lastMessage: Message | null = null;
                    convo.messages.forEach(msg => {
                        const messageDocRef = doc(collection(db, 'conversations', newConvoRef.id, 'messages'));
                        
                        const newMsg = { ...msg };
                        if (newMsg.senderId === oldUserId) {
                            newMsg.senderId = user.uid;
                        }
                        // Timestamps need to be converted back to Firestore Timestamps if they are strings
                        if (typeof newMsg.timestamp === 'object' && newMsg.timestamp.seconds) {
                            newMsg.timestamp = new Date(newMsg.timestamp.seconds * 1000);
                        } else {
                            newMsg.timestamp = new Date(); // fallback
                        }

                        messagesBatch.set(messageDocRef, newMsg);
                        if (!lastMessage || newMsg.timestamp > (lastMessage.timestamp as Date)) {
                            lastMessage = newMsg;
                        }
                    });

                    if (lastMessage) {
                        const finalMsg = lastMessage as Message;
                        await updateDoc(newConvoRef, {
                            lastMessage: {
                                text: finalMsg.text,
                                senderId: finalMsg.senderId,
                                timestamp: finalMsg.timestamp,
                            }
                        });
                    }

                    await messagesBatch.commit();
                }
            }
            toast({ title: 'Import Complete', description: 'Your conversations have been restored.' });
        } catch (error: any) {
            console.error("Data import error:", error);
            toast({ title: "Import Failed", description: error.message || "Could not import data. Please check the file and try again.", variant: "destructive" });
        } finally {
            setIsProcessing(false);
            if (importInputRef.current) {
                importInputRef.current.value = '';
            }
        }
    };


    const handleDeleteAccount = async () => {
        if (!user) return;
        setIsProcessing(true);
        try {
            const batch = writeBatch(db);
            const userDocRef = doc(db, 'users', user.uid);
            batch.delete(userDocRef);
            
            await batch.commit();

            await deleteUser(user);
            
            toast({ title: "Account Deleted", description: "Your account has been permanently deleted." });
        } catch (error: any) {
            console.error("Account deletion error:", error);
            if(error.code === 'auth/requires-recent-login') {
                 toast({ title: "Action Required", description: "This is a sensitive action. Please log out and log back in before deleting your account.", variant: "destructive", duration: 7000});
            } else {
                toast({ title: "Error", description: error.message || "Failed to delete account.", variant: "destructive"});
            }
        } finally {
            setIsProcessing(false);
        }
    }


    if (loading || !user) {
        return <AccountSkeleton />;
    }

    return (
        <motion.div 
          className="space-y-4 px-4 pt-4 pb-20"
          initial="initial"
          animate="animate"
          variants={{
            animate: {
              transition: {
                staggerChildren: 0.07,
              },
            },
          }}
        >
            <motion.header variants={cardVariants}>
                <p className="text-xs text-muted-foreground mb-2 max-w-md">Manage your account settings and data.</p>
            </motion.header>

             <motion.div variants={cardVariants}>
                <Card className="border border-border/50 bg-card/60">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-foreground">Security</CardTitle>
                        <CardDescription className="text-xs text-muted-foreground">
                            Change your password and manage your account security.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div>
                            <h3 className="font-medium">Password</h3>
                            <p className="text-sm text-muted-foreground">Click the button to receive a password reset link in your email.</p>
                        </div>
                        <div className="flex justify-end">
                            <Button asChild onClick={handlePasswordChange} disabled={isProcessing}>
                                <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                                    {isProcessing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                                    Change Password
                                </motion.button>
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </motion.div>

            <motion.div variants={cardVariants}>
                <Card className="border border-border/50 bg-card/60">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-foreground">Manage Data</CardTitle>
                        <CardDescription className="text-xs text-muted-foreground">
                            Export or import your account data. This allows you to take your information with you.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <p className="text-sm text-muted-foreground">Export all your personal data as a JSON file, or import data from a previous export.</p>
                        <div className="flex flex-wrap gap-2">
                            <Button variant="secondary" asChild onClick={handleExportData} disabled={isProcessing}>
                                 <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                                     {isProcessing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                                     Export My Data
                                 </motion.button>
                            </Button>
                            <input type="file" accept=".json" ref={importInputRef} onChange={handleImportData} className="hidden" />
                            <Button variant="secondary" asChild onClick={() => importInputRef.current?.click()} disabled={isProcessing}>
                                 <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                                     {isProcessing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                                     Import Data
                                 </motion.button>
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </motion.div>

            <motion.div variants={cardVariants}>
                <Card className="border border-border/50 bg-card/60">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-foreground flex items-center gap-2">
                            <Ban className="h-4 w-4 text-red-400" />
                            <span>Blocked Accounts</span>
                        </CardTitle>
                        <CardDescription className="text-xs text-muted-foreground">
                            Users you have blocked cannot message you or see your activity.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {blockedUsersList.length === 0 ? (
                            <p className="text-xs text-muted-foreground py-3 italic text-center rounded-xl bg-muted/20 border border-border/30">
                                You have not blocked any accounts.
                            </p>
                        ) : (
                            <div className="space-y-2.5">
                                {blockedUsersList.map((bUser) => (
                                    <div key={bUser.uid} className="flex items-center justify-between p-3 rounded-xl bg-muted/30 border border-border/40">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <UserAvatar user={bUser} className="h-9 w-9 shrink-0" />
                                            <div className="min-w-0">
                                                <p className="font-semibold text-sm text-foreground truncate">{bUser.name || 'Blocked User'}</p>
                                                <p className="text-xs text-muted-foreground truncate">{bUser.username ? `@${bUser.username}` : bUser.email || bUser.uid}</p>
                                            </div>
                                        </div>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            disabled={unblockingUserId === bUser.uid}
                                            onClick={() => handleUnblockUser(bUser.uid)}
                                            className="text-xs shrink-0 border-border/60 hover:bg-violet-600/10 hover:text-violet-400"
                                        >
                                            {unblockingUserId === bUser.uid ? (
                                                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                                            ) : (
                                                <ShieldOff className="h-3.5 w-3.5 mr-1 text-violet-400" />
                                            )}
                                            Unblock
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </motion.div>

            <motion.div variants={cardVariants}>
                <Card className="border border-red-900/40 bg-red-950/20">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-red-400">Delete Account</CardTitle>
                        <CardDescription className="text-xs text-muted-foreground">
                            Permanently delete your account and all of your content. This action is not reversible.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button variant="destructive" asChild disabled={isProcessing}>
                                    <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                                        {isProcessing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                                        Delete My Account
                                    </motion.button>
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        This action cannot be undone. This will permanently delete your account and remove your data from our servers.
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={handleDeleteAccount} className="bg-destructive hover:bg-destructive/90">
                                        Delete
                                    </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    </CardContent>
                </Card>
            </motion.div>
        </motion.div>
    );
}
