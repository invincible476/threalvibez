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
  const [callStatus, setCallStatus] = useState<string>('idle');
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

  // Debug rendering check logging inside hook
  useEffect(() => {
    console.log('[VoiceHook] Rendering Check -> Status:', callStatus, 'CallData:', incomingCall, 'User:', activeUserId);
  }, [callStatus, incomingCall, activeUserId]);

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

          // Auth desync guard check with safe receiver ID evaluation
          const isReceiver = data.receiverId === activeUserId;
          if (!isReceiver) {
            console.warn('[VoiceUI] Call target mismatch! Expected:', data.receiverId, 'Actual User:', activeUserId);
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
            setCallStatus('cancelled');
            callTelemetry.reset();
            return;
          }

          // Atomic state update: Whenever status is 'ringing', incomingCall MUST be guaranteed to be a valid object
          if (data.status === 'ringing') {
            const newCallData: CallSession = {
              id: docSnap.id,
              chatId: data.chatId || docSnap.id,
              callerId: data.callerId,
              callerName: data.callerName && data.callerName.trim() !== '' ? data.callerName : 'Incoming Call...',
              callerAvatar: data.callerAvatar || '',
              receiverId: data.receiverId,
              status: 'ringing',
              offer: data.offer,
              answer: data.answer,
              createdAt: data.createdAt,
            };

            setIncomingCall(newCallData);
            setCallStatus('ringing');

            callTelemetry.update({
              status: 'ringing',
              currentStep: 'Incoming Call Ringing',
              errorCode: null,
            });
          } else if (['ended', 'declined', 'cancelled', 'failed'].includes(data.status)) {
            setIncomingCall(null);
            setCallStatus(data.status);
            callTelemetry.update({
              status: data.status,
              currentStep: `Call ${data.status}`,
            });
          }
        } else {
          // Document was deleted or status changed away from ringing -> reset incomingCall
          setIncomingCall(null);
          setCallStatus('idle');
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
      setCallStatus('cancelled');
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
      setCallStatus('accepted');
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
      setCallStatus('declined');
      callTelemetry.reset();
    } catch (err) {
      logVoiceError('DECLINE_ERR', err);
    }
  }, []);

  return {
    callStatus,
    incomingCall,
    acceptCall,
    declineCall,
    showMicPermissionModal,
    setShowMicPermissionModal,
  };
}
