'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Download, ZoomIn, ZoomOut } from 'lucide-react';

interface ImageViewerModalProps {
  isOpen: boolean;
  src: string;
  alt?: string;
  title?: string;
  onClose: () => void;
}

export function ImageViewerModal({ isOpen, src, alt = 'Image preview', title, onClose }: ImageViewerModalProps) {
  const [zoom, setZoom] = useState(1);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !src || !mounted) return null;

  const handleDownload = async () => {
    try {
      const res = await fetch(src);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `vibez-photo-${Date.now()}.jpg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      window.open(src, '_blank');
    }
  };

  const modalContent = (
    <div 
      className="fixed inset-0 z-[9999] bg-black/95 backdrop-blur-2xl flex flex-col justify-between p-4 animate-in fade-in duration-200 select-none w-screen h-screen"
      style={{ top: 0, left: 0, right: 0, bottom: 0 }}
    >
      {/* Top Header Controls */}
      <div className="flex items-center justify-between z-10 px-3 py-2 shrink-0">
        <div className="text-white text-sm font-medium truncate max-w-[200px] sm:max-w-md">
          {title || 'Photo'}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setZoom(prev => Math.min(prev + 0.5, 3))}
            className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-all active:scale-95"
            title="Zoom In"
          >
            <ZoomIn className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={() => setZoom(prev => Math.max(prev - 0.5, 1))}
            className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-all active:scale-95"
            title="Zoom Out"
          >
            <ZoomOut className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={handleDownload}
            className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-all active:scale-95"
            title="Download Image"
          >
            <Download className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="p-2.5 rounded-full bg-white/20 hover:bg-white/30 text-white transition-all active:scale-95 ml-2"
            title="Close"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
      </div>

      {/* Main Centered High-Res Image Display Container */}
      <div
        className="flex-1 flex items-center justify-center overflow-hidden relative cursor-zoom-out p-2 w-full h-full"
        onClick={onClose}
      >
        <div
          className="relative flex items-center justify-center max-w-full max-h-full transition-transform duration-200"
          style={{ transform: `scale(${zoom})` }}
          onClick={(e) => e.stopPropagation()}
        >
          <img
            src={src}
            alt={alt}
            className="max-h-[85dvh] max-w-[95dvw] object-contain rounded-2xl shadow-2xl border border-white/10 m-auto"
          />
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
