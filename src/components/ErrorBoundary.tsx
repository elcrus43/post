import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6 text-center text-pretty">
          <div className="max-w-md w-full bg-white rounded-3xl shadow-xl shadow-gray-200/50 border border-gray-100 p-10">
            <div className="w-16 h-16 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <AlertTriangle size={32} />
            </div>
            
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Что-то пошло не так</h1>
            <p className="text-gray-500 text-sm mb-8">
              Приложение столкнулось с неожиданной ошибкой. Мы уже зафиксировали её. Попробуйте обновить страницу.
            </p>

            <div className="bg-gray-50 rounded-xl p-4 mb-8 text-left overflow-auto max-h-32 border border-gray-100">
              <code className="text-[10px] text-gray-400 font-mono break-all">
                {this.state.error?.message || 'Unknown error'}
              </code>
            </div>

            <button
              onClick={this.handleReset}
              className="w-full flex items-center justify-center gap-2 py-3.5 bg-gray-900 hover:bg-black text-white rounded-xl font-semibold transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <RefreshCw size={18} />
              Обновить страницу
            </button>
          </div>
        </div>
      );
    }

    return this.children;
  }
}
