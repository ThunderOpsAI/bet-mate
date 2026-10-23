"use client";

import type { ErrorInfo, ReactNode } from "react";
import { Component } from "react";
import ErrorState from "./ErrorState";
import { trackUiSignal } from "../lib/monitoring/performance";

type ErrorBoundaryProps = {
  children: ReactNode;
  sectionName: string;
};

type ErrorBoundaryState = {
  hasError: boolean;
};

export default class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = {
    hasError: false,
  };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    trackUiSignal("section_crash", {
      section: this.props.sectionName,
      message: error.message,
      stack: errorInfo.componentStack,
    });
  }

  private resetBoundary = () => {
    this.setState({ hasError: false });
  };

  render() {
    if (this.state.hasError) {
      return (
        <ErrorState
          title={`${this.props.sectionName} hit a snag`}
          message="BetMate kept the rest of the page alive. Try reloading this section."
          tone="warning"
          actionLabel="Reload section"
          onAction={this.resetBoundary}
        />
      );
    }

    return this.props.children;
  }
}
