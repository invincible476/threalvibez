import { useState, useCallback, useRef, useEffect } from 'react';
import { VoiceRoom } from '@/lib/voice/voice-room';
import { useToast } from '@/hooks/use-toast';

export function useVoiceChatManager() {
  const voiceRoomRef = useRef<VoiceRoom | null>(null);
  const [activeVoiceRoom, setActiveVoiceRoom] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    return () => {
      if (voiceRoomRef.current) {
        voiceRoomRef.current.leave();
      }
    };
  }, []);

  const joinVoiceRoom = useCallback(async (roomId: string, userId: string) => {
    try {
      // Leave current room if in one
      if (voiceRoomRef.current) {
        voiceRoomRef.current.leave();
      }

      // Create new voice room instance
      const voiceRoom = new VoiceRoom(userId, roomId);
      voiceRoomRef.current = voiceRoom;

      // Join the room
      await voiceRoom.join();
      setActiveVoiceRoom(roomId);

      toast({
        title: 'Voice Chat',
        description: 'Connected to voice chat',
      });
    } catch (error) {
      toast({
        title: 'Voice Chat Error',
        description: error instanceof Error ? error.message : 'Failed to join voice chat',
        variant: 'destructive',
      });
      throw error;
    }
  }, [toast]);

  const leaveVoiceRoom = useCallback(() => {
    if (voiceRoomRef.current) {
      voiceRoomRef.current.leave();
      voiceRoomRef.current = null;
      setActiveVoiceRoom(null);
      setIsMuted(false);

      toast({
        title: 'Voice Chat',
        description: 'Disconnected from voice chat',
      });
    }
  }, [toast]);

  const toggleMute = useCallback(() => {
    if (voiceRoomRef.current) {
      const newMuted = !isMuted;
      voiceRoomRef.current.setMuted(newMuted);
      setIsMuted(newMuted);

      toast({
        title: 'Voice Chat',
        description: newMuted ? 'Microphone muted' : 'Microphone unmuted',
      });
    }
  }, [isMuted, toast]);

  return {
    activeVoiceRoom,
    isMuted,
    joinVoiceRoom,
    leaveVoiceRoom,
    toggleMute,
  };
}