
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
import { useToast } from '@/hooks/use-toast';
import { Loader2, Search } from 'lucide-react';
import Image from 'next/image';
import { Button } from './ui/button';
import { cn } from '@/lib/utils';
import { useDebounce } from '@/hooks/use-debounce';

const TENOR_API_KEY = process.env.NEXT_PUBLIC_TENOR_API_KEY;

interface Gif {
  id: string;
  url: string;
  preview: string;
  title: string;
}

interface GifPickerProps {
  children: React.ReactNode;
  onSelect: (base64: string, fileType: string, fileName: string, caption: string) => void;
}

const fileToBase64 = (file: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
    });
};

async function fetchGifs(
  searchTerm: string,
  toast: (options: any) => void
): Promise<Gif[]> {
  if (!TENOR_API_KEY) {
      toast({
        title: 'Missing API Key',
        description: 'The Tenor API key is missing. Please add it to your environment variables.',
        variant: 'destructive',
      });
      return [];
  }
  
  const searchUrl = `https://tenor.googleapis.com/v2/search?q=${encodeURIComponent(
    searchTerm
  )}&key=${TENOR_API_KEY}&limit=20&media_filter=tinygif`;
  const trendingUrl = `https://tenor.googleapis.com/v2/featured?key=${TENOR_API_KEY}&limit=20&media_filter=tinygif`;

  const url = searchTerm ? searchUrl : trendingUrl;
  
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    return data.results.map((gif: any) => ({
      id: gif.id,
      url: gif.media_formats.gif?.url || gif.media_formats.tinygif.url,
      preview: gif.media_formats.tinygif.url,
      title: gif.content_description,
    })).filter((g: Gif) => g.url && g.preview);
  } catch (error) {
    console.error('Error fetching GIFs:', error);
    return [];
  }
}

export function GifPicker({ children, onSelect }: GifPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 300);
  const [gifs, setGifs] = useState<Gif[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleSearch = useCallback(async (term: string) => {
    setIsLoading(true);
    try {
      const results = await fetchGifs(term, toast);
      setGifs(results);
    } catch (error) {
      console.error('Failed to fetch GIFs', error);
      toast({
        title: 'Error fetching GIFs',
        description: 'Could not load GIFs. Please try again later.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (isOpen) {
      handleSearch(debouncedSearchTerm);
    }
  }, [isOpen, debouncedSearchTerm, handleSearch]);

  const handleGifSelect = (gif: Gif) => {
    fetch(gif.url)
        .then(res => res.blob())
        .then(blob => fileToBase64(blob))
        .then(base64 => {
            onSelect(base64, 'image/gif', gif.title || 'vibez-gif.gif', '');
        })
        .catch(err => {
             console.error("Error fetching GIF blob", err);
             toast({
                title: "Couldn't send GIF",
                description: "There was a problem downloading the selected GIF.",
                variant: "destructive"
             })
        });

    setIsOpen(false);
  };
  
  const memoizedGifs = useMemo(() => {
    return gifs.map((gif) => (
        <button
            key={gif.id}
            onClick={() => handleGifSelect(gif)}
            className="rounded-md overflow-hidden aspect-video relative group focus:outline-none focus:ring-2 focus:ring-primary"
        >
            <Image
            src={gif.preview}
            alt={gif.title}
            fill
            className="object-cover group-hover:scale-110 transition-transform duration-200"
            unoptimized
            />
        </button>
    ))
  }, [gifs, handleGifSelect]);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Select a GIF</DialogTitle>
        </DialogHeader>
        <div className="relative my-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search for a GIF..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        <ScrollArea className={cn("h-80 border rounded-md", isLoading && 'flex items-center justify-center')}>
            {isLoading ? (
                <div className="flex justify-center items-center h-full">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
            ) : gifs.length > 0 ? (
                <div className="p-2 grid grid-cols-2 gap-2">
                    {memoizedGifs}
                </div>
            ) : (
                <p className="text-center text-muted-foreground p-8">No GIFs found. Is your API key set?</p>
            )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
