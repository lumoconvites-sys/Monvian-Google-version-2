import React, { Component, ErrorInfo, ReactNode } from 'react';
import {
  forceCleanAppReload,
  isChunkOrModuleLoadError,
  tryAutoRecoverFromChunkError,
} from '../utils/lazyWithRetry';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  isRecovering: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      isRecovering: false,
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    const isChunkErr = isChunkOrModuleLoadError(error);
    return {
      hasError: true,
      isRecovering: isChunkErr,
      error,
    };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary caught error]:', error, errorInfo);
    if (isChunkOrModuleLoadError(error)) {
      tryAutoRecoverFromChunkError().then((recovering) => {
        if (!recovering) {
          this.setState({ isRecovering: false });
        }
      });
    }
  }

  private handleReload = () => {
    this.setState({ isRecovering: true });
    void forceCleanAppReload();
  };

  public render() {
    if (this.state.hasError) {
      if (this.state.isRecovering) {
        return (
          <div className="fixed inset-0 w-full h-full bg-black text-white flex items-center justify-center p-6 select-none z-[99999]" />
        );
      }

      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="fixed inset-0 w-full h-full bg-black text-white flex flex-col items-center justify-center p-6 select-none z-[99999]">
          <h2 className="text-xl font-bold tracking-tight text-zinc-100 mb-2">Ops, ocorreu um erro.</h2>
          <button
            onClick={this.handleReload}
            className="px-5 py-3 rounded-xl bg-zinc-100 text-black font-semibold text-sm active:scale-95 transition-transform"
          >
            Tentar novamente
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
