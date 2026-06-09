import { AsteroidType } from "./world";
import { markTelemetry } from "../telemetry/runtime";
import { nextId } from "../utils/id";

export interface SpawnData {
  id: string;
  pos: [number, number, number];
  type: AsteroidType;
}

const pendingSpawns: SpawnData[] = [];

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

export function enqueueAsteroidSpawn(spawn: SpawnData) {
  pendingSpawns.push(spawn);
  markTelemetry("spawn-queue:enqueue", {
    queued: pendingSpawns.length,
    type: spawn.type,
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
    });
  }
}

export function drainAsteroidSpawns(): SpawnData[] {
  if (pendingSpawns.length === 0) return [];
  const drained = pendingSpawns.slice();
  pendingSpawns.length = 0;
  markTelemetry("spawn-queue:drain", {
    count: drained.length,
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
}
