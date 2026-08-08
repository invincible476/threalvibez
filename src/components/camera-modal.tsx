'use client';

import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Camera as CameraIcon, RefreshCw } from 'lucide-react';
import { Button } from './ui/button';

interface CameraModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (file: File) => void;
}

export function CameraModal({ isOpen, onClose, onCapture }: CameraModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isOpen) {
      stopStream();
      return;
    }

    startCamera(facingMode);

    return () => {
      stopStream();
    };
  }, [isOpen, facingMode]);

  const stopStream = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
  };

  const startCamera = async (mode: 'user' | 'environment') => {
    stopStream();
    setError(null);

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Camera access not supported on this browser/device.');
      }

      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: mode, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });

      setStream(mediaStream);

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err: any) {
      console.error('[CameraModal] Error starting camera:', err);
      // If environment (rear camera) failed, try fallback to any video source
      if (mode === 'environment') {
        try {
          const fallbackStream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false,
          });
          setStream(fallbackStream);
          if (videoRef.current) {
            videoRef.current.srcObject = fallbackStream;
          }
          return;
        } catch (e: any) {
          setError(e?.message || 'Unable to access camera.');
        }
      } else {
        setError(err?.message || 'Unable to access camera.');
      }
    }
  };

  const toggleCamera = () => {
    setFacingMode((prev) => (prev === 'user' ? 'environment' : 'user'));
  };

  const takePhoto = () => {
    if (!videoRef.current) return;

    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Flip horizontally if front-facing camera
    if (facingMode === 'user') {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(
      (blob) => {
        if (blob) {
          const file = new File([blob], `camera-${Date.now()}.jpg`, { type: 'image/jpeg' });
          onCapture(file);
          stopStream();
          onClose();
        }
      },
      'image/jpeg',
      0.92
    );
  };

  if (!isOpen || !mounted) return null;

  const modalContent = (
    <div className="fixed inset-0 z-[9999] bg-black flex flex-col justify-between p-4 w-screen h-screen select-none animate-in fade-in duration-200">
      {/* Top Bar */}
      <div className="flex items-center justify-between z-10 px-2 py-1 shrink-0">
        <div className="text-white text-base font-semibold flex items-center gap-2">
          <CameraIcon className="w-5 h-5 text-emerald-400" />
          <span>Take Photo</span>
        </div>

        <button
          type="button"
          onClick={() => {
            stopStream();
            onClose();
          }}
          className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-all active:scale-95"
          title="Close Camera"
        >
          <X className="w-6 h-6" />
        </button>
      </div>

      {/* Camera Live Preview Viewfinder */}
      <div className="flex-1 relative flex items-center justify-center overflow-hidden rounded-3xl bg-zinc-950 my-2 border border-zinc-800">
        {error ? (
          <div className="p-6 text-center text-red-400 space-y-2">
            <p className="font-semibold">{error}</p>
            <p className="text-xs text-muted-foreground">Please check camera permissions in your OS or browser settings.</p>
          </div>
        ) : (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className={`w-full h-full object-cover rounded-3xl ${facingMode === 'user' ? 'scale-x-[-1]' : ''}`}
          />
        )}
      </div>

      {/* Bottom Shutter Controls */}
      <div className="flex items-center justify-around z-10 py-3 shrink-0">
        {/* Toggle Front/Rear Camera */}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={toggleCamera}
          className="h-12 w-12 rounded-full bg-white/10 hover:bg-white/20 text-white"
          title="Flip Camera"
        >
          <RefreshCw className="w-5 h-5" />
        </Button>

        {/* Capture Shutter Button */}
        <button
          type="button"
          onClick={takePhoto}
          disabled={!stream}
          className="h-18 w-18 rounded-full border-4 border-white bg-white/20 flex items-center justify-center active:scale-90 transition-all disabled:opacity-50"
          title="Snap Photo"
        >
          <div className="h-14 w-14 rounded-full bg-white shadow-lg" />
        </button>

        <div className="w-12 h-12" /> {/* Spacer */}
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
