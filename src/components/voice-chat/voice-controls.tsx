import React from 'react';
import { cn } from '@/lib/utils';

interface VoiceControlsProps {
  isMuted: boolean;
  onMuteToggle: () => void;
  onLeave: () => void;
  className?: string;
}

export function VoiceControls({ isMuted, onMuteToggle, onLeave, className }: VoiceControlsProps) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <button
        onClick={onMuteToggle}
        className={cn(
          'p-2 rounded-full transition-colors',
          'hover:bg-accent',
          isMuted && 'bg-destructive hover:bg-destructive/90'
        )}
        title={isMuted ? 'Unmute' : 'Mute'}
      >
        <i className={cn('fas', isMuted ? 'fa-microphone-slash' : 'fa-microphone')} />
      </button>

      <button
        onClick={onLeave}
        className="p-2 rounded-full bg-destructive hover:bg-destructive/90 transition-colors"
        title="Leave Voice"
      >
        <i className="fas fa-phone-slash" />
      </button>
    </div>
  );
}