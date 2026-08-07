import { 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  getDocs,
  limit,
  deleteField,
  runTransaction,
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
  type?: 'text' | 'gif';
  text?: string;
  gifUrl?: string;
  aspectRatio?: number;
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
  file?: Message['file'],
  type?: 'text' | 'gif',
  gifUrl?: string,
  aspectRatio?: number
): MinimalMessagePayload {
  const payload: MinimalMessagePayload = {
    senderId,
    timestamp: serverTimestamp(),
    clientTempId,
  };

  if (type === 'gif' || gifUrl) {
    payload.type = 'gif';
    payload.gifUrl = gifUrl;
    if (aspectRatio) payload.aspectRatio = aspectRatio;
    if (text) payload.text = text.trim();
  } else {
    payload.type = 'text';
    if (text) payload.text = text.trim();
  }

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
  file?: Message['file'],
  type?: 'text' | 'gif',
  gifUrl?: string,
  aspectRatio?: number
): Promise<string> {
  const messagesColRef = collection(db, 'conversations', chatId, 'messages');
  const payload = trimMessagePayload(senderId, text, clientTempId, replyTo, file, type, gifUrl, aspectRatio);

  const docRef = await addDoc(messagesColRef, payload);

  // Update conversation lastMessage non-blockingly
  const chatRef = doc(db, 'conversations', chatId);
  const lastMessageText = type === 'gif' ? '👾 GIF' : (text.trim() || (file ? (file.type.startsWith('image/') ? '📷 Photo' : '📁 Attachment') : ''));
  updateDoc(chatRef, {
    lastMessage: {
      text: lastMessageText,
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

export interface GroupMemberData {
  uid: string;
  name?: string;
  email?: string;
  photoURL?: string | null;
  username?: string;
}

/**
 * Adds new members to a group chat in Firestore.
 * Updates both `participants` and `participantIds` using `arrayUnion`,
 * updates participant metadata objects, and refreshes `updatedAt`.
 */
export async function addGroupMembers(
  chatId: string,
  newMembers: GroupMemberData[]
): Promise<void> {
  if (!chatId || newMembers.length === 0) return;

  const chatRef = doc(db, 'conversations', chatId);
  const uidsToAdd = newMembers.map((m) => m.uid);

  const updatePayload: Record<string, any> = {
    participants: arrayUnion(...uidsToAdd),
    participantIds: arrayUnion(...uidsToAdd),
    updatedAt: serverTimestamp(),
  };

  newMembers.forEach((member) => {
    updatePayload[`participantMetadata.${member.uid}`] = {
      uid: member.uid,
      name: member.name || '',
      email: member.email || '',
      photoURL: member.photoURL || '',
      username: member.username || '',
      addedAt: new Date().toISOString(),
    };
  });

  await updateDoc(chatRef, updatePayload);
}

/**
 * Safely deletes an individual message document within a conversation.
 * Targets ONLY the message document (conversations/{chatId}/messages/{messageId})
 * and NEVER touches conversation-level deletion fields (deletedFor/deletedBy).
 * Recalculates lastMessage on the top-level conversation if the deleted message
 * was the latest one.
 */
export async function deleteChatMessage(
  chatId: string,
  messageId: string
): Promise<void> {
  if (!chatId || !messageId) return;

  const messageRef = doc(db, 'conversations', chatId, 'messages', messageId);
  const chatRef = doc(db, 'conversations', chatId);

  // Soft delete the message document
  await updateDoc(messageRef, {
    text: 'This message was deleted.',
    file: deleteField(),
    deleted: true,
    reactions: [],
  });

  // Query recent messages to find previous non-deleted message
  try {
    const messagesColRef = collection(db, 'conversations', chatId, 'messages');
    const recentQuery = query(messagesColRef, orderBy('timestamp', 'desc'), limit(10));
    const snap = await getDocs(recentQuery);

    const prevDoc = snap.docs.find((d) => d.id !== messageId && !d.data().deleted);

    if (prevDoc) {
      const prevData = prevDoc.data();
      const lastText = prevData.text || (prevData.file ? (prevData.file.type?.startsWith('image/') ? '📷 Photo' : '📁 Attachment') : 'Message');
      await updateDoc(chatRef, {
        lastMessage: {
          text: lastText,
          senderId: prevData.senderId || '',
          timestamp: prevData.timestamp || serverTimestamp(),
        },
      });
    } else {
      // All messages in chat are deleted: preserve chat document, set fallback text
      await updateDoc(chatRef, {
        lastMessage: {
          text: 'No messages yet',
          senderId: '',
          timestamp: serverTimestamp(),
        },
      });
    }
  } catch (err) {
    console.error('Error recalculating lastMessage after deleteChatMessage:', err);
  }
}

/**
 * Initiates an active voice call for a conversation in Firestore.
 */
export async function startVoiceCall(
  chatId: string,
  caller: { uid: string; name?: string | null; photoURL?: string | null },
  targetRecipientIds?: string[]
): Promise<void> {
  if (!chatId || !caller.uid) return;
  const callId = `${chatId}_${Date.now()}`;
  const roomId = `voice_room_${chatId}`;
  const chatRef = doc(db, 'conversations', chatId);

  await updateDoc(chatRef, {
    activeCall: {
      callId,
      callerId: caller.uid,
      callerName: caller.name || 'User',
      callerAvatar: caller.photoURL || null,
      startedAt: Date.now(),
      status: 'calling',
      roomId,
    },
  });

  // Dispatch call push notification (wakes phone screen and triggers ringtone)
  try {
    let recipientIds = targetRecipientIds && targetRecipientIds.length > 0
      ? targetRecipientIds.filter(id => id !== caller.uid)
      : [];

    if (recipientIds.length === 0) {
      const chatSnap = await getDoc(chatRef);
      if (chatSnap.exists()) {
        const participants: string[] = chatSnap.data()?.participants || [];
        recipientIds = participants.filter(id => id !== caller.uid);
      }
    }

    if (recipientIds.length > 0) {
      fetch('/api/notifications/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'call',
          senderId: caller.uid,
          senderName: caller.name || 'User',
          senderPhoto: caller.photoURL || '',
          callId,
          roomId,
          recipientIds,
        }),
      }).catch(err => console.warn('[Call Push Notification] Send error:', err));
    }
  } catch (err) {
    console.warn('[Call Push Notification] Chat fetch error:', err);
  }
}



/**
 * Marks an active voice call as accepted/active in Firestore.
 */
export async function acceptVoiceCall(chatId: string): Promise<void> {
  if (!chatId) return;
  const chatRef = doc(db, 'conversations', chatId);
  await updateDoc(chatRef, {
    'activeCall.status': 'active',
  });
}

/**
 * Ends and cleans up an active voice call for a conversation in Firestore.
 */
export async function endVoiceCall(chatId: string): Promise<void> {
  if (!chatId) return;
  const chatRef = doc(db, 'conversations', chatId);
  await updateDoc(chatRef, {
    activeCall: deleteField(),
  });
}
