import React, { useMemo, useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { VoiceParticipant } from './voice-participant';
import { Button } from '../ui/button';
import { Mic, MicOff, PhoneOff } from 'lucide-react';
import { VoiceRoomParticipant } from '@/lib/voice/types';
import { useAppShell } from '../app-shell';
import { ScrollArea } from '../ui/scroll-area';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';

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

  // Deduplicate participants array by unique userId
  const deduplicatedParticipants = useMemo(() => {
    return Array.from(
      new Map(participants.map((p) => [p.id, p])).values()
    );
  }, [participants]);

  const sortedParticipants = useMemo(() => {
    return [...deduplicatedParticipants].sort((a, b) => {
      // Current user first
      if (a.id === currentUserId) return -1;
      if (b.id === currentUserId) return 1;
      // Speaking participants next
      if (a.isSpeaking && !b.isSpeaking) return -1;
      if (!a.isSpeaking && b.isSpeaking) return 1;
      // Sort by join time
      return a.joinedAt - b.joinedAt;
    });
  }, [deduplicatedParticipants, currentUserId]);

  const [remoteProfiles, setRemoteProfiles] = useState<
    Map<string, { displayName: string; photoURL?: string; bio?: string }>
  >(new Map());

  // Fetch remote user profiles from Firestore users/{id} or user cache
  useEffect(() => {
    const fetchRemoteProfiles = async () => {
      for (const p of sortedParticipants) {
        if (p.id === currentUserId) continue;

        // 1. Check cached user in usersCache first
        const cached = usersCache?.get(p.id);
        if (cached) {
          setRemoteProfiles((prev) => {
            const next = new Map(prev);
            next.set(p.id, {
              displayName: cached.name || cached.username || 'User',
              photoURL: cached.photoURL || undefined,
              bio: cached.about || undefined,
            });
            return next;
          });
        }

        // 2. Query Firestore users/{id} to get remote user's actual profile
        try {
          const userDocRef = doc(db, 'users', p.id);
          const userSnap = await getDoc(userDocRef);
          if (userSnap.exists()) {
            const data = userSnap.data();
            const displayName = data.displayName || data.name || data.username || 'User';
            const photoURL = data.photoURL || data.avatarUrl || undefined;
            const bio = data.bio || data.about || undefined;

            setRemoteProfiles((prev) => {
              const next = new Map(prev);
              next.set(p.id, { displayName, photoURL, bio });
              return next;
            });
          }
        } catch (err) {
          console.error('Error fetching remote user profile from Firestore:', err);
        }
      }
    };

    fetchRemoteProfiles();
  }, [sortedParticipants, currentUserId, usersCache]);

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
            ({sortedParticipants.length} {sortedParticipants.length === 1 ? 'user' : 'users'})
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
      <ScrollArea className="px-4 pb-4 max-h-60">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {sortedParticipants.map((participant) => {
            const isCurrentUser = participant.id === currentUserId;
            const remoteProfile = remoteProfiles.get(participant.id);
            const cachedUser = usersCache?.get(participant.id);

            const name = isCurrentUser
              ? 'You'
              : (remoteProfile?.displayName || cachedUser?.name || 'User');
            const photoURL = isCurrentUser
              ? undefined
              : (remoteProfile?.photoURL || cachedUser?.photoURL || undefined);
            const bio = isCurrentUser
              ? undefined
              : (remoteProfile?.bio || cachedUser?.about || undefined);

            return (
              <VoiceParticipant
                key={participant.id}
                name={name}
                photoURL={photoURL}
                bio={bio}
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