import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";
import ErrorBoundary from "./components/ErrorBoundary";
import { bootstrapDevTelemetry, markTelemetry } from "./telemetry/runtime";

bootstrapDevTelemetry();

/**
 * Renders a minimal DOM error overlay for crashes that happen outside
 * React's render tree (useFrame callbacks, async code, event handlers).
 * The ErrorBoundary catches render-phase errors; this catches the rest.
 */
function showGlobalError(message: string) {
  // Avoid stacking multiple overlays if errors cascade.
  if (document.getElementById("global-error-overlay")) return;

  const root = document.getElementById("root");
  if (root) root.style.display = "none";

  const overlay = document.createElement("div");
  overlay.id = "global-error-overlay";
  overlay.innerHTML = `
    <div style="
      position:fixed;inset:0;display:flex;flex-direction:column;
      align-items:center;justify-content:center;background:#050510;
      color:#fff;font-family:sans-serif;padding:2rem;text-align:center;z-index:99999;
    ">
      <h1 style="font-size:clamp(1.5rem,4vw,2.5rem);color:#ef4444;margin-bottom:1rem">
        Something went wrong
      </h1>
      <p style="color:#9ca3af;font-size:clamp(0.875rem,2vw,1.125rem);margin-bottom:1.5rem;max-width:32rem">
        The game encountered an unexpected error.
      </p>
      <pre style="
        background:rgba(255,255,255,0.06);padding:1rem;border-radius:8px;
        font-size:0.8rem;color:#f87171;max-width:90vw;overflow:auto;
        white-space:pre-wrap;word-break:break-word;
      ">${message}</pre>
      <button onclick="location.reload()" style="
        margin-top:1.5rem;padding:0.75rem 2rem;font-size:1rem;
        background:#ef4444;color:#fff;border:none;border-radius:8px;cursor:pointer;
      ">Reload</button>
    </div>
  `;
  document.body.appendChild(overlay);
}

window.addEventListener("error", (event) => {
  // Skip errors that React's ErrorBoundary can handle (they bubble through render).
  // Only catch runtime errors from callbacks, async, etc.
  if (event.target === window || event.target === document) {
    markTelemetry("window:error", {
      message: (event.error?.message ?? event.message ?? "Unknown error").slice(0, 180),
    });
    showGlobalError(event.error?.message ?? event.message ?? "Unknown error");
  }
});

window.addEventListener("unhandledrejection", (event) => {
  markTelemetry("window:unhandledrejection", {
    message: String(event.reason?.message ?? event.reason).slice(0, 180),
  });
  showGlobalError(event.reason?.message ?? String(event.reason));
});

const originalWarn = console.warn;
console.warn = (...args) => {
  const msg = typeof args[0] === "string" ? args[0] : "";
  if (
    msg.includes("THREE.Clock: This module has been deprecated") ||
    msg.includes("using deprecated parameters for the initialization function") ||
    msg.includes("Download the React DevTools")
  ) {
    return;
  }
  if (msg) {
    markTelemetry("console:warn", {
      message: msg.slice(0, 180),
    });
  }
  originalWarn(...args);
};

markTelemetry("app:render-root");

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
