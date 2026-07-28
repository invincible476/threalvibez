
'use client';

import { Message, User } from '@/lib/types';
import { cn } from '@/lib/utils';
import { UserAvatar } from './user-avatar';
import { Check, CheckCheck, Clock, File as FileIcon, Download, Image as ImageIcon, Smile, MoreHorizontal, Reply, Trash2, Video, Volume2 } from 'lucide-react';
import { Timestamp } from 'firebase/firestore';
import Image from 'next/image';
import { motion, PanInfo } from 'framer-motion';
import { UploadProgress } from './upload-progress';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Button } from './ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from './ui/dropdown-menu';
import { memo } from 'react';
import React from 'react';
import { formatText } from '@/lib/format-text';

interface MessageBubbleProps {
  message: Message;
  sender?: User;
  isCurrentUser: boolean;
  progress?: number;
  onCancelUpload: () => void;
  onMessageAction: (messageId: string, action: 'react' | 'delete', data?: any) => void;
  onReply: (message: Message) => void;
  isRead: boolean;
}

const isImage = (fileType: string) => fileType.startsWith('image/');
const isAudio = (fileType: string) => fileType.startsWith('audio/');
const isVideo = (fileType: string) => fileType.startsWith('video/');

const defaultEmojis = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

const messageVariants = {
    initial: { opacity: 0, y: 10, scale: 0.95 },
    animate: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.2, ease: [0.25, 1, 0.5, 1] } },
};

import { getPerformanceConfig } from '@/utils/performance';

const { imageQuality } = getPerformanceConfig();

function MessageBubble({ message, sender, isCurrentUser, progress, onCancelUpload, onMessageAction, onReply, isRead }: MessageBubbleProps) {
    // Optimize image quality based on device capabilities
    const getOptimizedImageUrl = (url: string) => {
        if (imageQuality === 'low') {
            return url.replace('/upload/', '/upload/q_auto,f_auto,w_600/');
        }
        return url.replace('/upload/', '/upload/q_auto,f_auto/');
    };
  if (!sender) {
    return (
        <div className={cn('group flex w-full items-start gap-3', isCurrentUser && 'flex-row-reverse')}>
            <div className="h-8 w-8 rounded-full bg-muted animate-pulse" />
            <div className={cn('relative flex max-w-[70%] flex-col rounded-xl px-4 py-2', isCurrentUser ? 'rounded-tr-none bg-primary text-primary-foreground' : 'rounded-tl-none bg-card')}>
                <p className="text-base">{message.text}</p>
            </div>
        </div>
    );
  }
  
  const getReadReceiptIcon = () => {
    if (message.status === 'sending') return <Clock className="h-4 w-4 text-primary-foreground/70" />;
    if (isRead) return <CheckCheck className="h-4 w-4 text-blue-400" />;
    if (message.status === 'sent' || message.status === 'delivered' || message.status === 'read') return <CheckCheck className="h-4 w-4 text-primary-foreground/70" />;
    return <Check className="h-4 w-4 text-primary-foreground/70" />;
  }


  const getFormattedTimestamp = (timestamp: any) => {
    if (!timestamp) return '';
    
    let date: Date;
    if (timestamp instanceof Timestamp) {
        date = timestamp.toDate();
    } else if (timestamp instanceof Date) {
        date = timestamp;
    } else if (typeof timestamp === 'string') {
        date = new Date(timestamp);
    } else if (timestamp?.seconds) {
        date = new Date(timestamp.seconds * 1000);
    } else {
        return "Sending..."
    }

    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };
  
  const formattedTimestamp = getFormattedTimestamp(message.timestamp);
  
  const renderMessageContent = () => {
     if (message.deleted) {
        return <p className="text-base italic text-muted-foreground">This message was deleted.</p>;
     }
    if (message.file) {
      const isSending = message.status === 'sending';
      const fileContent = (() => {
        if (isImage(message.file.type)) {
            const imageUrl = message.file.url;
            const isGif = message.file.type === 'image/gif';
            if (!imageUrl) {
                return (
                    <div className="w-[250px] h-[250px] bg-muted rounded-lg flex items-center justify-center">
                        <ImageIcon className="w-10 h-10 text-muted-foreground" />
                    </div>
                );
            }
            return (
                <a href={imageUrl} target="_blank" rel="noopener noreferrer">
                    <Image
                        key={message.id}
                        src={imageUrl}
                        alt={message.file.name}
                        width={250}
                        height={250}
                        className={cn(
                        "rounded-lg object-cover max-w-full",
                        isSending && 'opacity-60'
                        )}
                        unoptimized={isGif}
                    />
                </a>
            )
        }
        if (isAudio(message.file.type)) {
            return (
                message.file.url ? <audio controls src={message.file.url} className={cn("w-full max-w-xs", isSending && 'opacity-60')} /> : null
            )
        }
        if (isVideo(message.file.type)) {
            return (
                message.file.url ? <video controls src={message.file.url} className={cn("w-full max-w-xs rounded-lg", isSending && 'opacity-60')} /> : null
            )
        }
        return (
            <a 
            href={message.file.url} 
            target="_blank" 
            rel="noopener noreferrer" 
            className="flex items-center gap-3 bg-muted/50 p-3 rounded-lg hover:bg-muted"
            >
            <FileIcon className="h-8 w-8 text-muted-foreground" />
            <div className="flex-1 overflow-hidden">
                <p className="font-medium truncate">{message.file.name}</p>
                <p className="text-sm text-muted-foreground">Click to download</p>
            </div>
            <Download className="h-5 w-5 text-muted-foreground" />
            </a>
        )
      })();
      
      return (
        <div className="relative">
          {fileContent}
          {isSending && (
            <UploadProgress progress={progress} onCancel={onCancelUpload} />
          )}
        </div>
      );
    }
    return null;
  }
  
  const hasContent = message.text || message.file;

  const handleDragEnd = (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    const swipeThreshold = 50;
    if (info.offset.x > swipeThreshold && !isCurrentUser) {
      onReply(message);
    }
    if (info.offset.x < -swipeThreshold && isCurrentUser) {
      onReply(message);
    }
  };

  const MessageActions = () => (
    <div className={cn(
        "absolute top-0 -translate-y-1/2 flex items-center bg-background border rounded-full p-0.5 shadow-md transition-opacity duration-200 opacity-0 group-hover:opacity-100",
        isCurrentUser ? 'right-2' : 'left-2'
    )}>
        <Popover>
            <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full">
                    <Smile className="h-4 w-4" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="p-1 w-auto">
                <div className="flex gap-1">
                    {defaultEmojis.map(emoji => (
                        <Button
                            key={emoji}
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-xl rounded-full"
                            onClick={() => onMessageAction(message.id, 'react', emoji)}
                        >
                            {emoji}
                        </Button>
                    ))}
                </div>
            </PopoverContent>
        </Popover>
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full">
                    <MoreHorizontal className="h-4 w-4" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
                <DropdownMenuItem onClick={() => onReply(message)}>
                    <Reply className="mr-2 h-4 w-4" />
                    <span>Reply</span>
                </DropdownMenuItem>
                {isCurrentUser && (
                  <DropdownMenuItem
                    className="text-destructive"
                    onClick={() => onMessageAction(message.id, 'delete')}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    <span>Delete</span>
                  </DropdownMenuItem>
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    </div>
  );

  return (
    <motion.div
      variants={messageVariants}
      initial="initial"
      animate="animate"
      layout
      className={cn(
        'group flex w-full items-start gap-2.5 relative my-0.5',
        isCurrentUser && 'flex-row-reverse',
        message.isAiMessage && 'flex-row bg-transparent'
      )}
      // Swipe to reply gesture
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      onDragEnd={handleDragEnd}
      dragElastic={{ right: isCurrentUser ? 0 : 0.1, left: isCurrentUser ? 0.1 : 0 }}
      style={{ x: 0 }}
    >
      <UserAvatar user={sender} className="h-7 w-7 sm:h-8 sm:w-8 flex-shrink-0 mt-0.5" />
      <div
        className={cn(
          'relative flex max-w-[82%] sm:max-w-[70%] flex-col shadow-sm transition-all overflow-hidden',
          message.isAiMessage
            ? 'rounded-2xl rounded-tl-xs bg-green-500/10 text-foreground border border-green-500/30 backdrop-blur-md'
            : isCurrentUser
              ? 'rounded-2xl rounded-tr-xs bg-gradient-to-br from-primary via-primary/90 to-accent text-primary-foreground'
              : 'rounded-2xl rounded-tl-xs bg-card/90 border border-border/50 text-foreground backdrop-blur-md',
          (message.file && !message.text) ? 'p-1.5' : 'px-3.5 py-2 sm:px-4 sm:py-2.5'
        )}
      >
        {!isCurrentUser && (
            <p className="text-[12px] font-semibold text-primary/90 mb-0.5 px-0.5 tracking-tight">{sender.name}</p>
        )}
        
        {message.replyTo && (
          <div className={cn(
            "p-2 mb-1.5 bg-black/20 rounded-lg text-xs border-l-2 border-primary",
            message.replyTo.storyMedia && "flex items-center gap-2"
          )}>
                {message.replyTo.storyMedia && (
                    <Image src={message.replyTo.storyMedia} alt="Story reply" width={36} height={36} className="rounded-md object-cover h-9 w-9" />
                )}
                <div className="overflow-hidden">
                  <p className="font-semibold truncate">{message.replyTo.messageSender}</p>
                  <p className="text-white/80 line-clamp-1 truncate">{message.replyTo.messageText}</p>
                </div>
          </div>
        )}

        {renderMessageContent()}
        
        {message.text && (
          <p className={cn(
            "text-[14.5px] sm:text-base leading-relaxed whitespace-pre-wrap break-words chat-list-force-break",
            (message.file) ? "mt-1.5 px-1 pb-0.5" : "",
            message.deleted && "italic text-muted-foreground"
          )}>
            {formatText(message.text)}
          </p>
        )}

        {message.reactions && message.reactions.length > 0 && (
            <div className={cn(
                "absolute -bottom-3 flex gap-1 z-10",
                isCurrentUser ? 'left-2' : 'right-2'
            )}>
                {message.reactions.map(r => (
                    <div key={r.emoji} className="flex items-center bg-background/90 backdrop-blur-md border rounded-full px-2 py-0.5 text-[11px] shadow-sm">
                        <span>{r.emoji}</span>
                        <span className="ml-1 font-semibold">{r.count}</span>
                    </div>
                ))}
            </div>
        )}
        
        {hasContent && !message.deleted && <MessageActions />}

        <div className="mt-0.5 flex items-center justify-end gap-1 self-end px-0.5 text-[11px] opacity-80">
          <span className={cn(isCurrentUser ? 'text-primary-foreground/80' : 'text-muted-foreground')}>
            {formattedTimestamp}
          </span>
          {isCurrentUser && getReadReceiptIcon()}
        </div>
      </div>
    </motion.div>
  );
}

const MemoizedMessageBubble = memo(MessageBubble);
export { MemoizedMessageBubble as MessageBubble };
