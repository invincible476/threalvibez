import React, { useEffect, useRef } from 'react';
import { Phone, PhoneOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { UserAvatar } from '@/components/user-avatar';
import { CallSession } from '@/lib/voice/types';
import { cn } from '@/lib/utils';

interface IncomingCallModalProps {
  incomingCall: CallSession | null;
  onAccept: (call: CallSession) => void;
  onDecline: (call: CallSession) => void;
}

export function IncomingCallModal({
  incomingCall,
  onAccept,
  onDecline,
}: IncomingCallModalProps) {
  const audioContextRef = useRef<AudioContext | null>(null);
  const ringIntervalRef = useRef<NodeJS.Timeout | null>(null);

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

  if (!incomingCall) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/80 backdrop-blur-md animate-in fade-in duration-300">
      <div className="w-full max-w-sm rounded-3xl border border-primary/20 bg-card p-6 shadow-2xl flex flex-col items-center text-center space-y-6">
        
        {/* Pulsing Avatar Header */}
        <div className="relative mt-2">
          <div className="absolute -inset-4 rounded-full bg-emerald-500/20 animate-ping opacity-75" />
          <div className="absolute -inset-2 rounded-full bg-emerald-500/30 animate-pulse" />
          <UserAvatar
            user={{ name: incomingCall.callerName, photoURL: incomingCall.callerAvatar }}
            className="h-24 w-24 relative shadow-lg ring-4 ring-emerald-500/40"
          />
        </div>

        {/* Caller Info */}
        <div className="space-y-1">
          <h3 className="text-xl font-bold tracking-tight">{incomingCall.callerName}</h3>
          <p className="text-sm text-emerald-400 font-medium flex items-center justify-center gap-1.5">
            <span className="relative h-2 w-2">
              <span className="absolute h-full w-full rounded-full bg-emerald-400 animate-ping" />
              <span className="absolute h-full w-full rounded-full bg-emerald-400" />
            </span>
            Incoming Voice Call...
          </p>
        </div>

        {/* Actions (Decline & Accept) */}
        <div className="grid grid-cols-2 gap-4 w-full pt-2">
          <Button
            variant="destructive"
            size="lg"
            className="h-14 rounded-2xl flex items-center justify-center gap-2 text-base font-semibold shadow-lg hover:scale-105 transition-transform"
            onClick={() => onDecline(incomingCall)}
          >
            <PhoneOff className="h-5 w-5" />
            Decline
          </Button>

          <Button
            size="lg"
            className="h-14 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center gap-2 text-base font-semibold shadow-lg hover:scale-105 transition-transform"
            onClick={() => onAccept(incomingCall)}
          >
            <Phone className="h-5 w-5 fill-current" />
            Accept
          </Button>
        </div>
      </div>
    </div>
  );
}
