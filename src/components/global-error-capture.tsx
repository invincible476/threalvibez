'use client';

import React, { useEffect, useState } from 'react';

interface CapturedError {
  id: string;
  type: string;
  message: string;
  stack?: string;
  timestamp: string;
}

/**
 * GlobalErrorCapture - mounts window.onerror + unhandledrejection listeners
 * and renders a high-visibility mobile debug banner at the top of the viewport (z-index: 99999).
 * Provides one-tap copying of the full error message and stack trace.
 */
export function GlobalErrorCapture() {
  const [errors, setErrors] = useState<CapturedError[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      console.error('[GlobalErrorCapture] window.onerror caught:', event);
      
      const message = event.message || (event.error?.message ?? 'Unknown Window Error');
      const stack = event.error?.stack || (event.filename ? `${event.filename}:${event.lineno}:${event.colno}` : undefined);
      
      const newErr: CapturedError = {
        id: Math.random().toString(36).substring(2, 9),
        type: 'Async Window Error',
        message,
        stack,
        timestamp: new Date().toLocaleTimeString(),
      };

      setErrors(prev => [newErr, ...prev]);
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      console.error('[GlobalErrorCapture] Unhandled Promise Rejection:', event);
      
      const reason = event.reason;
      let message = 'Unhandled Promise Rejection';
      let stack: string | undefined = undefined;

      if (reason instanceof Error) {
        message = reason.message;
        stack = reason.stack;
      } else if (typeof reason === 'string') {
        message = reason;
      } else if (reason && typeof reason === 'object') {
        message = reason.message || JSON.stringify(reason);
        stack = reason.stack;
      }

      const newErr: CapturedError = {
        id: Math.random().toString(36).substring(2, 9),
        type: 'Unhandled Rejection',
        message,
        stack,
        timestamp: new Date().toLocaleTimeString(),
      };

      setErrors(prev => [newErr, ...prev]);
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);

  const copyToClipboard = async (err: CapturedError) => {
    const textToCopy = `[${err.type}] ${err.timestamp}\nMessage: ${err.message}\nStack:\n${err.stack || 'No stack trace available'}`;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(textToCopy);
      } else {
        // Fallback for older webviews / non-HTTPS / restricted contexts
        const textarea = document.createElement('textarea');
        textarea.value = textToCopy;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopiedId(err.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (e) {
      console.error('Failed to copy error:', e);
    }
  };

  const dismissError = (id: string) => {
    setErrors(prev => prev.filter(e => e.id !== id));
  };

  const clearAll = () => {
    setErrors([]);
  };

  if (errors.length === 0) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 99999,
        maxHeight: '80vh',
        overflowY: 'auto',
        backgroundColor: '#180505',
        borderBottom: '3px solid #ef4444',
        boxShadow: '0 10px 25px rgba(0,0,0,0.8)',
        color: '#fef2f2',
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
        fontSize: '12px',
        padding: '12px',
      }}
      className="mobile-error-banner"
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', borderBottom: '1px solid #7f1d1d', paddingBottom: '6px' }}>
        <span style={{ fontWeight: 'bold', color: '#f87171', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          🚨 Async Window Errors Captured ({errors.length})
        </span>
        <button
          onClick={clearAll}
          style={{
            backgroundColor: '#450a0a',
            color: '#fca5a5',
            border: '1px solid #991b1b',
            borderRadius: '4px',
            padding: '2px 8px',
            fontSize: '11px',
            cursor: 'pointer',
          }}
        >
          Dismiss All
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {errors.map(err => (
          <div
            key={err.id}
            style={{
              backgroundColor: '#2c0b0b',
              border: '1px solid #991b1b',
              borderRadius: '6px',
              padding: '10px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
              <span style={{ color: '#fca5a5', fontWeight: 'bold' }}>[{err.type}] {err.timestamp}</span>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  onClick={() => copyToClipboard(err)}
                  style={{
                    backgroundColor: copiedId === err.id ? '#15803d' : '#991b1b',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '4px',
                    padding: '3px 8px',
                    fontSize: '11px',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    transition: 'background-color 0.2s',
                  }}
                >
                  {copiedId === err.id ? '✓ Copied!' : '📋 Copy Error'}
                </button>
                <button
                  onClick={() => dismissError(err.id)}
                  style={{
                    backgroundColor: 'transparent',
                    color: '#9ca3af',
                    border: 'none',
                    fontSize: '13px',
                    cursor: 'pointer',
                    padding: '0 4px',
                  }}
                >
                  ✕
                </button>
              </div>
            </div>

            <div style={{ color: '#fee2e2', fontWeight: 600, wordBreak: 'break-word', marginBottom: '4px' }}>
              {err.message}
            </div>

            {err.stack && (
              <pre
                style={{
                  margin: 0,
                  padding: '6px',
                  backgroundColor: '#1a0505',
                  borderRadius: '4px',
                  color: '#4ade80',
                  maxHeight: '150px',
                  overflowX: 'auto',
                  overflowY: 'auto',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-all',
                  fontSize: '11px',
                }}
              >
                {err.stack}
              </pre>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
