import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Copy, Home } from 'lucide-react';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null
  };

  public static getDerivedStateFromError(error: Error): Partial<State> {
    // Update state so the next render will show the fallback UI.
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleCopyError = () => {
    const text = `Error: ${this.state.error?.toString()}\n\nStack: ${this.state.errorInfo?.componentStack || ''}`;
    navigator.clipboard.writeText(text);
    alert("Error copiado al portapapeles");
  };

  private handleReset = () => {
     this.setState({ hasError: false, error: null, errorInfo: null });
     window.location.href = '/';
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans">
          <div className="max-w-2xl w-full bg-white rounded-xl shadow-2xl overflow-hidden border border-red-200">
            
            {/* Header */}
            <div className="bg-red-600 px-6 py-4 flex items-center gap-3">
              <AlertTriangle className="text-white h-8 w-8" />
              <div>
                <h1 className="text-xl font-bold text-white">¡Ups! Algo salió mal</h1>
                <p className="text-red-100 text-sm">Se ha producido un error crítico en la aplicación.</p>
              </div>
            </div>

            {/* Content */}
            <div className="p-6">
              <div className="mb-6">
                <p className="text-slate-700 mb-2 font-semibold">Detalles del error:</p>
                <div className="bg-slate-900 rounded-lg p-4 overflow-x-auto">
                  <code className="text-red-400 font-mono text-sm block mb-2">
                    {this.state.error && this.state.error.toString()}
                  </code>
                  {this.state.errorInfo && (
                    <pre className="text-slate-400 font-mono text-xs whitespace-pre-wrap break-all">
                      {this.state.errorInfo.componentStack}
                    </pre>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-col sm:flex-row gap-3">
                <button 
                  onClick={this.handleReload}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors"
                >
                  <RefreshCw size={18} />
                  Recargar Página
                </button>
                
                <button 
                  onClick={this.handleCopyError}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-3 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors border border-slate-200"
                >
                  <Copy size={18} />
                  Copiar Error
                </button>

                 <button 
                  onClick={this.handleReset}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-3 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors border border-slate-200"
                >
                  <Home size={18} />
                  Ir al Inicio
                </button>
              </div>
            </div>
            
            <div className="bg-slate-50 px-6 py-3 border-t border-slate-200 text-center">
              <p className="text-xs text-slate-500">
                Si el error persiste, por favor comparte este reporte con el soporte técnico.
              </p>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}