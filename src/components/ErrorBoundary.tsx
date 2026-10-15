import React, { Component, ErrorInfo, ReactNode } from 'react';
import { RotateCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary caught error]:', error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="fixed inset-0 w-full h-full bg-black text-white flex flex-col items-center justify-center p-6 select-none z-[99999]">
          <h2 className="text-xl font-bold tracking-tight text-zinc-100 mb-2">Ops, ocorreu um erro.</h2>
          <button
            onClick={this.handleReload}
            className="px-5 py-3 rounded-xl bg-zinc-100 text-black font-semibold text-sm"
          >
            Tentar novamente
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
