'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from './ui/input';
import { ScrollArea } from './ui/scroll-area';
import { Loader2, Search, Film, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDebounce } from '@/hooks/use-debounce';
import { GifItem } from '@/lib/gif-service';

interface GifPickerProps {
  children: React.ReactNode;
  onSelectGif: (gifMp4Url: string, aspectRatio?: number) => void;
}

export function GifPicker({ children, onSelectGif }: GifPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 300);
  const [gifs, setGifs] = useState<GifItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchGifs = useCallback(async (query: string) => {
    setIsLoading(true);
    try {
      const endpoint = query.trim()
        ? `/api/gifs/search?q=${encodeURIComponent(query.trim())}&page=1`
        : `/api/gifs/trending?page=1`;

      const response = await fetch(endpoint);
      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`);
      }
      const data = await response.json();
      if (Array.isArray(data)) {
        setGifs(data);
      } else {
        setGifs([]);
      }
    } catch (error) {
      console.error('Failed to fetch GIFs from API proxy:', error);
      setGifs([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchGifs(debouncedSearchTerm);
    }
  }, [isOpen, debouncedSearchTerm, fetchGifs]);

  const handleGifClick = (gif: GifItem) => {
    const selectedUrl = gif.mp4Url || gif.previewUrl;
    // 1. Immediately invoke onSelectGif callback
    onSelectGif(selectedUrl, gif.aspectRatio);
    // 2. Instantly close modal
    setIsOpen(false);
  };

  const memoizedGifs = useMemo(() => {
    return gifs.map((gif) => {
      const isVideo = gif.previewUrl.endsWith('.mp4') || gif.previewUrl.includes('/mp4');
      return (
        <button
          key={gif.id}
          type="button"
          onClick={() => handleGifClick(gif)}
          className="group relative w-full overflow-hidden rounded-xl bg-card border border-border/50 hover:border-violet-500/50 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-violet-500 aspect-square sm:aspect-auto"
          style={{ aspectRatio: gif.aspectRatio || 1 }}
        >
          {isVideo ? (
            <video
              src={gif.previewUrl}
              autoPlay
              loop
              muted
              playsInline
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
            />
          ) : (
            <img
              src={gif.previewUrl}
              alt={gif.title || 'GIF'}
              loading="lazy"
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-2">
            <span className="text-[11px] font-medium text-white truncate">{gif.title}</span>
          </div>
        </button>
      );
    });
  }, [gifs]);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-md bg-card/95 backdrop-blur-xl border-border text-foreground shadow-2xl p-4 gap-3">
        <DialogHeader className="pb-1">
          <DialogTitle className="flex items-center gap-2 text-lg font-heading">
            <Film className="h-5 w-5 text-violet-400" />
            Select a GIF
          </DialogTitle>
        </DialogHeader>

        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search GIFs on Tenor & Giphy..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 bg-background/60 border-border/60 focus-visible:ring-violet-500 rounded-xl text-sm"
          />
        </div>

        {/* Header Indicator */}
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground px-1 font-medium">
          <TrendingUp className="h-3.5 w-3.5 text-violet-400" />
          <span>{searchTerm.trim() ? `Search results for "${searchTerm}"` : 'Trending GIFs'}</span>
        </div>

        {/* Masonry / Grid Container */}
        <ScrollArea className="h-80 border border-border/40 rounded-xl p-2 bg-background/30">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-72 gap-2 text-muted-foreground">
              <Loader2 className="h-7 w-7 animate-spin text-violet-400" />
              <span className="text-xs">Loading GIFs...</span>
            </div>
          ) : gifs.length > 0 ? (
            <div className="columns-2 sm:columns-3 gap-2 space-y-2">
              {memoizedGifs}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-72 text-center p-4 text-muted-foreground">
              <p className="text-sm font-medium">No GIFs found</p>
              <p className="text-xs mt-1">Try searching for something else like "cat", "dance", or "vibe".</p>
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
