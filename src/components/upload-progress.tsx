
'use client';
import { X } from 'lucide-react';
import { Button } from './ui/button';
import { Progress } from './ui/progress';

interface UploadProgressProps {
  progress?: number;
  onCancel: () => void;
}

export function UploadProgress({ progress, onCancel }: UploadProgressProps) {
  const p = progress || 0;
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/60 rounded-lg p-4">
      <div className="w-full flex items-center gap-2 text-white">
        <div className="flex-1">
          <p className="text-xs mb-1">{p < 100 ? `Uploading... ${p.toFixed(0)}%` : 'Processing...'}</p>
          <Progress value={p} className="h-1.5" />
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 rounded-full bg-white/20 hover:bg-white/30"
          onClick={onCancel}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

    