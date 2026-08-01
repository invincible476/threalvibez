"use client";

import React, { useEffect, useState } from 'react';
import {
  LiveKitRoom,
  RoomAudioRenderer,
  ControlBar,
  useTracks,
  useParticipants,
  AudioVisualizer,
  TrackRefContext,
} from '@livekit/components-react';
import '@livekit/components-styles';
import { Track } from 'livekit-client';
import { PhoneOff, Mic, MicOff, Volume2, VolumeX, Loader2, Users, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { UserAvatar } from '@/components/user-avatar';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

interface LiveKitVoiceModalProps {
  isOpen: boolean;
  roomId: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  targetUser?: { name: string; photoURL?: string };
  onClose: () => void;
}

export function LiveKitVoiceModal({
  isOpen,
  roomId,
  userId,
  userName,
  userAvatar,
  targetUser,
  onClose,
}: LiveKitVoiceModalProps) {
  const [token, setToken] = useState<string>('');
  const [wsUrl, setWsUrl] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (!isOpen || !roomId || !userId) return;

    let isMounted = true;
    setLoading(true);
    setError(null);

    const fetchToken = async () => {
      try {
        const res = await fetch(
          `/api/livekit/token?room=${encodeURIComponent(roomId)}&username=${encodeURIComponent(
            userName
          )}&identity=${encodeURIComponent(userId)}`
        );

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || `Server responded with status ${res.status}`);
        }

        const data = await res.json();
        if (isMounted) {
          setToken(data.token);
          setWsUrl(data.wsUrl);
          setLoading(false);
        }
      } catch (err: any) {
        console.error('[LiveKit] Token fetch error:', err);
        if (isMounted) {
          setError(err.message || 'Failed to initialize LiveKit connection');
          setLoading(false);
          toast({
            title: 'LiveKit Voice Error',
            description: err.message || 'Failed to connect to LiveKit voice room.',
            variant: 'destructive',
          });
        }
      }
    };

    fetchToken();

    return () => {
      isMounted = false;
    };
  }, [isOpen, roomId, userId, userName, toast]);

  if (!isOpen) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[99999] w-[94vw] max-w-md rounded-3xl bg-zinc-950/95 border border-emerald-500/30 p-5 shadow-2xl backdrop-blur-xl text-zinc-100 animate-in slide-in-from-bottom-5 duration-300">
      {loading ? (
        <div className="flex flex-col items-center justify-center py-6 space-y-3">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-400" />
          <p className="text-sm font-medium text-emerald-300">Connecting to LiveKit Voice Room...</p>
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-4 space-y-3 text-center">
          <ShieldAlert className="h-8 w-8 text-destructive animate-bounce" />
          <p className="text-sm font-semibold text-destructive">{error}</p>
          <Button variant="outline" size="sm" onClick={onClose} className="rounded-xl mt-2">
            Dismiss
          </Button>
        </div>
      ) : (
        <LiveKitRoom
          video={false}
          audio={true}
          token={token}
          serverUrl={wsUrl}
          data-lk-theme="default"
          onDisconnected={onClose}
          onError={(err) => {
            console.error('[LiveKit Room Error]:', err);
            toast({
              title: 'Voice Room Disconnected',
              description: err.message,
              variant: 'destructive',
            });
          }}
          className="flex flex-col space-y-4"
        >
          {/* Active Call Header */}
          <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
            <div className="flex items-center gap-3">
              <div className="relative">
                <span className="absolute -inset-1 rounded-full bg-emerald-500/30 animate-ping" />
                <UserAvatar
                  user={{ name: targetUser?.name || userName, photoURL: targetUser?.photoURL || userAvatar }}
                  className="h-10 w-10 relative ring-2 ring-emerald-500/50"
                />
              </div>
              <div>
                <h4 className="font-semibold text-sm truncate max-w-[160px]">
                  {targetUser?.name || 'Voice Room'}
                </h4>
                <p className="text-[11px] text-emerald-400 font-mono flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  LiveKit Voice Connected
                </p>
              </div>
            </div>

            <Button
              variant="destructive"
              size="sm"
              onClick={onClose}
              className="h-9 px-3 rounded-xl font-semibold flex items-center gap-1.5 shadow-lg hover:bg-destructive/90"
            >
              <PhoneOff className="h-4 w-4" />
              Leave
            </Button>
          </div>

          {/* Room Audio Renderer & Custom Controls */}
          <RoomAudioRenderer />
          
          <div className="pt-1 flex items-center justify-center">
            <ControlBar
              controls={{
                microphone: true,
                camera: false,
                screenShare: false,
                chat: false,
                leave: false,
              }}
              className="bg-zinc-900/90 border border-zinc-800 rounded-2xl px-2 py-1.5"
            />
          </div>
        </LiveKitRoom>
      )}
    </div>
  );
}
