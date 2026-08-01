'use client';
import type { Conversation as ConversationType, User, Message as MessageType } from '@/lib/types';
import { MoreVertical, Phone, Bot, X, Reply, ArrowLeft, Trash2, ArrowDown, Info } from 'lucide-react';
import { geminiService } from '@/lib/gemini-service';
import { Button } from './ui/button';
import { UserAvatar } from './user-avatar';
import { MessageInput } from './message-input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from './ui/dropdown-menu';
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
import React, { useState, useMemo, memo, useCallback, useEffect, useRef, useLayoutEffect } from 'react';
import { cn } from '@/lib/utils';
import { UserProfileSheet } from './user-profile-sheet';
import { SidebarTrigger } from './ui/sidebar';
import { useAppearance } from './providers/appearance-provider';
import Image from 'next/image';
import { ImagePreviewDialog } from './image-preview-dialog';
import { useToast } from '@/hooks/use-toast';
import { GroupProfileSheet } from './group-profile-sheet';
import { useMobileDesign } from './providers/mobile-provider';
import { MessageList } from './message-list';
import { RightPaneBackground } from './right-pane-background';
import { Timestamp } from 'firebase/firestore';
import { useAppShell } from './app-shell';
import { useVoiceChat } from '@/hooks/voice/use-voice-chat';
import { VoiceChat } from '@/components/voice-chat/voice-chat';
import { useMobileKeyboardHeight } from '@/hooks/use-mobile-keyboard-height';
import { useRouter } from 'next/navigation';

const AI_USER_ID = 'gemini-ai-chat-bot-7a4b9c1d-f2e3-4d56-a1b2-c3d4e5f6a7b8';

interface ChatViewProps {
  chat: ConversationType | undefined;
  isAiReplying: boolean;
  currentUser: User | undefined;
  onBack?: () => void;
  messages: MessageType[];
  loadMoreMessages: () => Promise<void>;
  hasMoreMessages: boolean;
  isLoadingMore: boolean;
}

const ChatViewComponent = ({ 
    chat, 
    isAiReplying, 
    currentUser, 
    onBack,
    messages,
    loadMoreMessages,
    hasMoreMessages,
    isLoadingMore
}: ChatViewProps) => {
  const { toast } = useToast();
  const router = useRouter();
  const { viewportHeight } = useMobileKeyboardHeight();
  const [isProfileSheetOpen, setIsProfileSheetOpen] = useState(false);
  const [isVoiceEnabled, setIsVoiceEnabled] = useState(false);
  
  // Chat type flags
  const isAIChat = chat?.id === AI_USER_ID;
  const isGroupChat = chat?.type === 'group';

  const voiceRoomId = useMemo(() => {
    if (!chat?.id) return '';
    return chat.id.startsWith('voice_room_') ? chat.id : `voice_room_${chat.id}`;
  }, [chat?.id]);

  const {
    isConnected: isVoiceConnected,
    isMuted,
    participants: voiceParticipants,
    remoteStreams,
    join: joinVoice,
    leave: leaveVoice,
    toggleMute,
  } = useVoiceChat({
    userId: currentUser?.uid || '',
    roomId: voiceRoomId,
    onError: (error: Error) => {
      console.error('Voice chat hook error:', error);
      toast({
        title: 'Voice Chat Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const [replyToMessage, setReplyToMessage] = useState<MessageType | null>(null);
  const { chatBackground } = useAppearance();
  const { isMobileView } = useMobileDesign();
  const [previewFile, setPreviewFile] = useState<File | null>(null);
  const messageListRef = useRef<HTMLDivElement>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [newMessagesCount, setNewMessagesCount] = useState<number>(0);
  const [optimisticMessages, setOptimisticMessages] = useState<MessageType[]>([]);

  useEffect(() => {
    setOptimisticMessages([]);
  }, [chat?.id]);

  // Deduplicate and merge server messages with local 0ms optimistic messages
  const displayMessages = React.useMemo(() => {
    const combined = [...messages, ...optimisticMessages];
    const uniqueMap = new Map<string, MessageType>();

    for (const msg of combined) {
      const key = msg.clientTempId || msg.id;
      if (uniqueMap.has(key)) {
        const existing = uniqueMap.get(key)!;
        if (existing.status === 'sending' && msg.status !== 'sending') {
          uniqueMap.set(key, msg);
        } else if (existing.id.startsWith('temp-') && !msg.id.startsWith('temp-')) {
          uniqueMap.set(key, msg);
        }
        continue;
      }
      uniqueMap.set(key, msg);
    }

    const result = Array.from(uniqueMap.values());
    result.sort((a, b) => {
      const getM = (ts: any) => {
        if (!ts) return 0;
        if (ts instanceof Date) return ts.getTime();
        if (typeof ts.toMillis === 'function') return ts.toMillis();
        if (typeof ts.seconds === 'number') return ts.seconds * 1000;
        if (typeof ts === 'string') return new Date(ts).getTime() || 0;
        return 0;
      };
      return getM(a.timestamp) - getM(b.timestamp);
    });
    return result;
  }, [messages, optimisticMessages]);

  const prevMessagesLength = useRef(displayMessages.length);

  const {
    usersCache,
    uploadProgress,
    cancelUpload,
    activeSendMessage,
    activeSendFile,
    handleMessageAction,
    handleTyping,
    handleFriendAction,
    handleBlockUser,
    handleMuteToggle,
    handleClearChat,
  } = useAppShell();
  
  const otherParticipant = useMemo(() => {
    if (!chat || !currentUser || chat.type !== 'private') return undefined;
    const otherId = chat.participants?.find(p => p !== currentUser.uid);
    return usersCache.get(otherId || '');
  }, [chat, currentUser, usersCache]);

  const typingUsers = useMemo(() => {
    if (!chat?.typing || !currentUser) return [];
    return chat.typing
      .filter(uid => uid !== currentUser.uid)
      .map(uid => usersCache.get(uid)?.name)
      .filter(Boolean) as string[];
  }, [chat?.typing, currentUser, usersCache]);

  const onReply = useCallback((message: MessageType) => {
    setReplyToMessage(message);
  }, []);

  useEffect(() => {
    if (!chat || !currentUser) return;
    const messageList = messageListRef.current;
    if (messageList) {
        const handleScroll = () => {
            const { scrollTop, scrollHeight, clientHeight } = messageList;
            const atBottom = scrollHeight - scrollTop - clientHeight < 100;
            setIsAtBottom(atBottom);
            if (atBottom) setNewMessagesCount(0);
        };
        messageList.addEventListener('scroll', handleScroll);
        return () => messageList.removeEventListener('scroll', handleScroll);
    }
  }, [chat, currentUser, messageListRef]);

  useLayoutEffect(() => {
    if (!chat || !currentUser) return;
    const newCount = displayMessages.length - prevMessagesLength.current;
    const newMessagesAdded = newCount > 0;

    if (newMessagesAdded && isAtBottom) {
        scrollToBottom();
    } else if (newMessagesAdded && !isAtBottom) {
        setNewMessagesCount(prev => prev + newCount);
    }
    
    prevMessagesLength.current = displayMessages.length;
  }, [displayMessages, isAtBottom, chat, currentUser]);
  
  const handleFileSelect = useCallback(async (file: File) => {
    const isImage = file.type.startsWith("image/");
    try {
      if (isImage) {
        setPreviewFile(file);
      } else {
        await activeSendFile(file, "");
      }
    } catch (error) {
      console.error("Error handling file:", error);
      toast({
        title: "File Error",
        description: "Could not process the selected file.",
        variant: "destructive",
      });
    }
  }, [activeSendFile, toast]);
  
  const handleSendFile = useCallback(async (file: File, message: string) => {
    try {
        await activeSendFile(file, message);
    } catch (error) {
        toast({
            title: "Upload Failed",
            description: "There was a problem sending your file.",
            variant: "destructive",
        });
    }
    setPreviewFile(null);
  }, [activeSendFile, toast]);

  const handleSendMessageWithReply = useCallback((messageText: string) => {
    if (!messageText.trim() || !chat || !currentUser) return;
    
    const messageReply = replyToMessage?.replyTo || (replyToMessage ? {
        messageId: replyToMessage.id,
        messageText: replyToMessage.text || (replyToMessage.file ? 'Attachment' : ''),
        messageSender: usersCache.get(replyToMessage.senderId)?.name || 'Unknown User'
    } : undefined);
    setReplyToMessage(null);

    // 1. Create temporary optimistic message object with id: temp-${Date.now()}, status: 'sending', timestamp: new Date()
    const tempId = `temp-${Date.now()}`;
    const optimisticMsg: MessageType = {
      id: tempId,
      clientTempId: tempId,
      senderId: currentUser.uid,
      text: messageText.trim(),
      timestamp: new Date(),
      status: 'sending',
      ...(messageReply && { replyTo: messageReply }),
    };

    // 2. IMMEDIATELY append to local state (0ms delay)
    setOptimisticMessages((prev) => [...prev, optimisticMsg]);

    // 3. Trigger background Firestore write asynchronously
    activeSendMessage(messageText, messageReply)
      .then((realId) => {
        // 4. On success, gracefully replace optimistic ID with real Firestore ID and update status to 'sent'
        setOptimisticMessages((prev) =>
          prev.map((m) =>
            m.clientTempId === tempId ? { ...m, id: realId || m.id, status: 'sent' } : m
          )
        );
      })
      .catch((e) => {
        console.error('Error sending message:', e);
        // 5. On error, mark optimistic bubble with red retry icon without removing from state
        setOptimisticMessages((prev) =>
          prev.map((m) => (m.clientTempId === tempId ? { ...m, status: 'error' } : m))
        );
        toast({
          title: 'Error Sending Message',
          description: 'Could not send your message. Click retry icon to try again.',
          variant: 'destructive',
        });
      });

    if (messageText.includes('@gemini')) {
      geminiService.processMessage({
        id: crypto.randomUUID(),
        senderId: currentUser.uid,
        text: messageText,
        timestamp: new Date(),
        status: 'sent'
      }, chat.id).then((aiResponse) => {
        if (aiResponse) activeSendMessage(aiResponse);
      }).catch((error) => {
        console.error('AI error:', error);
      });
    }
  }, [chat, currentUser, replyToMessage, usersCache, activeSendMessage, toast]);

  const handleRetryMessage = useCallback((failedMsg: MessageType) => {
    if (!chat || !currentUser) return;
    const targetKey = failedMsg.clientTempId || failedMsg.id;

    setOptimisticMessages((prev) =>
      prev.map((m) => ((m.clientTempId || m.id) === targetKey ? { ...m, status: 'sending' } : m))
    );

    activeSendMessage(failedMsg.text, failedMsg.replyTo)
      .then((realId) => {
        setOptimisticMessages((prev) =>
          prev.map((m) =>
            (m.clientTempId || m.id) === targetKey ? { ...m, id: realId || m.id, status: 'sent' } : m
          )
        );
      })
      .catch((err) => {
        console.error('Error retrying message:', err);
        setOptimisticMessages((prev) =>
          prev.map((m) => ((m.clientTempId || m.id) === targetKey ? { ...m, status: 'error' } : m))
        );
      });
  }, [chat, currentUser, activeSendMessage]);

  const handleSendGif = useCallback((base64: string, fileType: string, fileName: string, caption: string) => {
      activeSendFile(
        new File([Buffer.from(base64.split(',')[1], 'base64')], fileName, { type: fileType }),
        caption
      );
  }, [activeSendFile]);

  const navigateToChatInfo = useCallback(() => {
    if (chat?.id && !isAIChat) {
      router.push(`/chat/${chat.id}/info`);
    } else {
      setIsProfileSheetOpen(true);
    }
  }, [chat?.id, isAIChat, router]);

  const getStatusText = () => {
    if (isAiReplying) return 'typing...';
    if (typingUsers.length > 0) {
      if (typingUsers.length === 1) return `${typingUsers[0]} is typing...`;
      if (typingUsers.length === 2) return `${typingUsers[0]} and ${typingUsers[1]} are typing...`;
      return 'several people are typing...';
    }
    if (isAIChat) return 'Online';
    if (chat?.type === 'group') {
      const uniqueParticipants = new Set(chat.participants ?? []);
      return `${uniqueParticipants.size} members`;
    }
    return otherParticipant?.status;
  };

  const scrollToBottom = (smooth = true) => {
    if (messageListRef.current) {
      // Use rAF to ensure scroll happens after browser paint cycle
      requestAnimationFrame(() => {
        if (messageListRef.current) {
          messageListRef.current.scrollTo({
            top: messageListRef.current.scrollHeight,
            behavior: smooth ? 'smooth' : 'auto',
          });
        }
      });
    }
    setNewMessagesCount(0);
  };

  if (!chat || !currentUser) {
    return (
        <div className="flex h-full flex-1 flex-col items-center justify-center text-muted-foreground bg-transparent">
             <RightPaneBackground />
             <div className="text-center p-8 z-10">
                <h2 className="text-2xl font-bold font-heading">
                    Welcome to{' '}
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-gradient-from to-gradient-to animated-gradient">
                        Vibez
                    </span>
                </h2>
                <p className="mt-2">Select a chat to start messaging</p>
             </div>
        </div>
    );
  }

  const participantForProfile = isAIChat ? usersCache.get(AI_USER_ID) : otherParticipant;
  const displayName = chat.name;
  const displayAvatar = chat.avatar;
  const displayStatus = getStatusText();

  const headerAvatarUser = isGroupChat ? { 
    name: displayName, 
    photoURL: displayAvatar || (chat as any)?.avatarUrl || null,
    isGroup: true,
    type: 'group'
  } : (participantForProfile || { 
    name: displayName, 
    photoURL: displayAvatar || null
  });

  return (
    <div 
      className="h-[100dvh] max-h-[100dvh] flex flex-col overflow-hidden w-full bg-transparent"
      style={viewportHeight ? { height: `${viewportHeight}px` } : undefined}
    >
      {/* Top Header */}
      <header className="flex items-center justify-between border-b border-border/40 bg-background/80 backdrop-blur-md px-3 py-2 sm:px-4 sm:py-3 shrink-0 z-10 w-full">
        <div className="flex items-center gap-3">
            {isMobileView && onBack ? (
              <Button variant="ghost" size="icon" className="h-9 w-9 p-2 rounded-full text-muted-foreground hover:bg-muted/60 shrink-0 select-none" onClick={onBack}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
            ) : (
               <SidebarTrigger className="md:hidden text-muted-foreground hover:text-foreground" />
            )}
          <button 
            className="flex items-center gap-3 text-left hover:opacity-90 transition-opacity"
            onClick={navigateToChatInfo}
          >
            <UserAvatar user={headerAvatarUser} isGroup={isGroupChat} className="h-10 w-10"/>
            <div>
              <p className="font-semibold font-heading text-foreground">{displayName}</p>
              <p className="text-xs text-muted-foreground capitalize flex items-center gap-1">
                  {isAIChat && !isAiReplying && <Bot className="h-3 w-3 text-violet-400" />}
                  {displayStatus}
              </p>
            </div>
          </button>
        </div>

        <div className={cn("flex items-center gap-2", isAIChat && "hidden")}>
          {/* Voice Call Button — Icon Only Control */}
          {!isVoiceConnected && !isAIChat && (
            <Button
              variant="ghost"
              size="icon"
              className="w-9 h-9 rounded-full hover:bg-muted flex items-center justify-center text-muted-foreground"
              onClick={async () => {
                if (!currentUser?.uid || !chat?.id) return;
                try {
                  if (joinVoice) await joinVoice();
                  setIsVoiceEnabled(true);
                  toast({ title: 'Voice Call', description: 'Joined voice call.' });
                } catch (error) {
                  toast({ title: 'Voice Call Error', description: 'Could not connect.', variant: 'destructive' });
                }
              }}
            >
              <Phone className="h-4 w-4" />
              <span className="sr-only">Voice Call</span>
            </Button>
          )}

          {/* 3-dots Menu Button */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="w-9 h-9 rounded-full text-muted-foreground hover:bg-muted flex items-center justify-center">
                    <MoreVertical className="h-5 w-5" />
                    <span className="sr-only">More options</span>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-card border-border text-foreground">
                <DropdownMenuItem onClick={navigateToChatInfo}>
                    <Info className="mr-2 h-4 w-4 text-violet-400" />
                    Chat Info
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setIsProfileSheetOpen(true)}>
                    View Profile Sheet
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-muted" />
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-red-400 focus:text-red-300">
                      <Trash2 className="mr-2 h-4 w-4" />
                      Clear Chat
                    </DropdownMenuItem>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="bg-card border-border text-white">
                    <AlertDialogHeader>
                      <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                      <AlertDialogDescription className="text-muted-foreground">
                        This will permanently delete all messages in this conversation.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel className="bg-muted text-foreground/80 border-none">Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => handleClearChat(chat.id)} className="bg-red-600 text-white">
                        Clear Chat
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* Main Messages View */}
      <div className="flex flex-1 flex-col min-h-0 relative w-full max-w-full">
        <div className="flex-1 min-h-0 relative w-full overflow-hidden">
        {(isVoiceEnabled || isVoiceConnected) && (
          <VoiceChat
            participants={voiceParticipants}
            currentUserId={currentUser.uid}
            remoteStreams={remoteStreams}
            isMuted={isMuted}
            onMuteToggle={toggleMute}
            onLeave={() => {
              leaveVoice();
              setIsVoiceEnabled(false);
            }}
            className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b border-border/40"
          />
        )}
         {chatBackground && (
          <div className="absolute inset-0 opacity-15 pointer-events-none z-0">
             {!chatBackground.startsWith('data:image') ? (
                <Image src={chatBackground} fill style={{objectFit:"cover"}} alt="Chat background" />
            ) : (
                <div style={{ backgroundImage: `url(${chatBackground})`}} className="h-full w-full bg-cover bg-center" />
             )}
          </div>
        )}
      <MessageList 
        messages={displayMessages}
        currentUser={currentUser}
        usersCache={usersCache}
        uploadProgress={uploadProgress}
        onCancelUpload={cancelUpload}
        onMessageAction={handleMessageAction}
        onReply={onReply}
        onRetry={handleRetryMessage}
        isAiReplying={isAiReplying}
        otherParticipantLastRead={chat.otherParticipantLastRead}
        onLoadMore={loadMoreMessages}
        hasMore={hasMoreMessages}
        isLoadingMore={isLoadingMore}
        isLoadingMessages={isLoadingMore}
        ref={messageListRef}
        chatId={chat.id}
        isGroupChat={isGroupChat}
      />
      {/* Floating Scroll to Bottom Button */}
      <div
        className={cn(
          "absolute bottom-4 right-4 z-20 transition-[transform,opacity] duration-200 ease-out will-change-[transform,opacity]",
          !isAtBottom
            ? "opacity-100 translate-y-0 scale-100 pointer-events-auto"
            : "opacity-0 translate-y-2 scale-90 pointer-events-none"
        )}
      >
        <Button
          onClick={() => scrollToBottom(true)}
          size="icon"
          className="h-10 w-10 rounded-full shadow-xl bg-card/90 hover:bg-muted text-violet-400 border border-violet-500/30 backdrop-blur-md active:scale-95 transition-transform relative"
          title="Scroll to bottom"
        >
          <ArrowDown className="h-5 w-5" />
          {newMessagesCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-violet-600 px-1 text-[10px] font-bold text-white shadow-md animate-pulse">
              {newMessagesCount > 9 ? '9+' : newMessagesCount}
            </span>
          )}
        </Button>
      </div>
    </div>

    {/* Quoted Message Reply Banner & Input Container */}
    <div className="flex-none shrink-0 p-3 bg-background/90 backdrop-blur-md border-t border-border/40 z-20 w-full pb-safe">
      {/* Reply Banner - GPU-accelerated with transform instead of max-height to avoid layout thrashing */}
      <div
        className={cn(
          "overflow-hidden transition-[opacity,transform] duration-200 ease-in-out will-change-[transform,opacity]",
          replyToMessage
            ? "opacity-100 translate-y-0 pointer-events-auto mb-2"
            : "opacity-0 -translate-y-1 pointer-events-none h-0"
        )}
      >
        {replyToMessage && (
          <div className="p-2 px-4 bg-card/90 rounded-xl border border-violet-500/30 flex justify-between items-center">
            <div className="flex items-center gap-2 overflow-hidden">
              <Reply className="h-4 w-4 text-violet-400 shrink-0" />
              <div className="text-xs overflow-hidden">
                <p className="font-medium text-violet-400">
                  {replyToMessage.senderId === currentUser.uid ? "Replying to yourself" : usersCache.get(replyToMessage.senderId)?.name || "Replying to message"}
                </p>
                <p className="text-muted-foreground truncate max-w-xs">{replyToMessage.text || 'Attachment'}</p>
              </div>
            </div>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-white" onClick={() => setReplyToMessage(null)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
      <MessageInput
        onSendMessage={handleSendMessageWithReply}
        onFileSelect={handleFileSelect}
        onGifSelect={handleSendGif}
        onTyping={handleTyping}
        isAiChat={isAIChat}
      />
    </div>
  </div>
      
      {isGroupChat ? (
          <GroupProfileSheet 
            chat={chat}
            currentUser={currentUser}
            isOpen={isProfileSheetOpen}
            onOpenChange={setIsProfileSheetOpen}
            usersCache={usersCache}
          />
      ) : participantForProfile ? (
        <UserProfileSheet
          user={participantForProfile}
          currentUser={currentUser}
          chatId={chat.id}
          isOpen={isProfileSheetOpen}
          onOpenChange={setIsProfileSheetOpen}
          onFriendAction={handleFriendAction}
          onBlockUser={handleBlockUser}
          onMuteToggle={handleMuteToggle}
        />
      ) : null}

      {previewFile && (
        <ImagePreviewDialog
            file={previewFile}
            onSend={handleSendFile}
            onCancel={() => setPreviewFile(null)}
            mode="chat"
        />
      )}
    </div>
  );
};

export const ChatView = memo(ChatViewComponent);
