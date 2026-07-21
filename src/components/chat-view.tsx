
'use client';
import type { Conversation as ConversationType, User, Message as MessageType } from '@/lib/types';
import { MoreVertical, Phone, Video, Bot, X, Reply, ArrowLeft, Trash2, ArrowDown } from 'lucide-react';
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
  const [isProfileSheetOpen, setIsProfileSheetOpen] = useState(false);
  const [isVoiceEnabled, setIsVoiceEnabled] = useState(false);
  
  // Chat type flags
  const isAIChat = chat?.id === AI_USER_ID;
  const isGroupChat = chat?.type === 'group';

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
    roomId: chat?.id || '',
    onError: (error: Error) => {
      console.error('Voice chat hook error:', error);
      toast({
        title: 'Voice Chat Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Debug check for voice chat initialization
  useEffect(() => {
    if (chat && currentUser && !isAIChat) {
      console.log('Voice chat availability:', {
        chatId: chat.id,
        userId: currentUser.uid,
        isVoiceConnected,
        hookInitialized: Boolean(joinVoice)
      });
    }
  }, [chat, currentUser, isAIChat, isVoiceConnected, joinVoice]);
  const [replyToMessage, setReplyToMessage] = useState<MessageType | null>(null);
  const { chatBackground } = useAppearance();
  const { isMobileView } = useMobileDesign();
  const [previewFile, setPreviewFile] = useState<File | null>(null);
  const messageListRef = useRef<HTMLDivElement>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [newMessagesCount, setNewMessagesCount] = useState(0);
  const prevMessagesLength = useRef(messages.length);

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
    const otherId = chat.participants.find(p => p !== currentUser.uid);
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
    if (!chat || !currentUser) {
      return;
    }
    const messageList = messageListRef.current;
    if (messageList) {
        const handleScroll = () => {
            const { scrollTop, scrollHeight, clientHeight } = messageList;
            const atBottom = scrollHeight - scrollTop - clientHeight < 100;
            setIsAtBottom(atBottom);
            if (atBottom) {
                setNewMessagesCount(0);
            }
        };
        messageList.addEventListener('scroll', handleScroll);
        return () => messageList.removeEventListener('scroll', handleScroll);
    }
  }, [chat, currentUser, messageListRef]);


  useLayoutEffect(() => {
    if (!chat || !currentUser) {
      return;
    }
    const newMessagesAdded = messages.length > prevMessagesLength.current;

    if (newMessagesAdded && isAtBottom) {
        scrollToBottom();
    } else if (newMessagesAdded && !isAtBottom) {
        setNewMessagesCount(prev => prev + 1);
    }
    
    prevMessagesLength.current = messages.length;
}, [messages, isAtBottom, chat, currentUser]);
  
  const handleFileSelect = async (file: File) => {
    const isImage = file.type.startsWith("image/");
    const isVideo = file.type.startsWith("video/");
  
    try {
      if (isImage) {
        setPreviewFile(file);
      } else if (isVideo) {
        // Send video directly to Cloudinary flow
        await activeSendFile(file, "");
      } else {
        // Other files like audio, docs etc.
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
  };
  
  const handleSendFile = async (file: File, message: string) => {
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
  };


  const handleSendMessageWithReply = async (messageText: string) => {
    if (!messageText.trim() || !chat) return;
    
    try {
        // Send the user's message
        const messageReply = replyToMessage?.replyTo || (replyToMessage ? {
            messageId: replyToMessage.id,
            messageText: replyToMessage.text || (replyToMessage.file ? 'Attachment' : ''),
            messageSender: usersCache.get(replyToMessage.senderId)?.name || 'Unknown User'
        } : undefined);
        await activeSendMessage(messageText, messageReply);
        setReplyToMessage(null); // Clear reply state after sending

        // Check if the message mentions @gemini and process it
        if (messageText.includes('@gemini')) {
            try {
                const aiResponse = await geminiService.processMessage({
                    id: crypto.randomUUID(),
                    senderId: currentUser?.uid || '',
                    text: messageText,
                    timestamp: new Date(),
                    status: 'sent'
                }, chat.id);
                
                if (aiResponse) {
                    // AI responses are handled directly by AppShell's AI conversation flow
                    await activeSendMessage(aiResponse);
                }
            } catch (error) {
                toast({
                    title: 'AI Response Error',
                    description: 'Could not get a response from Gemini. Please try again.',
                    variant: 'destructive',
                });
            }
        }
    } catch (e) {
      toast({
          title: 'Error Sending Message',
          description: 'Could not send your message. Please try again.',
          variant: 'destructive',
      });
    }
  };

  const handleSendGif = (base64: string, fileType: string, fileName: string, caption: string) => {
      activeSendFile(
        new File([Buffer.from(base64.split(',')[1], 'base64')], fileName, { type: fileType }),
        caption
      );
  }


  const getStatusText = () => {
    if (isAiReplying) return 'typing...';
    if (typingUsers.length > 0) {
      if (typingUsers.length === 1) {
        return `${typingUsers[0]} is typing...`;
      }
      if (typingUsers.length === 2) {
        return `${typingUsers[0]} and ${typingUsers[1]} are typing...`;
      }
      return 'several people are typing...';
    }
    if (isAIChat) return 'Online';
    if (chat?.type === 'group') {
      const uniqueParticipants = new Set(chat.participants);
      return `${uniqueParticipants.size} members`;
    }
    return otherParticipant?.status;
  };

  const scrollToBottom = () => {
    if (messageListRef.current) {
        requestAnimationFrame(() => {
            if (messageListRef.current) {
                messageListRef.current.scrollTop = messageListRef.current.scrollHeight;
            }
        });
    }
    setNewMessagesCount(0);
  }

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
    )
  }
  
  // Chat type flags are now declared at the top of the component
  
  // Debug logging for voice chat state
  console.log('Voice Chat State:', {
    isVoiceConnected,
    isAIChat,
    chatType: chat.type,
    userId: currentUser.uid,
    chatId: chat.id
  });

  const participantForProfile = isAIChat ? usersCache.get(AI_USER_ID) : otherParticipant;

  const displayName = chat.name;
  const displayAvatar = chat.avatar;
  const displayStatus = getStatusText();

  const headerAvatarUser = isGroupChat ? { 
    name: displayName, 
    photoURL: displayAvatar 
  } : (participantForProfile || { 
    name: displayName, 
    photoURL: displayAvatar 
  });


  return (
    <div className="flex h-full w-full flex-col bg-transparent overflow-hidden">
      <header className="flex items-center justify-between border-b border-border/50 bg-card/80 backdrop-blur-xl px-3 py-2 sm:px-4 sm:py-3 shrink-0 z-10 w-full">
        <div className="flex items-center gap-3">
            {isMobileView && onBack ? (
              <Button variant="ghost" size="icon" className="h-10 w-10" onClick={onBack}>
                <ArrowLeft className="h-6 w-6" />
              </Button>
            ) : (
               <SidebarTrigger className="md:hidden" />
            )}
          <button 
            className="flex items-center gap-3 text-left disabled:cursor-default"
            onClick={() => setIsProfileSheetOpen(true)}
            disabled={!participantForProfile && !isGroupChat}
          >
            <UserAvatar user={headerAvatarUser} className="h-10 w-10"/>
            <div>
              <p className="font-semibold font-heading">{displayName}</p>
              <p className="text-sm text-muted-foreground capitalize flex items-center gap-1">
                  {isAIChat && !isAiReplying && <Bot className="h-3 w-3" />}
                  {displayStatus}
              </p>
            </div>
          </button>
        </div>
        <div className={cn("flex items-center gap-2", isAIChat && "hidden")}>
          {/* Voice Chat Buttons */}
          {!isVoiceConnected && !isAIChat && (
            <>
              {/* Voice Call Button */}
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={async () => {
                  console.log('Voice call button clicked', {
                    currentUser,
                    chatId: chat?.id,
                    isVoiceConnected,
                    joinVoiceFunction: Boolean(joinVoice)
                  });

                  if (!currentUser?.uid || !chat?.id) {
                    console.error('Missing required data:', { userId: currentUser?.uid, chatId: chat?.id });
                    toast({
                      title: 'Voice Chat Error',
                      description: 'Cannot start voice chat: missing user or chat information.',
                      variant: 'destructive',
                    });
                    return;
                  }

                  try {
                    console.log('Attempting to join voice chat:', { 
                      userId: currentUser.uid, 
                      roomId: chat.id,
                      chatType: chat.type 
                    });

                    if (!joinVoice) {
                      throw new Error('Voice chat join function not initialized');
                    }

                    await joinVoice();
                    console.log('Join voice call successful');
                    setIsVoiceEnabled(true);
                    toast({
                      title: 'Voice Chat',
                      description: 'Joined voice chat successfully.',
                    });
                  } catch (error) {
                    console.error('Voice chat join error:', error);
                    toast({
                      title: 'Voice Chat Error',
                      description: error instanceof Error 
                        ? error.message 
                        : 'Could not join voice chat. Please check your microphone permissions.',
                      variant: 'destructive',
                    });
                  }
                }}
              >
                <Phone className="h-4 w-4" />
                {chat.type === 'private' ? 'Voice Call' : 'Join Voice'}
              </Button>
            </>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                    <MoreVertical className="h-5 w-5" />
                    <span className="sr-only">More options</span>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setIsProfileSheetOpen(true)}>
                    View Profile
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <DropdownMenuItem
                      onSelect={(e) => e.preventDefault()}
                      className="text-destructive"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Clear Chat
                    </DropdownMenuItem>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will permanently delete all messages in this conversation. This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => handleClearChat(chat.id)}
                        className="bg-destructive hover:bg-destructive/90"
                      >
                        Clear Chat
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* FIXED THIS WRAPPER: Changed h-full to flex-1 and added relative */}
      <div className="flex flex-1 flex-col min-h-0 relative w-full max-w-full">
        <div className="flex-1 min-h-0 overflow-y-auto relative w-full">
        {(isVoiceEnabled || isVoiceConnected) && (
          <VoiceChat
            participants={voiceParticipants}
            currentUserId={currentUser.uid}
            remoteStreams={remoteStreams}
            isMuted={isMuted}
            onMuteToggle={toggleMute}
            onLeave={() => {
              console.log('Leaving voice chat');
              leaveVoice();
              setIsVoiceEnabled(false);
            }}
            className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b border-border/50"
          />
        )}
         {chatBackground && (
          <div className="absolute inset-0 opacity-20 dark:opacity-10">
             {chatBackground && !chatBackground.startsWith('data:image') && (
                <Image 
                    src={chatBackground}
                    fill
                    style={{objectFit:"cover"}}
                    alt="Chat background"
                />
            )}
             {chatBackground && chatBackground.startsWith('data:image') && (
                <div style={{ backgroundImage: `url(${chatBackground})`}} className="h-full w-full bg-cover bg-center" />
             )}
          </div>
        )}
      <MessageList 
        messages={messages}
        currentUser={currentUser}
        usersCache={usersCache}
        uploadProgress={uploadProgress}
        onCancelUpload={cancelUpload}
        onMessageAction={handleMessageAction}
        onReply={onReply}
        isAiReplying={isAiReplying}
        otherParticipantLastRead={chat.otherParticipantLastRead}
        onLoadMore={loadMoreMessages}
        hasMore={hasMoreMessages}
        isLoadingMore={isLoadingMore}
        ref={messageListRef}
        chatId={chat.id}
      />
      {newMessagesCount > 0 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20">
          <Button onClick={scrollToBottom} className="rounded-full shadow-lg">
            <ArrowDown className="mr-2 h-4 w-4"/>
            {newMessagesCount} New Message{newMessagesCount > 1 && 's'}
          </Button>
        </div>
      )}
    </div>
    <div className="sticky bottom-0 left-0 right-0 w-full bg-background z-10 px-2 sm:px-4 pb-safe">
      {replyToMessage && (
        <div className="p-2 px-4 border-t border-border/50 bg-background/50 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Reply className="h-4 w-4 text-muted-foreground" />
            <div className="text-sm">
              <p className="font-semibold">{replyToMessage.senderId === currentUser.uid ? "You" : usersCache.get(replyToMessage.senderId)?.name}</p>
              <p className="text-muted-foreground truncate max-w-xs">{replyToMessage.text}</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setReplyToMessage(null)}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}
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
