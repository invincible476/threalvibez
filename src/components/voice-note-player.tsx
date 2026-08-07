'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, Volume2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface VoiceNotePlayerProps {
  src: string;
  duration?: number;
  isOutgoing?: boolean;
  className?: string;
}

export function VoiceNotePlayer({ src, duration: initialDuration, isOutgoing = false, className }: VoiceNotePlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(initialDuration || 0);
  const [playbackRate, setPlaybackRate] = useState(1);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    const handleLoadedMetadata = () => {
      if (audio.duration && !isNaN(audio.duration) && isFinite(audio.duration)) {
        setDuration(audio.duration);
      }
    };
    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [src]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.play().then(() => {
        setIsPlaying(true);
      }).catch(err => console.error('[VoiceNotePlayer] Play error:', err));
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current;
    if (!audio) return;
    const newTime = parseFloat(e.target.value);
    audio.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const toggleSpeed = () => {
    const audio = audioRef.current;
    const nextRate = playbackRate === 1 ? 1.5 : playbackRate === 1.5 ? 2 : 1;
    setPlaybackRate(nextRate);
    if (audio) {
      audio.playbackRate = nextRate;
    }
  };

  const formatTime = (secs: number) => {
    if (isNaN(secs) || !isFinite(secs) || secs < 0) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  // Waveform bars simulation
  const waveformHeights = [30, 60, 40, 80, 50, 90, 35, 75, 45, 65, 85, 40, 70, 55, 30];

  return (
    <div className={cn(
      "flex items-center gap-3 p-3 rounded-2xl border backdrop-blur-md shadow-md min-w-[220px] max-w-[300px]",
      isOutgoing 
        ? "bg-emerald-950/40 border-emerald-800/40 text-emerald-100" 
        : "bg-zinc-900/80 border-zinc-800/80 text-zinc-100",
      className
    )}>
      <audio ref={audioRef} src={src} preload="metadata" />

      {/* Play / Pause Toggle Button */}
      <button
        type="button"
        onClick={togglePlay}
        className={cn(
          "w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-transform active:scale-95 shadow-md",
          isOutgoing
            ? "bg-emerald-500 hover:bg-emerald-400 text-zinc-950"
            : "bg-violet-600 hover:bg-violet-500 text-white"
        )}
      >
        {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-0.5" />}
      </button>

      {/* Waveform & Progress Bar */}
      <div className="flex-1 flex flex-col gap-1.5 min-w-0">
        {/* Animated Waveform Visualizer */}
        <div className="flex items-center gap-1 h-6 px-1">
          {waveformHeights.map((height, i) => {
            const barProgress = (i / waveformHeights.length) * 100;
            const isPassed = progressPercent >= barProgress;
            return (
              <div
                key={i}
                style={{ height: `${height}%` }}
                className={cn(
                  "w-1 rounded-full transition-all duration-150",
                  isPassed
                    ? (isOutgoing ? "bg-emerald-400" : "bg-violet-400")
                    : (isOutgoing ? "bg-emerald-900/60" : "bg-zinc-700/60"),
                  isPlaying && isPassed && "animate-pulse"
                )}
              />
            );
          })}
        </div>

        {/* Interactive Scrub Input Slider */}
        <div className="relative flex items-center">
          <input
            type="range"
            min={0}
            max={duration || 100}
            step={0.1}
            value={currentTime}
            onChange={handleSeek}
            className="w-full h-1.5 bg-zinc-700/50 rounded-lg appearance-none cursor-pointer accent-emerald-400 focus:outline-none"
          />
        </div>

        {/* Timer Label */}
        <div className="flex items-center justify-between text-[10px] opacity-75 font-mono">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      {/* Playback Speed Toggle Button */}
      <button
        type="button"
        onClick={toggleSpeed}
        className="text-[11px] font-semibold px-2 py-1 rounded-md bg-white/10 hover:bg-white/20 transition-colors shrink-0 text-zinc-300"
      >
        {playbackRate}x
      </button>
    </div>
  );
}
