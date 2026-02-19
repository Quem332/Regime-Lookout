import React from "react";
import { logger } from "../../core/logger";

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    try {
      logger.error?.("ui.error_boundary", { message: error?.message ?? String(error), stack: error?.stack, componentStack: info?.componentStack });
    } catch {
      // ignore
    }
  }

  render() {
    if (this.state.hasError) {
      const title = this.props.title ?? "Something went wrong";
      return (
        <div className="p-4">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="text-sm font-semibold">{title}</div>
            <div className="mt-2 text-xs opacity-70 break-words">
              {this.state.error?.message ?? "UI crashed."}
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
