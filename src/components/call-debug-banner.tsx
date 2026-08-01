"use client";

import React, { useEffect, useState } from 'react';
import { callTelemetry, CallTelemetryState } from '@/lib/voice/telemetry';
import { Bug, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CallDebugBannerProps {
  status?: string;
  currentStep?: string;
  errorCode?: string | null;
  className?: string;
}

export function CallDebugBanner({
  status: propStatus,
  currentStep: propStep,
  errorCode: propError,
  className,
}: CallDebugBannerProps) {
  const [telemetry, setTelemetry] = useState<CallTelemetryState>(callTelemetry.getSnapshot());

  useEffect(() => {
    const unsub = callTelemetry.subscribe((state) => {
      setTelemetry(state);
    });
    return () => unsub();
  }, []);

  const displayStatus = propStatus ?? telemetry.status;
  const displayStep = propStep ?? telemetry.currentStep;
  const displayError = propError !== undefined ? propError : telemetry.errorCode;

  // Don't render banner if system is completely idle with no status or error
  const isActive = displayStatus && displayStatus !== 'idle';
  const hasError = displayError && displayError !== 'NONE';

  if (!isActive && !hasError) {
    return null;
  }

  return (
    <div
      className={cn(
        'fixed top-2 left-1/2 -translate-x-1/2 z-[110] max-w-xl w-[92%] sm:w-auto px-4 py-2 rounded-xl shadow-xl border backdrop-blur-md transition-all duration-300 font-mono text-xs flex items-center justify-between gap-3',
        hasError
          ? 'bg-destructive/90 text-destructive-foreground border-destructive/50 animate-pulse'
          : 'bg-black/85 text-emerald-400 border-emerald-500/40',
        className
      )}
    >
      <div className="flex items-center gap-2 overflow-hidden">
        {hasError ? (
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-300 animate-bounce" />
        ) : (
          <Bug className="h-4 w-4 shrink-0 text-emerald-400" />
        )}
        <div className="truncate">
          <span className="font-bold tracking-wide">
            [Call System] Status: <span className="underline">{displayStatus || 'idle'}</span> | Step:{' '}
            <span>{displayStep || 'Idle'}</span> | Error:{' '}
            <span className={hasError ? 'text-amber-200 font-black' : 'text-emerald-300'}>
              {displayError || 'NONE'}
            </span>
          </span>
        </div>
      </div>
      {!hasError && (
        <span className="relative flex h-2 w-2 shrink-0">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
        </span>
      )}
    </div>
  );
}
