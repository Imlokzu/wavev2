import React from "react";

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Error caught by boundary:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <div className="flex h-screen w-screen items-center justify-center bg-[#0e1621]">
            <div className="max-w-sm rounded-2xl bg-[#17212b] p-6 text-center">
              <h2 className="mb-2 text-lg font-semibold text-white">Oops!</h2>
              <p className="mb-4 text-sm text-[#6b8299]">
                Something went wrong. Please try refreshing the page.
              </p>
              {this.state.error && (
                <p className="mb-4 text-xs text-red-400 font-mono text-left bg-[#0e1621] rounded-lg p-3 break-all">
                  {this.state.error.message}
                </p>
              )}
              <button
                onClick={() => window.location.reload()}
                className="inline-block rounded-lg bg-[#7eb88a] px-4 py-2 text-sm font-semibold text-[#0e1621] hover:bg-[#6da879]"
              >
                Refresh
              </button>
            </div>
          </div>
        )
      );
    }

    return this.props.children;
  }
}
