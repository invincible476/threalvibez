import React, { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { UserAvatar } from '../user-avatar';
import { Mic, MicOff } from 'lucide-react';

interface VoiceParticipantProps {
  name: string;
  photoURL?: string;
  bio?: string;
  isSpeaking?: boolean;
  isMuted?: boolean;
  isCurrentUser?: boolean;
}

export function VoiceParticipant({
  name,
  photoURL,
  bio,
  isSpeaking,
  isMuted,
  isCurrentUser,
}: VoiceParticipantProps) {
  const [speakingAnimation, setSpeakingAnimation] = useState(false);
  const [hasAudioActivity, setHasAudioActivity] = useState(false);

  useEffect(() => {
    if (isSpeaking) {
      // Debounce the speaking animation to prevent flicker
      const timer = setTimeout(() => {
        setSpeakingAnimation(true);
        setHasAudioActivity(true);
      }, 150);

      return () => clearTimeout(timer);
    } else {
      // Add slight delay before removing speaking indication
      const timer = setTimeout(() => {
        setSpeakingAnimation(false);
        setHasAudioActivity(false);
      }, 300);

      return () => clearTimeout(timer);
    }
  }, [isSpeaking]);

  return (
    <div
      className={cn(
        'flex items-center gap-3 p-3 rounded-xl transition-all border border-border/40',
        'bg-card/60 backdrop-blur-sm',
        isSpeaking ? 'bg-violet-950/40 ring-2 ring-violet-500 border-violet-500/50 shadow-[0_0_15px_rgba(139,92,246,0.3)]' : 'hover:bg-muted/40'
      )}
    >
      <div className="relative">
        <UserAvatar
          user={{ name, photoURL }}
          className={cn(
            'h-10 w-10 transition-all duration-300',
            speakingAnimation && 'ring-2 ring-emerald-400 ring-offset-2 ring-offset-zinc-950 shadow-[0_0_12px_rgba(52,211,153,0.6)]'
          )}
        />
        <div
          className={cn(
            'absolute -bottom-1 -right-1 p-1 rounded-full bg-background',
            isMuted ? 'text-destructive' : 'text-primary'
          )}
        >
          {isMuted ? (
            <MicOff className="h-3 w-3" />
          ) : (
            <Mic className="h-3 w-3" />
          )}
        </div>
      </div>

      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">
          {isCurrentUser ? 'You' : name}
        </p>
        {bio ? (
          <p className="text-xs text-muted-foreground truncate">{bio}</p>
        ) : (
          <p className="text-xs text-muted-foreground">
            {isMuted ? 'Muted' : isSpeaking ? 'Speaking' : 'Connected'}
          </p>
        )}
      </div>
    </div>
  );
}