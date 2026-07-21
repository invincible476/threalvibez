
"use client";
import '../styles/glass-theme.css';
import type { MessageReaction } from '@/lib/types';
import {
  addDoc, arrayRemove, arrayUnion, collection, deleteDoc, doc, getDoc, getDocs, onSnapshot, orderBy, query,
  runTransaction, serverTimestamp, Timestamp, updateDoc, where, writeBatch, limit, startAfter, setDoc, deleteField,
  DocumentData, DocumentSnapshot
} from 'firebase/firestore';
import { usePresence } from '@/hooks/use-presence';
import { useOnlineStatus } from '@/hooks/use-online-status';
import { getDownloadURL, ref, uploadBytesResumable, UploadTask } from 'firebase/storage';
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { continueConversation } from '@/ai/flows/ai-chat-flow';
import { useAuth } from '@/hooks/use-auth';
import { useNotifications } from '@/hooks/use-notifications';
import { type Firestore } from 'firebase/firestore';
import { db, storage } from '@/lib/firebase';
import type { Conversation, Message, Story, User, StoryReaction } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { StoryViewer } from './story-viewer';
import { StoriesContext } from './providers/stories-provider';
import { ImagePreviewDialog } from './image-preview-dialog';
import { useAppearance } from './providers/appearance-provider';
import { GalaxyBackground } from './galaxy-background';
import { GradientGlowBackground } from './gradient-glow-background';
import { AuraBackground } from './aura-background';
import { GridBackground } from './grid-background';
import { useIsMobile } from '@/hooks/use-mobile';
import { MobileGalaxyBackground } from './mobile-galaxy-background';


const AI_USER_ID = 'gemini-ai-chat-bot-7a4b9c1d-f2e3-4d56-a1b2-c3d4e5f6a7b8';
const AI_USER_NAME = 'Gemini';
const AI_AVATAR_URL = '/gemini-logo.png';

// Helper function to ensure consistent AI user data
const getAiUserData = () => ({
  id: AI_USER_ID,
  uid: AI_USER_ID,
  name: AI_USER_NAME,
  photoURL: AI_AVATAR_URL,
  avatarUrl: AI_AVATAR_URL,
  displayPhoto: AI_AVATAR_URL,
  status: 'online',
});

const PAGE_SIZE = 30;

export async function uploadToCloudinaryXHR(
  file: File,
  cloudName: string,
  uploadPreset: string,
  onProgress?: (p: number) => void,
  signal?: { xhrAbort?: () => void }
): Promise<any> {
  if (!cloudName || !uploadPreset) {
    throw new Error('Missing required Cloudinary configuration');
  }

  // Basic file validation
  if (!file || !(file instanceof File)) {
    throw new Error('Invalid file object');
  }

  if (file.size === 0) {
    throw new Error('File is empty');
  }

  const url = `https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`;
  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', uploadPreset);
  formData.append('timestamp', String(Date.now())); // Prevent caching
  
  // Add resource type hints
  if (file.type.startsWith('image/')) {
    formData.append('resource_type', 'image');
  } else if (file.type.startsWith('video/')) {
    formData.append('resource_type', 'video');
  }

  console.log('Starting upload with config:', {
    url,
    cloudName,
    uploadPreset,
    fileType: file.type,
    fileSize: file.size
  });

  try {
    const response = await fetch(url, {
      method: 'POST',
      body: formData,
      mode: 'cors',
      credentials: 'omit',
      headers: {
        'Accept': 'application/json'
      },
      signal: AbortSignal.timeout(30000) // 30 second timeout
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Cloudinary upload failed:', {
        status: response.status,
        statusText: response.statusText,
        error: errorText,
        url,
        fileType: file.type,
        fileSize: file.size
      });

      // Add custom error handling for common cases
      if (response.status === 413) {
        throw new Error('413: File size exceeds server limits');
      } else if (response.status === 401 || response.status === 403) {
        throw new Error('Upload not authorized. Please check your Cloudinary configuration.');
      }

      throw new Error(`Cloudinary upload failed: ${response.status} - ${response.statusText}. ${errorText}`);
    }

    const data = await response.json();
    if (!data.secure_url) {
      console.error('Invalid Cloudinary response:', data);
      throw new Error('Invalid response: missing secure_url');
    }

    console.log('Upload successful:', {
      publicId: data.public_id,
      url: data.secure_url,
      format: data.format,
      resourceType: data.resource_type,
      bytes: data.bytes,
      duration: data.duration
    });

    return {
      secure_url: data.secure_url,
      resource_type: data.resource_type,
      duration: data.duration,
      format: data.format,
      bytes: data.bytes,
      public_id: data.public_id
    };
  } catch (error: any) {
    console.error('Upload error:', error, {
      url,
      fileType: file.type,
      fileSize: file.size
    });
    
    if (error.name === 'TimeoutError') {
      throw new Error('Upload timed out. Please try again or use a smaller file.');
    }
    
    if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
      throw new Error('Network error: Could not connect to Cloudinary. Please check your internet connection.');
    }
    
    if (error.message.includes('Failed to execute') && error.message.includes('fetch')) {
      throw new Error('Browser error: The request was blocked. Please check your browser settings and extensions.');
    }
    
    throw error;
  }
}

function useChatData() {
  const { user: authUser, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const { setAppBackground, setUseCustomBackground } = useAppearance();

  const aiUser: User = {
    id: AI_USER_ID,
    uid: AI_USER_ID,
    name: AI_USER_NAME,
    photoURL: AI_AVATAR_URL,
    status: 'online'
  };

  const initialAiConversation: Conversation = {
    id: AI_USER_ID,
    type: 'private',
    participants: [AI_USER_ID],
    participantsDetails: [aiUser],
    name: AI_USER_NAME,
    avatar: AI_AVATAR_URL,
    messages: [],
    lastMessage: {
      text: 'Ask me anything!',
      senderId: AI_USER_ID,
      timestamp: new Date() as any,
    }
  };

  const [aiConversation, setAiConversation] = useState<Conversation>(initialAiConversation);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedChat, setSelectedChat] = useState<Conversation | undefined>(undefined);
  const [isAiReplying, setIsAiReplying] = useState(false);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [usersCache, setUsersCache] = useState<Map<string, User>>(new Map([[AI_USER_ID, aiUser]]));
  const [newlyCreatedChatId, setNewlyCreatedChatId] = useState<string | null>(null);

  const [uploadProgress, setUploadProgress] = useState<Map<string, number>>(new Map());
  const uploadTasks = useRef<Map<string, UploadTask>>(new Map());
  const xhrRequests = useRef<Map<string, { xhrAbort?: () => void }>>(new Map());


  
  const [currentUser, setCurrentUser] = useState<User | undefined>(undefined);
  const [stories, setStories] = useState<Story[]>([]);
  const [viewingStory, setViewingStory] = useState<{ user: User, stories: Story[] } | null>(null);
  const [previewStoryFile, setPreviewStoryFile] = useState<File | null>(null);

  const [messages, setMessages] = useState<Message[]>([]);
// DEBUG LOGGING
useEffect(() => {
  console.log('[AppShell] selectedChat:', selectedChat);
  console.log('[AppShell] messages:', messages);
}, [selectedChat, messages]);
  const [firstMessageDoc, setFirstMessageDoc] = useState<any>(null);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  
  const messagesUnsubscribe = useRef<() => void>();


  useNotifications({ conversations, usersCache, currentUser, activeChatId: selectedChat?.id });

  const updateUserInCache = useCallback((userToCache: User) => {
    setUsersCache(prev => {
      const newCache = new Map(prev);
      const existingUser = newCache.get(userToCache.uid);
      if (JSON.stringify(existingUser) !== JSON.stringify(userToCache)) {
        newCache.set(userToCache.uid, userToCache);
        return newCache;
      }
      return prev;
    });
  }, []);

  useEffect(() => {
    if (!authUser || authLoading) return;
    
    const userDocRef = doc(db, 'users', authUser.uid);
    const unsubscribeCurrentUser = onSnapshot(userDocRef, (doc) => {
        if (doc.exists()) {
            const userData = { id: doc.id, ...doc.data() } as User;
            setCurrentUser(userData);
            updateUserInCache(userData);
            // Update appearance from user data
            if(userData.background) {
              setAppBackground(userData.background);
            }
              if(userData.hasOwnProperty('useCustomBackground')) {
              setUseCustomBackground(userData.useCustomBackground ?? false);
            }
        }
    });
    
    const usersQuery = query(collection(db, 'users'));
    const unsubscribeAllUsers = onSnapshot(usersQuery, (snapshot) => {
      const usersData = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as User));
      const newCache = new Map(usersCache);
      usersData.forEach(user => newCache.set(user.uid, user));
      setUsersCache(newCache);
      setAllUsers(usersData);
    }, (error) => console.error("Error fetching all users:", error));

    return () => {
      unsubscribeCurrentUser();
      unsubscribeAllUsers();
    };
  }, [authUser, authLoading, updateUserInCache, setAppBackground, setUseCustomBackground]);


  const getParticipantDetails = useCallback((participantIds: string[]): User[] => {
    return participantIds.map(id => usersCache.get(id)).filter(Boolean) as User[];
  }, [usersCache]);


  useEffect(() => {
    if (!authUser || usersCache.size <= 1) return;

    const conversationsQuery = query(
      collection(db, 'conversations'),
      where('participants', 'array-contains', authUser.uid)
    );

    const unsubscribeConversations = onSnapshot(conversationsQuery, async (snapshot) => {
      const convosPromises = snapshot.docs.map(async (doc) => {
          const data = doc.data() as Omit<Conversation, 'id'|'participantsDetails'>;
          const participantIds = data.participants;
          const participantsDetails = getParticipantDetails(participantIds);
          let name = data.name;
          let avatar = data.avatar;
          let otherParticipantLastRead: Timestamp | undefined = undefined;

          if (data.type === 'private') {
              const otherParticipant = participantsDetails.find(p => p.uid !== authUser.uid);
              if (otherParticipant) {
                  name = otherParticipant.name;
                  avatar = otherParticipant.photoURL;
                  if(data.lastRead) {
                    otherParticipantLastRead = data.lastRead[otherParticipant.uid];
                  }
              }
          }
          
          let unreadCount = 0;
          const lastReadTimestamp = data.lastRead?.[authUser.uid];
          if (data.lastMessage && lastReadTimestamp && data.lastMessage.timestamp > lastReadTimestamp) {
              // This is a simplified unread count. A more accurate one would query messages.
              // For performance, we can assume 1 unread if last message is newer.
              unreadCount = data.lastMessage.senderId !== authUser.uid ? 1 : 0;
          } else if (data.lastMessage && !lastReadTimestamp && data.lastMessage.senderId !== authUser.uid) {
              unreadCount = 1;
          }

          return {
              ...data,
              id: doc.id,
              name,
              avatar,
              participantsDetails,
              unreadCount,
              otherParticipantLastRead,
          } as Conversation
      });

      const convos = await Promise.all(convosPromises);
      // Keep conversations in their current order if a chat is selected
      if (!selectedChat) {
        convos.sort((a, b) => (b.lastMessage?.timestamp?.toMillis() || 0) - (a.lastMessage?.timestamp?.toMillis() || 0));
      }
      setConversations(convos);

    });

    return () => unsubscribeConversations();
  }, [authUser, usersCache, getParticipantDetails]);
  
  useEffect(() => {
    if (newlyCreatedChatId) {
       const newChat = conversations.find(c => c.id === newlyCreatedChatId);
       if (newChat) {
         handleChatSelect(newChat.id);
         setNewlyCreatedChatId(null);
       }
     }
  }, [conversations, newlyCreatedChatId]);

  // Sync messages with aiConversation when AI chat is selected
  useEffect(() => {
    if (selectedChat && selectedChat.id === AI_USER_ID) {
      setMessages(aiConversation.messages || []);
    }
  }, [aiConversation, selectedChat]);

  // Cleanup temporary URLs when component unmounts
  useEffect(() => {
    return () => {
      messages.forEach(message => {
        if (message.file?.url.startsWith('blob:')) {
          URL.revokeObjectURL(message.file.url);
        }
      });
      
      // Also cleanup any pending uploads
      uploadTasks.current.forEach(task => task.cancel());
      xhrRequests.current.forEach(request => request.xhrAbort?.());
      uploadTasks.current.clear();
      xhrRequests.current.clear();
      setUploadProgress(new Map());
    };
  }, [messages]);


  // Message fetching logic
  const handleChatSelect = useCallback(async (chatId: string) => {
    if (messagesUnsubscribe.current) {
        messagesUnsubscribe.current();
    }

    // Reset AI typing state when switching chats
    if (selectedChat?.id === AI_USER_ID && chatId !== AI_USER_ID) {
        setIsAiReplying(false);
    }

    const chat = conversations.find(c => c.id === chatId) || (chatId === AI_USER_ID ? aiConversation : undefined);

    if (!chat) {
        setSelectedChat(undefined);
        setMessages([]);
        return;
    }

    if (chat.id === AI_USER_ID) {
        setSelectedChat(aiConversation);
        setMessages(aiConversation.messages || []);
        setHasMoreMessages(false);
        return;
    }
    
    setSelectedChat(chat);
    setIsLoadingMore(true);

    const messagesRef = collection(db, 'conversations', chat.id, 'messages');
    const q = query(messagesRef, orderBy('timestamp', 'desc'), limit(PAGE_SIZE));
    const snapshot = await getDocs(q);

    const initialMsgs = snapshot.docs.map(d => ({ ...d.data(), id: d.id } as Message)).reverse();
    setMessages(initialMsgs);

    const lastDoc = snapshot.docs[snapshot.docs.length - 1];
    setFirstMessageDoc(lastDoc);
    setHasMoreMessages(snapshot.docs.length === PAGE_SIZE);
    setIsLoadingMore(false);
    
    if (chat && authUser) {
        const chatRef = doc(db, 'conversations', chat.id);
        await updateDoc(chatRef, {
            [`lastRead.${authUser.uid}`]: serverTimestamp()
        });
    }

    // Subscribe to new messages
    const lastVisibleMessage = initialMsgs[initialMsgs.length - 1];
    const newMessagesQuery = lastVisibleMessage?.timestamp
        ? query(messagesRef, orderBy('timestamp', 'asc'), startAfter(lastVisibleMessage.timestamp))
        : query(messagesRef, orderBy('timestamp', 'asc'));

    messagesUnsubscribe.current = onSnapshot(newMessagesQuery, (snapshot) => {
        const newMsgs: Message[] = [];
        snapshot.docChanges().forEach(change => {
            if (change.type === 'added') {
                newMsgs.push({ ...change.doc.data(), id: change.doc.id } as Message);
            }
        });

        if (newMsgs.length > 0) {
            setMessages(prev => {
                const newMessagesMap = new Map(newMsgs.map(m => [m.clientTempId || m.id, m]));
                const updatedMessages = prev.map(m => {
                    const serverVersion = newMessagesMap.get(m.clientTempId!);
                    if (serverVersion) {
                        newMessagesMap.delete(m.clientTempId!);
                        return serverVersion; // Replace optimistic with server version
                    }
                    return m;
                });
                return [...updatedMessages, ...Array.from(newMessagesMap.values())];
            });
        }
    });

  }, [conversations, aiConversation, authUser]);
  
  const loadMoreMessages = useCallback(async () => {
    if (isLoadingMore || !hasMoreMessages || !selectedChat || !firstMessageDoc) return;
  
    setIsLoadingMore(true);
  
    const messagesRef = collection(db, 'conversations', selectedChat.id, 'messages');
    const q = query(messagesRef, orderBy('timestamp', 'desc'), startAfter(firstMessageDoc), limit(PAGE_SIZE));
    
    try {
        const snapshot = await getDocs(q);
        if (snapshot.empty) {
            setHasMoreMessages(false);
            setIsLoadingMore(false);
            return;
        }

        const olderMsgs = snapshot.docs.map(d => ({...d.data(), id: d.id} as Message)).reverse();
        const newFirstDoc = snapshot.docs[snapshot.docs.length - 1];
        setFirstMessageDoc(newFirstDoc);
        setHasMoreMessages(snapshot.docs.length === PAGE_SIZE);

        setMessages(prev => [...olderMsgs, ...prev]);

    } catch (error) {
      console.error("Error loading more messages:", error);
    } finally {
      setIsLoadingMore(false);
    }
  }, [isLoadingMore, hasMoreMessages, selectedChat, firstMessageDoc]);


  useEffect(() => {
    if (!currentUser) {
        setStories([]);
        return;
    };
    
    const storyOwnerIds = [...(currentUser.friends || []), currentUser.uid];

    if(storyOwnerIds.length === 0) {
      setStories([]);
      return;
    }

    const storiesQuery = query(
        collection(db, 'stories'),
        where('ownerId', 'in', storyOwnerIds)
    );

    const unsubscribe = onSnapshot(storiesQuery, (snapshot) => {
        const now = new Date();
        const twentyFourHoursAgo = new Date(now.getTime() - (24 * 60 * 60 * 1000));
        
        const stories = snapshot.docs
          .map(d => ({id: d.id, ...d.data()} as Story))
          .filter(story => (story.createdAt as Timestamp).toDate() > twentyFourHoursAgo);
        
        setStories(stories);
    }, error => {
      console.error("Error fetching stories: ", error);
    });

    return () => unsubscribe();

  }, [currentUser]);
  
  const handleSendMessage = useCallback(async (
    chatId: string,
    senderId: string,
    messageText: string,
    replyTo?: Message['replyTo']
  ): Promise<string> => {
    if (!messageText.trim() || !currentUser) return Promise.reject("Cannot send empty message");
  
    const tempId = uuidv4();
    const optimisticMessage: Message = {
        id: tempId,
        clientTempId: tempId,
        senderId: currentUser.uid,
        text: messageText,
        timestamp: new Date(),
        status: 'sending',
        ...(replyTo && { replyTo })
    };

    setMessages(prev => [...prev, optimisticMessage]);

    try {
      await runTransaction(db, async (transaction) => {
        // Get the current conversation state
        const chatRef = doc(db, 'conversations', chatId);
        const chatDoc = await transaction.get(chatRef);
        
        if (!chatDoc.exists()) {
          throw new Error('Conversation not found');
        }

        // Create new message
        const messageCollectionRef = collection(db, 'conversations', chatId, 'messages');
        const newMessageRef = doc(messageCollectionRef);
        const messageData = {
          senderId: senderId,
          text: messageText,
          timestamp: serverTimestamp(),
          clientTempId: tempId,
          ...(replyTo && { replyTo })
        };

        // Update both the message and conversation atomically
        transaction.set(newMessageRef, messageData);
        transaction.update(chatRef, {
          lastMessage: {
            text: messageText,
            senderId: senderId,
            timestamp: serverTimestamp(),
          },
        });
      });
      
      return tempId;
    } catch (error) {
      console.error('Error sending message:', error);
      setMessages(prev => prev.map(m => 
        m.clientTempId === tempId ? { ...m, status: 'error' } : m
      ));
      throw error;
    }
  
  }, [currentUser]);

  const handleSendBase64File = useCallback(async (chatId: any, senderId: any, base64Data: any, fileType: any, fileName: any, caption: any) => {
    if (!base64Data || !currentUser) return Promise.reject("No data or user");
    if (fileType.startsWith('video/')) {
        // Prevent regressions: videos must not be stored as base64
        toast({ title: "Error", description: "Video uploads must use Cloudinary. Do not send base64 for videos.", variant: "destructive"});
        return Promise.reject('Video uploads must use Cloudinary. Do not send base64 for videos.');
    }
    
    if (!base64Data || !currentUser) return;
    
    const tempId = uuidv4();
    const optimisticMessage: Message = {
        id: tempId,
        clientTempId: tempId,
        senderId,
        text: caption,
        timestamp: new Date(),
        status: 'sending',
        file: {
            url: base64Data, // Use data URL for optimistic preview
            type: fileType,
            name: fileName
        }
    };

    setMessages(prev => [...prev, optimisticMessage]);

    const messageData: any = {
        senderId,
        text: caption,
        timestamp: serverTimestamp(),
        clientTempId: tempId,
        file: {
            url: base64Data, 
            type: fileType,
            name: fileName
        }
    };

    try {
        const messageCollectionRef = collection(db, 'conversations', chatId, 'messages');
        const newMessageRef = doc(messageCollectionRef);
        await setDoc(newMessageRef, messageData);
        
        let lastMessageText = caption ? caption : 'Sent a file';
        if (fileType.startsWith('image/')) {
            lastMessageText = caption || 'Sent an image';
        } else if (fileType.startsWith('audio/')) {
             lastMessageText = 'Sent a voice note';
        } else if (fileType.startsWith('video/')) {
             lastMessageText = caption || 'Sent a video';
        }
        
        await updateDoc(doc(db, 'conversations', chatId), {
            lastMessage: {
                text: lastMessageText,
                senderId: senderId,
                timestamp: serverTimestamp(),
            },
        });
    } catch (error) {
        console.error('Error sending base64 file:', error);
        setMessages(prev => prev.map(m => m.clientTempId === tempId ? {...m, status: 'error'} : m));
        throw error;
    }
  }, [currentUser, toast]);


  const handleAiConversation = useCallback(async (messageText: string) => {
    if (!currentUser) return;
    
    let cleanup = () => {
      setIsAiReplying(false);
    }
    
    try {
      const userMessage: Message = {
        id: uuidv4(),
        senderId: currentUser.uid,
        text: messageText,
        timestamp: new Date(),
        status: 'read',
      };

      // Optimistically update AI chat with user message
      const tempAiConvo = {
        ...aiConversation,
        messages: [...(aiConversation.messages || []), userMessage],
        lastMessage: { text: messageText, senderId: currentUser.uid, timestamp: new Date() as any }
      };
      
      setAiConversation(tempAiConvo);
      
      // Only update selectedChat if we're still on the AI chat
      if (selectedChat?.id === AI_USER_ID) {
        setSelectedChat(tempAiConvo);
      }

      setIsAiReplying(true);
      
      const history = (tempAiConvo.messages)
          .slice(-10) 
          .map(m => (m.senderId === currentUser.uid ? { user: m.text } : { model: m.text }));

      const aiResponse = await continueConversation({ message: messageText, history });

      if (!aiResponse?.reply) {
        throw new Error("No response received from AI");
      }

      const aiMessage: Message = {
        id: uuidv4(),
        senderId: AI_USER_ID,
        text: aiResponse.reply,
        timestamp: new Date(),
        status: 'read',
      };
      
      setAiConversation(prev => {
          const newMessages = [...prev.messages, aiMessage];
          const finalAiConvo = {
            ...prev,
            messages: newMessages,
            lastMessage: { text: aiResponse.reply, senderId: AI_USER_ID, timestamp: new Date() as any }
          };
          setSelectedChat(finalAiConvo);
          return finalAiConvo;
      });

    } catch (error) {
      console.error("Error with AI conversation:", error);
      const errorMessage: Message = {
        id: uuidv4(),
        senderId: AI_USER_ID,
        text: "Sorry, I encountered an error. Please try again.",
        timestamp: new Date(),
        status: 'read',
      };
      setAiConversation(prev => {
        const finalAiConvo = { ...prev, messages: [...prev.messages, errorMessage] };
        setSelectedChat(finalAiConvo);
        return finalAiConvo;
      });
      toast({
        title: "AI Error",
        description: "There was an error generating the AI response. Please try again.",
        variant: "destructive"
      });
    } finally {
      cleanup();
    }
  }, [currentUser, aiConversation, selectedChat, toast]);
  
  const handleCloudinaryUpload = useCallback(async (file: File, messageText: string, chatId: string, senderId: string): Promise<string> => {
    const tempId = uuidv4();
    const optimisticMessage: Message = {
        id: tempId, clientTempId: tempId, senderId,
        text: messageText, timestamp: new Date(), status: 'sending',
        file: { url: URL.createObjectURL(file), type: file.type, name: file.name }
    };
    setMessages(prev => [...prev, optimisticMessage]);

    const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
    const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;
    
    // Debug environment variables and validate configuration
    console.log('Checking Cloudinary config:', { 
      nodeEnv: process.env.NODE_ENV,
      hasCloudName: !!cloudName,
      hasUploadPreset: !!uploadPreset,
      cloudinaryKeys: Object.keys(process.env).filter(key => key.includes('CLOUDINARY'))
    });
    
    if (!cloudName || !uploadPreset) {
        const error = 'Missing Cloudinary configuration';
        console.error('Configuration error:', { 
          cloudName: cloudName ? 'SET' : 'MISSING',
          uploadPreset: uploadPreset ? 'SET' : 'MISSING'
        });
        setMessages(prev => prev.map(m => m.clientTempId === tempId ? {...m, status: 'error'} : m));
        toast({ 
          title: 'Upload Error', 
          description: 'Missing Cloudinary configuration. Please check your environment setup.',
          variant: 'destructive',
          duration: 5000
        });
        return Promise.reject(error);
    }

    let xhrSignal: { xhrAbort?: ()=>void } = {};
    xhrRequests.current.set(tempId, xhrSignal);
    
    try {
        // Start the upload with Cloudinary
        const formData = new FormData();
        formData.append('file', file);
        formData.append('upload_preset', uploadPreset);
        formData.append('timestamp', String(Date.now())); // Prevent caching
        
        // Add resource type hints
        if (file.type.startsWith('image/')) {
          formData.append('resource_type', 'image');
        } else if (file.type.startsWith('video/')) {
          formData.append('resource_type', 'video');
        }

        const url = `https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`;
        
        console.log('Starting Cloudinary upload:', {
          url,
          fileType: file.type,
          fileSize: file.size,
          uploadPreset
        });

        const response = await fetch(url, {
          method: 'POST',
          body: formData,
          mode: 'cors',
          credentials: 'omit',
          signal: AbortSignal.timeout(30000) // 30 second timeout
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('Cloudinary upload failed:', {
            status: response.status,
            statusText: response.statusText,
            error: errorText,
            url,
            fileType: file.type,
            fileSize: file.size
          });
          throw new Error(`Upload failed: ${response.status} - ${response.statusText}. ${errorText}`);
        }

        const data = await response.json();
        if (!data.secure_url) {
          console.error('Invalid Cloudinary response:', data);
          throw new Error('Invalid response: missing secure_url');
        }

        // Successfully uploaded to Cloudinary, now create the message
        const fileData: Message['file'] = {
            url: data.secure_url,
            type: file.type,
            name: file.name
        };
        
        if (data.resource_type === 'video' && data.duration) {
            fileData.duration = data.duration;
        }

        console.log('Upload successful:', {
          publicId: data.public_id,
          url: data.secure_url,
          type: data.resource_type
        });

        const finalMessageData = {
            senderId,
            text: messageText || '',
            timestamp: serverTimestamp(),
            clientTempId: tempId,
            file: fileData
        };

        // Store the message in Firebase
        const messageCollectionRef = collection(db, 'conversations', chatId, 'messages');
        await addDoc(messageCollectionRef, finalMessageData);
        await updateDoc(doc(db, 'conversations', chatId), { 
          lastMessage: { 
            text: messageText || `Sent a ${file.type.split('/')[0]}`, 
            senderId, 
            timestamp: serverTimestamp() 
          } 
        });

        // Cleanup
        xhrRequests.current.delete(tempId);
        setUploadProgress(prev => {
          const newMap = new Map(prev);
          newMap.delete(tempId);
          return newMap;
        });
        return tempId;

    } catch (err: any) {
        console.error('Upload error:', err, {
          fileType: file.type,
          fileSize: file.size
        });

        // Enhanced error handling
        let errorMessage = 'Could not upload file. Please try again.';
        if (err.name === 'TypeError' && err.message.includes('Failed to fetch')) {
          errorMessage = 'Network error: Could not connect to upload service. Please check your internet connection.';
        } else if (err.message.includes('timeout')) {
          errorMessage = 'Upload timed out. Please try again with a smaller file or check your connection.';
        } else if (err.message.includes('blocked') || err.message.includes('CORS')) {
          errorMessage = 'Upload was blocked. Please check your browser settings and extensions.';
        }

        toast({
          title: 'Upload Failed',
          description: errorMessage,
          variant: 'destructive',
          duration: 5000
        });

        setMessages(prev => prev.map(m => m.clientTempId === tempId ? {...m, status: 'error'} : m));
        xhrRequests.current.delete(tempId);
        setUploadProgress(prev => {
          const newMap = new Map(prev);
          newMap.delete(tempId);
          return newMap;
        });
        throw err;
    }
  }, [toast]);

  const handleFileUpload = useCallback(async (file: File, messageText: string, chatId: string, senderId: string): Promise<string> => {
      // Basic file validation
      if (!file || !(file instanceof File)) {
        toast({
          title: 'Invalid File',
          description: 'The selected file is invalid.',
          variant: 'destructive'
        });
        throw new Error('Invalid file object');
      }

      if (file.size === 0) {
        toast({
          title: 'Empty File',
          description: 'The selected file is empty.',
          variant: 'destructive'
        });
        throw new Error('File is empty');
      }

      // File size limit (10MB for images/audio, 50MB for videos)
      const maxSize = file.type.startsWith('video/') ? 50 * 1024 * 1024 : 10 * 1024 * 1024;
      if (file.size > maxSize) {
        toast({
          title: 'File Too Large',
          description: `File size must be less than ${maxSize / (1024 * 1024)}MB.`,
          variant: 'destructive'
        });
        throw new Error('File too large');
      }

      // Videos, Images, Audio, GIFs -> Cloudinary
      if (file.type.startsWith('video/') || file.type.startsWith('image/') || file.type.startsWith('audio/')) {
        console.log('Starting Cloudinary upload for file:', {
          type: file.type,
          size: file.size,
          name: file.name
        });
        
        try {
          // Verify Cloudinary configuration before uploading
          const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
          const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;
          
          console.log('Checking Cloudinary config:', { 
            hasCloudName: !!cloudName, 
            hasUploadPreset: !!uploadPreset,
            uploadPreset: uploadPreset
          });

          if (!cloudName || !uploadPreset) {
            throw new Error('Cloudinary configuration is missing');
          }

          return await handleCloudinaryUpload(file, messageText, chatId, senderId);
        } catch (error: any) {
          console.error('Cloudinary upload failed:', error);
          
          let errorMessage = 'Could not upload file. Please try again.';
          let errorTitle = 'Upload Failed';

          if (error?.message?.includes('configuration')) {
            errorMessage = 'Upload service is not properly configured. Please contact support.';
            errorTitle = 'Configuration Error';
          } else if (error?.message?.includes('Network error')) {
            errorMessage = 'Network error occurred. Please check your internet connection.';
            errorTitle = 'Connection Error';
          } else if (error?.message?.includes('413')) {
            errorMessage = 'File size exceeds server limits.';
            errorTitle = 'File Too Large';
          } else if (error?.message?.includes('blocked')) {
            errorMessage = 'Upload was blocked. Please check your browser settings and extensions.';
            errorTitle = 'Upload Blocked';
          } else if (error?.message?.includes('CORS')) {
            errorMessage = 'Upload failed due to security restrictions. Please try again or contact support.';
            errorTitle = 'Security Error';
          }

          toast({
            title: errorTitle,
            description: errorMessage,
            variant: 'destructive',
            duration: 5000
          });
          throw error;
        }
      }
    
      // Other files -> Firebase Storage
      const tempId = uuidv4();
      const optimisticMessage: Message = {
          id: tempId,
          clientTempId: tempId,
          senderId: senderId,
          text: messageText,
          timestamp: new Date(),
          status: 'sending',
          file: {
              url: URL.createObjectURL(file),
              type: file.type,
              name: file.name
          }
      };

      setMessages(prev => [...prev, optimisticMessage]);
  
      const fileId = `${Date.now()}_${file.name}`;
      const storageRef = ref(storage, `uploads/${chatId}/${fileId}`);
      const metadata = { contentType: file.type };
      
      const uploadTask = uploadBytesResumable(storageRef, file, metadata);
      uploadTasks.current.set(tempId, uploadTask);
    
      uploadTask.on('state_changed', 
          (snapshot) => {
              const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
              setUploadProgress(prev => {
                const newMap = new Map(prev);
                newMap.set(tempId, progress);
                return newMap;
              });
          },
          (error) => {
              console.error('Upload error:', error);
              setMessages(prev => prev.map(m => m.clientTempId === tempId ? {...m, status: 'error'} : m));
              uploadTasks.current.delete(tempId);
          },
          async () => {
              try {
                  const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                  
                  const finalMessageData = {
                    senderId: senderId,
                    text: messageText,
                    timestamp: serverTimestamp(),
                    clientTempId: tempId,
                    file: {
                        url: downloadURL,
                        type: file.type,
                        name: file.name,
                    },
                  };
                  
                  const messageCollectionRef = collection(db, 'conversations', chatId, 'messages');
                  await addDoc(messageCollectionRef, finalMessageData);
  
                  const lastMessageText = messageText || `Sent a file: ${file.name}`;
  
                  const chatRef = doc(db, 'conversations', chatId);
                  await updateDoc(chatRef, {
                      lastMessage: {
                          text: lastMessageText,
                          senderId: senderId,
                          timestamp: serverTimestamp(),
                      },
                  });
              } catch(e) {
                  console.error('Error saving message after upload:', e);
                  setMessages(prev => prev.map(m => m.clientTempId === tempId ? {...m, status: 'error'} : m));
              } finally {
                  uploadTasks.current.delete(tempId);
                  setUploadProgress(prev => {
                      const newMap = new Map(prev);
                      newMap.delete(tempId);
                      return newMap;
                  });
              }
          }
      );
        
      return tempId;
  }, [handleCloudinaryUpload, toast]);
  
  const cancelUpload = useCallback((messageId: string) => {
    const firebaseTask = uploadTasks.current.get(messageId);
    if (firebaseTask) {
      firebaseTask.cancel();
      uploadTasks.current.delete(messageId);
    }
    
    const cloudinaryXhrSignal = xhrRequests.current.get(messageId);
    if (cloudinaryXhrSignal?.xhrAbort) {
        cloudinaryXhrSignal.xhrAbort();
        xhrRequests.current.delete(messageId);
    }
    
    // Clean up any file URLs
    const message = messages.find(m => m.clientTempId === messageId);
    if (message?.file?.url.startsWith('blob:')) {
      URL.revokeObjectURL(message.file.url);
    }
    
    setMessages(prev => prev.filter(m => m.clientTempId !== messageId));
    setUploadProgress(prev => {
      const newProgress = new Map(prev);
      newProgress.delete(messageId);
      return newProgress;
    });
  }, [messages]);


  const handleCreateChat = useCallback(async (targetUser: User): Promise<string> => {
    if (!currentUser) return Promise.reject("No current user");
  
    const participants = [currentUser.uid, targetUser.uid].sort();
  
    const q = query(collection(db, "conversations"),
      where("type", "==", "private"),
      where("participants", "==", participants)
    );
  
    const querySnapshot = await getDocs(q);
  
    if (!querySnapshot.empty) {
      const existingConvoDoc = querySnapshot.docs[0];
      handleChatSelect(existingConvoDoc.id);
      return existingConvoDoc.id;
    } else {
      try {
        const newConvoRef = await addDoc(collection(db, 'conversations'), {
          type: 'private',
          participants: participants,
          createdAt: serverTimestamp(),
          lastMessage: null,
          lastRead: {}
        });
        setNewlyCreatedChatId(newConvoRef.id);
        return newConvoRef.id;
      } catch (error) {
        console.error("Error creating new chat:", error);
        return Promise.reject(error);
      }
    }
  }, [currentUser, handleChatSelect, conversations]);
  
  const handleCreateGroupChat = useCallback(async (groupName: string, selectedUsers: User[]) => {
    if (!currentUser) return;
  
    const participantUids = [currentUser.uid, ...selectedUsers.map(u => u.uid)].sort();
  
    const newConvoData = {
      type: 'group',
      name: groupName,
      participants: participantUids,
      createdBy: currentUser.uid,
      createdAt: serverTimestamp(),
      lastMessage: null,
      avatar: null,
      lastRead: {}
    };
  
    const newConvoRef = await addDoc(collection(db, 'conversations'), newConvoData);
    setNewlyCreatedChatId(newConvoRef.id);
  }, [currentUser]);

  const handleConversationAction = useCallback(async (
    conversationId: string,
    action: 'toggleFavorite' | 'archive' | 'unarchive'
  ) => {
    const conversation = conversations.find(c => c.id === conversationId);
    if (!conversation) return;

    const conversationRef = doc(db, 'conversations', conversationId);

    if (action === 'toggleFavorite') {
      await updateDoc(conversationRef, {
        isFavorite: !conversation.isFavorite,
      });
    } else if (action === 'archive') {
      await updateDoc(conversationRef, {
        isArchived: true,
      });
      if (selectedChat?.id === conversationId) {
        setSelectedChat(undefined);
      }
    } else if (action === 'unarchive') {
        await updateDoc(conversationRef, {
            isArchived: false,
        });
    }
  }, [conversations, selectedChat?.id]);

  const handleMessageAction = useCallback(async (
    messageId: string,
    action: 'react' | 'delete',
    data?: unknown
  ): Promise<void> => {
    if (!selectedChat || !currentUser) return;

    if (action === 'delete') {
      const messageToDelete = messages.find(m => m.id === messageId || m.clientTempId === messageId);
      if (!messageToDelete) return;
      
      // Optimistically update messages list
      setMessages(prevMessages => prevMessages.map(msg => 
        msg.id === messageToDelete.id ? {
          ...msg,
          text: 'This message was deleted.',
          file: undefined,
          deleted: true,
          reactions: []
        } : msg
      ));
      
      // Always update the conversation's last message for optimistic UI
      const previousMessage = messages
        .filter(m => m.id !== messageToDelete.id && !m.deleted)
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())[0];
      
      setConversations(prevConvos => prevConvos.map(convo =>
        convo.id === selectedChat.id ? {
          ...convo,
          lastMessage: previousMessage ? {
            text: previousMessage.text,
            senderId: previousMessage.senderId,
            timestamp: Timestamp.fromDate(previousMessage.timestamp)
          } : undefined
        } : convo
      ));
      
      const messageRef = doc(db, 'conversations', selectedChat.id, 'messages', messageToDelete.id);
      const convoRef = doc(db, 'conversations', selectedChat.id);
      
      try {
        await runTransaction(db, async (transaction) => {
          // Update the message
          transaction.update(messageRef, {
            text: 'This message was deleted.',
            file: deleteField(),
            deleted: true,
            reactions: []
          });
          
          // Always check if this affects the last message
          const previousMessage = messages
            .filter(m => m.id !== messageToDelete.id && !m.deleted)
            .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())[0];

          // Update conversation's lastMessage
          if (previousMessage) {
            transaction.update(convoRef, {
              lastMessage: {
                text: previousMessage.text,
                senderId: previousMessage.senderId,
                timestamp: Timestamp.fromDate(previousMessage.timestamp)
              }
            });
          } else {
            transaction.update(convoRef, {
              lastMessage: deleteField()
            });
          }
        });
      } catch (error) {
        console.error("Error deleting message", error);
        // Revert optimistic updates on error
        setMessages(prevMessages => prevMessages.map(msg => 
          msg.id === messageToDelete.id ? messageToDelete : msg
        ));
        setConversations(prevConvos => prevConvos.map(convo =>
          convo.id === selectedChat.id ? {
            ...convo,
            lastMessage: selectedChat.lastMessage
          } : convo
        ));
      }
    } else if (action === 'react') {
      const emoji = data as string;
      
      setMessages(prevMessages => prevMessages.map(msg => {
          if (msg.id === messageId) {
              const reactions = msg.reactions || [];
              const existingReaction = reactions.find(r => r.emoji === emoji);
              let newReactions: MessageReaction[];

              if (existingReaction) {
                  const userIndex = existingReaction.users.indexOf(currentUser.uid);
                  if (userIndex > -1) {
                      existingReaction.users.splice(userIndex, 1);
                      existingReaction.count--;
                  } else {
                      existingReaction.users.push(currentUser.uid);
                      existingReaction.count++;
                  }
                  newReactions = reactions.filter(r => r.count > 0);
              } else {
                  newReactions = [...reactions, { emoji, users: [currentUser.uid], count: 1 }];
              }
              return { ...msg, reactions: newReactions };
          }
          return msg;
      }));

      const messageRef = doc(db, 'conversations', selectedChat.id, 'messages', messageId);
      try {
        await runTransaction(db, async (transaction) => {
          const messageDoc = await transaction.get(messageRef);
          if (!messageDoc.exists()) return;
          const messageData = messageDoc.data() as Message;
          let reactions = messageData.reactions || [];
          let existingReaction = reactions.find(r => r.emoji === emoji);

          if (existingReaction) {
            const userIndex = existingReaction.users.indexOf(currentUser.uid);
            if (userIndex > -1) {
                existingReaction.users.splice(userIndex, 1);
                existingReaction.count--;
            } else {
                existingReaction.users.push(currentUser.uid);
                existingReaction.count++;
            }
          } else {
            reactions.push({ emoji, users: [currentUser.uid], count: 1 });
          }
          
          const finalReactions = reactions.filter(r => r.count > 0);
          transaction.update(messageRef, { reactions: finalReactions });
        });
      } catch (error) {
        console.error("Error reacting to message", error);
        setMessages(messages);
      }
    }
  }, [selectedChat, currentUser, messages]);  const handleFriendAction = useCallback(async (targetUserId: string, action: 'sendRequest' | 'acceptRequest' | 'declineRequest' | 'removeFriend') => {
    if (!currentUser) return;
    const currentUserRef = doc(db, 'users', currentUser.uid);
    const targetUserRef = doc(db, 'users', targetUserId);

    try {
      if (action === 'sendRequest') {
          await updateDoc(currentUserRef, { friendRequestsSent: arrayUnion(targetUserId) });
          await updateDoc(targetUserRef, { friendRequestsReceived: arrayUnion(currentUser.uid) });
          toast({ title: 'Request Sent', description: 'Your friend request has been sent.' });
      } else if (action === 'acceptRequest') {
          await updateDoc(currentUserRef, { 
              friends: arrayUnion(targetUserId),
              friendRequestsReceived: arrayRemove(targetUserId)
          });
          await updateDoc(targetUserRef, {
              friends: arrayUnion(currentUser.uid),
              friendRequestsSent: arrayRemove(currentUser.uid)
          });
          toast({ title: 'Friend Added', description: 'You are now friends!' });
      } else if (action === 'declineRequest') {
          await updateDoc(currentUserRef, { friendRequestsReceived: arrayRemove(targetUserId) });
          await updateDoc(targetUserRef, { friendRequestsSent: arrayRemove(currentUser.uid) });
          toast({ title: 'Request Declined' });
      } else if (action === 'removeFriend') {
          await updateDoc(currentUserRef, { friends: arrayRemove(targetUserId) });
          await updateDoc(targetUserRef, { friends: arrayRemove(currentUser.uid) });
          toast({ title: 'Friend Removed' });
      }
    } catch (error: any) {
        console.error("Error with friend action:", error);
        toast({ title: 'Error', description: error.message || "An unexpected error occurred.", variant: "destructive" });
    }
  }, [currentUser, toast, authUser]);

  const handleBlockUser = useCallback(async (targetUserId: string, isBlocked: boolean) => {
    if (!currentUser) return;
    const currentUserRef = doc(db, 'users', currentUser.uid);

    try {
      if (isBlocked) {
        await updateDoc(currentUserRef, { blockedUsers: arrayRemove(targetUserId) });
        toast({ title: 'User Unblocked', description: 'You can now receive messages from this user.' });
      } else {
        await updateDoc(currentUserRef, { blockedUsers: arrayUnion(targetUserId) });
        toast({ title: 'User Blocked', description: 'You will no longer see messages or chats from this user.' });
      }
    } catch (error: any) {
      console.error("Error blocking user:", error);
      toast({ title: 'Error', description: error.message || 'An unexpected error occurred.', variant: 'destructive' });
    }
  }, [currentUser, toast]);
  
  const handleMuteToggle = useCallback(async (conversationId: string) => {
      if (!currentUser) return;
      const userRef = doc(db, 'users', currentUser.uid);
      const isMuted = currentUser.mutedConversations?.includes(conversationId);

      try {
          if (isMuted) {
              await updateDoc(userRef, { mutedConversations: arrayRemove(conversationId) });
              toast({ title: 'Unmuted', description: 'You will now receive notifications from this chat.' });
          } else {
              await updateDoc(userRef, { mutedConversations: arrayUnion(conversationId) });
              toast({ title: 'Muted', description: 'You will no longer receive notifications from this chat.' });
          }
      } catch (error: any) {
          console.error("Error toggling mute:", error);
          toast({ title: 'Error', description: error.message || "Could not update mute setting.", variant: 'destructive'});
      }
  }, [currentUser, toast]);


  const handleCreateStory = useCallback(async (mediaFile: File, caption?: string) => {
    if (!currentUser) return Promise.reject("No current user");
  
    const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
    const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;
    if (!cloudName || !uploadPreset) {
      toast({ title: "Cloudinary not configured", variant: "destructive" });
      return Promise.reject("Cloudinary not configured");
    }
  
    const tempId = uuidv4();
    const isVideo = mediaFile.type.startsWith('video/');
    const tempUrl = URL.createObjectURL(mediaFile);
    const optimisticStory: Story = {
      id: tempId,
      ownerId: currentUser.uid,
      mediaUrl: tempUrl,
      mediaType: isVideo ? 'video' : 'image',
      caption,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 24*60*60*1000),
      viewedBy: [],
      reactions: [],
    };
    setStories(prev => [optimisticStory, ...prev]);

    // Clean up URL object when story is uploaded or on error
    const cleanup = () => URL.revokeObjectURL(tempUrl);
  
    let signal: { xhrAbort?: () => void } = {};
    try {
      const { secure_url, resource_type, duration } = await uploadToCloudinaryXHR(mediaFile, cloudName, uploadPreset, p => {
        // optionally show story upload progress if you want
      }, signal);
      
      const now = Timestamp.now();
      const expiresAt = new Timestamp(now.seconds + 24*60*60, now.nanoseconds);
      const storyData: Omit<Story, 'id'> = {
        ownerId: currentUser.uid,
        mediaUrl: secure_url,
        mediaType: isVideo ? 'video' : 'image',
        caption,
        createdAt: now,
        expiresAt,
        viewedBy: [],
        reactions: [],
      }
      if(isVideo && duration) {
        storyData.duration = duration;
      }

      await addDoc(collection(db, 'stories'), storyData);
      
      toast({ title: "Story posted!" });
    } catch (err) {
      console.error("Error uploading story:", err);
      // remove optimistic story or mark failed
      setStories(prev => prev.filter(s => s.id !== tempId));
      toast({ title: "Error", description: "Failed to post story.", variant: "destructive" });
      return Promise.reject(err);
    }
  }, [currentUser, toast]);


  const handleViewStory = useCallback((user: User, stories: Story[]) => {
      setViewingStory({ user, stories });
  }, []);
  
  const handleStoryMarkAsViewed = useCallback(async (storyId: string) => {
    if(!currentUser) return;
    try {
        await updateDoc(doc(db, 'stories', storyId), {
            viewedBy: arrayUnion(currentUser.uid)
        });
    } catch (error) {
        console.error("Failed to mark story as viewed", error);
    }
  }, [currentUser]);

  const handleDeleteStory = useCallback(async (storyId: string) => {
    try {
        await deleteDoc(doc(db, 'stories', storyId));
        toast({ title: "Story deleted" });
        setViewingStory(null); // Close the viewer
    } catch (error) {
        console.error("Error deleting story:", error);
        toast({ title: "Error", description: "Failed to delete story.", variant: "destructive" });
    }
  }, [toast]);
  
  const handleStoryReaction = useCallback(async (storyId: string, emoji: string) => {
    if (!currentUser?.uid) return;
    try {
      const storyRef = doc(db, 'stories', storyId);
      const reaction: StoryReaction = {
        emoji,
        userId: currentUser.uid,
      };
      await updateDoc(storyRef, {
        reactions: arrayUnion(reaction)
      });
    } catch(error) {
       console.error("Failed to add reaction to story", error);
    }
  }, [currentUser]);


  const activeSendMessage = useCallback(async (messageText: string, replyTo?: Message['replyTo']): Promise<string> => {
    if (!selectedChat || !currentUser) return Promise.reject("No chat selected");
    if (selectedChat.id === AI_USER_ID) {
      await handleAiConversation(messageText);
      return Promise.resolve(uuidv4()); // Return a temp ID for AI chat
    } else {
      return handleSendMessage(selectedChat.id, currentUser.uid, messageText, replyTo);
    }
  }, [selectedChat, currentUser, handleAiConversation, handleSendMessage]);

  const activeSendFile = useCallback((file: File, message: string): Promise<string> => {
      if (!selectedChat || !currentUser) return Promise.reject("No chat selected");
      return handleFileUpload(file, message, selectedChat.id, currentUser.uid);
  }, [selectedChat, currentUser, handleFileUpload]);

  const activeSendBase64File = useCallback((base64: string, fileType: string, fileName: string, caption: string) => {
      if (!selectedChat || !currentUser) return Promise.reject("No chat selected");
      return handleSendBase64File(selectedChat.id, currentUser.uid, base64, fileType, fileName, caption);
  }, [selectedChat, currentUser, handleSendBase64File]);

  const handleBack = useCallback(() => {
    if (selectedChat?.id === AI_USER_ID) {
      setIsAiReplying(false);
    }
    setSelectedChat(undefined);
  }, [selectedChat?.id]);

  const handleTyping = useCallback(async (isTyping: boolean) => {
    if (!selectedChat || !currentUser || selectedChat.id === AI_USER_ID) return;

    const chatRef = doc(db, 'conversations', selectedChat.id);
    try {
      if (isTyping) {
        await updateDoc(chatRef, {
          typing: arrayUnion(currentUser.uid)
        });
      } else {
        await updateDoc(chatRef, {
          typing: arrayRemove(currentUser.uid)
        });
      }
    } catch (error) {
      console.error("Error updating typing status:", error);
    }
  }, [selectedChat, currentUser]);
  
  const handleStoryReply = useCallback(async (story: Story, message: string) => {
    if (!currentUser) return;
    const storyOwnerId = story.ownerId;
    const storyOwner = usersCache.get(storyOwnerId);
    if (!storyOwner) return;

    setViewingStory(null); // Close the viewer

    let chatId: string;
    const existingConvo = conversations.find(c => c.type === 'private' && c.participants.includes(storyOwnerId));
    
    if(existingConvo) {
      chatId = existingConvo.id;
      handleChatSelect(existingConvo.id);
    } else {
      chatId = await handleCreateChat(storyOwner);
    }
    
    const replyTo: Message['replyTo'] = {
        storyId: story.id,
        storyMedia: story.mediaUrl,
        messageSender: storyOwner.name,
        messageText: 'Replied to story'
    };
    
    handleSendMessage(chatId, currentUser.uid, message, replyTo);
    
    toast({ title: 'Reply Sent!' });

  }, [currentUser, usersCache, conversations, handleCreateChat, handleSendMessage, toast, handleChatSelect]);

  const usersWithStories = allUsers.filter(u => stories.some(s => s.ownerId === u.uid));
  
  const handleCreateStoryFromFile = async (file: File, caption: string) => {
    return handleCreateStory(file, caption);
  };

  const handleClearChat = useCallback(async (conversationId: string) => {
    const messagesRef = collection(db, 'conversations', conversationId, 'messages');
    
    try {
      const querySnapshot = await getDocs(messagesRef);
      if (querySnapshot.empty) return;
  
      // Firestore allows a maximum of 500 operations in a single batch.
      const batchSize = 500;
      let batch = writeBatch(db);
      let count = 0;
  
      for (const messageDoc of querySnapshot.docs) {
        batch.delete(messageDoc.ref);
        count++;
        if (count === batchSize) {
          await batch.commit();
          batch = writeBatch(db);
          count = 0;
        }
      }
  
      if (count > 0) {
        await batch.commit();
      }

      await updateDoc(doc(db, 'conversations', conversationId), {
        lastMessage: null
      });
      
      setMessages([]);

      toast({ title: 'Chat Cleared', description: 'All messages have been deleted.' });

    } catch (error) {
      console.error("Error clearing chat:", error);
      toast({ title: 'Error', description: 'Could not clear chat history.', variant: 'destructive' });
    }
  }, [toast]);


  return {
    conversations,
    selectedChat,
    isAiReplying,
    allUsers,
    usersCache,
    currentUser,
    uploadProgress,
    stories,
    viewingStory,
    setViewingStory,
    usersWithStories,
    previewStoryFile, 
    setPreviewStoryFile,
    aiConversation,
    messages,
    loadMoreMessages,
    hasMoreMessages,
    isLoadingMore,
    handleViewStory,
    handleCreateStory,
    handleStoryMarkAsViewed,
    handleDeleteStory,
    handleStoryReaction,
    handleChatSelect,
    activeSendMessage,
    activeSendFile,
    activeSendBase64File,
    handleMessageAction,
    cancelUpload,
    handleCreateChat,
    handleCreateGroupChat,
    handleBack,
    handleConversationAction,
    handleTyping,
    handleFriendAction,
    handleBlockUser,
    handleCreateStoryFromFile,
    handleStoryReply,
    handleMuteToggle,
    handleClearChat,
  }
}

interface AppShellContextType {
  conversations: Conversation[];
  selectedChat: Conversation | undefined;
  isAiReplying: boolean;
  allUsers: User[];
  usersCache: Map<string, User>;
  currentUser: User | undefined;
  uploadProgress: Map<string, number>;
  stories: Story[];
  viewingStory: { user: User, stories: Story[] } | null;
  setViewingStory: (story: { user: User, stories: Story[] } | null) => void;
  usersWithStories: User[];
  previewStoryFile: File | null;
  setPreviewStoryFile: (file: File | null) => void;
  aiConversation: Conversation;
  messages: Message[];
  loadMoreMessages: () => Promise<void>;
  hasMoreMessages: boolean;
  isLoadingMore: boolean;
  handleViewStory: (user: User, stories: Story[]) => void;
  handleCreateStory: (file: File, caption?: string) => Promise<void>;
  handleStoryMarkAsViewed: (storyId: string) => Promise<void>;
  handleDeleteStory: (storyId: string) => Promise<void>;
  handleStoryReaction: (storyId: string, emoji: string) => Promise<void>;
  handleChatSelect: (chatId: string) => Promise<void>;
  activeSendMessage: (messageText: string, replyTo?: Message['replyTo']) => Promise<string>;
  activeSendFile: (file: File, message: string) => Promise<string>;
  activeSendBase64File: (base64: string, fileType: string, fileName: string, caption: string) => Promise<void>;
  handleMessageAction: (messageId: string, action: 'react' | 'delete', data?: unknown) => Promise<void>;
  cancelUpload: (messageId: string) => void;
  handleCreateChat: (targetUser: User) => Promise<string>;
  handleCreateGroupChat: (groupName: string, selectedUsers: User[]) => Promise<void>;
  handleBack: () => void;
  handleConversationAction: (conversationId: string, action: 'toggleFavorite' | 'archive' | 'unarchive') => Promise<void>;
  handleTyping: (isTyping: boolean) => Promise<void>;
  handleFriendAction: (targetUserId: string, action: 'sendRequest' | 'acceptRequest' | 'declineRequest' | 'removeFriend') => Promise<void>;
  handleBlockUser: (targetUserId: string, isBlocked: boolean) => Promise<void>;
  handleCreateStoryFromFile: (file: File, caption: string) => Promise<void>;
  handleStoryReply: (story: Story, message: string) => Promise<void>;
  handleMuteToggle: (conversationId: string) => Promise<void>;
  handleClearChat: (conversationId: string) => Promise<void>;
}

const AppShellContext = createContext<AppShellContextType | undefined>(undefined);

export { AppShellContext };  // Export the context for use in other files

export function useAppShell(): AppShellContextType {
  const context = useContext(AppShellContext);
  if (!context) {
    throw new Error('useAppShell must be used within an AppShell provider');
  }
  return context;
}

function AppBackground() {
  const { appBackground, useCustomBackground } = useAppearance();
  const isMobile = useIsMobile();

  if (!useCustomBackground) {
    return isMobile ? <MobileGalaxyBackground /> : <GalaxyBackground />;
  }

  switch(appBackground) {
    case 'galaxy':
      return isMobile ? <MobileGalaxyBackground /> : <GalaxyBackground />;
    case 'glow':
      return <GradientGlowBackground />;
    case 'aura':
      return <AuraBackground />;
    case 'grid':
        return <GridBackground />;
    default:
      return isMobile ? <MobileGalaxyBackground /> : <GalaxyBackground />;
  }
}

export function AppShell({ children }: { children: React.ReactNode }): JSX.Element {
  const chatData = useChatData();
  const { toast } = useToast();
  
  // Check for blocked Firestore requests
  useEffect(() => {
    const checkFirestore = async () => {
      try {
        // Try a simple Firestore operation
        const testRef = doc(db, '_health_check', 'test');
        await getDoc(testRef).catch(e => {
          // Ignore document not found errors
          if (e?.code !== 'not-found') throw e;
        });
      } catch (error: any) {
        console.error('Firestore check error:', error);
        if (error?.message?.includes('ERR_BLOCKED_BY_CLIENT')) {
          toast({
            title: "Connection Issue",
            description: "Please disable any ad blockers or privacy extensions that might interfere with the app's functionality.",
            variant: "destructive",
            duration: 10000
          });
        }
      }
    };
    
    if (typeof window !== 'undefined') {
      checkFirestore();
    }
  }, [toast]);
  
  // Setup presence and online status monitoring
  usePresence(chatData.currentUser);
  useOnlineStatus(chatData.currentUser);
  
  return (
    <AppShellContext.Provider value={chatData}>
      <StoriesContext.Provider value={{
        stories: chatData.stories,
        usersWithStories: chatData.usersWithStories,
        currentUser: chatData.currentUser,
        onViewStory: chatData.handleViewStory,
        onCreateStory: chatData.setPreviewStoryFile,
        usersCache: chatData.usersCache,
      }}>
        <div className="relative">
          <AppBackground />
          <div className="relative z-10">
            {children}
          </div>
        </div>

        {chatData.previewStoryFile && (
          <ImagePreviewDialog
            file={chatData.previewStoryFile}
            mode="story"
            onSend={chatData.handleCreateStoryFromFile}
            onCancel={() => chatData.setPreviewStoryFile(null)}
          />
        )}
        
        {chatData.viewingStory && (
            <StoryViewer 
                isOpen={!!chatData.viewingStory}
                onOpenChange={(open) => !open && chatData.setViewingStory(null)}
                user={chatData.viewingStory.user}
                stories={chatData.viewingStory.stories}
                currentUser={chatData.currentUser}
                onMarkAsViewed={chatData.handleStoryMarkAsViewed}
                onDeleteStory={chatData.handleDeleteStory}
                onReply={chatData.handleStoryReply}
                onReact={chatData.handleStoryReaction}
                usersCache={chatData.usersCache}
            />
        )}
      </StoriesContext.Provider>
    </AppShellContext.Provider>
  )
}
