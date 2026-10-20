import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('[WhisperErrorBoundary] Uncaught application error:', error, errorInfo);
  }

  private handleReset = (): void => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  public render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-[#FEF7FF] text-[#1D1B20] p-6 text-center select-none">
          <div className="w-16 h-16 rounded-3xl bg-red-100 flex items-center justify-center text-red-600 mb-4 shadow-sm">
            <AlertTriangle className="w-8 h-8" />
          </div>

          <h2 className="text-xl font-bold text-[#1D1B20] mb-2">Application Error Recovered</h2>
          <p className="text-xs text-[#49454F] max-w-sm mb-6 leading-relaxed">
            A resilient boundary caught an unexpected UI fault. Your memory keys remain isolated.
          </p>

          <button
            onClick={this.handleReset}
            className="flex items-center gap-2 px-5 py-2.5 bg-[#6750A4] text-white text-xs font-semibold rounded-xl hover:bg-[#523d8c] transition-all shadow-sm"
          >
            <RefreshCw className="w-4 h-4" />
            Reload &amp; Re-initialize Secure RAM
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
