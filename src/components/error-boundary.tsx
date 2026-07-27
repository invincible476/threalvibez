'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { logger } from '@/lib/logger';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
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
    });
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: undefined });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex flex-col items-center justify-center min-h-[300px] p-6 text-center bg-card rounded-xl border border-destructive/20 shadow-lg my-4">
          <div className="p-3 bg-destructive/10 text-destructive rounded-full mb-4">
            <AlertTriangle className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-foreground mb-2">Something went wrong</h2>
          <p className="text-sm text-muted-foreground max-w-md mb-6">
            An unexpectedly caught error occurred in the application UI. The event has been logged for diagnosis.
          </p>
          {this.state.error && (
            <div className="p-3 mb-6 bg-muted/50 text-xs font-mono text-left max-w-lg w-full overflow-x-auto rounded border border-border">
              {this.state.error.toString()}
            </div>
          )}
          <Button onClick={this.handleReset} variant="default" className="gap-2">
            <RefreshCw className="w-4 h-4" />
            Reload Application
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}
