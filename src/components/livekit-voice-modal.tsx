"use client";

import React, { useEffect, useState, useCallback } from 'react';
import {
  LiveKitRoom,
  RoomAudioRenderer,
  AudioConference,
} from '@livekit/components-react';
import '@livekit/components-styles';
import { PhoneOff, Loader2, ShieldAlert, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { UserAvatar } from '@/components/user-avatar';
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

const DEFAULT_WS_URL = process.env.NEXT_PUBLIC_LIVEKIT_URL || 'wss://omegaone-7kb381s3.livekit.cloud';

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
  const [wsUrl, setWsUrl] = useState<string>(DEFAULT_WS_URL);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState<number>(0);
  const { toast } = useToast();

  const fetchToken = useCallback(async () => {
    if (!roomId || !userId) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(
        `/api/livekit/token?room=${encodeURIComponent(roomId)}&username=${encodeURIComponent(
          userName
        )}&identity=${encodeURIComponent(userId)}`
      );

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Token endpoint returned HTTP ${res.status}`);
      }

      const data = await res.json();
      if (!data.token) {
        throw new Error(data.error || 'No token returned by token endpoint');
      }

      setToken(data.token);
      if (data.wsUrl) {
        setWsUrl(data.wsUrl);
      }
      setLoading(false);
    } catch (err: any) {
      console.error('[LiveKit] Token fetch error:', err);
      setError(err.message || 'Failed to connect to LiveKit voice room');
      setLoading(false);
      toast({
        title: 'LiveKit Voice Error',
        description: err.message || 'Failed to connect to LiveKit voice room.',
        variant: 'destructive',
      });
    }
  }, [roomId, userId, userName, toast]);

  useEffect(() => {
    if (!isOpen) return;
    fetchToken();
  }, [isOpen, fetchToken, retryCount]);

  if (!isOpen) return null;

  const serverUrl = wsUrl || DEFAULT_WS_URL;

  return (
    <div className="fixed bottom-4 right-4 z-[9999] w-[94vw] max-w-md rounded-3xl bg-zinc-950/95 border border-emerald-500/30 p-5 shadow-2xl backdrop-blur-xl text-zinc-100 animate-in slide-in-from-bottom-5 duration-300 pointer-events-auto">
      {loading ? (
        <div className="flex flex-col items-center justify-center py-6 space-y-3">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-400" />
          <p className="text-sm font-medium text-emerald-300">Connecting to LiveKit Voice Room...</p>
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-4 space-y-3 text-center">
          <ShieldAlert className="h-8 w-8 text-destructive animate-bounce" />
          <p className="text-sm font-semibold text-destructive">{error}</p>
          <div className="flex items-center gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setRetryCount((prev) => prev + 1)}
              className="rounded-xl flex items-center gap-1.5 border-zinc-700 hover:bg-zinc-800"
            >
              <RotateCcw className="h-4 w-4" />
              Retry Connection
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={onClose}
              className="rounded-xl"
            >
              Close
            </Button>
          </div>
        </div>
      ) : (
        <LiveKitRoom
          video={false}
          audio={true}
          token={token}
          serverUrl={serverUrl}
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

          {/* Room Audio Renderer */}
          <RoomAudioRenderer />

          {/* LiveKit Audio Conference & Controls */}
          <div className="pt-1 flex flex-col items-center justify-center">
            <AudioConference />
          </div>
        </LiveKitRoom>
      )}
    </div>
  );
}
