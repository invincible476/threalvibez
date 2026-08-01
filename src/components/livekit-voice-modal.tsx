'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  LiveKitRoom,
  AudioConference,
  RoomAudioRenderer,
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

  const activeUsername = username || userName || 'User';
  const activeUserId = userId || activeUsername;

  // Client-side mount check for React Portal
  useEffect(() => {
    setMounted(true);
  }, []);

  // Fetch LiveKit access token
  useEffect(() => {
    if (isOpen === false) return;
    let isMounted = true;

    async function fetchToken() {
      try {
        const res = await fetch(
          `/api/livekit/token?room=${encodeURIComponent(roomId)}&username=${encodeURIComponent(
            activeUsername
          )}&identity=${encodeURIComponent(activeUserId)}`
        );
        const data = await res.json();

        if (!res.ok || data.error) {
          throw new Error(data.error || `HTTP ${res.status}`);
        }

        if (isMounted && data.token) {
          setToken(data.token);
        }
      } catch (err: any) {
        if (isMounted) {
          setErrorMessage(err.message || 'Failed to fetch access token');
        }
      }
    }

    fetchToken();

    return () => {
      isMounted = false;
    };
  }, [isOpen, roomId, activeUsername, activeUserId]);

  if (isOpen === false || !mounted) return null;

  // Content render
  const modalContent = (
    <div className="fixed inset-0 z-[999999] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 pointer-events-auto">
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
          <div className="text-center py-4">
            <div className="animate-pulse text-sm font-medium text-zinc-300">
              Joining voice channel...
            </div>
          </div>
        ) : (
          <LiveKitRoom
            video={false}
            audio={true}
            token={token}
            serverUrl={LIVEKIT_WS_URL}
            data-lk-theme="default"
            onDisconnected={onClose}
            onError={(err: any) => console.error('[LiveKit Error]:', err)}
          >
            <AudioConference />
            <RoomAudioRenderer />
          </LiveKitRoom>
        )}
      </div>
    </div>
  );

  // Force render directly into document.body to escape parent container CSS transforms
  return createPortal(modalContent, document.body);
}
