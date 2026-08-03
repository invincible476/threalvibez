'use client';

/**
 * DebugLogger — Full-featured dev debug panel.
 *
 * DISABLE PERMANENTLY when bugs are fixed:
 *   Set NEXT_PUBLIC_DEBUG_LOGGER=false in Vercel environment variables.
 *   The component renders nothing when the flag is off.
 *
 * Captures:
 *  • window.onerror      — JS runtime errors with file + line + column
 *  • unhandledrejection  — Promise rejections (Firebase, fetch, etc.)
 *  • console.error/warn  — All console.error and console.warn calls
 *  • securitypolicyviolation — Every CSP violation (blocked script, frame, connect, etc.)
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';

// ─── Types ──────────────────────────────────────────────────────────────────
type LogLevel = 'error' | 'warn' | 'csp' | 'rejection' | 'info';

interface LogEntry {
  id: string;
  level: LogLevel;
  message: string;
  detail?: string;   // stack trace / CSP directive / extra detail
  source?: string;   // file:line:col
  timestamp: string;
}

const LEVEL_CONFIG: Record<LogLevel, { label: string; color: string; bg: string; border: string }> = {
  error:     { label: 'ERROR',     color: '#f87171', bg: '#2c0b0b', border: '#991b1b' },
  rejection: { label: 'REJECTION', color: '#fb923c', bg: '#2c1400', border: '#92400e' },
  csp:       { label: 'CSP',       color: '#facc15', bg: '#1c1a00', border: '#854d0e' },
  warn:      { label: 'WARN',      color: '#fbbf24', bg: '#1c1200', border: '#78350f' },
  info:      { label: 'INFO',      color: '#60a5fa', bg: '#0b1626', border: '#1e3a5f' },
};

// ── Global helper: any module can call this to force-push into the debug panel ─
// Usage: window.__debugLog?.('error', 'Something broke', 'stack trace here', 'file:line')
declare global {
  interface Window {
    __debugLog?: (level: LogLevel, message: string, detail?: string, source?: string) => void;
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function uid() { return Math.random().toString(36).slice(2, 9); }
function ts() { return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }); }

// ─── Component ───────────────────────────────────────────────────────────────
export function GlobalErrorCapture() {
  // Feature flag — set NEXT_PUBLIC_DEBUG_LOGGER=false to disable
  const enabled = process.env.NEXT_PUBLIC_DEBUG_LOGGER !== 'false';

  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [open, setOpen] = useState(true);
  const [filter, setFilter] = useState<LogLevel | 'all'>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const logRef = useRef<LogEntry[]>([]);

  const push = useCallback((entry: Omit<LogEntry, 'id' | 'timestamp'>) => {
    const full: LogEntry = { ...entry, id: uid(), timestamp: ts() };
    logRef.current = [full, ...logRef.current].slice(0, 200);
    setLogs([...logRef.current]);
  }, []);

  useEffect(() => {
    if (!enabled) return;

    // ── Register global helper so any module can force-push entries ───────
    window.__debugLog = (level, message, detail, source) => {
      push({ level, message, detail, source });
      setMinimized(false);
    };

    // ── window.onerror ────────────────────────────────────────────────────
    const onError = (event: ErrorEvent) => {
      push({
        level: 'error',
        message: event.message || event.error?.message || 'Unknown error',
        detail: event.error?.stack,
        source: event.filename ? `${event.filename}:${event.lineno}:${event.colno}` : undefined,
      });
    };

    // ── unhandledrejection ────────────────────────────────────────────────
    const onRejection = (event: PromiseRejectionEvent) => {
      const r = event.reason;
      push({
        level: 'rejection',
        message: r instanceof Error ? r.message : (typeof r === 'string' ? r : JSON.stringify(r)),
        detail: r instanceof Error ? r.stack : (r?.stack ?? undefined),
        source: r?.code ? `code: ${r.code}` : undefined,
      });
    };

    // ── CSP violations ────────────────────────────────────────────────────
    const onCSP = (event: SecurityPolicyViolationEvent) => {
      push({
        level: 'csp',
        message: `Blocked: ${event.blockedURI || '(inline)'}`,
        detail: [
          `Directive : ${event.violatedDirective}`,
          `Policy    : ${event.effectiveDirective}`,
          `Document  : ${event.documentURI}`,
          `Source    : ${event.sourceFile || '—'}:${event.lineNumber}:${event.columnNumber}`,
          `Disposition: ${event.disposition}`,
        ].join('\n'),
        source: event.violatedDirective,
      });
    };

    // ── console interception ──────────────────────────────────────────────
    const origError = console.error.bind(console);
    const origWarn  = console.warn.bind(console);

    console.error = (...args: any[]) => {
      origError(...args);
      const msg = args.map(a => (typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a))).join(' ');
      push({ level: 'error', message: msg });
    };
    console.warn = (...args: any[]) => {
      origWarn(...args);
      const msg = args.map(a => (typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a))).join(' ');
      push({ level: 'warn', message: msg });
    };

    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);
    document.addEventListener('securitypolicyviolation', onCSP);

    return () => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onRejection);
      document.removeEventListener('securitypolicyviolation', onCSP);
      console.error = origError;
      console.warn  = origWarn;
    };
  }, [enabled, push]);

  if (!enabled) return null;

  // ── Derived ────────────────────────────────────────────────────────────────
  const visible = filter === 'all' ? logs : logs.filter(l => l.level === filter);
  const counts = logs.reduce((acc, l) => { acc[l.level] = (acc[l.level] ?? 0) + 1; return acc; }, {} as Record<string, number>);

  // ── Actions ────────────────────────────────────────────────────────────────
  const copyOne = async (entry: LogEntry) => {
    const text = [
      `[${entry.level.toUpperCase()}] ${entry.timestamp}`,
      entry.source ? `Source : ${entry.source}` : null,
      `Message: ${entry.message}`,
      entry.detail ? `Detail :\n${entry.detail}` : null,
    ].filter(Boolean).join('\n');
    await navigator.clipboard.writeText(text).catch(() => {});
    setCopiedId(entry.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const copyAll = async () => {
    const text = logs.map(e =>
      [`[${e.level.toUpperCase()}] ${e.timestamp}`, e.source && `Source: ${e.source}`, `Msg: ${e.message}`, e.detail].filter(Boolean).join('\n')
    ).join('\n──────────────────────────\n');
    await navigator.clipboard.writeText(text).catch(() => {});
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2000);
  };

  // ── UI ─────────────────────────────────────────────────────────────────────
  // ── Style helpers (functions outside record to satisfy TS) ─────────────────
  const badgeStyle = (level: string): React.CSSProperties => ({
    fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 9999,
    background: LEVEL_CONFIG[level as LogLevel]?.bg ?? '#111',
    color: LEVEL_CONFIG[level as LogLevel]?.color ?? '#fff',
    border: `1px solid ${LEVEL_CONFIG[level as LogLevel]?.border ?? '#333'}`,
    cursor: 'pointer',
  });

  const btnStyle = (active?: boolean, color?: string): React.CSSProperties => ({
    background: active ? (color ?? '#3f3f46') : 'transparent',
    color: active ? '#fff' : '#a1a1aa',
    border: `1px solid ${active ? (color ?? '#52525b') : '#3f3f46'}`,
    borderRadius: 4, padding: '1px 8px', fontSize: 11,
    cursor: 'pointer', whiteSpace: 'nowrap',
  });

  const cardStyle = (level: LogLevel): React.CSSProperties => ({
    background: LEVEL_CONFIG[level].bg,
    border: `1px solid ${LEVEL_CONFIG[level].border}`,
    borderRadius: 6, padding: '7px 10px',
  });

  const s: Record<string, React.CSSProperties> = {
    root: {
      position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 99999,
      fontFamily: 'ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace',
      fontSize: 12,
      maxHeight: minimized ? 36 : '55vh',
      display: 'flex', flexDirection: 'column',
      background: '#0d0d0d',
      borderTop: '2px solid #3f3f46',
      boxShadow: '0 -4px 30px rgba(0,0,0,0.7)',
      transition: 'max-height 0.2s ease',
      overflow: 'hidden',
    },
    topbar: {
      display: 'flex', alignItems: 'center', gap: 6,
      padding: '4px 10px', background: '#18181b',
      borderBottom: minimized ? 'none' : '1px solid #27272a',
      flexShrink: 0, userSelect: 'none', flexWrap: 'wrap',
    },
    row: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 6 },
    pre: {
      margin: '4px 0 0', padding: '6px 8px', borderRadius: 4,
      background: '#0a0a0a', color: '#4ade80',
      maxHeight: 160, overflow: 'auto',
      whiteSpace: 'pre-wrap', wordBreak: 'break-all', fontSize: 11,
    },
    scroll: {
      overflowY: 'auto', flex: 1, padding: '6px 10px',
      display: 'flex', flexDirection: 'column', gap: 6,
    },
  };

  const LEVELS: (LogLevel | 'all')[] = ['all', 'error', 'rejection', 'csp', 'warn'];

  return (
    <div style={s.root}>
      {/* ── Top bar ── */}
      <div style={s.topbar}>
        <span style={{ color: '#f87171', fontWeight: 700, fontSize: 12, marginRight: 4 }}>
          🪲 Debug
        </span>

        {/* Level badges with counts */}
        {LEVELS.map(lvl => (
          <span
            key={lvl}
            style={{
              ...badgeStyle(lvl === 'all' ? 'info' : lvl),
              opacity: filter === lvl ? 1 : 0.5,
              outline: filter === lvl ? `2px solid ${LEVEL_CONFIG[lvl === 'all' ? 'info' : lvl as LogLevel].color}` : 'none',
            }}
            onClick={() => { setFilter(lvl); setMinimized(false); }}
          >
            {lvl.toUpperCase()} {lvl === 'all' ? logs.length : (counts[lvl] ?? 0)}
          </span>
        ))}

        <span style={{ flex: 1 }} />

        {/* Actions */}
        <button style={btnStyle(copiedAll, '#15803d')} onClick={copyAll}>
          {copiedAll ? '✓ Copied!' : '📋 Copy All'}
        </button>
        <button style={btnStyle()} onClick={() => { setLogs([]); logRef.current = []; }}>
          🗑 Clear
        </button>
        <button style={btnStyle()} onClick={() => setMinimized(m => !m)}>
          {minimized ? '▲' : '▼'}
        </button>
        <button style={{ ...btnStyle(), color: '#ef4444' }} onClick={() => setOpen(false)}>
          ✕ Close
        </button>
      </div>

      {/* ── Log list ── */}
      {!minimized && open && (
        <div style={s.scroll}>
          {visible.length === 0 && (
            <div style={{ color: '#52525b', textAlign: 'center', padding: 20 }}>
              No logs captured yet. Errors, warnings, CSP violations will appear here.
            </div>
          )}
          {visible.map(entry => {
            const cfg = LEVEL_CONFIG[entry.level];
            const expanded = expandedId === entry.id;
            return (
              <div key={entry.id} style={cardStyle(entry.level)}>
                <div style={s.row}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {/* Header row */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2, flexWrap: 'wrap' }}>
                      <span style={{ color: cfg.color, fontWeight: 700, fontSize: 10 }}>[{cfg.label}]</span>
                      <span style={{ color: '#71717a', fontSize: 10 }}>{entry.timestamp}</span>
                      {entry.source && (
                        <span style={{ color: '#a78bfa', fontSize: 10, wordBreak: 'break-all' }}>
                          📍 {entry.source}
                        </span>
                      )}
                    </div>
                    {/* Message */}
                    <div
                      style={{ color: '#fafafa', wordBreak: 'break-word', cursor: entry.detail ? 'pointer' : 'default' }}
                      onClick={() => entry.detail && setExpandedId(expanded ? null : entry.id)}
                    >
                      {entry.message}
                      {entry.detail && (
                        <span style={{ color: '#52525b', fontSize: 10, marginLeft: 6 }}>
                          {expanded ? '▲ hide' : '▼ show detail'}
                        </span>
                      )}
                    </div>
                    {/* Expanded detail / stack */}
                    {expanded && entry.detail && (
                      <pre style={s.pre}>{entry.detail}</pre>
                    )}
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flexShrink: 0 }}>
                    <button
                      style={btnStyle(copiedId === entry.id, '#15803d')}
                      onClick={() => copyOne(entry)}
                    >
                      {copiedId === entry.id ? '✓' : '📋'}
                    </button>
                    <button
                      style={{ ...btnStyle(), color: '#71717a' }}
                      onClick={() => setLogs(prev => prev.filter(l => l.id !== entry.id))}
                    >
                      ✕
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
