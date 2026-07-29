

'use client';
import { Search, LogOut, Plus, Settings, Star, MoreHorizontal, Bot, Archive, ArchiveRestore, UserPlus, UserCheck, UserX, GalleryHorizontal, Moon, Sun } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import type { Conversation, User } from '@/lib/types';
import { UserAvatar } from './user-avatar';
import { cn } from '@/lib/utils';
import { VibezLogo } from './vibez-logo';
import { NewChatDialog } from './new-chat-dialog';
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import React, { useState, useMemo, useCallback } from 'react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from './ui/dropdown-menu';
import { motion, AnimatePresence } from 'framer-motion';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { WeatherWidget } from './weather-widget';
import { useAppearance } from './providers/appearance-provider';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Separator } from './ui/separator';
import { useTheme } from 'next-themes';
import { GlassCard } from './ui/cards/GlassCard';
import { doc, getDoc, updateDoc, arrayRemove, collection, deleteDoc, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';
import { useAppShell } from './app-shell';

const listVariants = {
    initial: { opacity: 0 },
    animate: { 
        opacity: 1,
        transition: {
            staggerChildren: 0.05,
        }
    },
    exit: { opacity: 0 }
};

const itemVariants = {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, x: -20 },
};

import { useMobileDesign } from './providers/mobile-provider';

function UserProfileMenu({ currentUser }: { currentUser?: User }) {
    const { signOut, user: authUser } = useAuth();
    const router = useRouter();
    const { theme, setTheme } = useTheme();
    const { toast } = useToast();

    // Fallback to authUser if currentUser from Firestore doc isn't loaded yet
    const activeUser: User | null = currentUser || (authUser ? {
        id: authUser.uid,
        uid: authUser.uid,
        name: authUser.displayName || (authUser.email ? authUser.email.split('@')[0] : 'User'),
        email: authUser.email || '',
        photoURL: authUser.photoURL || '',
        status: 'online' as const,
        about: '',
        friends: [],
        friendRequestsSent: [],
        friendRequestsReceived: [],
        blockedUsers: [],
    } : null);

    if (!activeUser) return null;

    const requestCount = activeUser.friendRequestsReceived?.length || 0;
    const hasFriendRequests = requestCount > 0;

    const handleLogout = async () => {
        const deviceId = localStorage.getItem('deviceId');
        if (deviceId && activeUser) {
            try {
                // Delete the per-device document from the devices subcollection
                const deviceDocRef = doc(db, 'users', activeUser.uid, 'devices', deviceId);
                await deleteDoc(deviceDocRef);

                // Recalculate remaining device docs to determine online/offline
                const devicesCol = collection(db, 'users', activeUser.uid, 'devices');
                const snapshots = await getDocs(devicesCol);
                const remaining = snapshots.docs.length;

                const userDocRef = doc(db, 'users', activeUser.uid);
                await updateDoc(userDocRef, {
                    status: remaining > 0 ? 'online' : 'offline',
                });
            } catch (error) {
                console.error("Error removing device doc on logout:", error);
                toast({
                    title: "Logout Error",
                    description: "Could not update your device status, but you will be logged out.",
                    variant: "destructive"
                });
            }
        }
        await signOut();
        router.push('/login');
    };

    return (
        <Popover>
            <PopoverTrigger asChild>
                <div className="group/user-menu relative flex w-full cursor-pointer items-center justify-between p-2 transition-colors hover:bg-muted/50 rounded-lg">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="relative shrink-0">
                            <UserAvatar user={activeUser} className="h-10 w-10" />
                            {hasFriendRequests && (
                                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-[9px] font-extrabold text-black ring-2 ring-background animate-pulse">
                                    {requestCount > 9 ? '9+' : requestCount}
                                </span>
                            )}
                        </div>
                        <div className="overflow-hidden flex-1">
                            <p className="font-semibold truncate text-sm">{activeUser.name}</p>
                            <p className="text-xs text-muted-foreground truncate">{activeUser.email}</p>
                        </div>
                    </div>
                     <div className="relative flex items-center gap-2 shrink-0">
                        {hasFriendRequests && (
                            <span className="flex h-5 px-2 items-center justify-center rounded-full bg-emerald-500 text-[10px] font-bold text-black animate-pulse">
                                {requestCount} request{requestCount > 1 ? 's' : ''}
                            </span>
                        )}
                        <MoreHorizontal className="h-5 w-5 text-muted-foreground" />
                    </div>
                </div>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-2 rounded-xl shadow-lg border backdrop-blur-xl bg-background/80 mb-2" side="top" align="start">
                <div className="p-2">
                    <p className="font-semibold truncate">{activeUser.name}</p>
                    <p className="text-sm text-muted-foreground truncate">{activeUser.email}</p>
                </div>
                <Separator />
                <div className="p-1 space-y-1">
                    <Button variant="ghost" className="w-full justify-start relative" asChild>
                        <Link href="/friends">
                            <UserPlus className="mr-2 h-4 w-4 text-emerald-400" />
                            <span>Friends</span>
                            {hasFriendRequests && (
                                <span className="ml-auto flex h-5 px-2 items-center justify-center rounded-full bg-emerald-500 text-[10px] font-bold text-black animate-pulse">
                                    {requestCount}
                                </span>
                            )}
                        </Link>
                    </Button>
                    <Button variant="ghost" className="w-full justify-start" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
                        {theme === 'dark' ? <Sun className="mr-2 h-4 w-4" /> : <Moon className="mr-2 h-4 w-4" />}
                        <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
                    </Button>
                    <Button variant="ghost" className="w-full justify-start relative" asChild>
                        <Link href="/settings">
                            <Settings className="mr-2 h-4 w-4" />
                            <span>Settings</span>
                            {hasFriendRequests && (
                                <span className="ml-auto h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                            )}
                        </Link>
                    </Button>
                </div>
                <Separator />
                <div className="p-1">
                     <Button variant="ghost" className="w-full justify-start text-destructive hover:text-destructive" onClick={handleLogout}>
                        <LogOut className="mr-2 h-4 w-4" />
                        <span>Log Out</span>
                    </Button>
                </div>
            </PopoverContent>
        </Popover>
    )
}

import { useMobileKeyboardHeight } from '@/hooks/use-mobile-keyboard-height';

export function ChatList() {
  const {
    conversations,
    aiConversation,
    selectedChat,
    handleChatSelect,
    allUsers,
    handleCreateChat,
    handleCreateGroupChat,
    currentUser,
    handleConversationAction,
    handleFriendAction,
  } = useAppShell();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const { keyboardOpen } = useMobileKeyboardHeight();
  const { isWeatherVisible } = useAppearance();
  const { isMobileView } = useMobileDesign();

  const filteredConversations = useMemo(() => {
    const blockedUserIds = currentUser?.blockedUsers || [];
    if (!conversations) return [];
    const term = searchTerm.trim().toLowerCase();

    return conversations.filter(convo => {
      const isBlocked = convo.type === 'private' && convo.participants.some(p => blockedUserIds.includes(p) && p !== currentUser?.uid);
      if (isBlocked) return false;
      if (!term) return true;

      const convoName = (convo.name || '').toLowerCase();
      const otherParticipant = convo.participantsDetails?.find(p => p.uid !== currentUser?.uid);
      const otherEmail = (otherParticipant?.email || '').toLowerCase();
      const otherUser = (otherParticipant?.username || '').toLowerCase();
      const lastMsgText = (convo.lastMessage?.text || '').toLowerCase();

      return convoName.includes(term) || otherEmail.includes(term) || otherUser.includes(term) || lastMsgText.includes(term);
    });
  }, [conversations, searchTerm, currentUser]);
  
  const activeChats = useMemo(() => filteredConversations.filter(c => !c.isArchived), [filteredConversations]);
  const archivedChats = useMemo(() => filteredConversations.filter(c => c.isArchived), [filteredConversations]);

  const favoriteChats = useMemo(() => activeChats.filter(c => c.isFavorite), [activeChats]);
  const unreadChats = useMemo(() => activeChats.filter(c => c.unreadCount && c.unreadCount > 0 && !c.isFavorite && c.id !== selectedChat?.id), [activeChats, selectedChat?.id]);
  const regularChats = useMemo(() => activeChats.filter(c => !c.isFavorite && (!c.unreadCount || c.unreadCount === 0)), [activeChats]);

  const usersForNewChat = allUsers.filter(u => u.uid !== currentUser?.uid && !(currentUser?.blockedUsers || []).includes(u.uid));

  const shouldShowAiChat = useMemo(() => {
    return aiConversation.name?.toLowerCase().includes(searchTerm.toLowerCase());
  }, [aiConversation, searchTerm]);

  return (
    <>
    <div className="flex flex-col h-full min-h-0 w-full max-w-[22rem] flex-1 overflow-x-hidden bg-transparent" style={{boxSizing: 'border-box'}}>
    <div className="flex-none p-4 border-b border-border/50 flex justify-between items-center gap-2">
         <VibezLogo className="group-[[data-sidebar-state=collapsed]]/sidebar:hidden" />
         <div className="flex-1 flex justify-center group-[[data-sidebar-state=collapsed]]/sidebar:hidden">
            {isWeatherVisible && <WeatherWidget />}
         </div>
         <NewChatDialog 
            users={usersForNewChat}
            onCreateChat={handleCreateChat}
            onCreateGroupChat={handleCreateGroupChat}
            currentUser={currentUser}
         >
            <Button variant="ghost" size="icon">
                <Plus className="h-5 w-5" />
                <span className="sr-only">New Chat</span>
            </Button>
         </NewChatDialog>
       </div>

    <div className="flex-none px-4 py-2 border-b border-border/50">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            type="search"
            placeholder="Search existing chats..." 
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="none"
            spellCheck={false}
            className="pl-10 bg-background/50 group-[[data-sidebar-state=collapsed]]/sidebar:hidden"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onFocus={() => setIsSearchFocused(true)}
            onBlur={() => setIsSearchFocused(false)}
          />
           <div className="hidden group-[[data-sidebar-state=collapsed]]/sidebar:flex items-center justify-center">
             <Button variant="ghost" size="icon">
                <Search className="h-5 w-5" />
             </Button>
           </div>
        </div>
         <div className="mt-2 group-[[data-sidebar-state=collapsed]]/sidebar:hidden">
            <Button asChild variant="outline" className="w-full justify-start">
                <Link href="/stories">
                    <GalleryHorizontal className="mr-2 h-5 w-5" />
                    Stories
                </Link>
            </Button>
        </div>
      </div>
      
            <ScrollArea className="flex-1 min-h-0 overflow-y-auto">
                <div className="flex flex-col gap-1 p-2 w-full overflow-hidden">
            <div className="space-y-4">
            {favoriteChats.length > 0 && (
                <div>
                <h2 className="text-xs font-semibold text-muted-foreground px-2 pt-2 pb-1 uppercase tracking-wider group-[[data-sidebar-state=collapsed]]/sidebar:hidden">Favorites</h2>
                <motion.ul 
                    className="space-y-1"
                    variants={listVariants}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                >
                    {favoriteChats.map((convo) => (
                    <ChatItem
                        key={convo.id}
                        conversation={convo}
                        isSelected={selectedChat?.id === convo.id}
                        currentUser={currentUser}
                        selectedChat={selectedChat}
                        onSelect={() => handleChatSelect(convo.id)}
                        onAction={handleConversationAction}
                        onFriendAction={handleFriendAction}
                    />
                    ))}
                </motion.ul>
                </div>
            )}
            {unreadChats.length > 0 && (
                <div>
                <h2 className="text-xs font-semibold text-muted-foreground px-2 pt-2 pb-1 uppercase tracking-wider group-[[data-sidebar-state=collapsed]]/sidebar:hidden">Unread</h2>
                <motion.ul 
                    className="space-y-1"
                    variants={listVariants}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                >
                    {unreadChats.map((convo) => (
                    <ChatItem
                        key={convo.id}
                        conversation={convo}
                        isSelected={selectedChat?.id === convo.id}
                        currentUser={currentUser}
                        selectedChat={selectedChat}
                        onSelect={() => handleChatSelect(convo.id)}
                        onAction={handleConversationAction}
                        onFriendAction={handleFriendAction}
                    />
                    ))}
                </motion.ul>
                </div>
            )}
                <div>
                <h2 className="text-xs font-semibold text-muted-foreground px-2 pt-2 pb-1 uppercase tracking-wider group-[[data-sidebar-state=collapsed]]/sidebar:hidden">Chats</h2>
                <motion.ul 
                    className="space-y-1"
                    variants={listVariants}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                >
                    {regularChats.map((convo) => (
                    <ChatItem
                        key={convo.id}
                        conversation={convo}
                        isSelected={selectedChat?.id === convo.id}
                        currentUser={currentUser}
                        selectedChat={selectedChat}
                        onSelect={() => handleChatSelect(convo.id)}
                        onAction={handleConversationAction}
                        onFriendAction={handleFriendAction}
                    />
                    ))}
                </motion.ul>
            </div>

            {regularChats.length === 0 && unreadChats.length === 0 && favoriteChats.length === 0 && (
                searchTerm.trim().length > 0 ? (
                    <div className="p-4 text-center space-y-3 group-[[data-sidebar-state=collapsed]]/sidebar:hidden rounded-xl border border-border/60 bg-muted/20 my-2 backdrop-blur-sm">
                        <p className="text-xs font-semibold text-muted-foreground">
                            No existing chats match "{searchTerm}"
                        </p>
                        <p className="text-xs text-muted-foreground">
                            Looking for new friends? Use the Friends section to search all registered users!
                        </p>
                        <Button asChild size="sm" variant="outline" className="w-full">
                            <Link href="/friends">
                                <UserPlus className="mr-2 h-4 w-4 text-primary" />
                                Find New Friends →
                            </Link>
                        </Button>
                    </div>
                ) : (
                    <p className="p-4 text-center text-muted-foreground group-[[data-sidebar-state=collapsed]]/sidebar:hidden">No user chats yet.</p>
                )
            )}
            
            {shouldShowAiChat && (
                <div>
                    <h2 className="text-xs font-semibold text-muted-foreground px-2 pt-2 pb-1 uppercase tracking-wider group-[[data-sidebar-state=collapsed]]/sidebar:hidden">AI Assistant</h2>
                    <ChatItem
                        conversation={aiConversation}
                        isSelected={selectedChat?.id === aiConversation.id}
                        currentUser={currentUser}
                        selectedChat={selectedChat}
                        onSelect={() => handleChatSelect(aiConversation.id)}
                        onAction={handleConversationAction}
                        onFriendAction={handleFriendAction}
                    />
                </div>
            )}

            {archivedChats.length > 0 && (
                    <div className="px-2 group-[[data-sidebar-state=collapsed]]/sidebar:hidden">
                    <Accordion type="single" collapsible className="w-full">
                        <AccordionItem value="archived" className="border-b-0">
                            <AccordionTrigger className="text-xs font-semibold text-muted-foreground uppercase tracking-wider hover:no-underline py-2">
                                Archived
                            </AccordionTrigger>
                            <AccordionContent>
                                <motion.ul 
                                    className="space-y-1"
                                    variants={listVariants}
                                    initial="initial"
                                    animate="animate"
                                    exit="exit"
                                >
                                    {archivedChats.map((convo) => (
                                    <ChatItem
                                        key={convo.id}
                                        conversation={convo}
                                        isSelected={selectedChat?.id === convo.id}
                                        currentUser={currentUser}
                                        selectedChat={selectedChat}
                                        onSelect={() => handleChatSelect(convo.id)}
                                        onAction={handleConversationAction}
                                        onFriendAction={handleFriendAction}
                                    />
                                    ))}
                                </motion.ul>
                            </AccordionContent>
                        </AccordionItem>
                    </Accordion>
                </div>
            )}
            </div>
        </div>
      </ScrollArea>

    <div className={cn("flex-none shrink-0 p-2 border-t border-border/50 transition-all duration-200 mt-auto bg-background/30 backdrop-blur-md z-20", (isMobileView && (keyboardOpen || isSearchFocused)) && "hidden")}>
      <UserProfileMenu currentUser={currentUser} />
    </div>
    </div>
    </>
  );
}

interface ChatItemProps {
  conversation: Conversation;
  isSelected: boolean;
  currentUser?: User;
  selectedChat?: Conversation;
  onSelect: () => void;
  onAction: (conversationId: string, action: 'toggleFavorite' | 'archive' | 'unarchive') => void;
  onFriendAction: (targetUserId: string, action: 'sendRequest' | 'acceptRequest' | 'declineRequest' | 'removeFriend') => void;
}

function ChatItem({ conversation, isSelected, currentUser, selectedChat, onSelect, onAction, onFriendAction }: ChatItemProps) {
  const lastMessage = (convo: Conversation) => {
    if(convo.lastMessage) {
        const timestamp = convo.lastMessage.timestamp;
        let date;
        if (timestamp?.seconds) {
            date = new Date(timestamp.seconds * 1000);
        } else if (timestamp instanceof Date) {
            date = timestamp;
        }

        return {
            text: convo.lastMessage.text,
            timestamp: date ? date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '',
        }
    }
    return { text: 'No messages yet', timestamp: '' };
  }

  const { text, timestamp } = lastMessage(conversation);
  
  const handleAction = (action: 'toggleFavorite' | 'archive' | 'unarchive') => {
    onAction(conversation.id, action);
  }
  
  const handleFriendRequest = () => {
    const otherParticipant = conversation.participantsDetails?.find(p => p.uid !== currentUser?.uid);
    if(otherParticipant) {
        onFriendAction(otherParticipant.uid, 'sendRequest');
    }
  }

  const otherParticipant = conversation.participantsDetails?.find(p => p.uid !== currentUser?.uid);
  const isFriend = currentUser?.friends?.includes(otherParticipant?.uid || '');
  const hasSentRequest = currentUser?.friendRequestsSent?.includes(otherParticipant?.uid || '');
  const hasReceivedRequest = currentUser?.friendRequestsReceived?.includes(otherParticipant?.uid || '');
  const isAiChat = conversation.id === 'gemini-ai-chat-bot-7a4b9c1d-f2e3-4d56-a1b2-c3d4e5f6a7b8';
  
  const canSendRequest = conversation.type === 'private' && !isFriend && !hasSentRequest && !hasReceivedRequest && !isAiChat;
  
  const ContextMenuContent = ({ children }: { children: React.ReactNode }) => (
    <DropdownMenuContent onClick={(e) => e.stopPropagation()} className="shadow-lg backdrop-blur-xl bg-background/80">
        {children}
    </DropdownMenuContent>
  );

  return (
     <motion.li
        variants={itemVariants}
        layout
        className="list-none w-full max-w-full min-w-0 overflow-x-hidden"
    >
            <GlassCard
                onClick={onSelect}
                className={cn(
                    'relative group/chat-item flex w-full max-w-full min-w-0 items-center gap-3 p-3 text-left transition-all cursor-pointer overflow-x-hidden',
                    isSelected ? 'bg-primary/20 border-primary/50' : 'hover:bg-muted/10'
                )}
            >
        <UserAvatar 
            user={{
                name: conversation.name || 'Unknown',
                photoURL: conversation.avatar || '',
            }} 
            isFriend={isFriend}
            className="h-12 w-12 flex-shrink-0"
        />
        <div className="flex-1 min-w-0 max-w-full overflow-hidden group-[[data-sidebar-state=collapsed]]/sidebar:hidden">
            <div className="flex justify-between items-baseline min-w-0 max-w-full">
                <div className="flex items-center gap-2 min-w-0 max-w-full">
                    <p className="font-semibold truncate flex-grow min-w-0 max-w-full overflow-hidden whitespace-nowrap">{conversation.name}</p>
                    {conversation.isFavorite && !isAiChat && <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />}
                    {isAiChat && <Bot className="h-4 w-4 text-primary" />}
                </div>
                <div className="flex items-center gap-2">
                    <p className="text-xs text-muted-foreground flex-shrink-0">{timestamp}</p>
                </div>
            </div>
            <div className="flex justify-between items-start gap-2 min-w-0 max-w-full">
                    <p className="text-sm text-muted-foreground line-clamp-1 break-words overflow-hidden min-w-0 max-w-full chat-list-force-break">
                    {text}
                </p>
                {conversation.unreadCount && conversation.unreadCount > 0 && conversation.id !== selectedChat?.id ? (
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground shrink-0">
                        {conversation.unreadCount}
                    </span>
                ) : null}
            </div>
        </div>
        <div className="absolute right-1 top-1/2 -translate-y-1/2 group-[[data-sidebar-state=collapsed]]/sidebar:hidden">
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-background/50 hover:backdrop-blur-sm" onClick={(e) => e.stopPropagation()}>
                        <MoreHorizontal className="h-4 w-4" />
                    </Button>
                </DropdownMenuTrigger>
                {!isAiChat && (
                  <ContextMenuContent>
                      {canSendRequest && <DropdownMenuItem onClick={handleFriendRequest}><UserPlus className="mr-2 h-4 w-4" /><span>Add Friend</span></DropdownMenuItem>}
                      {isFriend && <DropdownMenuItem disabled><UserCheck className="mr-2 h-4 w-4" /><span>Friends</span></DropdownMenuItem>}
                      {hasSentRequest && <DropdownMenuItem disabled><UserCheck className="mr-2 h-4 w-4" /><span>Request Sent</span></DropdownMenuItem>}
                      {hasReceivedRequest && <DropdownMenuItem onClick={() => { if (otherParticipant) onFriendAction(otherParticipant.uid, 'acceptRequest'); }}><UserPlus className="mr-2 h-4 w-4" /><span>Accept Request</span></DropdownMenuItem>}
                      <DropdownMenuItem onClick={() => handleAction('toggleFavorite')}><Star className="mr-2 h-4 w-4" /><span>{conversation.isFavorite ? 'Unfavorite' : 'Favorite'}</span></DropdownMenuItem>
                      {conversation.isArchived ? <DropdownMenuItem onClick={() => handleAction('unarchive')}><ArchiveRestore className="mr-2 h-4 w-4" /><span>Unarchive</span></DropdownMenuItem> : <DropdownMenuItem onClick={() => handleAction('archive')}><Archive className="mr-2 h-4 w-4" /><span>Archive</span></DropdownMenuItem>}
                      {isFriend && <DropdownMenuItem className="text-destructive" onClick={() => { if(otherParticipant) onFriendAction(otherParticipant.uid, 'removeFriend'); }}><UserX className="mr-2 h-4 w-4" /><span>Remove Friend</span></DropdownMenuItem>}
                  </ContextMenuContent>
                )}
            </DropdownMenu>
        </div>
      </GlassCard>
    </motion.li>
  );
}
