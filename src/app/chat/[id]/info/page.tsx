'use client';

import React, { useState, useEffect, useMemo, use } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Bell,
  BellOff,
  Search,
  Download,
  Trash2,
  UserPlus,
  UserX,
  LogOut,
  FileText,
  ExternalLink,
  Image as ImageIcon,
  Video as VideoIcon,
  ShieldAlert,
  Loader2,
  Check,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { UserAvatar } from '@/components/user-avatar';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { doc, getDoc, collection, query, orderBy, onSnapshot, updateDoc, arrayRemove, arrayUnion } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/hooks/use-auth';
import { Conversation, Message, User } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { MediaLightbox, LightboxMedia } from '@/components/media-lightbox';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { addGroupMembers } from '@/lib/firebase/chat';

interface ChatInfoPageProps {
  params: Promise<{ id: string }>;
}

export default function ChatInfoPage({ params }: ChatInfoPageProps) {
  const resolvedParams = use(params);
  const chatId = resolvedParams.id;
  const router = useRouter();
  const { user: authUser } = useAuth();
  const { toast } = useToast();

  const [chat, setChat] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [participantsDetails, setParticipantsDetails] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchActive, setIsSearchActive] = useState(false);

  // Lightbox state
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  // Friend Picker Modal State
  const [isAddMemberModalOpen, setIsAddMemberModalOpen] = useState(false);
  const [availableFriends, setAvailableFriends] = useState<User[]>([]);
  const [selectedFriendIds, setSelectedFriendIds] = useState<string[]>([]);
  const [friendSearchQuery, setFriendSearchQuery] = useState('');
  const [loadingFriends, setLoadingFriends] = useState(false);
  const [isAddingMember, setIsAddingMember] = useState(false);

  useEffect(() => {
    if (!chatId) return;

    // Fetch conversation doc
    const chatRef = doc(db, 'conversations', chatId);
    const unsubscribeChat = onSnapshot(chatRef, async (snapshot) => {
      if (snapshot.exists()) {
        const data = { id: snapshot.id, ...snapshot.data() } as Conversation;
        setChat(data);

        // Check if user has muted conversation
        if (authUser) {
          const userRef = doc(db, 'users', authUser.uid);
          const userSnap = await getDoc(userRef);
          if (userSnap.exists()) {
            const userData = userSnap.data() as User;
            setIsMuted(userData.mutedConversations?.includes(chatId) || false);
          }
        }

        // Fetch participant details
        if (data.participants && data.participants.length > 0) {
          const fetchedUsers: User[] = [];
          for (const uid of data.participants) {
            const uSnap = await getDoc(doc(db, 'users', uid));
            if (uSnap.exists()) {
              fetchedUsers.push({ id: uSnap.id, uid: uSnap.id, ...uSnap.data() } as User);
            }
          }
          setParticipantsDetails(fetchedUsers);
        }
      } else {
        toast({ title: 'Error', description: 'Chat not found', variant: 'destructive' });
      }
      setLoading(false);
    });

    // Fetch messages for media tabs & search
    const messagesQuery = query(
      collection(db, 'conversations', chatId, 'messages'),
      orderBy('timestamp', 'desc')
    );
    const unsubscribeMessages = onSnapshot(messagesQuery, (snapshot) => {
      const msgs = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      })) as Message[];
      setMessages(msgs);
    });

    return () => {
      unsubscribeChat();
      unsubscribeMessages();
    };
  }, [chatId, authUser, toast]);

  // Load available friends for group addition modal
  const fetchAvailableFriends = async () => {
    if (!authUser || !chat) return;
    setLoadingFriends(true);
    try {
      const userSnap = await getDoc(doc(db, 'users', authUser.uid));
      if (userSnap.exists()) {
        const userData = userSnap.data() as User;
        const currentParticipants = new Set(chat.participants || []);
        const friendIds = (userData.friends || []).filter((fId) => !currentParticipants.has(fId));

        const friendsList: User[] = [];
        for (const fId of friendIds) {
          const fSnap = await getDoc(doc(db, 'users', fId));
          if (fSnap.exists()) {
            friendsList.push({ id: fSnap.id, uid: fSnap.id, ...fSnap.data() } as User);
          }
        }
        setAvailableFriends(friendsList);
      }
    } catch (e) {
      console.error('Error fetching friends list:', e);
      toast({ title: 'Error', description: 'Could not load friends list', variant: 'destructive' });
    } finally {
      setLoadingFriends(false);
    }
  };

  const openAddMemberModal = () => {
    setSelectedFriendIds([]);
    setFriendSearchQuery('');
    setIsAddMemberModalOpen(true);
    fetchAvailableFriends();
  };

  // Derived Media & Links
  const mediaItems = useMemo(() => {
    const items: LightboxMedia[] = [];
    messages.forEach((msg) => {
      if (msg.file && (msg.file.type?.startsWith('image/') || msg.file.type?.startsWith('video/'))) {
        items.push({
          url: msg.file.url,
          type: msg.file.type,
          name: msg.file.name || 'Shared Media',
        });
      }
    });
    return items;
  }, [messages]);

  const documentItems = useMemo(() => {
    return messages.filter(
      (msg) =>
        msg.file &&
        !msg.file.type?.startsWith('image/') &&
        !msg.file.type?.startsWith('video/') &&
        !msg.file.type?.startsWith('audio/')
    );
  }, [messages]);

  const linkItems = useMemo(() => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const links: { url: string; domain: string; text: string; senderId: string }[] = [];

    messages.forEach((msg) => {
      if (msg.text) {
        const matches = msg.text.match(urlRegex);
        if (matches) {
          matches.forEach((url) => {
            try {
              const domain = new URL(url).hostname;
              links.push({
                url,
                domain,
                text: msg.text,
                senderId: msg.senderId,
              });
            } catch (e) {
              // ignore invalid url format
            }
          });
        }
      }
    });
    return links;
  }, [messages]);

  const filteredMessages = useMemo(() => {
    if (!searchQuery.trim()) return [];
    return messages.filter((m) =>
      m.text?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [messages, searchQuery]);

  const filteredAvailableFriends = useMemo(() => {
    const queryStr = friendSearchQuery.trim().toLowerCase();
    if (!queryStr) return availableFriends;
    return availableFriends.filter((f) => {
      const name = (f.name || '').toLowerCase();
      const email = (f.email || '').toLowerCase();
      const username = (f.username || '').toLowerCase();
      return name.includes(queryStr) || email.includes(queryStr) || username.includes(queryStr);
    });
  }, [availableFriends, friendSearchQuery]);

  // Actions
  const handleToggleMute = async () => {
    if (!authUser || !chatId) return;
    try {
      const userRef = doc(db, 'users', authUser.uid);
      if (isMuted) {
        await updateDoc(userRef, { mutedConversations: arrayRemove(chatId) });
        setIsMuted(false);
        toast({ title: 'Notifications unmuted' });
      } else {
        await updateDoc(userRef, { mutedConversations: arrayUnion(chatId) });
        setIsMuted(true);
        toast({ title: 'Notifications muted' });
      }
    } catch (e) {
      toast({ title: 'Error', description: 'Failed to update mute state', variant: 'destructive' });
    }
  };

  const handleExportChat = () => {
    if (!chat || messages.length === 0) {
      toast({ title: 'No messages to export' });
      return;
    }
    const exportData = messages.map((m) => ({
      sender: m.senderId,
      text: m.text || '',
      file: m.file ? m.file.name : null,
      timestamp: m.timestamp,
    }));
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `chat-export-${chat.name || chatId}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast({ title: 'Export Complete', description: 'Chat log downloaded.' });
  };

  const handleRemoveMember = async (targetUid: string) => {
    if (!chatId || !chat) return;
    try {
      const chatRef = doc(db, 'conversations', chatId);
      await updateDoc(chatRef, {
        participants: arrayRemove(targetUid),
        participantIds: arrayRemove(targetUid),
      });
      toast({ title: 'Member removed' });
    } catch (e) {
      toast({ title: 'Error', description: 'Could not remove member', variant: 'destructive' });
    }
  };

  const handleLeaveGroup = async () => {
    if (!chatId || !authUser) return;
    try {
      const chatRef = doc(db, 'conversations', chatId);
      await updateDoc(chatRef, {
        participants: arrayRemove(authUser.uid),
        participantIds: arrayRemove(authUser.uid),
      });
      toast({ title: 'Left group successfully' });
      router.push('/');
    } catch (e) {
      toast({ title: 'Error', description: 'Could not leave group', variant: 'destructive' });
    }
  };

  const toggleFriendSelection = (uid: string) => {
    setSelectedFriendIds((prev) =>
      prev.includes(uid) ? prev.filter((id) => id !== uid) : [...prev, uid]
    );
  };

  const handleAddSelectedMembers = async () => {
    if (!chatId || selectedFriendIds.length === 0) return;
    setIsAddingMember(true);
    try {
      const friendsToAdd = availableFriends.filter((f) => selectedFriendIds.includes(f.uid));
      await addGroupMembers(chatId, friendsToAdd);
      toast({
        title: 'Members Added',
        description: `Added ${friendsToAdd.length} member(s) to the group.`,
      });
      setIsAddMemberModalOpen(false);
      setSelectedFriendIds([]);
    } catch (e) {
      console.error('Error adding group members:', e);
      toast({ title: 'Error', description: 'Could not add members', variant: 'destructive' });
    } finally {
      setIsAddingMember(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background text-foreground">
        <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
      </div>
    );
  }

  const isGroup = chat?.type === 'group' || (chat as any)?.isGroup === true;
  const isAdmin = authUser?.uid === chat?.createdBy;

  return (
    <div className="min-h-screen w-full bg-background text-foreground flex flex-col">
      {/* Header Bar */}
      <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-border/60 bg-background/80 px-4 py-3 backdrop-blur-md">
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 rounded-full text-muted-foreground hover:bg-muted hover:text-white"
          onClick={() => router.back()}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-lg font-semibold tracking-tight font-heading">
          {isGroup ? 'Group Info' : 'Contact Info'}
        </h1>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-3xl w-full mx-auto p-4 space-y-6">
        {/* Profile Card */}
        <div className="flex flex-col items-center justify-center p-6 bg-card/60 rounded-2xl border border-border/60 backdrop-blur-sm text-center space-y-3">
          <UserAvatar
            user={{
              name: chat?.name || 'Group',
              photoURL: chat?.avatar || (chat as any)?.avatarUrl || null,
              isGroup: isGroup,
              type: isGroup ? 'group' : 'private',
            }}
            isGroup={isGroup}
            className="w-24 h-24 text-3xl shadow-xl ring-2 ring-violet-500/20"
          />
          <div>
            <h2 className="text-2xl font-bold font-heading text-foreground">{chat?.name}</h2>
            {isGroup ? (
              <p className="text-xs text-muted-foreground mt-1">
                Group · {chat?.participants?.length || 0} members
              </p>
            ) : (
              <p className="text-xs text-muted-foreground mt-1">Direct Message</p>
            )}
            {chat?.description && (
              <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto italic">
                "{chat.description}"
              </p>
            )}
          </div>

          {/* Action Quick Toggles */}
          <div className="flex items-center gap-2 pt-2 flex-wrap justify-center">
            <Button
              variant={isMuted ? 'secondary' : 'outline'}
              size="sm"
              className="rounded-full gap-2 border-border bg-muted/50 hover:bg-muted text-foreground/80"
              onClick={handleToggleMute}
            >
              {isMuted ? <BellOff className="h-4 w-4 text-amber-400" /> : <Bell className="h-4 w-4" />}
              {isMuted ? 'Muted' : 'Mute'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="rounded-full gap-2 border-border bg-muted/50 hover:bg-muted text-foreground/80"
              onClick={() => setIsSearchActive(!isSearchActive)}
            >
              <Search className="h-4 w-4" />
              Search
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="rounded-full gap-2 border-border bg-muted/50 hover:bg-muted text-foreground/80"
              onClick={handleExportChat}
            >
              <Download className="h-4 w-4" />
              Export Chat
            </Button>
          </div>
        </div>

        {/* Search Drawer / Input */}
        {isSearchActive && (
          <div className="p-4 bg-card/80 rounded-xl border border-border/60 space-y-3 animate-in fade-in duration-200">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search messages in this chat..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 bg-background border-border text-foreground focus-visible:ring-violet-500"
              />
            </div>
            {searchQuery.trim() && (
              <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
                {filteredMessages.length > 0 ? (
                  filteredMessages.map((msg) => (
                    <div
                      key={msg.id}
                      className="p-2.5 bg-background/60 rounded-lg border border-border text-xs flex flex-col gap-1"
                    >
                      <span className="font-semibold text-violet-400">
                        {participantsDetails.find((p) => p.uid === msg.senderId)?.name || 'User'}
                      </span>
                      <p className="text-foreground/80">{msg.text}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-muted-foreground text-center py-2">No matching messages found.</p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Media & Shared Files Tabs */}
        <div className="bg-card/60 rounded-2xl border border-border/60 p-4 space-y-4">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Shared Media & Links
          </h3>

          <Tabs defaultValue="photos" className="w-full">
            <TabsList className="w-full bg-background border border-border p-1 rounded-xl grid grid-cols-3">
              <TabsTrigger value="photos" className="data-[state=active]:bg-violet-700 data-[state=active]:text-white rounded-lg text-xs">
                Photos / Videos ({mediaItems.length})
              </TabsTrigger>
              <TabsTrigger value="documents" className="data-[state=active]:bg-violet-700 data-[state=active]:text-white rounded-lg text-xs">
                Documents ({documentItems.length})
              </TabsTrigger>
              <TabsTrigger value="links" className="data-[state=active]:bg-violet-700 data-[state=active]:text-white rounded-lg text-xs">
                Links ({linkItems.length})
              </TabsTrigger>
            </TabsList>

            {/* Photos & Videos Tab */}
            <TabsContent value="photos" className="pt-4">
              {mediaItems.length > 0 ? (
                <div className="grid grid-cols-3 gap-2">
                  {mediaItems.map((item, idx) => (
                    <div
                      key={idx}
                      className="relative aspect-square rounded-lg overflow-hidden bg-background border border-border/80 cursor-pointer group"
                      onClick={() => {
                        setLightboxIndex(idx);
                        setLightboxOpen(true);
                      }}
                    >
                      {item.type.startsWith('image/') ? (
                        <img
                          src={item.url}
                          alt={item.name || 'Media'}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-card text-violet-400">
                          <VideoIcon className="h-8 w-8" />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground text-center py-8">No photos or videos shared yet.</p>
              )}
            </TabsContent>

            {/* Documents Tab */}
            <TabsContent value="documents" className="pt-4 space-y-2">
              {documentItems.length > 0 ? (
                documentItems.map((msg) => (
                  <div
                    key={msg.id}
                    className="flex items-center justify-between p-3 bg-background/80 rounded-xl border border-border hover:border-border transition-colors"
                  >
                    <div className="flex items-center gap-3 overflow-hidden">
                      <div className="p-2.5 bg-violet-950/50 rounded-lg text-violet-400 border border-violet-800/40">
                        <FileText className="h-5 w-5" />
                      </div>
                      <div className="overflow-hidden">
                        <p className="font-medium text-sm text-foreground truncate">
                          {msg.file?.name || 'Document'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {msg.file?.type || 'File'}
                        </p>
                      </div>
                    </div>
                    {msg.file?.url && (
                      <a
                        href={msg.file.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        download
                        className="p-2 text-muted-foreground hover:text-violet-300"
                      >
                        <Download className="h-5 w-5" />
                      </a>
                    )}
                  </div>
                ))
              ) : (
                <p className="text-xs text-muted-foreground text-center py-8">No documents shared yet.</p>
              )}
            </TabsContent>

            {/* Links Tab */}
            <TabsContent value="links" className="pt-4 space-y-2">
              {linkItems.length > 0 ? (
                linkItems.map((link, idx) => (
                  <a
                    key={idx}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between p-3 bg-background/80 rounded-xl border border-border hover:border-border transition-colors"
                  >
                    <div className="overflow-hidden space-y-1">
                      <div className="flex items-center gap-1.5 text-xs text-violet-400 font-medium">
                        <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{link.domain}</span>
                      </div>
                      <p className="text-xs text-muted-foreground truncate max-w-md">{link.url}</p>
                    </div>
                  </a>
                ))
              ) : (
                <p className="text-xs text-muted-foreground text-center py-8">No links shared yet.</p>
              )}
            </TabsContent>
          </Tabs>
        </div>

        {/* Group Member Management Section */}
        {isGroup && (
          <div className="bg-card/60 rounded-2xl border border-border/60 p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                Group Members ({participantsDetails.length})
              </h3>
              {isAdmin && (
                <Button
                  size="sm"
                  className="h-8 rounded-lg bg-violet-700 hover:bg-violet-600 text-white text-xs gap-1.5 shadow-md"
                  onClick={openAddMemberModal}
                >
                  <UserPlus className="h-3.5 w-3.5" />
                  Add Members
                </Button>
              )}
            </div>

            <div className="space-y-3">
              {participantsDetails.map((participant) => {
                const isMemberAdmin = participant.uid === chat?.createdBy;
                const isSelf = participant.uid === authUser?.uid;

                return (
                  <div
                    key={participant.uid}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-background/60 border border-border/40"
                  >
                    <div className="flex items-center gap-3">
                      <UserAvatar user={participant} className="h-10 w-10" />
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-sm text-foreground">{participant.name}</p>
                          {isMemberAdmin && (
                            <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/30 text-[10px] py-0">
                              Admin
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">{participant.email || participant.username}</p>
                      </div>
                    </div>

                    {isAdmin && !isMemberAdmin && !isSelf && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-400 hover:text-red-300 hover:bg-red-950/30 h-8 text-xs"
                        onClick={() => handleRemoveMember(participant.uid)}
                      >
                        <UserX className="h-4 w-4 mr-1" />
                        Remove
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="pt-4 border-t border-border/60 flex justify-end">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm" className="rounded-xl gap-2 text-xs">
                    <LogOut className="h-4 w-4" />
                    Leave Group
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="bg-card border-border text-white">
                  <AlertDialogHeader>
                    <AlertDialogTitle>Leave Group?</AlertDialogTitle>
                    <AlertDialogDescription className="text-muted-foreground">
                      Are you sure you want to leave this group conversation? You will not receive future messages.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel className="bg-muted text-foreground/80 border-none">
                      Cancel
                    </AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleLeaveGroup}
                      className="bg-red-600 hover:bg-red-700 text-white"
                    >
                      Leave Group
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        )}
      </main>

      {/* Multi-Select Friend Picker Modal for Group Addition */}
      <Dialog open={isAddMemberModalOpen} onOpenChange={setIsAddMemberModalOpen}>
        <DialogContent className="sm:max-w-md bg-background text-foreground border-border shadow-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-bold font-heading text-foreground">
              <Users className="h-5 w-5 text-violet-400" />
              Add Group Members
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search friends by name or email..."
                value={friendSearchQuery}
                onChange={(e) => setFriendSearchQuery(e.target.value)}
                className="pl-9 bg-card border-border text-foreground text-sm h-9"
              />
            </div>

            <ScrollArea className="h-64 rounded-xl border border-border/80 bg-card/40 p-2">
              {loadingFriends ? (
                <div className="flex items-center justify-center h-48">
                  <Loader2 className="h-6 w-6 animate-spin text-violet-500" />
                </div>
              ) : availableFriends.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 text-center p-4">
                  <p className="text-sm text-muted-foreground">
                    No eligible friends found. All your friends may already be in this group.
                  </p>
                </div>
              ) : filteredAvailableFriends.length === 0 ? (
                <div className="p-6 text-center text-sm text-muted-foreground">
                  No friends match "{friendSearchQuery}"
                </div>
              ) : (
                <div className="space-y-1">
                  {filteredAvailableFriends.map((friend) => {
                    const isSelected = selectedFriendIds.includes(friend.uid);
                    return (
                      <div
                        key={friend.uid}
                        onClick={() => toggleFriendSelection(friend.uid)}
                        className={`flex items-center gap-3 p-2.5 rounded-lg cursor-pointer transition-colors ${
                          isSelected
                            ? 'bg-violet-950/40 border border-violet-800/50'
                            : 'hover:bg-muted/50 border border-transparent'
                        }`}
                      >
                        <Checkbox
                          id={`friend-${friend.uid}`}
                          checked={isSelected}
                          onCheckedChange={() => toggleFriendSelection(friend.uid)}
                          onClick={(e) => e.stopPropagation()}
                          className="data-[state=checked]:bg-violet-700 data-[state=checked]:border-violet-700 border-zinc-600"
                        />
                        <UserAvatar user={friend} isFriend={true} className="h-9 w-9 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm text-foreground truncate">{friend.name}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {friend.username ? `@${friend.username}` : (friend.email || '')}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="ghost"
              onClick={() => setIsAddMemberModalOpen(false)}
              disabled={isAddingMember}
              className="text-muted-foreground hover:text-foreground hover:bg-muted text-xs"
            >
              Cancel
            </Button>
            <Button
              onClick={handleAddSelectedMembers}
              disabled={selectedFriendIds.length === 0 || isAddingMember}
              className="bg-violet-700 hover:bg-violet-600 text-white font-semibold text-xs shadow-lg disabled:opacity-50"
            >
              {isAddingMember ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Adding...
                </>
              ) : (
                `Add Selected (${selectedFriendIds.length})`
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Full-Screen Media Lightbox Modal */}
      <MediaLightbox
        media={mediaItems}
        initialIndex={lightboxIndex}
        isOpen={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
      />
    </div>
  );
}

