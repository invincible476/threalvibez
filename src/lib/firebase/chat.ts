import { 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  arrayUnion, 
  arrayRemove, 
  serverTimestamp, 
  onSnapshot, 
  query, 
  orderBy, 
  limitToLast, 
  Unsubscribe 
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Message } from '@/lib/types';

// Debounce timer stores for non-critical network writes
const typingDebounceTimers = new Map<string, NodeJS.Timeout>();
const readReceiptDebounceTimers = new Map<string, NodeJS.Timeout>();

export interface MinimalMessagePayload {
  senderId: string;
  text: string;
  timestamp: ReturnType<typeof serverTimestamp>;
  clientTempId: string;
  replyTo?: {
    messageId?: string;
    storyId?: string;
    storyMedia?: string;
    messageText: string;
    messageSender: string;
  };
  file?: {
    url: string;
    type: string;
    name: string;
    duration?: number;
  };
}

/**
 * Trims message payloads sent over the wire strictly to necessary fields.
 */
export function trimMessagePayload(
  senderId: string,
  text: string,
  clientTempId: string,
  replyTo?: Message['replyTo'],
  file?: Message['file']
): MinimalMessagePayload {
  const payload: MinimalMessagePayload = {
    senderId,
    text: text.trim(),
    timestamp: serverTimestamp(),
    clientTempId,
  };

  if (replyTo) {
    payload.replyTo = {
      messageText: replyTo.messageText,
      messageSender: replyTo.messageSender,
      ...(replyTo.messageId && { messageId: replyTo.messageId }),
      ...(replyTo.storyId && { storyId: replyTo.storyId }),
      ...(replyTo.storyMedia && { storyMedia: replyTo.storyMedia }),
    };
  }

  if (file) {
    payload.file = {
      url: file.url,
      type: file.type,
      name: file.name,
      ...(file.duration !== undefined && { duration: file.duration }),
    };
  }

  return payload;
}

/**
 * Sends a chat message with trimmed payload to Firestore.
 */
export async function sendChatMessage(
  chatId: string,
  senderId: string,
  text: string,
  clientTempId: string,
  replyTo?: Message['replyTo'],
  file?: Message['file']
): Promise<string> {
  const messagesColRef = collection(db, 'conversations', chatId, 'messages');
  const payload = trimMessagePayload(senderId, text, clientTempId, replyTo, file);

  const docRef = await addDoc(messagesColRef, payload);

  // Update conversation lastMessage non-blockingly
  const chatRef = doc(db, 'conversations', chatId);
  updateDoc(chatRef, {
    lastMessage: {
      text: text.trim() || (file ? (file.type.startsWith('image/') ? '📷 Photo' : '📁 Attachment') : ''),
      senderId,
      timestamp: serverTimestamp(),
    },
  }).catch((err) => console.error('Error updating lastMessage:', err));

  return docRef.id;
}

/**
 * Debounces typing indicator updates by at least 1500ms to prevent network flooding.
 */
export function debouncedUpdateTypingStatus(
  chatId: string,
  userId: string,
  isTyping: boolean,
  debounceMs: number = 1500
): void {
  const timerKey = `${chatId}_${userId}`;

  if (typingDebounceTimers.has(timerKey)) {
    clearTimeout(typingDebounceTimers.get(timerKey)!);
    typingDebounceTimers.delete(timerKey);
  }

  const timer = setTimeout(async () => {
    try {
      const chatRef = doc(db, 'conversations', chatId);
      if (isTyping) {
        await updateDoc(chatRef, {
          typing: arrayUnion(userId),
        });
      } else {
        await updateDoc(chatRef, {
          typing: arrayRemove(userId),
        });
      }
    } catch (error) {
      console.error('Error updating debounced typing status:', error);
    } finally {
      typingDebounceTimers.delete(timerKey);
    }
  }, debounceMs);

  typingDebounceTimers.set(timerKey, timer);
}

/**
 * Batches and debounces read receipt update calls (`markAsRead`) by 1500ms
 * so they don't fire continuously while scrolling through unread messages.
 */
export function debouncedMarkAsRead(
  chatId: string,
  userId: string,
  debounceMs: number = 1500
): void {
  const timerKey = `${chatId}_${userId}`;

  if (readReceiptDebounceTimers.has(timerKey)) {
    clearTimeout(readReceiptDebounceTimers.get(timerKey)!);
  }

  const timer = setTimeout(async () => {
    try {
      const chatRef = doc(db, 'conversations', chatId);
      await updateDoc(chatRef, {
        [`lastRead.${userId}`]: serverTimestamp(),
      });
    } catch (error) {
      console.error('Error updating debounced read receipt:', error);
    } finally {
      readReceiptDebounceTimers.delete(timerKey);
    }
  }, debounceMs);

  readReceiptDebounceTimers.set(timerKey, timer);
}

/**
 * Subscribes to chat messages using `onSnapshot` with `{ includeMetadataChanges: false }`
 * to avoid duplicate state updates before server confirmation.
 */
export function subscribeToMessages(
  chatId: string,
  limitCount: number,
  onUpdate: (snapshot: any) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  const messagesColRef = collection(db, 'conversations', chatId, 'messages');
  const liveQuery = query(messagesColRef, orderBy('timestamp', 'asc'), limitToLast(limitCount));

  // includeMetadataChanges set to FALSE per optimization guidelines to prevent double state triggers
  return onSnapshot(
    liveQuery,
    { includeMetadataChanges: false },
    (snapshot) => onUpdate(snapshot),
    (error) => {
      console.error('Error in subscribeToMessages snapshot listener:', error);
      if (onError) onError(error);
    }
  );
}
