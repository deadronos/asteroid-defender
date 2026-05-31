import { useSyncExternalStore } from "react";
import type { TelemetryEvent, TelemetryFunctionSummary, TelemetrySnapshot } from "./core";
import { getDevTelemetryStore } from "./runtime";
import "./DevTelemetryOverlay.css";

const EMPTY_SNAPSHOT: TelemetrySnapshot = {
  enabled: false,
  paused: false,
  overlayVisible: false,
  startedAt: 0,
  totalRecorded: 0,
  droppedEvents: 0,
  maxEvents: 0,
  eventCount: 0,
  activeCallCount: 0,
  recentEventRate: 0,
  recentEvents: [],
  recentSignals: [],
  recentSlowCalls: [],
  topByCallCount: [],
  topByTotalDuration: [],
};

function formatMs(value?: number) {
  if (value === undefined) {
    return "-";
  }

  return `${value.toFixed(2)} ms`;
}

function renderMetadata(event: TelemetryEvent): string {
  if (!event.metadata) {
    return event.detail ?? "";
  }

  return Object.entries(event.metadata)
    .map(([key, value]) => `${key}=${String(value)}`)
    .join(" ");
}

function formatCount(value: number) {
  return value.toLocaleString();
}

function renderSummaryMeta(summary: TelemetryFunctionSummary): string {
  const parts = [`calls ${formatCount(summary.callCount)}`];

  if (summary.returnCount > 0) {
    parts.push(`avg ${formatMs(summary.averageDuration)}`);
  }

  if (summary.throwCount > 0) {
    parts.push(`throws ${formatCount(summary.throwCount)}`);
  }

  return parts.join(" | ");
}

function getEventColor(type: TelemetryEvent["type"]) {
  switch (type) {
    case "call":
      return "dev-telemetry__label--call";
    case "return":
      return "dev-telemetry__label--return";
    case "throw":
      return "dev-telemetry__label--throw";
    case "mark":
      return "dev-telemetry__label--mark";
    default:
      return "";
  }
}

export default function DevTelemetryOverlay() {
  const telemetryStore = getDevTelemetryStore();
  const snapshot = useSyncExternalStore(
    (listener) => telemetryStore?.subscribe(listener) ?? (() => undefined),
    () => telemetryStore?.getSnapshot() ?? EMPTY_SNAPSHOT,
    () => EMPTY_SNAPSHOT,
  );

  if (!telemetryStore || !snapshot.overlayVisible) {
    return null;
  }

  return (
    <aside className="dev-telemetry">
      <div className="dev-telemetry__header">
        <div>
          <div className="dev-telemetry__title">Dev Telemetry</div>
          <div className="dev-telemetry__subtitle">
            Full-trace mode is intrusive. Use it for debugging, not clean perf baselines.
          </div>
        </div>
        <button
          type="button"
          onClick={() => telemetryStore.setOverlayVisible(false)}
          className="dev-telemetry__close"
        >
          x
        </button>
      </div>

      <div className="dev-telemetry__stats">
        <div>Enabled: {snapshot.enabled ? "yes" : "no"}</div>
        <div>Paused: {snapshot.paused ? "yes" : "no"}</div>
        <div>Buffered: {snapshot.eventCount}</div>
        <div>Dropped: {snapshot.droppedEvents}</div>
        <div>Capacity: {snapshot.maxEvents}</div>
        <div>Active calls: {snapshot.activeCallCount}</div>
        <div>Rate: {formatCount(snapshot.recentEventRate)}/s</div>
        <div>Fill: {snapshot.maxEvents > 0 ? `${Math.round((snapshot.eventCount / snapshot.maxEvents) * 100)}%` : "0%"}</div>
      </div>

      <div className="dev-telemetry__actions">
        <button type="button" onClick={() => telemetryStore.togglePaused()} className="dev-telemetry__button">
          {snapshot.paused ? "Resume" : "Pause"}
        </button>
        <button
          type="button"
          onClick={() => telemetryStore.setEnabled(!snapshot.enabled)}
          className="dev-telemetry__button"
        >
          {snapshot.enabled ? "Disable" : "Enable"}
        </button>
        <button type="button" onClick={() => telemetryStore.clear()} className="dev-telemetry__button">
          Clear
        </button>
        <button
          type="button"
          onClick={() => window.__DEV_TELEMETRY__?.download()}
          className="dev-telemetry__button"
        >
          Export JSON
        </button>
      </div>

      <div className="dev-telemetry__hint">
        Hotkeys: `Alt+Shift+T` overlay, `Alt+Shift+P` pause
      </div>

      <section className="dev-telemetry__section">
        <div className="dev-telemetry__section-title">Recent slow returns</div>
        {snapshot.recentSlowCalls.length === 0 ? (
          <div className="dev-telemetry__empty">No slow returns captured yet.</div>
        ) : (
          <ul className="dev-telemetry__list">
            {snapshot.recentSlowCalls.map((event) => (
              <li key={`slow-${event.seq}`} className="dev-telemetry__item">
                <div className={`dev-telemetry__label ${getEventColor(event.type)}`}>{event.name}</div>
                <div className="dev-telemetry__duration">{formatMs(event.duration)}</div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="dev-telemetry__section">
        <div className="dev-telemetry__section-title">Most active functions</div>
        {snapshot.topByCallCount.length === 0 ? (
          <div className="dev-telemetry__empty">No function activity captured yet.</div>
        ) : (
          <ul className="dev-telemetry__list">
            {snapshot.topByCallCount.map((summary) => (
              <li key={`count-${summary.name}`} className="dev-telemetry__item">
                <div className="dev-telemetry__row">
                  <span className="dev-telemetry__label dev-telemetry__label--call">{summary.name}</span>
                  <span className="dev-telemetry__duration">{formatCount(summary.callCount)}</span>
                </div>
                <div className="dev-telemetry__detail">{renderSummaryMeta(summary)}</div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="dev-telemetry__section">
        <div className="dev-telemetry__section-title">Most expensive functions</div>
        {snapshot.topByTotalDuration.length === 0 ? (
          <div className="dev-telemetry__empty">No completed function timings captured yet.</div>
        ) : (
          <ul className="dev-telemetry__list">
            {snapshot.topByTotalDuration.map((summary) => (
              <li key={`duration-${summary.name}`} className="dev-telemetry__item">
                <div className="dev-telemetry__row">
                  <span className="dev-telemetry__label dev-telemetry__label--return">{summary.name}</span>
                  <span className="dev-telemetry__duration">{formatMs(summary.totalDuration)}</span>
                </div>
                <div className="dev-telemetry__detail">
                  avg {formatMs(summary.averageDuration)} | max {formatMs(summary.maxDuration)} | returns {formatCount(summary.returnCount)}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="dev-telemetry__section">
        <div className="dev-telemetry__section-title">Recent signals</div>
        {snapshot.recentSignals.length === 0 ? (
          <div className="dev-telemetry__empty">No marks or thrown errors captured yet.</div>
        ) : (
          <ul className="dev-telemetry__list">
            {snapshot.recentSignals.map((event) => (
              <li key={event.seq} className="dev-telemetry__item">
                <div className="dev-telemetry__row">
                  <span className={`dev-telemetry__label ${getEventColor(event.type)}`}>
                    {event.type.toUpperCase()} {event.name}
                  </span>
                  <span className="dev-telemetry__duration">#{event.seq}</span>
                </div>
                {(event.detail || event.metadata) && <div className="dev-telemetry__detail">{renderMetadata(event)}</div>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </aside>
  );
}
