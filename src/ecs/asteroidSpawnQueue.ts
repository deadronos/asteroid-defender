import { AsteroidType } from "./world";
import { markTelemetry } from "../telemetry/runtime";
import { nextId } from "../utils/id";
import { MAX_PENDING_SPAWNS } from "../config/spawning";
import { recordSpawnEnqueued, recordSpawnOverflow, setSpawnQueueDepth } from "./spawnStats";

export interface SpawnData {
  id: string;
  pos: [number, number, number];
  type: AsteroidType;
  /**
   * Where this spawn came from. Fragment spawns produced by splitter
   * destruction are tagged so the reserved pool headroom and telemetry can
   * distinguish them from the ambient spawner. Defaults to "ambient".
   */
  source?: "ambient" | "fragment";
}

/**
 * Offsets (X, Y, Z) applied to the two fragments produced by a splitter
 * destruction. Preserves the historical ±2 X spread so the two swarmers
 * don't spawn co-located, which would cause overlapping colliders and
 * unpredictable Rapier physics on the first frame.
 */
const FRAGMENT_OFFSETS: ReadonlyArray<[number, number, number]> = [
  [2, 0, 0],
  [-2, 0, 0],
];

let pendingSpawns: SpawnData[] = [];
// Reused across drains so the per-frame drain does not allocate a new array.
const drainBuffer: SpawnData[] = [];

export function enqueueAsteroidSpawn(spawn: SpawnData) {
  // Safety valve: never let the queue grow without bound. Realistic bursts
  // (2 fragments per splitter, bounded by the asteroid pool) stay under this.
  if (pendingSpawns.length >= MAX_PENDING_SPAWNS) {
    recordSpawnOverflow(1);
    markTelemetry("spawn-queue:overflow", {
      dropped: 1,
      queued: pendingSpawns.length,
      type: spawn.type,
      source: spawn.source ?? "ambient",
    });
    return;
  }

  pendingSpawns.push(spawn);
  recordSpawnEnqueued(spawn.source ?? "ambient");
  setSpawnQueueDepth(pendingSpawns.length);
  markTelemetry("spawn-queue:enqueue", {
    queued: pendingSpawns.length,
    type: spawn.type,
    source: spawn.source ?? "ambient",
  });
}

/**
 * Enqueue two swarmer fragment spawns produced by a splitter destruction.
 *
 * Routes fragments through the same queue as regular spawns so that:
 *  - The proximity backpressure in AsteroidSpawner observes fragment
 *    activations.
 *  - Pool-starvation telemetry is reported via the same path.
 *  - The dev telemetry overlay shows the true activation rate.
 *
 * The two fragments are placed at the given position plus the
 * `FRAGMENT_OFFSETS` deltas, preserving the visual separation that the
 * pre-refactor `poolStore.activateSplitterFragments` provided.
 */
export function enqueueAsteroidFragment(pos: [number, number, number]) {
  for (const [dx, dy, dz] of FRAGMENT_OFFSETS) {
    enqueueAsteroidSpawn({
      id: nextId(),
      pos: [pos[0] + dx, pos[1] + dy, pos[2] + dz],
      type: "swarmer",
      source: "fragment",
    });
  }
}

/**
 * Removes and returns up to `maxCount` queued spawns in FIFO order. Callers
 * pass a per-frame budget to spread bursts across frames; the remainder stays
 * queued for the next call. Omit `maxCount` to drain everything.
 */
export function drainAsteroidSpawns(maxCount = Number.POSITIVE_INFINITY): SpawnData[] {
  const drainCount = Math.min(maxCount, pendingSpawns.length);
  if (drainCount <= 0) return [];

  const drained = drainBuffer;
  drained.length = 0;
  for (let i = 0; i < drainCount; i++) {
    drained.push(pendingSpawns[i]);
  }

  // Remove the consumed prefix in place (no allocation).
  pendingSpawns.copyWithin(0, drainCount);
  pendingSpawns.length -= drainCount;

  setSpawnQueueDepth(pendingSpawns.length);
  markTelemetry("spawn-queue:drain", {
    count: drained.length,
    remaining: pendingSpawns.length,
  });

  return drained;
}

export function clearAsteroidSpawns() {
  if (pendingSpawns.length > 0) {
    markTelemetry("spawn-queue:clear", {
      count: pendingSpawns.length,
    });
  }
  pendingSpawns.length = 0;
  drainBuffer.length = 0;
  setSpawnQueueDepth(0);
}
