import { AsteroidType } from "./world";

export interface SpawnData {
  id: string;
  pos: [number, number, number];
  type: AsteroidType;
}

const pendingSpawns: SpawnData[] = [];

export function enqueueAsteroidSpawn(spawn: SpawnData) {
  pendingSpawns.push(spawn);
}

export function drainAsteroidSpawns(): SpawnData[] {
  if (pendingSpawns.length === 0) return [];
  const drained = pendingSpawns.slice();
  pendingSpawns.length = 0;
  return drained;
}

export function clearAsteroidSpawns() {
  pendingSpawns.length = 0;
}
