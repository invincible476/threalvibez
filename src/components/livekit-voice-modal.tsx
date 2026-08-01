'use client';

import { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  LiveKitRoom,
  RoomAudioRenderer,
  ControlBar,
  useParticipants,
  useConnectionState,
} from '@livekit/components-react';

interface VoiceModalProps {
  isOpen?: boolean;
  roomId: string;
  username?: string;
  userName?: string;
  userId?: string;
  userAvatar?: string;
  targetUser?: { name: string; photoURL?: string };
  onClose: () => void;
}

const LIVEKIT_WS_URL = 'wss://omegaone-7kb381s3.livekit.cloud';

function ActiveCallUI({ onClose }: { onClose: () => void }) {
  const participants = useParticipants();
  const connectionState = useConnectionState();

  return (
    <div className="flex flex-col items-center gap-6 w-full py-2">
      <div className="text-center">
        <h3 className="text-lg font-bold text-white mb-1">Voice Call</h3>
        <p className="text-xs text-emerald-400 font-medium capitalize">
          Status: {connectionState}
        </p>
        <p className="text-xs text-zinc-400 mt-1">
          {participants.length} {participants.length === 1 ? 'participant' : 'participants'} in room
        </p>
      </div>

      <div className="w-20 h-20 rounded-full bg-zinc-800 border-2 border-emerald-500/50 flex items-center justify-center animate-pulse shadow-lg shadow-emerald-500/10">
        <span className="text-2xl font-bold text-zinc-200">
          {participants.length}
        </span>
      </div>

      <div className="w-full flex justify-center scale-110 mt-2">
        <ControlBar
          controls={{
            microphone: true,
            camera: false,
            chat: false,
            screenShare: false,
            leave: true,
          }}
        />
      </div>
    </div>
  );
}

export function LiveKitVoiceModal({
  isOpen = true,
  roomId,
  username,
  userName,
  userId,
  userAvatar,
  targetUser,
  onClose,
}: VoiceModalProps) {
  const [token, setToken] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [mounted, setMounted] = useState<boolean>(false);
  const [connectionStatus, setConnectionStatus] = useState<string>('connecting');
  const abortRef = useRef<AbortController | null>(null);
  const hasConnectedRef = useRef(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isOpen) {
      setToken('');
      setErrorMessage('');
      setConnectionStatus('connecting');
      hasConnectedRef.current = false;
      abortRef.current?.abort();
      abortRef.current = null;
      return;
    }

    let active = true;
    const controller = new AbortController();
    abortRef.current?.abort();
    abortRef.current = controller;

    setToken('');
    setErrorMessage('');
    setConnectionStatus('connecting');
    hasConnectedRef.current = false;

    async function fetchToken() {
      try {
        const baseUsername = username || userName || 'User';
        const uniqueUsername = `${baseUsername}_${Math.floor(Math.random() * 1000)}`;
        const res = await fetch(
          `/api/livekit/token?room=${encodeURIComponent(roomId)}&username=${encodeURIComponent(uniqueUsername)}`,
          { signal: controller.signal }
        );
        const data = await res.json();

        if (!active) return;

        if (!res.ok || data.error) {
          throw new Error(data.error || `HTTP ${res.status}`);
        }

        if (data.token) {
          setToken(data.token);
          setConnectionStatus('connecting');
        }
      } catch (err: any) {
        if (err?.name === 'AbortError') return;
        if (active) {
          setErrorMessage(err.message || 'Failed to fetch access token');
          setConnectionStatus('error');
        }
      }
    }

    fetchToken();

    return () => {
      active = false;
      controller.abort();
      abortRef.current = null;
    };
  }, [isOpen, roomId, username, userName]);

  if (isOpen === false || !mounted) return null;

  const modalContent = (
    <div
      className="fixed inset-0 z-[999999] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 pointer-events-auto"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="w-full max-w-sm rounded-3xl bg-zinc-900 border border-zinc-800 p-6 shadow-2xl text-white my-auto">
        {errorMessage ? (
          <div className="text-center">
            <p className="text-red-400 font-medium text-sm mb-4">{errorMessage}</p>
            <button
              onClick={onClose}
              className="px-5 py-2 bg-zinc-800 hover:bg-zinc-700 text-white font-medium rounded-xl text-sm"
            >
              Close
            </button>
          </div>
        ) : !token ? (
          <div className="text-center py-6">
            <div className="animate-pulse text-sm font-medium text-zinc-300">
              Connecting to Voice Server...
            </div>
            <p className="mt-2 text-xs uppercase tracking-[0.2em] text-zinc-400">{connectionStatus}</p>
          </div>
        ) : (
          <LiveKitRoom
            key={token}
            video={false}
            audio={true}
            token={token}
            serverUrl={LIVEKIT_WS_URL}
            connect={true}
            data-lk-theme="default"
            onConnected={() => {
              hasConnectedRef.current = true;
              setConnectionStatus('connected');
            }}
            onDisconnected={() => {
              if (hasConnectedRef.current) {
                onClose();
              }
              setConnectionStatus('disconnected');
            }}
            onError={(err: any) => {
              console.error('[LiveKit Error]:', err);
              setConnectionStatus('error');
              setErrorMessage(err.message || 'Connection error occurred');
            }}
          >
            <ActiveCallUI onClose={onClose} />
            <RoomAudioRenderer />
          </LiveKitRoom>
        )}
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
