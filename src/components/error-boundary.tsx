'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { logger } from '@/lib/logger';
import { AlertTriangle, RefreshCw, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  /** Optional label shown in error display to identify which boundary caught this */
  label?: string;
}

interface State {
  hasError: boolean;
  error?: Error;
  componentStack?: string;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    logger.error('Unhandled React Component Error', error, {
      componentStack: errorInfo.componentStack,
      label: this.props.label,
    });
    // Also log to console so browser DevTools shows the full stack
    console.error(`[ErrorBoundary${this.props.label ? ` <${this.props.label}>` : ''}] Caught:`, error);
    console.error('[ComponentStack]', errorInfo.componentStack);

    this.setState({ componentStack: errorInfo.componentStack ?? undefined });
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: undefined, componentStack: undefined });
    window.location.reload();
  };

  private handleCopy = () => {
    const text = [
      `Error: ${this.state.error?.message}`,
      '',
      'Stack:',
      this.state.error?.stack,
      '',
      'Component Stack:',
      this.state.componentStack,
    ].join('\n');
    navigator.clipboard.writeText(text).catch(console.error);
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex flex-col items-start justify-start min-h-[300px] p-6 bg-card rounded-xl border border-destructive/20 shadow-lg my-4 overflow-auto">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-destructive/10 text-destructive rounded-full">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">
                Runtime Crash{this.props.label ? ` in <${this.props.label}>` : ''}
              </h2>
              <p className="text-xs text-muted-foreground">
                Unhandled error in component tree — full stack below
              </p>
            </div>
          </div>

          {/* Error Message */}
          {this.state.error && (
            <div className="w-full mb-3">
              <p className="text-xs font-semibold text-destructive mb-1 uppercase tracking-wide">Error</p>
              <pre className="p-3 bg-destructive/10 text-destructive text-xs font-mono rounded border border-destructive/20 overflow-x-auto whitespace-pre-wrap break-all">
                {this.state.error.message}
              </pre>
            </div>
          )}

          {/* Stack Trace */}
          {this.state.error?.stack && (
            <div className="w-full mb-3">
              <p className="text-xs font-semibold text-amber-500 mb-1 uppercase tracking-wide">Stack Trace</p>
              <pre className="p-3 bg-muted/30 text-green-400 text-xs font-mono rounded border border-border overflow-x-auto whitespace-pre-wrap break-all max-h-60">
                {this.state.error.stack}
              </pre>
            </div>
          )}

          {/* Component Stack */}
          {this.state.componentStack && (
            <div className="w-full mb-4">
              <p className="text-xs font-semibold text-blue-400 mb-1 uppercase tracking-wide">Component Stack</p>
              <pre className="p-3 bg-muted/30 text-blue-300 text-xs font-mono rounded border border-border overflow-x-auto whitespace-pre-wrap break-all max-h-48">
                {this.state.componentStack}
              </pre>
            </div>
          )}

          <div className="flex gap-2 flex-wrap">
            <Button onClick={this.handleReset} variant="default" className="gap-2" size="sm">
              <RefreshCw className="w-3.5 h-3.5" />
              Reload
            </Button>
            <Button onClick={this.handleCopy} variant="outline" className="gap-2" size="sm">
              <Copy className="w-3.5 h-3.5" />
              Copy Error
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
