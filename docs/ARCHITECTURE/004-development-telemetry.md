# Architecture Decision Record: 004 - Development Telemetry

## Context

Investigating frame pacing in a real-time browser game is awkward when all we have is an occasional DevTools trace. We need first-party telemetry that can run automatically during local development, expose the game's own control flow, and help correlate gameplay events with hot paths such as spawning, pool pressure, and postprocessing.

The telemetry must stay a development tool. Production builds should not auto-start it, and local debugging needs a fast way to pause or disable capture when tracing itself becomes too noisy.

## Decision

We will add a **development-only telemetry system** with three parts:

1. A browser-side telemetry runtime with a bounded in-memory event buffer.
2. A toggleable in-app overlay and `window` API for inspecting, exporting, and clearing telemetry.
3. A dev-only source transform that wraps first-party functions with entry and exit timing so local sessions record function names plus call and return timestamps automatically.

## Design

### Runtime

- The runtime stores `call`, `return`, `throw`, and `mark` events in a circular buffer.
- Events use a high-resolution clock so timings line up with frame-level investigations.
- Telemetry starts automatically in `npm run dev` and can be disabled with `?telemetry=off` or a persisted local flag.
- The runtime exposes controls on `window.__DEV_TELEMETRY__` for export, clear, pause, resume, overlay visibility, and manual marks.

### Overlay

- The overlay is mounted only in development.
- It is toggleable by hotkey and shows capture state, buffer usage, active calls, recent event rate, grouped hot functions, recent signals, and recent slow returns.
- The overlay includes controls for pause/resume, enable/disable, clear, and JSON export.

### Instrumentation

- Broad tracing is implemented with a Vite dev-only transform rather than hand-editing every function.
- The transform targets first-party source files and skips tests, benchmarks, generated typings, third-party code, and the telemetry implementation itself.
- Manual `mark` events are still added at a few important orchestration points so exported traces remain readable during gameplay.

## Controls

- `Alt+Shift+T`: show or hide the telemetry overlay.
- `Alt+Shift+P`: pause or resume capture.
- `?telemetry=off`: disable autostart for the current URL.
- `window.__DEV_TELEMETRY__`: inspect, export, clear, or change capture state from DevTools.

## Consequences

- **Positive:** local debugging gains function-level and gameplay-level visibility without requiring a fresh manual trace each time.
- **Positive:** the telemetry buffer is bounded, so long dev sessions do not grow unbounded memory.
- **Negative:** aggressive dev tracing perturbs timings and is not a substitute for clean performance benchmarking.
- **Negative:** the transform layer adds maintenance cost and must stay scoped to development.
