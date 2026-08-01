"use client";

import React from 'react';
import { MicOff, Settings, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';

interface MicPermissionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRetry?: () => void;
}

export function MicPermissionModal({
  isOpen,
  onClose,
  onRetry,
}: MicPermissionModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md rounded-3xl border border-destructive/30 bg-card p-6 shadow-2xl">
        <DialogHeader className="flex flex-col items-center text-center space-y-3">
          <div className="h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center text-destructive">
            <MicOff className="h-8 w-8 animate-pulse" />
          </div>
          <DialogTitle className="text-xl font-bold tracking-tight text-foreground">
            Microphone Access Required
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground text-center">
            Microphone Access Required: Please enable microphone permissions in your browser settings to make voice calls.
          </DialogDescription>
        </DialogHeader>

        <div className="my-2 rounded-2xl bg-muted/60 p-4 border border-border/50 text-xs text-muted-foreground space-y-2">
          <div className="flex items-center gap-2 text-foreground font-semibold">
            <Settings className="h-4 w-4 text-primary" />
            How to fix in browser:
          </div>
          <ol className="list-decimal list-inside space-y-1 pl-1">
            <li>Click the Lock / Camera icon in your browser address bar</li>
            <li>Change Microphone permission to <span className="font-semibold text-emerald-400">Allow</span></li>
            <li>Refresh the page or click Try Again</li>
          </ol>
        </div>

        <DialogFooter className="grid grid-cols-2 gap-3 w-full sm:space-x-0 mt-4">
          <Button variant="outline" className="rounded-xl font-semibold" onClick={onClose}>
            Dismiss
          </Button>
          {onRetry ? (
            <Button className="rounded-xl font-semibold bg-primary" onClick={onRetry}>
              Try Again
            </Button>
          ) : (
            <Button className="rounded-xl font-semibold bg-primary" onClick={onClose}>
              Got It
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
