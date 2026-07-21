import React, { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { VoiceParticipant } from './voice-participant';
import { Button } from '../ui/button';
import { Mic, MicOff, PhoneOff } from 'lucide-react';
import { VoiceRoomParticipant } from '@/lib/voice/types';
import { useAppShell } from '../app-shell';
import { ScrollArea } from '../ui/scroll-area';

interface VoiceChatProps {
  participants: VoiceRoomParticipant[];
  currentUserId: string;
  remoteStreams: Map<string, MediaStream>;
  isMuted: boolean;
  onMuteToggle: () => void;
  onLeave: () => void;
  className?: string;
}

class VoiceChatErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.error('Voice chat error:', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-4 text-sm text-destructive bg-destructive/10 rounded-lg">
          Voice chat encountered an error. Please try rejoining.
        </div>
      );
    }

    return this.props.children;
  }
}

export function VoiceChat({
  participants,
  currentUserId,
  remoteStreams,
  isMuted,
  onMuteToggle,
  onLeave,
  className,
}: VoiceChatProps) {
  const { usersCache } = useAppShell();

  const sortedParticipants = useMemo(() => {
    return participants.sort((a, b) => {
      // Current user first
      if (a.id === currentUserId) return -1;
      if (b.id === currentUserId) return 1;
      // Speaking participants next
      if (a.isSpeaking && !b.isSpeaking) return -1;
      if (!a.isSpeaking && b.isSpeaking) return 1;
      // Sort by join time
      return a.joinedAt - b.joinedAt;
    });
  }, [participants, currentUserId]);

  return (
    <VoiceChatErrorBoundary>
      <div className={cn('flex flex-col', className)}>
      {/* Voice chat header */}
      <div className="flex items-center justify-between p-4">
        <div className="flex items-center gap-2">
          <div className="relative h-2 w-2">
            <div className="absolute h-full w-full bg-primary rounded-full animate-ping opacity-75" />
            <div className="absolute h-full w-full bg-primary rounded-full" />
          </div>
          <span className="font-medium">Voice Connected</span>
          <span className="text-sm text-muted-foreground">
            ({participants.length} {participants.length === 1 ? 'user' : 'users'})
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant={isMuted ? 'destructive' : 'secondary'}
            size="sm"
            className="h-8 px-3"
            onClick={onMuteToggle}
          >
            {isMuted ? (
              <>
                <MicOff className="h-4 w-4 mr-2" />
                Unmute
              </>
            ) : (
              <>
                <Mic className="h-4 w-4 mr-2" />
                Mute
              </>
            )}
          </Button>

          <Button
            variant="destructive"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={onLeave}
          >
            <PhoneOff className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Participants list */}
      <ScrollArea className="px-4 pb-4">
        <div className="grid gap-2">
          {sortedParticipants.map((participant) => {
            const user = usersCache.get(participant.id);
            const isCurrentUser = participant.id === currentUserId;

            return (
              <VoiceParticipant
                key={participant.id}
                name={user?.name || 'Unknown User'}
                photoURL={user?.photoURL || undefined}
                isSpeaking={participant.isSpeaking}
                isMuted={participant.isMuted}
                isCurrentUser={isCurrentUser}
              />
            );
          })}
        </div>
      </ScrollArea>

      {/* Remote audio elements (hidden) */}
      {Array.from(remoteStreams.entries()).map(([participantId, stream]) => (
        <audio
          key={participantId}
          autoPlay
          playsInline
          ref={(el) => {
            if (el) {
              if (el.srcObject !== stream) {
                el.srcObject = stream;
              }
              el.volume = 1.0;
              
              // Ensure audio plays when ready
              const playPromise = el.play();
              if (playPromise !== undefined) {
                playPromise.catch(error => {
                  console.warn('Audio playback failed:', error);
                });
              }
            }
          }}
          onError={(e) => {
            console.error('Audio element error:', e);
          }}
          className="hidden"
        />
      ))}
      </div>
    </VoiceChatErrorBoundary>
  );
}