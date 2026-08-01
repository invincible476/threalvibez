'use client';

import React, { memo } from 'react';
import { Message, User } from '@/lib/types';
import { MessageBubble } from './message-bubble';

export interface MessageItemProps {
  message: Message;
  sender?: User;
  isCurrentUser: boolean;
  progress?: number;
  onCancelUpload: (messageId: string) => void;
  onMessageAction: (messageId: string, action: 'react' | 'delete' | 'pin' | 'edit', data?: any) => void;
  onReply: (message: Message) => void;
  onRetry?: (message: Message) => void;
  isRead: boolean;
  isGrouped?: boolean;
  isGroupChat?: boolean;
}

/**
 * Custom comparison function for React.memo to ensure that existing messages
 * in the stream NEVER re-render when a new message arrives or when typing state changes.
 */
function arePropsEqual(prevProps: MessageItemProps, nextProps: MessageItemProps): boolean {
  const m1 = prevProps.message;
  const m2 = nextProps.message;

  // Basic message identity and metadata check
  if (
    m1.id !== m2.id ||
    m1.clientTempId !== m2.clientTempId ||
    m1.status !== m2.status ||
    m1.text !== m2.text ||
    m1.deleted !== m2.deleted
  ) {
    return false;
  }

  // Timestamp comparison
  const t1 = m1.timestamp instanceof Date ? m1.timestamp.getTime() : (m1.timestamp?.seconds ? m1.timestamp.seconds * 1000 : m1.timestamp);
  const t2 = m2.timestamp instanceof Date ? m2.timestamp.getTime() : (m2.timestamp?.seconds ? m2.timestamp.seconds * 1000 : m2.timestamp);
  if (t1 !== t2) return false;

  // Read status & current user flags
  if (
    prevProps.isRead !== nextProps.isRead ||
    prevProps.isCurrentUser !== nextProps.isCurrentUser ||
    prevProps.isGrouped !== nextProps.isGrouped ||
    prevProps.isGroupChat !== nextProps.isGroupChat ||
    prevProps.progress !== nextProps.progress
  ) {
    return false;
  }

  // Sender details check
  if (
    prevProps.sender?.uid !== nextProps.sender?.uid ||
    prevProps.sender?.name !== nextProps.sender?.name ||
    prevProps.sender?.photoURL !== nextProps.sender?.photoURL
  ) {
    return false;
  }

  // Reactions comparison
  const r1 = m1.reactions ?? [];
  const r2 = m2.reactions ?? [];
  if (r1.length !== r2.length) return false;
  for (let i = 0; i < r1.length; i++) {
    if (r1[i].emoji !== r2[i].emoji || r1[i].count !== r2[i].count) return false;
  }

  // File attachment comparison
  if (m1.file?.url !== m2.file?.url || m1.file?.type !== m2.file?.type) return false;

  // Reply target comparison
  if (m1.replyTo?.messageId !== m2.replyTo?.messageId || m1.replyTo?.messageText !== m2.replyTo?.messageText) return false;

  return true;
}

const MessageItemComponent: React.FC<MessageItemProps> = ({
  message,
  sender,
  isCurrentUser,
  progress,
  onCancelUpload,
  onMessageAction,
  onReply,
  onRetry,
  isRead,
  isGrouped,
  isGroupChat,
}) => {
  return (
    <MessageBubble
      message={message}
      sender={sender}
      isCurrentUser={isCurrentUser}
      progress={progress}
      onCancelUpload={() => onCancelUpload(message.clientTempId || message.id)}
      onMessageAction={onMessageAction}
      onReply={onReply}
      onRetry={onRetry}
      isRead={isRead}
      isGrouped={isGrouped}
      isGroupChat={isGroupChat}
    />
  );
};

export const MessageItem = memo(MessageItemComponent, arePropsEqual);
