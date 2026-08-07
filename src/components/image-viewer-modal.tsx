'use client';

import React, { useEffect } from 'react';
import { X, Download, ZoomIn, ZoomOut } from 'lucide-react';
import Image from 'next/image';

interface ImageViewerModalProps {
  isOpen: boolean;
  src: string;
  alt?: string;
  title?: string;
  onClose: () => void;
}

export function ImageViewerModal({ isOpen, src, alt = 'Image preview', title, onClose }: ImageViewerModalProps) {
  const [zoom, setZoom] = React.useState(1);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !src) return null;

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

  return (
    <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-2xl flex flex-col justify-between p-4 animate-in fade-in duration-200 select-none">
      {/* Top Header Controls */}
      <div className="flex items-center justify-between z-10 px-2 py-1">
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

      {/* Main High-Res Image Container */}
      <div
        className="flex-1 flex items-center justify-center overflow-hidden relative cursor-zoom-out p-2"
        onClick={onClose}
      >
        <div
          className="relative max-w-full max-h-full transition-transform duration-200"
          style={{ transform: `scale(${zoom})` }}
          onClick={(e) => e.stopPropagation()}
        >
          <img
            src={src}
            alt={alt}
            className="max-h-[85vh] max-w-[95vw] object-contain rounded-2xl shadow-2xl border border-white/10"
          />
        </div>
      </div>
    </div>
  );
}
