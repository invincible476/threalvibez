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
  incomingCall: CallSession | null;
  onAccept: (call: CallSession) => Promise<boolean | void> | boolean | void;
  onDecline: (call: CallSession) => Promise<void> | void;
}

export function IncomingCallModal({
  incomingCall,
  onAccept,
  onDecline,
}: IncomingCallModalProps) {
  const [isConnecting, setIsConnecting] = useState(false);
  const [showMicModal, setShowMicModal] = useState(false);
  const [mounted, setMounted] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const ringIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Play synthesized Web Audio ringing sound while modal is mounted
  useEffect(() => {
    if (!incomingCall) return;

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
  }, [incomingCall]);

  if (!incomingCall && !showMicModal) return null;

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
      if (incomingCall) {
        const success = await onAccept(incomingCall);
        if (success === false) {
          setIsConnecting(false);
        }
      }
    } catch (err: any) {
      logVoiceError('ACCEPT_HANDSHAKE_ERR', err);
      setIsConnecting(false);
    }
  };

  // Fallback defaults so card mounts and renders IMMEDIATELY when status === 'ringing'
  const displayName =
    incomingCall?.callerName && incomingCall.callerName.trim() !== ''
      ? incomingCall.callerName
      : 'Incoming Call...';

  const avatarUrl = incomingCall?.callerAvatar || '';

  const modalContent = (
    <>
      <MicPermissionModal
        isOpen={showMicModal}
        onClose={() => setShowMicModal(false)}
        onRetry={handleAcceptClick}
      />

      {incomingCall && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200 pointer-events-auto">
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
                onClick={() => onDecline(incomingCall)}
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
      )}
    </>
  );

  if (mounted && typeof document !== 'undefined') {
    return createPortal(modalContent, document.body);
  }

  return modalContent;
}
