import React, { useMemo, useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { VoiceParticipant } from './voice-participant';
import { Button } from '../ui/button';
import { Mic, MicOff, PhoneOff } from 'lucide-react';
import { VoiceRoomParticipant, VoiceConnectionState, WebRTCMetrics } from '@/lib/voice/types';
import { useAppShell } from '../app-shell';
import { ScrollArea } from '../ui/scroll-area';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';

interface VoiceChatProps {
  participants: VoiceRoomParticipant[];
  currentUserId: string;
  remoteStreams: Map<string, MediaStream>;
  isMuted: boolean;
  connectionState?: VoiceConnectionState | string;
  metrics?: WebRTCMetrics;
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
  connectionState,
  metrics,
  onMuteToggle,
  onLeave,
  className,
}: VoiceChatProps) {
  const { usersCache } = useAppShell();
  const [callDuration, setCallDuration] = useState(0);

  // Determine if WebRTC P2P connection is fully connected
  const isFullyConnected = useMemo(() => {
    const ice = metrics?.iceState;
    if (ice === 'connected' || ice === 'completed') return true;
    if (connectionState === VoiceConnectionState.CONNECTED || connectionState === 'connected') return true;
    return false;
  }, [metrics?.iceState, connectionState]);

  // Format call duration timer (MM:SS)
  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    if (isFullyConnected) {
      timer = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
    } else {
      setCallDuration(0);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isFullyConnected]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Derive dynamic status text strictly bound to RTCPeerConnection iceConnectionState
  const statusText = useMemo(() => {
    const ice = metrics?.iceState || 'new';
    if (isFullyConnected) {
      return `Connected (${formatDuration(callDuration)})`;
    }
    if (ice === 'disconnected' || ice === 'failed' || connectionState === VoiceConnectionState.FAILED) {
      return 'Connection Failed - Reconnecting...';
    }
    return 'Connecting to peer...';
  }, [isFullyConnected, metrics?.iceState, connectionState, callDuration]);

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

  const iceStateDisplay = metrics?.iceState || 'new';
  const signalingStateDisplay = metrics?.signalingState || 'stable';
  const peerDisplay = (metrics?.hasRemoteTrack || remoteStreams.size > 0) ? 'Active' : 'Waiting';

  return (
    <VoiceChatErrorBoundary>
      <div className={cn('flex flex-col', className)}>
      {/* Voice chat header */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-4">
        <div className="flex items-center gap-2">
          <div className="relative h-2.5 w-2.5">
            <div
              className={cn(
                'absolute h-full w-full rounded-full animate-ping opacity-75',
                isFullyConnected ? 'bg-emerald-500' : 'bg-amber-500'
              )}
            />
            <div
              className={cn(
                'absolute h-full w-full rounded-full',
                isFullyConnected ? 'bg-emerald-500' : 'bg-amber-500'
              )}
            />
          </div>
          <span className="font-semibold text-sm">{statusText}</span>
          <span className="text-xs text-muted-foreground">
            ({sortedParticipants.length} {sortedParticipants.length === 1 ? 'user' : 'users'})
          </span>
        </div>

        {/* Live WebRTC Telemetry Badge Overlay */}
        <div className="text-[11px] px-2.5 py-1 rounded-full bg-muted/80 font-mono text-muted-foreground border border-border/40">
          ICE: {iceStateDisplay} | Signaling: {signalingStateDisplay} | Peer: {peerDisplay}
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

      {/* Remote audio elements with play promise error handling for mobile policies */}
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
              const playPromise = el.play();
              if (playPromise !== undefined) {
                playPromise.catch((error) => {
                  console.warn('[Voice] Remote audio playback promise error:', error);
                });
              }
            }
          }}
          onError={(e) => {
            console.error('[Voice] Audio element error:', e);
          }}
          className="hidden"
        />
      ))}
      </div>
    </VoiceChatErrorBoundary>
  );
}