"use client";

import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Phone, PhoneOff, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { UserAvatar } from '@/components/user-avatar';
import { CallSession } from '@/lib/voice/types';
import { checkMicrophonePermission, callTelemetry, logVoiceError } from '@/lib/voice/telemetry';
import { MicPermissionModal } from './mic-permission-modal';

interface IncomingCallModalProps {
  call?: CallSession | null;
  incomingCall?: CallSession | null;
  callStatus?: string;
  onAccept: (call: CallSession) => Promise<boolean | void> | boolean | void;
  onDecline: (call: CallSession) => Promise<void> | void;
  user?: { uid?: string; id?: string } | null;
  currentUserId?: string;
}

export function IncomingCallModal({
  call,
  incomingCall,
  callStatus,
  onAccept,
  onDecline,
  user,
  currentUserId,
}: IncomingCallModalProps) {
  const [isConnecting, setIsConnecting] = useState(false);
  const [showMicModal, setShowMicModal] = useState(false);
  const [mounted, setMounted] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const ringIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Effective call object with fallback guaranteed
  const activeCallData: CallSession = call || incomingCall || {
    chatId: 'incoming_call_session',
    callerId: 'unknown',
    callerName: 'Incoming Call...',
    callerAvatar: '',
    receiverId: user?.uid || user?.id || currentUserId || '',
    status: 'ringing',
  };

  // Safe receiver ID check with console warning on mismatch
  const effectiveUserId = user?.uid || user?.id || currentUserId;
  if (effectiveUserId && activeCallData.receiverId && activeCallData.receiverId !== effectiveUserId) {
    const isReceiver = activeCallData.receiverId === user?.uid || activeCallData.receiverId === user?.id;
    if (!isReceiver) {
      console.warn('[VoiceUI] Call target mismatch! Expected:', activeCallData.receiverId, 'Actual User:', effectiveUserId);
    }
  }

  // Play synthesized Web Audio ringing sound while modal is mounted
  useEffect(() => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        const audioCtx = new AudioCtx();
        audioContextRef.current = audioCtx;

        const playRingPulse = () => {
          if (!audioCtx || audioCtx.state === 'closed') return;
          try {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(440, audioCtx.currentTime); // A4 tone
            gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.8);
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.start();
            osc.stop(audioCtx.currentTime + 0.8);
          } catch (e) {
            // Ignore audio synthesis errors on strict autoplay policies
          }
        };

        playRingPulse();
        ringIntervalRef.current = setInterval(playRingPulse, 2000);
      }
    } catch (e) {
      console.warn('Web Audio ringtone setup warning:', e);
    }

    return () => {
      if (ringIntervalRef.current) {
        clearInterval(ringIntervalRef.current);
        ringIntervalRef.current = null;
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().catch(() => {});
        audioContextRef.current = null;
      }
    };
  }, []);

  // Direct user-action handler for Accepting incoming call
  const handleAcceptClick = async () => {
    setIsConnecting(true);
    callTelemetry.update({
      status: 'accepting',
      currentStep: 'Checking Microphone Permission',
    });

    try {
      // 1. Query permission state before initializing WebRTC
      const permResult = await checkMicrophonePermission();
      if (permResult.state === 'denied') {
        logVoiceError(101, 'Microphone permission state is denied');
        callTelemetry.setError('ERR_MIC_DENIED', 'Microphone access denied by browser setting');
        setShowMicModal(true);
        setIsConnecting(false);
        return;
      }

      // 2. Execute getUserMedia synchronously inside click handler to request mic access
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach((track) => track.stop());
      } catch (micErr: any) {
        logVoiceError(101, micErr);
        callTelemetry.setError('ERR_MIC_DENIED', micErr?.message || 'Microphone access rejected by user');
        setShowMicModal(true);
        setIsConnecting(false);
        return;
      }

      // 3. Delegate to caller onAccept callback
      const success = await onAccept(activeCallData);
      if (success === false) {
        setIsConnecting(false);
      }
    } catch (err: any) {
      logVoiceError('ACCEPT_HANDSHAKE_ERR', err);
      setIsConnecting(false);
    }
  };

  const displayName =
    activeCallData.callerName && activeCallData.callerName.trim() !== ''
      ? activeCallData.callerName
      : 'Incoming Call...';

  const avatarUrl = activeCallData.callerAvatar || '';

  // Render Inspection Log required by instruction #4
  console.log('[IncomingCallModal] MOUNTED AND RENDERING CARD NOW!');

  const modalContent = (
    <>
      <MicPermissionModal
        isOpen={showMicModal}
        onClose={() => setShowMicModal(false)}
        onRetry={handleAcceptClick}
      />

      <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/80 p-4 text-white pointer-events-auto">
        <div className="w-full max-w-sm rounded-3xl bg-zinc-900 border border-zinc-800 p-6 shadow-2xl flex flex-col items-center text-center space-y-6 text-zinc-100">
          
          {/* Pulsing Avatar Header */}
          <div className="relative mt-2">
            <div className="absolute -inset-4 rounded-full bg-emerald-500/20 animate-ping opacity-75" />
            <div className="absolute -inset-2 rounded-full bg-emerald-500/30 animate-pulse" />
            <UserAvatar
              user={{ name: displayName, photoURL: avatarUrl }}
              className="h-24 w-24 relative shadow-lg ring-4 ring-emerald-500/40"
            />
          </div>

          {/* Caller Info */}
          <div className="space-y-1">
            <h3 className="text-xl font-bold tracking-tight text-zinc-100">{displayName}</h3>
            <p className="text-sm text-emerald-400 font-medium flex items-center justify-center gap-1.5">
              <span className="relative h-2 w-2">
                <span className="absolute h-full w-full rounded-full bg-emerald-400 animate-ping" />
                <span className="absolute h-full w-full rounded-full bg-emerald-400" />
              </span>
              {isConnecting ? 'Connecting Call...' : 'Incoming Voice Call...'}
            </p>
          </div>

          {/* Actions (Decline & Accept) */}
          <div className="grid grid-cols-2 gap-4 w-full pt-2">
            <Button
              variant="destructive"
              size="lg"
              disabled={isConnecting}
              className="h-14 rounded-2xl flex items-center justify-center gap-2 text-base font-semibold shadow-lg hover:scale-105 transition-transform pointer-events-auto cursor-pointer"
              onClick={() => onDecline(activeCallData)}
            >
              <PhoneOff className="h-5 w-5" />
              Decline
            </Button>

            <Button
              size="lg"
              disabled={isConnecting}
              className="h-14 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center gap-2 text-base font-semibold shadow-lg hover:scale-105 transition-transform pointer-events-auto cursor-pointer"
              onClick={handleAcceptClick}
            >
              {isConnecting ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Connecting...
                </>
              ) : (
                <>
                  <Phone className="h-5 w-5 fill-current" />
                  Accept
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </>
  );

  if (mounted && typeof document !== 'undefined') {
    return createPortal(modalContent, document.body);
  }

  return modalContent;
}
