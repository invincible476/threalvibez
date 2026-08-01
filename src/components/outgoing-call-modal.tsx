import React, { useEffect, useRef } from 'react';
import { PhoneOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { UserAvatar } from '@/components/user-avatar';

interface OutgoingCallModalProps {
  receiverName: string;
  receiverAvatar?: string;
  onCancel: () => void;
}

export function OutgoingCallModal({
  receiverName,
  receiverAvatar,
  onCancel,
}: OutgoingCallModalProps) {
  const audioContextRef = useRef<AudioContext | null>(null);
  const ringIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Play synthesized Web Audio outgoing ringback tone while waiting for answer
  useEffect(() => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        const audioCtx = new AudioCtx();
        audioContextRef.current = audioCtx;

        const playRingbackPulse = () => {
          if (!audioCtx || audioCtx.state === 'closed') return;
          try {
            const osc1 = audioCtx.createOscillator();
            const osc2 = audioCtx.createOscillator();
            const gain = audioCtx.createGain();

            osc1.type = 'sine';
            osc2.type = 'sine';
            osc1.frequency.setValueAtTime(440, audioCtx.currentTime);
            osc2.frequency.setValueAtTime(480, audioCtx.currentTime);

            gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 1.2);

            osc1.connect(gain);
            osc2.connect(gain);
            gain.connect(audioCtx.destination);

            osc1.start();
            osc2.start();
            osc1.stop(audioCtx.currentTime + 1.2);
            osc2.stop(audioCtx.currentTime + 1.2);
          } catch (e) {
            // Ignore synthesis policy errors
          }
        };

        playRingbackPulse();
        ringIntervalRef.current = setInterval(playRingbackPulse, 3000);
      }
    } catch (e) {
      console.warn('Outgoing ringback tone warning:', e);
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

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/80 backdrop-blur-md animate-in fade-in duration-300">
      <div className="w-full max-w-sm rounded-3xl border border-primary/20 bg-card p-6 shadow-2xl flex flex-col items-center text-center space-y-6">
        
        {/* Pulsing Avatar Header */}
        <div className="relative mt-2">
          <div className="absolute -inset-4 rounded-full bg-violet-500/20 animate-ping opacity-75" />
          <div className="absolute -inset-2 rounded-full bg-violet-500/30 animate-pulse" />
          <UserAvatar
            user={{ name: receiverName, photoURL: receiverAvatar }}
            className="h-24 w-24 relative shadow-lg ring-4 ring-violet-500/40"
          />
        </div>

        {/* Receiver Info */}
        <div className="space-y-1">
          <h3 className="text-xl font-bold tracking-tight">{receiverName}</h3>
          <p className="text-sm text-violet-400 font-medium flex items-center justify-center gap-1.5">
            <span className="relative h-2 w-2">
              <span className="absolute h-full w-full rounded-full bg-violet-400 animate-ping" />
              <span className="absolute h-full w-full rounded-full bg-violet-400" />
            </span>
            Ringing...
          </p>
        </div>

        {/* Action (Cancel Call) */}
        <div className="w-full pt-2">
          <Button
            variant="destructive"
            size="lg"
            className="w-full h-14 rounded-2xl flex items-center justify-center gap-2 text-base font-semibold shadow-lg hover:scale-105 transition-transform"
            onClick={onCancel}
          >
            <PhoneOff className="h-5 w-5" />
            Cancel Call
          </Button>
        </div>
      </div>
    </div>
  );
}
