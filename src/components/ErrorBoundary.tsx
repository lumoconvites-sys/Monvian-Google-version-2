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
          <div className="w-16 h-16 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mb-5 shadow-2xl">
            <img src="/logo-white.png" alt="Monvian" className="h-8 w-auto object-contain" onError={(e: any) => { e.target.src = '/loogo.png'; }} />
          </div>
          <h2 className="text-xl font-bold tracking-tight text-zinc-100 mb-2">Reiniciando Monvian</h2>
          <p className="text-xs text-zinc-400 text-center max-w-xs mb-6">
            Ocorreu uma pequena instabilidade na inicialização. Toque abaixo para carregar instantaneamente.
          </p>
          <button
            onClick={this.handleReload}
            className="flex items-center gap-2 px-5 py-3 rounded-xl bg-zinc-100 text-black font-semibold text-sm active:scale-95 transition-all shadow-lg hover:bg-white"
          >
            <RotateCcw className="w-4 h-4" />
            Recarregar Aplicativo
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
