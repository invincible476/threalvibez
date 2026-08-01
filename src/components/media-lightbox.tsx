'use client';

import React, { useState } from 'react';
import { X, ChevronLeft, ChevronRight, Download } from 'lucide-react';
import { Button } from './ui/button';
import Image from 'next/image';

export interface LightboxMedia {
  url: string;
  type: string;
  name?: string;
}

interface MediaLightboxProps {
  media: LightboxMedia[];
  initialIndex?: number;
  isOpen: boolean;
  onClose: () => void;
}

export function MediaLightbox({
  media,
  initialIndex = 0,
  isOpen,
  onClose,
}: MediaLightboxProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);

  if (!isOpen || !media || media.length === 0) return null;

  const currentItem = media[currentIndex] || media[0];
  const isImage = currentItem.type.startsWith('image/');
  const isVideo = currentItem.type.startsWith('video/');

  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : media.length - 1));
  };

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev < media.length - 1 ? prev + 1 : 0));
  };

  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation();
    const link = document.createElement('a');
    link.href = currentItem.url;
    link.download = currentItem.name || 'download';
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/95 backdrop-blur-md flex flex-col justify-between p-4 select-none animate-in fade-in duration-200"
      onClick={onClose}
    >
      {/* Top Header */}
      <div className="flex items-center justify-between w-full z-10 p-2" onClick={(e) => e.stopPropagation()}>
        <span className="text-sm font-medium text-zinc-300">
          {media.length > 1 ? `${currentIndex + 1} of ${media.length}` : (currentItem.name || 'Media')}
        </span>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 rounded-full text-zinc-300 hover:bg-zinc-800 hover:text-white"
            onClick={handleDownload}
            title="Download"
          >
            <Download className="h-5 w-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 rounded-full text-zinc-300 hover:bg-zinc-800 hover:text-white"
            onClick={onClose}
            title="Close"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Main Display Container */}
      <div
        className="flex-1 relative flex items-center justify-center min-h-0 w-full p-2"
        onClick={(e) => e.stopPropagation()}
      >
        {media.length > 1 && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute left-2 z-20 h-10 w-10 rounded-full bg-black/50 text-white hover:bg-black/80"
            onClick={handlePrev}
          >
            <ChevronLeft className="h-6 w-6" />
          </Button>
        )}

        <div className="relative max-w-full max-h-full flex items-center justify-center overflow-hidden rounded-lg">
          {isImage ? (
            <img
              src={currentItem.url}
              alt={currentItem.name || 'Lightbox image'}
              className="max-h-[85vh] max-w-[90vw] object-contain rounded-lg"
            />
          ) : isVideo ? (
            <video
              src={currentItem.url}
              controls
              autoPlay
              className="max-h-[85vh] max-w-[90vw] rounded-lg"
            />
          ) : (
            <div className="text-zinc-300 p-8 text-center bg-zinc-900 rounded-xl">
              <p className="font-semibold">{currentItem.name}</p>
              <p className="text-sm text-zinc-400 mt-2">Cannot preview this media format.</p>
              <Button onClick={handleDownload} className="mt-4 bg-violet-700 text-white">
                Download File
              </Button>
            </div>
          )}
        </div>

        {media.length > 1 && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-2 z-20 h-10 w-10 rounded-full bg-black/50 text-white hover:bg-black/80"
            onClick={handleNext}
          >
            <ChevronRight className="h-6 w-6" />
          </Button>
        )}
      </div>

      {/* Footer Title */}
      <div className="text-center text-xs text-zinc-500 py-2 select-none" onClick={(e) => e.stopPropagation()}>
        {currentItem.name && <p className="truncate max-w-md mx-auto">{currentItem.name}</p>}
      </div>
    </div>
  );
}
