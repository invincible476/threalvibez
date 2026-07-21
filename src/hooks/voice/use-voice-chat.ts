import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { VoiceRoom } from '@/lib/voice/voice-room';
import {
  VoiceRoomParticipant,
  VoiceRoomEvent,
  VoiceConnectionState,
} from '@/lib/voice/types';

export interface UseVoiceChatOptions {
  userId: string;
  roomId: string;
  onError?: (error: Error) => void;
}

export function useVoiceChat({
  userId,
  roomId,
  onError,
}: UseVoiceChatOptions) {
  const voiceRoomRef = useRef<VoiceRoom | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [participants, setParticipants] = useState<VoiceRoomParticipant[]>([]);
  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(new Map());
  const [connectionState, setConnectionState] = useState<VoiceConnectionState>(
    VoiceConnectionState.DISCONNECTED
  );

  // Validate required parameters
  const isValid = useMemo(() => {
    if (!userId || !roomId) {
      console.warn('VoiceChat: userId and roomId are required');
      return false;
    }
    if (userId.length < 1 || roomId.length < 1) {
      console.warn('VoiceChat: userId and roomId cannot be empty');
      return false;
    }
    return true;
  }, [userId, roomId]);

  // Initialize voice room
  useEffect(() => {
    console.log('Initializing voice room:', { userId, roomId });
    
    if (!userId || !roomId) {
      console.warn('Missing required data for voice room:', { userId, roomId });
      return;
    }

    const voiceRoom = new VoiceRoom(userId, roomId);
    voiceRoomRef.current = voiceRoom;
    console.log('Voice room created:', { voiceRoom: Boolean(voiceRoom) });

    // Setup event handlers
    voiceRoom.on(VoiceRoomEvent.PARTICIPANT_JOINED, (participant) => {
      console.log('Participant joined:', participant);
      setParticipants((prev) => [...prev, participant]);
    });

    voiceRoom.on(VoiceRoomEvent.PARTICIPANT_LEFT, (participantId) => {
      setParticipants((prev) => prev.filter(p => p.id !== participantId));
      setRemoteStreams((prev) => {
        const next = new Map(prev);
        next.delete(participantId);
        return next;
      });
    });

    voiceRoom.on(VoiceRoomEvent.PARTICIPANT_UPDATED, (participant) => {
      setParticipants((prev) =>
        prev.map(p => p.id === participant.id ? { ...p, ...participant } : p)
      );
    });

    voiceRoom.on(VoiceRoomEvent.STREAM_ADDED, (stream, participantId) => {
      setRemoteStreams((prev) => {
        const next = new Map(prev);
        next.set(participantId, stream);
        return next;
      });
    });

    voiceRoom.on(VoiceRoomEvent.STREAM_REMOVED, (participantId) => {
      setRemoteStreams((prev) => {
        const next = new Map(prev);
        next.delete(participantId);
        return next;
      });
    });

    voiceRoom.on(VoiceRoomEvent.CONNECTION_STATE_CHANGED, (state) => {
      setConnectionState(state as VoiceConnectionState);
      setIsConnected(state === 'connected');
    });

    voiceRoom.on(VoiceRoomEvent.ERROR, (error) => {
      onError?.(error);
    });

    return () => {
      if (voiceRoomRef.current) {
        voiceRoomRef.current.leave();
        voiceRoomRef.current = null;
      }
    };
  }, [userId, roomId, onError]);

  // Join voice room
  const join = useCallback(async () => {
    if (!isValid) {
      const error = new Error('Cannot join voice chat: Invalid userId or roomId');
      onError?.(error);
      return;
    }

    if (voiceRoomRef.current) {
      try {
        console.log('Joining voice chat:', { userId, roomId });
        await voiceRoomRef.current.join();
        setIsConnected(true);
      } catch (error) {
        console.error('Voice chat join error:', error);
        onError?.(error as Error);
      }
    } else {
      console.error('Voice chat not initialized');
      onError?.(new Error('Voice chat not initialized'));
    }
  }, [isValid, userId, roomId, onError]);

  // Leave voice room
  const leave = useCallback(() => {
    if (voiceRoomRef.current) {
      voiceRoomRef.current.leave();
      setIsConnected(false);
      setParticipants([]);
      setRemoteStreams(new Map());
    }
  }, []);

  // Toggle mute
  const toggleMute = useCallback(() => {
    if (voiceRoomRef.current) {
      const newMuted = !isMuted;
      voiceRoomRef.current.setMuted(newMuted);
      setIsMuted(newMuted);
    }
  }, [isMuted]);

  return {
    isConnected,
    isMuted,
    participants,
    remoteStreams,
    connectionState,
    join,
    leave,
    toggleMute,
  };
}