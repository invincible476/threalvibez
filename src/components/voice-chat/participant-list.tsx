import React from 'react';
import { VoiceRoomParticipant } from '@/lib/voice/types';
import { cn } from '@/lib/utils';

interface ParticipantListProps {
  participants: VoiceRoomParticipant[];
  currentUserId: string;
}

export function ParticipantList({ participants, currentUserId }: ParticipantListProps) {
  return (
    <div className="flex flex-col gap-2 p-2">
      {participants.map((participant) => (
        <ParticipantItem
          key={participant.id}
          participant={participant}
          isCurrentUser={participant.id === currentUserId}
        />
      ))}
    </div>
  );
}

interface ParticipantItemProps {
  participant: VoiceRoomParticipant;
  isCurrentUser: boolean;
}

function ParticipantItem({ participant, isCurrentUser }: ParticipantItemProps) {
  return (
    <div className={cn(
      'flex items-center gap-2 px-3 py-2 rounded-md',
      'bg-background hover:bg-accent transition-colors',
      isCurrentUser && 'border border-primary'
    )}>
      <div className="flex-1 min-w-0">
        <p className="truncate text-sm font-medium">
          {isCurrentUser ? 'You' : participant.id}
        </p>
      </div>

      {/* Status icons */}
      <div className="flex items-center gap-1">
        {participant.isMuted && (
          <span className="text-muted-foreground">
            <i className="fas fa-microphone-slash" />
          </span>
        )}
        {participant.isSpeaking && (
          <span className="text-green-500">
            <i className="fas fa-volume-up" />
          </span>
        )}
      </div>
    </div>
  );
}