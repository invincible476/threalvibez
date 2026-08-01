'use client';

import { Message, User } from '@/lib/types';
import { cn } from '@/lib/utils';
import { UserAvatar } from './user-avatar';
import {
  Check,
  CheckCheck,
  Clock,
  File as FileIcon,
  Download,
  Image as ImageIcon,
  Reply,
  Trash2,
  Edit,
  Pin,
  Copy,
  MoreHorizontal,
  AlertCircle,
} from 'lucide-react';
import { Timestamp } from 'firebase/firestore';
import Image from 'next/image';
import { motion, PanInfo } from 'framer-motion';
import { UploadProgress } from './upload-progress';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Button } from './ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
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
import React, { memo, useState, useRef } from 'react';
import { formatText } from '@/lib/format-text';
import { useToast } from '@/hooks/use-toast';
import { MediaLightbox, LightboxMedia } from './media-lightbox';
import { Input } from './ui/input';

interface MessageBubbleProps {
  message: Message;
  sender?: User;
  isCurrentUser: boolean;
  progress?: number;
  onCancelUpload: () => void;
  onMessageAction: (messageId: string, action: 'react' | 'delete' | 'pin' | 'edit', data?: any) => void;
  onReply: (message: Message) => void;
  onRetry?: (message: Message) => void;
  isRead: boolean;
  isGrouped?: boolean;
  isGroupChat?: boolean;
}

const isImage = (fileType?: string) => fileType?.startsWith('image/') || false;
const isAudio = (fileType?: string) => fileType?.startsWith('audio/') || false;
const isVideo = (fileType?: string) => fileType?.startsWith('video/') || false;

// 6 quick reaction emojis requested: ❤️, 👍, 😂, 😮, 😢, 🔥
const QUICK_REACTION_EMOJIS = ['❤️', '👍', '😂', '😮', '😢', '🔥'];

const messageVariants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.2, ease: [0.16, 1, 0.3, 1] } },
};

function MessageBubble({
  message,
  sender,
  isCurrentUser,
  progress,
  onCancelUpload,
  onMessageAction,
  onReply,
  onRetry,
  isRead,
  isGrouped = false,
  isGroupChat = false,
}: MessageBubbleProps) {
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(message.text || '');
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);

  // Long press timer for touch devices
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);

  const handleTouchStart = () => {
    longPressTimer.current = setTimeout(() => {
      if (typeof window !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate?.(50);
      }
      setMenuOpen(true);
    }, 450);
  };

  const handleTouchEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
    }
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setMenuOpen(true);
  };

  const isOutgoing = isCurrentUser;

  if (!sender) {
    return (
      <div className={cn('group flex w-full items-end gap-2 relative my-1', isOutgoing ? 'justify-end ml-auto' : 'justify-start mr-auto')}>
        {!isOutgoing && isGroupChat && <div className="w-8 h-8 rounded-full bg-muted animate-pulse shrink-0" />}
        <div
          className={cn(
            'relative flex max-w-[70%] flex-col rounded-xl px-4 py-2',
            isOutgoing ? 'rounded-tr-none bg-violet-700 text-white' : 'rounded-tl-none bg-muted text-foreground'
          )}
        >
          <p className="text-base">{message.text}</p>
        </div>
      </div>
    );
  }

  // Delivery status icons: single checkmark (sent), double checkmarks (delivered), indigo/violet double checkmarks (read)
  const renderReadReceiptIcon = () => {
    if (message.status === 'sending') return <Clock className="h-3.5 w-3.5 text-muted-foreground" />;
    if (message.status === 'error') {
      return (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (onRetry) onRetry(message);
          }}
          className="flex items-center gap-1 text-red-400 hover:text-red-300 transition-colors"
          title="Failed to send. Click to retry"
        >
          <AlertCircle className="h-3.5 w-3.5 text-red-500 animate-pulse shrink-0" />
          <span className="text-[10px] underline font-medium">Retry</span>
        </button>
      );
    }
    if (isRead) return <CheckCheck className="h-3.5 w-3.5 text-indigo-300 fill-indigo-300/20" />;
    if (message.status === 'sent' || message.status === 'delivered' || message.status === 'read')
      return <CheckCheck className="h-3.5 w-3.5 text-muted-foreground" />;
    return <Check className="h-3.5 w-3.5 text-muted-foreground" />;
  };

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
      return 'Sending...';
    }
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formattedTimestamp = getFormattedTimestamp(message.timestamp);

  // Copy text to clipboard
  const handleCopyText = () => {
    if (message.text) {
      navigator.clipboard.writeText(message.text);
      toast({ title: 'Copied to clipboard', description: 'Message text copied.' });
    }
    setMenuOpen(false);
  };

  // Pin message
  const handlePinMessage = () => {
    onMessageAction(message.id, 'pin');
    toast({ title: 'Message pinned', description: 'Pinned message updated.' });
    setMenuOpen(false);
  };

  // Save edit
  const handleSaveEdit = () => {
    if (editText.trim() && editText !== message.text) {
      onMessageAction(message.id, 'edit', editText.trim());
      toast({ title: 'Message edited' });
    }
    setIsEditing(false);
  };

  // Handle Drag End for Swipe-to-Reply
  const handleDragEnd = (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    const swipeThreshold = 40;
    if (info.offset.x > swipeThreshold) {
      if (typeof window !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate?.(40);
      }
      onReply(message);
    }
  };

  // Render media attachments (including multi-image grid support)
  const renderMessageContent = () => {
    if (message.deleted) {
      return <p className="text-sm italic text-muted-foreground">This message was deleted.</p>;
    }

    if (message.file) {
      const fileType = message.file.type || '';
      const isSending = message.status === 'sending';

      if (isImage(fileType)) {
        const mediaList: LightboxMedia[] = [{ url: message.file.url, type: fileType, name: message.file.name }];

        return (
          <div className="relative rounded-lg overflow-hidden my-1 bg-muted animate-pulse">
            <img
              src={message.file.url}
              alt={message.file.name || 'Attached image'}
              onLoad={(e) => {
                const parent = e.currentTarget.parentElement;
                if (parent) parent.classList.remove('animate-pulse');
              }}
              className={cn(
                'rounded-lg object-cover max-w-full max-h-72 cursor-pointer hover:opacity-95 transition-opacity',
                isSending && 'opacity-60'
              )}
              onClick={() => {
                setLightboxIndex(0);
                setLightboxOpen(true);
              }}
            />
            {isSending && <UploadProgress progress={progress} onCancel={onCancelUpload} />}
            <MediaLightbox
              media={mediaList}
              initialIndex={lightboxIndex}
              isOpen={lightboxOpen}
              onClose={() => setLightboxOpen(false)}
            />
          </div>
        );
      }

      if (isAudio(fileType)) {
        return message.file.url ? (
          <audio controls src={message.file.url} className={cn('w-full max-w-xs my-1', isSending && 'opacity-60')} />
        ) : null;
      }

      if (isVideo(fileType)) {
        return message.file.url ? (
          <video
            controls
            src={message.file.url}
            className={cn('w-full max-w-xs rounded-lg my-1', isSending && 'opacity-60')}
          />
        ) : null;
      }

      return (
        <a
          href={message.file.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 bg-black/20 p-3 rounded-lg hover:bg-black/30 transition-colors my-1 border border-white/10"
        >
          <FileIcon className="h-7 w-7 text-violet-300 shrink-0" />
          <div className="flex-1 overflow-hidden text-xs">
            <p className="font-medium truncate text-foreground">{message.file.name}</p>
            <p className="text-muted-foreground">Click to download</p>
          </div>
          <Download className="h-4 w-4 text-muted-foreground shrink-0" />
        </a>
      );
    }
    return null;
  };

  return (
    <>
      <motion.div
        variants={messageVariants}
        initial="initial"
        animate="animate"
        layout
        className={cn(
          'group flex w-full items-end relative will-change-[transform,opacity]',
          isGrouped ? 'my-0.5' : 'my-1',
          isOutgoing ? 'justify-end' : 'justify-start gap-2'
        )}
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        onDragEnd={handleDragEnd}
        dragElastic={{ right: 0.2, left: 0 }}
        style={{ x: 0 }}
      >
        {/* Incoming message avatar (Group Chat only) */}
        {!isOutgoing && isGroupChat && (
          isGrouped ? (
            <div className="w-8 h-8 shrink-0 flex-shrink-0" />
          ) : (
            <UserAvatar user={sender!} className="w-8 h-8 shrink-0 flex-shrink-0 mb-0.5" />
          )
        )}

        <div
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          onContextMenu={handleContextMenu}
          className={cn(
            'relative flex max-w-[80%] sm:max-w-[70%] flex-col shadow-md transition-all overflow-hidden group/bubble select-text',
            message.isAiMessage
              ? 'rounded-2xl rounded-tl-xs bg-emerald-950/40 text-foreground border border-emerald-800/40 backdrop-blur-md'
              : isOutgoing
              ? 'rounded-2xl rounded-tr-xs bg-violet-700 text-white'
              : 'rounded-2xl rounded-tl-xs bg-muted border border-border/40 text-foreground',
            message.file && !message.text ? 'p-1.5' : 'px-3.5 py-2 sm:px-4 sm:py-2.5'
          )}
        >
          {/* Sender Name in Group Chat */}
          {!isOutgoing && isGroupChat && !isGrouped && (
            <p className="text-[11px] font-semibold text-violet-300 mb-0.5 tracking-tight">{sender?.name}</p>
          )}

          {/* Quoted Reply Banner */}
          {message.replyTo && (
            <div className="p-2 mb-1.5 bg-black/25 rounded-lg text-xs border-l-2 border-violet-400 flex flex-col gap-0.5">
              <p className="font-medium text-violet-300 text-[11px] truncate">{message.replyTo.messageSender}</p>
              <p className="text-white/90 line-clamp-1 text-[11px]">{message.replyTo.messageText}</p>
            </div>
          )}

          {/* Media & Content */}
          {renderMessageContent()}

          {/* Text Message or Edit Form */}
          {isEditing ? (
            <div className="flex items-center gap-2 mt-1">
              <Input
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                className="bg-black/30 border-white/20 text-white text-xs h-8"
              />
              <Button size="sm" onClick={handleSaveEdit} className="h-8 text-xs bg-emerald-600 hover:bg-emerald-500">
                Save
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setIsEditing(false)} className="h-8 text-xs text-muted-foreground">
                Cancel
              </Button>
            </div>
          ) : (
            message.text && (
              <p
                className={cn(
                  'text-[14px] sm:text-[15px] leading-relaxed whitespace-pre-wrap break-words chat-list-force-break',
                  message.file ? 'mt-1.5 px-0.5' : '',
                  message.deleted && 'italic text-muted-foreground'
                )}
              >
                {formatText(message.text)}
              </p>
            )
          )}

          {/* Displayed Emoji Reactions */}
          {message.reactions && message.reactions.length > 0 && (
            <div className={cn('flex flex-wrap gap-1 mt-1 z-10', isOutgoing ? 'justify-end' : 'justify-start')}>
              {message.reactions.map((r) => (
                <motion.button
                  key={r.emoji}
                  whileTap={{ scale: 1.25 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 15 }}
                  onClick={() => onMessageAction(message.id, 'react', r.emoji)}
                  className="flex items-center bg-black/40 backdrop-blur-md border border-white/10 rounded-full px-2 py-0.5 text-[11px] shadow-sm hover:scale-105 active:scale-125 transition-transform duration-150 ease-out select-none"
                >
                  <span>{r.emoji}</span>
                  <span className="ml-1 font-semibold text-foreground/80">{r.count}</span>
                </motion.button>
              ))}
            </div>
          )}

          {/* Inline Bottom-Right Timestamp & Status Stacking */}
          <div className="mt-1 flex items-center justify-end gap-1 self-end text-[10px] text-muted-foreground ml-2 float-right select-none">
            <span>{formattedTimestamp}</span>
            {isOutgoing && renderReadReceiptIcon()}
          </div>
        </div>

        {/* Floating Context Menu Dropdown - Absolute Positioned */}
        <div className={cn('absolute top-1/2 -translate-y-1/2 z-20 pointer-events-none group-hover:pointer-events-auto', isOutgoing ? '-left-7' : '-right-7')}>
          <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity rounded-full p-0">
                <MoreHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align={isCurrentUser ? 'end' : 'start'}
              className="w-56 bg-card/95 border-border backdrop-blur-xl text-foreground shadow-2xl p-1.5 animate-in fade-in-0 zoom-in-95 duration-150 pointer-events-auto will-change-[transform,opacity] transform-gpu"
            >
              {/* Quick Reaction Emoji Pill */}
              <div className="flex items-center justify-between px-1 py-1 mb-1 border-b border-border">
                {QUICK_REACTION_EMOJIS.map((emoji) => (
                  <motion.button
                    key={emoji}
                    whileTap={{ scale: 1.25 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 15 }}
                    onClick={() => {
                      onMessageAction(message.id, 'react', emoji);
                      setMenuOpen(false);
                    }}
                    className="text-lg hover:scale-125 active:scale-125 transition-transform p-1 select-none"
                  >
                    {emoji}
                  </motion.button>
                ))}
              </div>

              <DropdownMenuItem onClick={() => { onReply(message); setMenuOpen(false); }}>
                <Reply className="mr-2 h-4 w-4 text-violet-400" />
                <span>Reply</span>
              </DropdownMenuItem>

              {message.text && (
                <DropdownMenuItem onClick={handleCopyText}>
                  <Copy className="mr-2 h-4 w-4 text-muted-foreground" />
                  <span>Copy Text</span>
                </DropdownMenuItem>
              )}

              <DropdownMenuItem onClick={handlePinMessage}>
                <Pin className="mr-2 h-4 w-4 text-amber-400" />
                <span>Pin Message</span>
              </DropdownMenuItem>

              {isCurrentUser && message.text && !message.deleted && (
                <DropdownMenuItem onClick={() => { setIsEditing(true); setMenuOpen(false); }}>
                  <Edit className="mr-2 h-4 w-4 text-blue-400" />
                  <span>Edit Message</span>
                </DropdownMenuItem>
              )}

              {isCurrentUser && !message.deleted && (
                <>
                  <DropdownMenuSeparator className="bg-border" />
                  <DropdownMenuItem
                    className="text-red-400 focus:text-red-300 focus:bg-red-950/40"
                    onClick={() => {
                      setIsDeleteDialogOpen(true);
                      setMenuOpen(false);
                    }}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    <span>Delete Message</span>
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Delete Confirmation Alert Dialog */}
        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <AlertDialogContent className="bg-card border-border text-foreground">
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Message?</AlertDialogTitle>
              <AlertDialogDescription className="text-muted-foreground">
                This will delete the message for everyone in this chat. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="bg-muted text-foreground border-none">
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  onMessageAction(message.id, 'delete');
                  setIsDeleteDialogOpen(false);
                }}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </motion.div>
    </>
  );
}

const MemoizedMessageBubble = memo(MessageBubble);
export { MemoizedMessageBubble as MessageBubble };
