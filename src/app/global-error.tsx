'use client';

import React, { useEffect, useState } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    console.error('[GlobalError Boundary] Root exception caught:', error);
    console.error('[GlobalError Boundary] Stack:', error?.stack);
  }, [error]);

  const copyError = async () => {
    const textToCopy = `[Root Global Error]\nMessage: ${error?.message}\nDigest: ${error?.digest || 'N/A'}\nStack:\n${error?.stack || 'No stack trace available'}`;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(textToCopy);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = textToCopy;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.error('Failed to copy error:', e);
    }
  };

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          padding: '16px',
          backgroundColor: '#0a0505',
          color: '#fef2f2',
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
          boxSizing: 'border-box',
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div
          style={{
            maxWidth: '800px',
            margin: '0 auto',
            width: '100%',
            backgroundColor: '#180505',
            border: '2px solid #ef4444',
            borderRadius: '12px',
            padding: '20px',
            boxShadow: '0 10px 30px rgba(0,0,0,0.9)',
            boxSizing: 'border-box',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '16px',
              borderBottom: '1px solid #7f1d1d',
              paddingBottom: '12px',
            }}
          >
            <h1
              style={{
                margin: 0,
                fontSize: '18px',
                color: '#f87171',
                fontWeight: 'bold',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              🚨 Root Layout Exception
            </h1>
            <span
              style={{
                fontSize: '11px',
                backgroundColor: '#450a0a',
                color: '#fca5a5',
                padding: '3px 8px',
                borderRadius: '4px',
                border: '1px solid #991b1b',
              }}
            >
              global-error.tsx
            </span>
          </div>

          <p style={{ margin: '0 0 16px 0', fontSize: '13px', color: '#fca5a5' }}>
            A critical error occurred in the Root Layout or global Provider tree.
          </p>

          <div style={{ marginBottom: '16px' }}>
            <div style={{ fontSize: '11px', textTransform: 'uppercase', color: '#991b1b', fontWeight: 'bold', marginBottom: '4px' }}>
              Error Message
            </div>
            <div
              style={{
                backgroundColor: '#2c0b0b',
                border: '1px solid #991b1b',
                borderRadius: '6px',
                padding: '12px',
                color: '#fee2e2',
                fontWeight: 'bold',
                fontSize: '13px',
                wordBreak: 'break-word',
              }}
            >
              {error?.message || 'Unknown Root Error'}
            </div>
            {error?.digest && (
              <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '4px' }}>
                Digest: {error.digest}
              </div>
            )}
          </div>

          <div style={{ marginBottom: '20px' }}>
            <div style={{ fontSize: '11px', textTransform: 'uppercase', color: '#991b1b', fontWeight: 'bold', marginBottom: '4px' }}>
              Stack Trace
            </div>
            <pre
              style={{
                margin: 0,
                padding: '12px',
                backgroundColor: '#110303',
                border: '1px solid #450a0a',
                borderRadius: '6px',
                color: '#4ade80',
                fontSize: '11px',
                lineHeight: '1.5',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all',
                maxHeight: '400px',
                overflowY: 'auto',
              }}
            >
              {error?.stack || 'No stack trace available'}
            </pre>
          </div>

          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button
              onClick={copyError}
              style={{
                backgroundColor: copied ? '#15803d' : '#991b1b',
                color: '#ffffff',
                border: 'none',
                borderRadius: '6px',
                padding: '10px 16px',
                fontSize: '13px',
                fontWeight: 'bold',
                cursor: 'pointer',
                transition: 'background-color 0.2s',
              }}
            >
              {copied ? '✓ Copied to Clipboard!' : '📋 Copy Error Details'}
            </button>
            <button
              onClick={() => reset()}
              style={{
                backgroundColor: '#7c3aed',
                color: '#ffffff',
                border: 'none',
                borderRadius: '6px',
                padding: '10px 16px',
                fontSize: '13px',
                fontWeight: 'bold',
                cursor: 'pointer',
              }}
            >
              🔄 Try Again
            </button>
            <button
              onClick={() => (window.location.href = '/')}
              style={{
                backgroundColor: '#374151',
                color: '#ffffff',
                border: 'none',
                borderRadius: '6px',
                padding: '10px 16px',
                fontSize: '13px',
                fontWeight: 'bold',
                cursor: 'pointer',
              }}
            >
              🏠 Reload App
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
