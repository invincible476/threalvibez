import React, { useRef, useEffect } from 'react';

interface RemoteAudioProps {
  stream: MediaStream;
  participantId: string;
  volume?: number;
}

export function RemoteAudio({ stream, participantId, volume = 1 }: RemoteAudioProps) {
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.srcObject = stream;
      audioRef.current.volume = volume;
    }
  }, [stream, volume]);

  return (
    <audio
      ref={audioRef}
      autoPlay
      id={`voice-${participantId}`}
      className="hidden"
    />
  );
}