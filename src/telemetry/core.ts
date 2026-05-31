export type TelemetryEventType = "call" | "return" | "throw" | "mark";

export type TelemetryValue = string | number | boolean | null;

export type TelemetryMetadata = Record<string, TelemetryValue>;

export interface TelemetryEvent {
  seq: number;
  type: TelemetryEventType;
  name: string;
  at: number;
  callId?: number;
  depth?: number;
  duration?: number;
  detail?: string;
  metadata?: TelemetryMetadata;
}

export interface TelemetryFunctionSummary {
  name: string;
  callCount: number;
  returnCount: number;
  throwCount: number;
  totalDuration: number;
  averageDuration: number;
  maxDuration: number;
  lastAt: number;
}

export interface TelemetrySnapshot {
  enabled: boolean;
  paused: boolean;
  overlayVisible: boolean;
  startedAt: number;
  totalRecorded: number;
  droppedEvents: number;
  maxEvents: number;
  eventCount: number;
  activeCallCount: number;
  recentEventRate: number;
  recentEvents: TelemetryEvent[];
  recentSignals: TelemetryEvent[];
  recentSlowCalls: TelemetryEvent[];
  topByCallCount: TelemetryFunctionSummary[];
  topByTotalDuration: TelemetryFunctionSummary[];
}

export interface TelemetryStore {
  enter: (name: string) => number;
  exit: (callId: number) => void;
  fail: (callId: number, error: unknown) => void;
  mark: (name: string, metadata?: TelemetryMetadata) => void;
  clear: () => void;
  setEnabled: (enabled: boolean) => void;
  setPaused: (paused: boolean) => void;
  setOverlayVisible: (visible: boolean) => void;
  toggleOverlay: () => boolean;
  togglePaused: () => boolean;
  subscribe: (listener: () => void) => () => void;
  getSnapshot: () => TelemetrySnapshot;
  exportEvents: () => TelemetryEvent[];
}

interface ActiveCall {
  name: string;
  startedAt: number;
  depth: number;
}

interface TelemetryOptions {
  maxEvents?: number;
  slowCallThresholdMs?: number;
  recentEventLimit?: number;
  recentSignalLimit?: number;
  recentSlowLimit?: number;
  summaryLimit?: number;
  notifyIntervalMs?: number;
  clock?: () => number;
  startedAt?: number;
  enabled?: boolean;
  paused?: boolean;
  overlayVisible?: boolean;
}

const DEFAULT_MAX_EVENTS = 100000;
const DEFAULT_SLOW_CALL_THRESHOLD_MS = 8;
const DEFAULT_RECENT_EVENT_LIMIT = 12;
const DEFAULT_RECENT_SIGNAL_LIMIT = 10;
const DEFAULT_RECENT_SLOW_LIMIT = 8;
const DEFAULT_SUMMARY_LIMIT = 8;
const DEFAULT_NOTIFY_INTERVAL_MS = 160;

interface MutableTelemetryFunctionSummary {
  name: string;
  callCount: number;
  returnCount: number;
  throwCount: number;
  totalDuration: number;
  maxDuration: number;
  lastAt: number;
}

function getErrorDetail(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

export function createTelemetryStore(options: TelemetryOptions = {}): TelemetryStore {
  const clock = options.clock ?? (() => Date.now());
  const maxEvents = options.maxEvents ?? DEFAULT_MAX_EVENTS;
  const slowCallThresholdMs = options.slowCallThresholdMs ?? DEFAULT_SLOW_CALL_THRESHOLD_MS;
  const recentEventLimit = options.recentEventLimit ?? DEFAULT_RECENT_EVENT_LIMIT;
  const recentSignalLimit = options.recentSignalLimit ?? DEFAULT_RECENT_SIGNAL_LIMIT;
  const recentSlowLimit = options.recentSlowLimit ?? DEFAULT_RECENT_SLOW_LIMIT;
  const summaryLimit = options.summaryLimit ?? DEFAULT_SUMMARY_LIMIT;
  const notifyIntervalMs = options.notifyIntervalMs ?? DEFAULT_NOTIFY_INTERVAL_MS;

  const listeners = new Set<() => void>();
  const activeCalls = new Map<number, ActiveCall>();
  const events = Array.from<TelemetryEvent | undefined>({ length: maxEvents });

  let enabled = options.enabled ?? true;
  let paused = options.paused ?? false;
  let overlayVisible = options.overlayVisible ?? false;
  let startedAt = options.startedAt ?? Date.now();
  let nextSequence = 1;
  let nextCallId = 1;
  let totalRecorded = 0;
  let droppedEvents = 0;
  let writeIndex = 0;
  let eventCount = 0;
  let lastNotifyAt = 0;
  let notifyTimer: ReturnType<typeof setTimeout> | null = null;
  let cachedSnapshot: TelemetrySnapshot | null = null;

  const invalidateSnapshot = () => {
    cachedSnapshot = null;
  };

  const flushNotify = () => {
    lastNotifyAt = clock();
    notifyTimer = null;

    for (const listener of listeners) {
      listener();
    }
  };

  const scheduleNotify = () => {
    if (listeners.size === 0) {
      return;
    }

    if (notifyTimer !== null) {
      return;
    }

    const now = clock();
    const waitMs = Math.max(0, notifyIntervalMs - (now - lastNotifyAt));
    notifyTimer = setTimeout(flushNotify, waitMs);
  };

  const pushEvent = (event: Omit<TelemetryEvent, "seq">) => {
    const nextEvent: TelemetryEvent = {
      ...event,
      seq: nextSequence++,
    };

    totalRecorded += 1;
    if (eventCount === maxEvents) {
      droppedEvents += 1;
    } else {
      eventCount += 1;
    }

    events[writeIndex] = nextEvent;
    writeIndex = (writeIndex + 1) % maxEvents;
    invalidateSnapshot();
    scheduleNotify();
  };

  const getEventAtOffset = (offsetFromNewest: number): TelemetryEvent | undefined => {
    if (offsetFromNewest < 0 || offsetFromNewest >= eventCount) {
      return undefined;
    }

    const index = (writeIndex - 1 - offsetFromNewest + maxEvents) % maxEvents;
    return events[index];
  };

  const getRecentEvents = (limit: number): TelemetryEvent[] => {
    const count = Math.min(limit, eventCount);
    const recent: TelemetryEvent[] = [];

    for (let offset = 0; offset < count; offset += 1) {
      const event = getEventAtOffset(offset);
      if (event) {
        recent.push(event);
      }
    }

    return recent;
  };

  const getRecentSlowCalls = (limit: number): TelemetryEvent[] => {
    const slowCalls: TelemetryEvent[] = [];

    for (let offset = 0; offset < eventCount && slowCalls.length < limit; offset += 1) {
      const event = getEventAtOffset(offset);
      if (event?.type !== "return") {
        continue;
      }

      if ((event.duration ?? 0) >= slowCallThresholdMs) {
        slowCalls.push(event);
      }
    }

    return slowCalls;
  };

  const getRecentSignals = (limit: number): TelemetryEvent[] => {
    const signals: TelemetryEvent[] = [];

    for (let offset = 0; offset < eventCount && signals.length < limit; offset += 1) {
      const event = getEventAtOffset(offset);
      if (!event || (event.type !== "mark" && event.type !== "throw")) {
        continue;
      }

      signals.push(event);
    }

    return signals;
  };

  const summarizeFunctions = (): {
    topByCallCount: TelemetryFunctionSummary[];
    topByTotalDuration: TelemetryFunctionSummary[];
    recentEventRate: number;
  } => {
    const summaries = new Map<string, MutableTelemetryFunctionSummary>();
    const newestEvent = getEventAtOffset(0);
    const cutoffAt = newestEvent ? newestEvent.at - 1000 : 0;
    let recentEventRate = 0;

    for (let index = 0; index < eventCount; index += 1) {
      const ringIndex = (writeIndex - eventCount + index + maxEvents) % maxEvents;
      const event = events[ringIndex];

      if (!event) {
        continue;
      }

      if (event.at >= cutoffAt) {
        recentEventRate += 1;
      }

      if (event.type === "mark") {
        continue;
      }

      let summary = summaries.get(event.name);
      if (!summary) {
        summary = {
          name: event.name,
          callCount: 0,
          returnCount: 0,
          throwCount: 0,
          totalDuration: 0,
          maxDuration: 0,
          lastAt: event.at,
        };
        summaries.set(event.name, summary);
      }

      summary.lastAt = event.at;
      if (event.type === "call") {
        summary.callCount += 1;
        continue;
      }

      if (event.type === "throw") {
        summary.throwCount += 1;
        continue;
      }

      summary.returnCount += 1;
      const duration = event.duration ?? 0;
      summary.totalDuration += duration;
      summary.maxDuration = Math.max(summary.maxDuration, duration);
    }

    const normalized = Array.from(summaries.values(), (summary) => ({
      name: summary.name,
      callCount: summary.callCount,
      returnCount: summary.returnCount,
      throwCount: summary.throwCount,
      totalDuration: summary.totalDuration,
      averageDuration: summary.returnCount > 0 ? summary.totalDuration / summary.returnCount : 0,
      maxDuration: summary.maxDuration,
      lastAt: summary.lastAt,
    }));

    const topByCallCount = [...normalized]
      .sort(
        (left, right) =>
          right.callCount - left.callCount ||
          right.throwCount - left.throwCount ||
          right.lastAt - left.lastAt,
      )
      .slice(0, summaryLimit);

    const topByTotalDuration = [...normalized]
      .sort(
        (left, right) =>
          right.totalDuration - left.totalDuration ||
          right.maxDuration - left.maxDuration ||
          right.lastAt - left.lastAt,
      )
      .slice(0, summaryLimit);

    return {
      topByCallCount,
      topByTotalDuration,
      recentEventRate,
    };
  };

  return {
    enter(name) {
      if (!enabled || paused) {
        return 0;
      }

      const callId = nextCallId++;
      const started = clock();
      const depth = activeCalls.size;
      activeCalls.set(callId, { name, startedAt: started, depth });

      pushEvent({
        type: "call",
        name,
        at: started,
        callId,
        depth,
      });

      return callId;
    },

    exit(callId) {
      if (callId === 0) {
        return;
      }

      const activeCall = activeCalls.get(callId);
      if (!activeCall) {
        return;
      }

      activeCalls.delete(callId);
      if (!enabled || paused) {
        return;
      }

      const endedAt = clock();
      pushEvent({
        type: "return",
        name: activeCall.name,
        at: endedAt,
        callId,
        depth: activeCall.depth,
        duration: endedAt - activeCall.startedAt,
      });
    },

    fail(callId, error) {
      if (callId === 0 || !enabled || paused) {
        return;
      }

      const activeCall = activeCalls.get(callId);
      if (!activeCall) {
        return;
      }

      pushEvent({
        type: "throw",
        name: activeCall.name,
        at: clock(),
        callId,
        depth: activeCall.depth,
        detail: getErrorDetail(error),
      });
    },

    mark(name, metadata) {
      if (!enabled || paused) {
        return;
      }

      pushEvent({
        type: "mark",
        name,
        at: clock(),
        metadata,
      });
    },

    clear() {
      events.fill(undefined);
      activeCalls.clear();
      nextSequence = 1;
      nextCallId = 1;
      totalRecorded = 0;
      droppedEvents = 0;
      writeIndex = 0;
      eventCount = 0;
      startedAt = Date.now();
      invalidateSnapshot();
      scheduleNotify();
    },

    setEnabled(nextEnabled) {
      if (enabled === nextEnabled) {
        return;
      }

      enabled = nextEnabled;
      activeCalls.clear();
      invalidateSnapshot();
      scheduleNotify();
    },

    setPaused(nextPaused) {
      if (paused === nextPaused) {
        return;
      }

      paused = nextPaused;
      activeCalls.clear();
      invalidateSnapshot();
      scheduleNotify();
    },

    setOverlayVisible(visible) {
      if (overlayVisible === visible) {
        return;
      }

      overlayVisible = visible;
      invalidateSnapshot();
      scheduleNotify();
    },

    toggleOverlay() {
      overlayVisible = !overlayVisible;
      invalidateSnapshot();
      scheduleNotify();
      return overlayVisible;
    },

    togglePaused() {
      paused = !paused;
      activeCalls.clear();
      invalidateSnapshot();
      scheduleNotify();
      return paused;
    },

    subscribe(listener) {
      listeners.add(listener);

      return () => {
        listeners.delete(listener);
      };
    },

    getSnapshot() {
      if (cachedSnapshot) {
        return cachedSnapshot;
      }

      const { topByCallCount, topByTotalDuration, recentEventRate } = summarizeFunctions();

      cachedSnapshot = {
        enabled,
        paused,
        overlayVisible,
        startedAt,
        totalRecorded,
        droppedEvents,
        maxEvents,
        eventCount,
        activeCallCount: activeCalls.size,
        recentEventRate,
        recentEvents: getRecentEvents(recentEventLimit),
        recentSignals: getRecentSignals(recentSignalLimit),
        recentSlowCalls: getRecentSlowCalls(recentSlowLimit),
        topByCallCount,
        topByTotalDuration,
      };

      return cachedSnapshot;
    },

    exportEvents() {
      const ordered: TelemetryEvent[] = [];

      for (let index = 0; index < eventCount; index += 1) {
        const ringIndex = (writeIndex - eventCount + index + maxEvents) % maxEvents;
        const event = events[ringIndex];
        if (event) {
          ordered.push(event);
        }
      }

      return ordered;
    },
  };
}
