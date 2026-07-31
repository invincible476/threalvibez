'use client';

import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log to console for DevTools inspection
    console.error('[Route Error Boundary] Caught error:', error);
    console.error('[Route Error Boundary] Stack:', error.stack);
  }, [error]);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        backgroundColor: '#0a0a0a',
        color: '#f0f0f0',
        padding: '2rem',
        overflow: 'auto',
        fontFamily: 'monospace',
      }}
    >
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        <div
          style={{
            background: '#1a0000',
            border: '2px solid #ff4444',
            borderRadius: '8px',
            padding: '1.5rem',
            marginBottom: '1.5rem',
          }}
        >
          <h1 style={{ color: '#ff6666', margin: '0 0 0.5rem', fontSize: '1.4rem' }}>
            ⚠️ Client-Side Crash Detected
          </h1>
          <p style={{ color: '#ff9999', margin: 0, fontSize: '0.9rem' }}>
            An unhandled error crashed the React component tree. Full details below.
          </p>
        </div>

        <div
          style={{
            background: '#111',
            border: '1px solid #333',
            borderRadius: '8px',
            padding: '1rem',
            marginBottom: '1rem',
          }}
        >
          <h2 style={{ color: '#fbbf24', margin: '0 0 0.75rem', fontSize: '1rem' }}>
            Error Message
          </h2>
          <pre
            style={{
              margin: 0,
              color: '#f87171',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-all',
              fontSize: '0.85rem',
              lineHeight: '1.6',
            }}
          >
            {error.message}
          </pre>
          {error.digest && (
            <p style={{ color: '#888', margin: '0.5rem 0 0', fontSize: '0.75rem' }}>
              Digest: {error.digest}
            </p>
          )}
        </div>

        <div
          style={{
            background: '#111',
            border: '1px solid #333',
            borderRadius: '8px',
            padding: '1rem',
            marginBottom: '1.5rem',
          }}
        >
          <h2 style={{ color: '#fbbf24', margin: '0 0 0.75rem', fontSize: '1rem' }}>
            Stack Trace
          </h2>
          <pre
            style={{
              margin: 0,
              color: '#a3e635',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-all',
              fontSize: '0.78rem',
              lineHeight: '1.7',
              maxHeight: '60vh',
              overflow: 'auto',
            }}
          >
            {error.stack || 'No stack trace available'}
          </pre>
        </div>

        <div style={{ display: 'flex', gap: '1rem' }}>
          <button
            onClick={reset}
            style={{
              background: '#7c3aed',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              padding: '0.6rem 1.4rem',
              cursor: 'pointer',
              fontSize: '0.9rem',
              fontWeight: '600',
            }}
          >
            🔄 Try Again
          </button>
          <button
            onClick={() => (window.location.href = '/')}
            style={{
              background: '#374151',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              padding: '0.6rem 1.4rem',
              cursor: 'pointer',
              fontSize: '0.9rem',
            }}
          >
            🏠 Reload App
          </button>
        </div>
      </div>
    </div>
  );
}
