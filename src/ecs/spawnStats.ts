/**
 * Lightweight, allocation-free counters describing asteroid spawn activity.
 *
 * These are separate from the full telemetry store (which records every event
 * in a ring buffer) because the spawn loop touches them at frame rate. The dev
 * overlay reads snapshots from here and subscribes for throttled updates.
 */

export interface SpawnStatsSnapshot {
  ambientEnqueued: number;
  fragmentsEnqueued: number;
  activations: number;
  starvedDrops: number;
  overflowDrops: number;
  queueDepth: number;
}

export type SpawnSource = "ambient" | "fragment";

const NOTIFY_INTERVAL_MS = 200;

let ambientEnqueued = 0;
let fragmentsEnqueued = 0;
let activations = 0;
let starvedDrops = 0;
let overflowDrops = 0;
let queueDepth = 0;

const listeners = new Set<() => void>();
let notifyTimer: ReturnType<typeof setTimeout> | null = null;
let cachedSnapshot: SpawnStatsSnapshot | null = null;

function invalidateSnapshot() {
  cachedSnapshot = null;
}

function scheduleNotify() {
  if (listeners.size === 0 || notifyTimer !== null) {
    return;
  }

  notifyTimer = setTimeout(() => {
    notifyTimer = null;
    for (const listener of listeners) {
      listener();
    }
  }, NOTIFY_INTERVAL_MS);
}

export function recordSpawnEnqueued(source: SpawnSource) {
  if (source === "fragment") {
    fragmentsEnqueued += 1;
  } else {
    ambientEnqueued += 1;
  }
  invalidateSnapshot();
  scheduleNotify();
}

export function recordSpawnActivations(activated: number, starved = 0) {
  activations += activated;
  starvedDrops += starved;
  invalidateSnapshot();
  scheduleNotify();
}

export function recordSpawnOverflow(dropped: number) {
  overflowDrops += dropped;
  invalidateSnapshot();
  scheduleNotify();
}

export function setSpawnQueueDepth(depth: number) {
  queueDepth = depth;
  invalidateSnapshot();
  scheduleNotify();
}

export function resetSpawnStats() {
  ambientEnqueued = 0;
  fragmentsEnqueued = 0;
  activations = 0;
  starvedDrops = 0;
  overflowDrops = 0;
  queueDepth = 0;
  invalidateSnapshot();
  scheduleNotify();
}

export function getSpawnStatsSnapshot(): SpawnStatsSnapshot {
  if (!cachedSnapshot) {
    cachedSnapshot = {
      ambientEnqueued,
      fragmentsEnqueued,
      activations,
      starvedDrops,
      overflowDrops,
      queueDepth,
    };
  }

  return cachedSnapshot;
}

export function subscribeSpawnStats(listener: () => void): () => void {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}
