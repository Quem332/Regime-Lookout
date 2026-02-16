import React from "react";
import { logger } from "../../core/logger";

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, info: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    this.setState({ info });
    logger.error("ui.error_boundary", {
      message: error?.message,
      stack: error?.stack,
      componentStack: info?.componentStack,
    });
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    const title = this.props.title ?? "Something went wrong";
    return (
      <div className="fixed inset-0 bg-gray-950 text-white p-6 overflow-auto">
        <div className="max-w-md mx-auto">
          <div className="text-xl font-bold mb-2">{title}</div>
          <div className="text-sm text-gray-300 mb-4">
            The app hit an unexpected error. Open Hub → Debug Logs to copy details.
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-4">
            <div className="text-xs text-gray-400 mb-1">Error</div>
            <div className="text-sm whitespace-pre-wrap break-words">
              {String(this.state.error?.message ?? this.state.error ?? "Unknown error")}
            </div>
          </div>

          <div className="flex gap-2">
            <button
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-sm"
              onClick={() => window.location.reload()}
            >
              Reload
            </button>
            <button
              className="px-4 py-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-sm"
              onClick={() => {
                logger.clear();
                this.setState({ hasError: false, error: null, info: null });
              }}
            >
              Clear Error
            </button>
          </div>
        </div>
      </div>
    );
  }
}
