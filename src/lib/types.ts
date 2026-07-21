
import { Timestamp } from "firebase/firestore";

type Device = {
    id: string;
    type: 'web' | 'mobile';
    loggedInAt: Timestamp;
};

export type User = {
  instagramUrl?: string; //
  id: string;
  uid: string;
  name: string;
  photoURL?: string | null;
  status: 'online' | 'offline';
  email?: string;
  isPrivate?: boolean;
  friends?: string[];
  friendRequestsSent?: string[];
  friendRequestsReceived?: string[];
  blockedUsers?: string[];
  stories?: string[]; // array of story ids
  isVerified?: boolean;
  background?: string;
  useCustomBackground?: boolean;
  mutedConversations?: string[];
  devices?: Device[];
  about?: string;
};

export type MessageReaction = {
  emoji: string;
  users: string[]; // array of user uids
  count: number;
};

export type Message = {
  id:string;
  senderId: string;
  text: string;
  timestamp: any;
  status: 'sent' | 'delivered' | 'read' | 'sending' | 'error';
  isAiMessage?: boolean;
  reactions?: MessageReaction[];
  file?: {
    url: string;
    type: string;
    name: string;
    duration?: number;
  };
  replyTo?: {
    messageId?: string;
    storyId?: string;
    storyMedia?: string;
    messageText: string;
    messageSender: string;
  };
  deleted?: boolean;
  clientTempId?: string;
};

export type Conversation = {
  id: string;
  type: 'private' | 'group';
  participants: string[]; // user ids
  participantsDetails?: User[];
  name?: string; // for group chats or to be derived for private chats
  avatar?: string | null; // for group chats or to be derived for private chats
  description?: string; // for group chats
  messages: Message[];
  unreadCount?: number;
  pinned?: boolean;
  lastMessage?: {
    text: string;
    senderId: string;
    timestamp: Timestamp;
  },
  lastRead?: {
    [userId: string]: Timestamp;
  },
  otherParticipantLastRead?: Timestamp; // Added for convenience
  createdBy?: string;
  isFavorite?: boolean;
  isArchived?: boolean;
  typing?: string[];
};

export type StoryReaction = {
  emoji: string;
  userId: string;
};

export type Story = {
    id: string;
    ownerId: string;
    mediaUrl?: string;
    mediaType: 'image' | 'video';
    createdAt: Timestamp | Date;
    expiresAt: Timestamp | Date;
    caption?: string;
    viewedBy: string[]; // array of user uids who have viewed the story
    duration?: number;
    reactions?: StoryReaction[];
};
