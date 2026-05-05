import { Component, type ReactNode } from "react";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Catches rendering errors anywhere in the child tree so the Canvas does
 * not whitescreen on a single component failure (e.g. shader compilation).
 */
export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            position: "fixed",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            background: "#050510",
            color: "#fff",
            fontFamily: "sans-serif",
            padding: "2rem",
            textAlign: "center",
            zIndex: 9999,
          }}
        >
          <h1
            style={{
              fontSize: "clamp(1.5rem, 4vw, 2.5rem)",
              color: "#ef4444",
              marginBottom: "1rem",
            }}
          >
            Something went wrong
          </h1>
          <p
            style={{
              color: "#9ca3af",
              fontSize: "clamp(0.875rem, 2vw, 1.125rem)",
              marginBottom: "1.5rem",
              maxWidth: "32rem",
            }}
          >
            The game encountered an unexpected error.
          </p>
          <pre
            style={{
              background: "rgba(255,255,255,0.06)",
              padding: "1rem",
              borderRadius: "8px",
              fontSize: "0.8rem",
              color: "#f87171",
              maxWidth: "90vw",
              overflow: "auto",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
            }}
          >
            {this.state.error?.message ?? "Unknown error"}
          </pre>
          <button
            onClick={() => {
              this.setState({ hasError: false, error: null });
              window.location.reload();
            }}
            style={{
              marginTop: "1.5rem",
              padding: "0.75rem 2rem",
              fontSize: "1rem",
              background: "#ef4444",
              color: "#fff",
              border: "none",
              borderRadius: "8px",
              cursor: "pointer",
            }}
          >
            Reload
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
