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
import { callTelemetry, checkMicrophonePermission, logVoiceError } from '@/lib/voice/telemetry';

export function useVoiceChatManager(currentUserId?: string) {
  const [incomingCall, setIncomingCall] = useState<CallSession | null>(null);
  const [showMicPermissionModal, setShowMicPermissionModal] = useState(false);

  // 1. Stabilize currentUserId reference using a persistent useRef & cached state
  const stableUserIdRef = useRef<string | undefined>(currentUserId);
  if (currentUserId && currentUserId.length > 0) {
    stableUserIdRef.current = currentUserId;
  }
  const activeUserId = currentUserId || stableUserIdRef.current;

  // 2. Store active call listener unsubscribe function in a ref to prevent duplicate subscriptions
  const listenerUnsubRef = useRef<(() => void) | null>(null);
  const subscribedUserIdRef = useRef<string | undefined>(undefined);

  // Real-time Firestore snapshot listener for incoming calls
  useEffect(() => {
    if (!activeUserId) {
      if (listenerUnsubRef.current) {
        listenerUnsubRef.current();
        listenerUnsubRef.current = null;
        subscribedUserIdRef.current = undefined;
      }
      return;
    }

    // Avoid duplicate subscriptions if listener is already active for the same activeUserId
    if (subscribedUserIdRef.current === activeUserId && listenerUnsubRef.current) {
      return;
    }

    // Cleanup existing subscription if switching users
    if (listenerUnsubRef.current) {
      listenerUnsubRef.current();
      listenerUnsubRef.current = null;
    }

    subscribedUserIdRef.current = activeUserId;
    console.log('[VoiceManager] Subscribing listener for incoming calls. Receiver ID:', activeUserId);

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

          // Auth desync guard check
          if (data.receiverId !== activeUserId) {
            logVoiceError(201, {
              reason: 'Receiver ID mismatch in call doc snapshot',
              docReceiverId: data.receiverId,
              activeUserId,
            });
            callTelemetry.setError('ERR_SNAPSHOT_DESYNC', {
              docReceiverId: data.receiverId,
              activeUserId,
            });
            return;
          }

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
            callTelemetry.reset();
            return;
          }

          // 3. GUARD state updates: DO NOT reset incomingCall state to null if the document is updated
          // with new metadata (like candidates or offer timestamps).
          // ONLY update/maintain incomingCall state when status is explicitly 'ringing'.
          if (data.status === 'ringing') {
            callTelemetry.update({
              status: 'ringing',
              currentStep: 'Incoming Call Ringing',
              errorCode: null,
            });

            setIncomingCall((prevCall) => {
              const newCallData: CallSession = {
                id: docSnap.id,
                chatId: data.chatId || docSnap.id,
                callerId: data.callerId,
                callerName: data.callerName && data.callerName.trim() !== '' ? data.callerName : 'Incoming Call...',
                callerAvatar: data.callerAvatar || '',
                receiverId: data.receiverId,
                status: data.status,
                offer: data.offer,
                answer: data.answer,
                createdAt: data.createdAt,
              };

              // Merge metadata smoothly without triggering UI flicker
              if (prevCall && prevCall.chatId === newCallData.chatId) {
                return { ...prevCall, ...newCallData };
              }
              return newCallData;
            });
          } else if (['ended', 'declined', 'cancelled', 'failed'].includes(data.status)) {
            // ONLY set incomingCall to null if status explicitly changes to ended/declined/cancelled/failed
            setIncomingCall(null);
            callTelemetry.update({
              status: data.status,
              currentStep: `Call ${data.status}`,
            });
          }
        } else {
          // Document was deleted or status changed away from ringing -> reset incomingCall
          setIncomingCall(null);
        }
      },
      (err) => {
        logVoiceError('SNAPSHOT_ERR', err);
      }
    );

    listenerUnsubRef.current = unsub;

    return () => {
      // Cleanup on unmount or user change
      if (listenerUnsubRef.current) {
        listenerUnsubRef.current();
        listenerUnsubRef.current = null;
        subscribedUserIdRef.current = undefined;
      }
    };
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
      callTelemetry.reset();
    }, 30000);

    return () => clearTimeout(timer);
  }, [incomingCall]);

  const acceptCall = useCallback(async (call: CallSession) => {
    callTelemetry.update({
      status: 'connecting',
      currentStep: 'Checking Microphone Permission',
    });

    // Check microphone permission before proceeding
    const perm = await checkMicrophonePermission();
    if (perm.state === 'denied') {
      callTelemetry.setError('ERR_MIC_DENIED', 'Microphone permission state is denied');
      setShowMicPermissionModal(true);
      return false;
    }

    // Direct getUserMedia test to ensure microphone can be accessed
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Stop temporary track right after test since VoiceRoom will manage the actual media stream
      stream.getTracks().forEach((track) => track.stop());
    } catch (micErr: any) {
      logVoiceError(101, micErr);
      callTelemetry.setError('ERR_MIC_DENIED', micErr?.message || 'Microphone access denied');
      setShowMicPermissionModal(true);
      return false;
    }

    try {
      callTelemetry.update({
        status: 'accepting',
        currentStep: 'Posting Acceptance to Firestore',
      });
      const callDocRef = doc(db, 'calls', call.chatId);
      await updateDoc(callDocRef, { status: 'accepted' }).catch(async () => {
        await setDoc(callDocRef, { status: 'accepted' }, { merge: true });
      });
      setIncomingCall(null);
      return true;
    } catch (err: any) {
      logVoiceError('ACCEPT_ERR', err);
      callTelemetry.setError('ERR_ANSWER_TIMEOUT', err?.message || 'Failed to accept call in Firestore');
      return false;
    }
  }, []);

  const declineCall = useCallback(async (call: CallSession) => {
    try {
      callTelemetry.update({
        status: 'declining',
        currentStep: 'Declining Call',
      });
      const callDocRef = doc(db, 'calls', call.chatId);
      await updateDoc(callDocRef, { status: 'declined' }).catch(async () => {
        await setDoc(callDocRef, { status: 'declined' }, { merge: true });
      });
      setIncomingCall(null);
      callTelemetry.reset();
    } catch (err) {
      logVoiceError('DECLINE_ERR', err);
    }
  }, []);

  return {
    incomingCall,
    acceptCall,
    declineCall,
    showMicPermissionModal,
    setShowMicPermissionModal,
  };
}
