"use client";

import React, { useEffect, useState } from 'react';
import { callTelemetry, CallTelemetryState } from '@/lib/voice/telemetry';
import { Bug, AlertTriangle, X, ChevronDown, ChevronUp, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
  const [isExpanded, setIsExpanded] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const unsub = callTelemetry.subscribe((state) => {
      setTelemetry(state);
      // Auto-expand on new error arrival
      if (state.errorCode && state.errorCode !== 'NONE') {
        setIsExpanded(true);
      }
    });
    return () => unsub();
  }, []);

  const displayStatus = propStatus ?? telemetry.status;
  const displayStep = propStep ?? telemetry.currentStep;
  const displayError = propError !== undefined ? propError : telemetry.errorCode;
  const errorDetails = telemetry.errorDetails;

  const isActive = displayStatus && displayStatus !== 'idle';
  const hasError = displayError && displayError !== 'NONE';

  if (!isActive && !hasError) {
    return null;
  }

  const handleCopyDetails = () => {
    const textToCopy = `[Call System Error]\nStatus: ${displayStatus}\nStep: ${displayStep}\nError: ${displayError}\nDetails:\n${errorDetails || 'N/A'}`;
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDismiss = () => {
    callTelemetry.reset();
  };

  return (
    <div
      className={cn(
        'fixed top-3 left-1/2 -translate-x-1/2 z-[9999] max-w-xl w-[94%] sm:w-[540px] rounded-2xl shadow-2xl border backdrop-blur-md transition-all duration-200 font-mono text-xs overflow-hidden',
        hasError
          ? 'bg-destructive/95 text-destructive-foreground border-destructive/60 animate-in slide-in-from-top-4'
          : 'bg-black/90 text-emerald-400 border-emerald-500/40',
        className
      )}
    >
      {/* Top Header Bar */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-black/40 border-b border-white/10">
        <div className="flex items-center gap-2 overflow-hidden">
          {hasError ? (
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-300 animate-pulse" />
          ) : (
            <Bug className="h-4 w-4 shrink-0 text-emerald-400" />
          )}
          <div className="truncate font-bold tracking-wide">
            {hasError ? (
              <span className="text-amber-200 text-sm font-black">
                [Call System Error] {displayError}
              </span>
            ) : (
              <span>
                [Call System] Status: <span className="underline">{displayStatus || 'idle'}</span> | Step:{' '}
                <span>{displayStep || 'Idle'}</span>
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {hasError && (
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7 text-amber-200 hover:text-white hover:bg-white/10"
              onClick={handleCopyDetails}
              title="Copy error details"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
            </Button>
          )}

          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 opacity-80 hover:opacity-100 hover:bg-white/10"
            onClick={() => setIsExpanded(!isExpanded)}
            title={isExpanded ? 'Collapse' : 'Expand Details'}
          >
            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>

          {hasError && (
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7 text-white/80 hover:text-white hover:bg-destructive"
              onClick={handleDismiss}
              title="Dismiss error"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Expanded Multi-Line Error Details & Telemetry View */}
      {isExpanded && (
        <div className="p-3.5 space-y-2.5 bg-black/60 border-t border-white/5 text-[11px] leading-relaxed">
          <div className="grid grid-cols-2 gap-2 text-white/90">
            <div>
              <span className="text-white/60">Status:</span>{' '}
              <span className="font-semibold text-emerald-300">{displayStatus || 'idle'}</span>
            </div>
            <div>
              <span className="text-white/60">Current Step:</span>{' '}
              <span className="font-semibold text-white">{displayStep || 'Idle'}</span>
            </div>
          </div>

          {hasError && (
            <div>
              <div className="flex items-center justify-between text-amber-300 font-bold mb-1">
                <span>Error Code: {displayError}</span>
                {telemetry.timestamp && (
                  <span className="text-[10px] text-white/50">
                    {new Date(telemetry.timestamp).toLocaleTimeString()}
                  </span>
                )}
              </div>

              {errorDetails ? (
                <div className="mt-1">
                  <div className="text-[10px] uppercase font-bold tracking-wider text-amber-200/80 mb-1">
                    Error Details & Stack Trace:
                  </div>
                  <pre className="p-3 rounded-xl bg-black/90 text-amber-100 border border-amber-500/30 overflow-x-auto max-h-48 font-mono text-[10px] leading-snug whitespace-pre-wrap break-all shadow-inner">
                    {typeof errorDetails === 'object'
                      ? JSON.stringify(errorDetails, null, 2)
                      : String(errorDetails)}
                  </pre>
                </div>
              ) : (
                <div className="text-amber-200/80 italic text-[10px]">
                  No additional stack trace captured.
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
