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

  // Add Member Modal State
  const [addMemberInput, setAddMemberInput] = useState('');
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
      });
      toast({ title: 'Left group successfully' });
      router.push('/');
    } catch (e) {
      toast({ title: 'Error', description: 'Could not leave group', variant: 'destructive' });
    }
  };

  const handleAddMember = async () => {
    if (!addMemberInput.trim() || !chatId) return;
    setIsAddingMember(true);
    try {
      const chatRef = doc(db, 'conversations', chatId);
      await updateDoc(chatRef, {
        participants: arrayUnion(addMemberInput.trim()),
      });
      toast({ title: 'Member added successfully' });
      setAddMemberInput('');
    } catch (e) {
      toast({ title: 'Error', description: 'Could not add member', variant: 'destructive' });
    } finally {
      setIsAddingMember(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-zinc-950 text-white">
        <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
      </div>
    );
  }

  const isGroup = chat?.type === 'group';
  const isAdmin = authUser?.uid === chat?.createdBy;

  return (
    <div className="min-h-screen w-full bg-zinc-950 text-zinc-100 flex flex-col">
      {/* Header Bar */}
      <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-zinc-800/60 bg-zinc-950/80 px-4 py-3 backdrop-blur-md">
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 rounded-full text-zinc-300 hover:bg-zinc-800 hover:text-white"
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
        <div className="flex flex-col items-center justify-center p-6 bg-zinc-900/60 rounded-2xl border border-zinc-800/60 backdrop-blur-sm text-center space-y-3">
          <UserAvatar
            user={{ name: chat?.name || 'Chat', photoURL: chat?.avatar || '' }}
            className="w-24 h-24 text-3xl shadow-xl ring-2 ring-violet-500/20"
          />
          <div>
            <h2 className="text-2xl font-bold font-heading text-zinc-100">{chat?.name}</h2>
            {isGroup ? (
              <p className="text-xs text-zinc-400 mt-1">
                Group · {chat?.participants?.length || 0} members
              </p>
            ) : (
              <p className="text-xs text-zinc-400 mt-1">Direct Message</p>
            )}
            {chat?.description && (
              <p className="text-sm text-zinc-300 mt-2 max-w-md mx-auto italic">
                "{chat.description}"
              </p>
            )}
          </div>

          {/* Action Quick Toggles */}
          <div className="flex items-center gap-2 pt-2 flex-wrap justify-center">
            <Button
              variant={isMuted ? 'secondary' : 'outline'}
              size="sm"
              className="rounded-full gap-2 border-zinc-800 bg-zinc-800/50 hover:bg-zinc-800 text-zinc-200"
              onClick={handleToggleMute}
            >
              {isMuted ? <BellOff className="h-4 w-4 text-amber-400" /> : <Bell className="h-4 w-4" />}
              {isMuted ? 'Muted' : 'Mute'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="rounded-full gap-2 border-zinc-800 bg-zinc-800/50 hover:bg-zinc-800 text-zinc-200"
              onClick={() => setIsSearchActive(!isSearchActive)}
            >
              <Search className="h-4 w-4" />
              Search
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="rounded-full gap-2 border-zinc-800 bg-zinc-800/50 hover:bg-zinc-800 text-zinc-200"
              onClick={handleExportChat}
            >
              <Download className="h-4 w-4" />
              Export Chat
            </Button>
          </div>
        </div>

        {/* Search Drawer / Input */}
        {isSearchActive && (
          <div className="p-4 bg-zinc-900/80 rounded-xl border border-zinc-800/60 space-y-3 animate-in fade-in duration-200">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
              <Input
                placeholder="Search messages in this chat..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 bg-zinc-950 border-zinc-800 text-white focus-visible:ring-violet-500"
              />
            </div>
            {searchQuery.trim() && (
              <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
                {filteredMessages.length > 0 ? (
                  filteredMessages.map((msg) => (
                    <div
                      key={msg.id}
                      className="p-2.5 bg-zinc-950/60 rounded-lg border border-zinc-800 text-xs flex flex-col gap-1"
                    >
                      <span className="font-semibold text-violet-400">
                        {participantsDetails.find((p) => p.uid === msg.senderId)?.name || 'User'}
                      </span>
                      <p className="text-zinc-200">{msg.text}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-zinc-500 text-center py-2">No matching messages found.</p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Media & Shared Files Tabs */}
        <div className="bg-zinc-900/60 rounded-2xl border border-zinc-800/60 p-4 space-y-4">
          <h3 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider">
            Shared Media & Links
          </h3>

          <Tabs defaultValue="photos" className="w-full">
            <TabsList className="w-full bg-zinc-950 border border-zinc-800 p-1 rounded-xl grid grid-cols-3">
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
                      className="relative aspect-square rounded-lg overflow-hidden bg-zinc-950 border border-zinc-800/80 cursor-pointer group"
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
                        <div className="w-full h-full flex items-center justify-center bg-zinc-900 text-violet-400">
                          <VideoIcon className="h-8 w-8" />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-zinc-500 text-center py-8">No photos or videos shared yet.</p>
              )}
            </TabsContent>

            {/* Documents Tab */}
            <TabsContent value="documents" className="pt-4 space-y-2">
              {documentItems.length > 0 ? (
                documentItems.map((msg) => (
                  <div
                    key={msg.id}
                    className="flex items-center justify-between p-3 bg-zinc-950/80 rounded-xl border border-zinc-800 hover:border-zinc-700 transition-colors"
                  >
                    <div className="flex items-center gap-3 overflow-hidden">
                      <div className="p-2.5 bg-violet-950/50 rounded-lg text-violet-400 border border-violet-800/40">
                        <FileText className="h-5 w-5" />
                      </div>
                      <div className="overflow-hidden">
                        <p className="font-medium text-sm text-zinc-100 truncate">
                          {msg.file?.name || 'Document'}
                        </p>
                        <p className="text-xs text-zinc-500">
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
                        className="p-2 text-zinc-400 hover:text-violet-300"
                      >
                        <Download className="h-5 w-5" />
                      </a>
                    )}
                  </div>
                ))
              ) : (
                <p className="text-xs text-zinc-500 text-center py-8">No documents shared yet.</p>
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
                    className="flex items-center justify-between p-3 bg-zinc-950/80 rounded-xl border border-zinc-800 hover:border-zinc-700 transition-colors"
                  >
                    <div className="overflow-hidden space-y-1">
                      <div className="flex items-center gap-1.5 text-xs text-violet-400 font-medium">
                        <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{link.domain}</span>
                      </div>
                      <p className="text-xs text-zinc-300 truncate max-w-md">{link.url}</p>
                    </div>
                  </a>
                ))
              ) : (
                <p className="text-xs text-zinc-500 text-center py-8">No links shared yet.</p>
              )}
            </TabsContent>
          </Tabs>
        </div>

        {/* Group Member Management Section */}
        {isGroup && (
          <div className="bg-zinc-900/60 rounded-2xl border border-zinc-800/60 p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider">
                Group Members ({participantsDetails.length})
              </h3>
              {isAdmin && (
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="User UID to add..."
                    value={addMemberInput}
                    onChange={(e) => setAddMemberInput(e.target.value)}
                    className="h-8 text-xs bg-zinc-950 border-zinc-800 text-white w-40"
                  />
                  <Button
                    size="sm"
                    className="h-8 rounded-lg bg-violet-700 hover:bg-violet-600 text-white text-xs gap-1"
                    onClick={handleAddMember}
                    disabled={isAddingMember}
                  >
                    <UserPlus className="h-3.5 w-3.5" />
                    Add
                  </Button>
                </div>
              )}
            </div>

            <div className="space-y-3">
              {participantsDetails.map((participant) => {
                const isMemberAdmin = participant.uid === chat?.createdBy;
                const isSelf = participant.uid === authUser?.uid;

                return (
                  <div
                    key={participant.uid}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-950/60 border border-zinc-800/40"
                  >
                    <div className="flex items-center gap-3">
                      <UserAvatar user={participant} className="h-10 w-10" />
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-sm text-zinc-100">{participant.name}</p>
                          {isMemberAdmin && (
                            <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/30 text-[10px] py-0">
                              Admin
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-zinc-400">{participant.email || participant.username}</p>
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

            <div className="pt-4 border-t border-zinc-800/60 flex justify-end">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm" className="rounded-xl gap-2 text-xs">
                    <LogOut className="h-4 w-4" />
                    Leave Group
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="bg-zinc-900 border-zinc-800 text-white">
                  <AlertDialogHeader>
                    <AlertDialogTitle>Leave Group?</AlertDialogTitle>
                    <AlertDialogDescription className="text-zinc-400">
                      Are you sure you want to leave this group conversation? You will not receive future messages.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel className="bg-zinc-800 text-zinc-200 border-none">
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
