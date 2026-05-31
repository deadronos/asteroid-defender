import { AsteroidType } from "./world";
import { markTelemetry } from "../telemetry/runtime";

export interface SpawnData {
  id: string;
  pos: [number, number, number];
  type: AsteroidType;
}

const pendingSpawns: SpawnData[] = [];

export function enqueueAsteroidSpawn(spawn: SpawnData) {
  pendingSpawns.push(spawn);
  markTelemetry("spawn-queue:enqueue", {
    queued: pendingSpawns.length,
    type: spawn.type,
  });
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
