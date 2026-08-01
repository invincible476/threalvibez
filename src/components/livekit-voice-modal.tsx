"use client";

import React, { useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
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
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState<number>(0);
  const [mounted, setMounted] = useState<boolean>(false);
  const { toast } = useToast();

  useEffect(() => {
    setMounted(true);
  }, []);

  const initVoiceConnection = useCallback(async () => {
    if (!roomId || !userId) return;

    setLoading(true);
    setError(null);
    setToken('');

    // 1. Microphone Permission Pre-fetch Check
    try {
      if (typeof navigator !== 'undefined' && navigator.mediaDevices) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach((track) => track.stop());
      }
    } catch (err: any) {
      console.error('[LiveKit] Microphone permission denied:', err);
      setError('Microphone access is required to join the call.');
      setLoading(false);
      return;
    }

    // 2. Token Fetching from Server API Route
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
      setLoading(false);
    } catch (err: any) {
      console.error('[LiveKit] Connection setup error:', err);
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
    initVoiceConnection();
  }, [isOpen, initVoiceConnection, retryCount]);

  if (!isOpen) return null;

  const modalContent = (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md pointer-events-auto">
      <div className="w-full max-w-sm rounded-3xl bg-zinc-900 border border-zinc-800 p-6 shadow-2xl text-center text-white my-auto flex flex-col space-y-4">
        {loading || (!token && !error) ? (
          <div className="flex flex-col items-center justify-center py-6 space-y-3">
            <Loader2 className="h-8 w-8 animate-spin text-emerald-400" />
            <p className="text-sm font-medium text-emerald-300 text-center">
              Requesting media permissions & joining call...
            </p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-4 space-y-3 text-center">
            <ShieldAlert className="h-8 w-8 text-destructive animate-bounce" />
            <p className="text-sm font-semibold text-destructive">{error}</p>
            <div className="flex items-center justify-center gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setRetryCount((prev) => prev + 1)}
                className="rounded-xl flex items-center gap-1.5 border-zinc-700 hover:bg-zinc-800 text-zinc-200"
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
            serverUrl="wss://omegaone-7kb381s3.livekit.cloud"
            connect={true}
            data-lk-theme="default"
            onDisconnected={onClose}
            onError={(err) => {
              console.error('[LiveKit Room Error]', err);
              setError(`Connection Error: ${err.message || 'Disconnected from LiveKit Cloud.'}`);
              toast({
                title: 'Voice Room Disconnected',
                description: err.message || 'Connection error encountered.',
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
    </div>
  );

  if (mounted && typeof document !== 'undefined') {
    return createPortal(modalContent, document.body);
  }

  return modalContent;
}
