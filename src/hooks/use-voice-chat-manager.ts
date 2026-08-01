import { useEffect, useRef, useState, useCallback } from 'react';
import { db } from '@/lib/firebase';
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  updateDoc,
  setDoc,
} from 'firebase/firestore';
import { CallSession } from '@/lib/voice/types';

export function useVoiceChatManager(currentUserId?: string) {
  const [incomingCall, setIncomingCall] = useState<CallSession | null>(null);
  const stableUserIdRef = useRef<string | undefined>(currentUserId);

  // Keep stable user ID cached to prevent user re-hydration state flickering
  useEffect(() => {
    if (currentUserId && currentUserId.length > 0) {
      stableUserIdRef.current = currentUserId;
    }
  }, [currentUserId]);

  const activeUserId = currentUserId || stableUserIdRef.current;

  // Real-time Firestore snapshot listener for incoming calls where receiverId === activeUserId
  useEffect(() => {
    if (!activeUserId) return;

    console.log('[VoiceManager] Listening for calls for receiver:', activeUserId);

    const callsQuery = query(
      collection(db, 'calls'),
      where('receiverId', '==', activeUserId),
      where('status', '==', 'ringing')
    );

    const unsub = onSnapshot(
      callsQuery,
      (snapshot) => {
        if (!snapshot.empty) {
          const docSnap = snapshot.docs[0];
          const data = docSnap.data();

          // Calculate call age for auto-hangup 30s timeout
          let isExpired = false;
          if (data.createdAt) {
            const createdMs =
              typeof data.createdAt.toMillis === 'function'
                ? data.createdAt.toMillis()
                : data.createdAt.seconds
                ? data.createdAt.seconds * 1000
                : Date.now();
            if (Date.now() - createdMs > 30000) {
              isExpired = true;
            }
          }

          if (isExpired) {
            console.log('[VoiceManager] Call timed out after 30s ringing. Auto-cancelling call:', docSnap.id);
            const callRef = doc(db, 'calls', docSnap.id);
            updateDoc(callRef, { status: 'cancelled' }).catch(() => {});
            setIncomingCall(null);
            return;
          }

          // Maintain incomingCall state across offer/candidate document updates while ringing
          setIncomingCall((prevCall) => {
            const newCallData: CallSession = {
              id: docSnap.id,
              chatId: data.chatId || docSnap.id,
              callerId: data.callerId,
              callerName: data.callerName || 'User',
              callerAvatar: data.callerAvatar || '',
              receiverId: data.receiverId,
              status: data.status,
              offer: data.offer,
              answer: data.answer,
              createdAt: data.createdAt,
            };

            // If previous call was already ringing for the same document, merge updates smoothly
            if (prevCall && prevCall.chatId === newCallData.chatId && newCallData.status === 'ringing') {
              return { ...prevCall, ...newCallData };
            }
            return newCallData;
          });
        } else {
          // Dismiss modal when snapshot becomes empty (status changed from ringing)
          setIncomingCall(null);
        }
      },
      (err) => {
        console.error('[VoiceManager] Firestore snapshot error:', err);
      }
    );

    return () => unsub();
  }, [activeUserId]);

  // Auto-hangup 30s safety timer for active incoming call
  useEffect(() => {
    if (!incomingCall || incomingCall.status !== 'ringing') return;

    const timer = setTimeout(() => {
      console.log('[VoiceManager] 30s auto-hangup timer triggered for call:', incomingCall.chatId);
      const callRef = doc(db, 'calls', incomingCall.chatId);
      updateDoc(callRef, { status: 'cancelled' }).catch(async () => {
        await setDoc(callRef, { status: 'cancelled' }, { merge: true }).catch(() => {});
      });
      setIncomingCall(null);
    }, 30000);

    return () => clearTimeout(timer);
  }, [incomingCall]);

  const acceptCall = useCallback(async (call: CallSession) => {
    try {
      const callDocRef = doc(db, 'calls', call.chatId);
      await updateDoc(callDocRef, { status: 'accepted' }).catch(async () => {
        await setDoc(callDocRef, { status: 'accepted' }, { merge: true });
      });
      setIncomingCall(null);
    } catch (err) {
      console.error('[VoiceManager] Error accepting call:', err);
    }
  }, []);

  const declineCall = useCallback(async (call: CallSession) => {
    try {
      const callDocRef = doc(db, 'calls', call.chatId);
      await updateDoc(callDocRef, { status: 'declined' }).catch(async () => {
        await setDoc(callDocRef, { status: 'declined' }, { merge: true });
      });
      setIncomingCall(null);
    } catch (err) {
      console.error('[VoiceManager] Error declining call:', err);
    }
  }, []);

  return {
    incomingCall,
    acceptCall,
    declineCall,
  };
}
