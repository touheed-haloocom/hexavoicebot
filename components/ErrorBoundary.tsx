import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

class ErrorBoundary extends Component<Props, State> {
  // FIX: Replaced the constructor with a class property initializer for state. The
  // constructor-based initialization was causing type errors, preventing
  // `this.state` and `this.props` from being recognized correctly. This modern
  // syntax resolves these issues.
  public state: State = {
    hasError: false,
  };

  static getDerivedStateFromError(_: Error): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="h-screen bg-gray-900 text-white flex flex-col items-center justify-center text-center p-4">
          <h1 className="text-3xl font-bold text-red-500 mb-4">Oops! Something went wrong.</h1>
          <p className="text-lg text-gray-400 mb-8">
            Hexa has encountered an unexpected issue. Please try refreshing the page.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-2 rounded-md bg-cyan-600 hover:bg-cyan-700 text-white transition-colors"
          >
            Refresh Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
