import type { AsteroidType } from "../../ecs/world";
import { markTelemetry } from "../../telemetry/runtime";
import { nextId } from "../../utils/id";

export interface PooledAsteroid {
  id: string;
  active: boolean;
  pos: [number, number, number];
  type: AsteroidType;
}

export interface PooledExplosion {
  id: string;
  active: boolean;
  pos: [number, number, number];
  type: AsteroidType;
}

export interface PoolUpdate<T> {
  items: T[];
  activeDelta: number;
}

function getStoragePosition(): [number, number, number] {
  return [0, -1000, 0];
}

export function createAsteroidPool(size: number): PooledAsteroid[] {
  return Array.from({ length: size }, () => ({
    id: nextId(),
    active: false,
    pos: getStoragePosition(),
    type: "swarmer",
  }));
}

export function createExplosionPool(size: number): PooledExplosion[] {
  return Array.from({ length: size }, () => ({
    id: nextId(),
    active: false,
    pos: getStoragePosition(),
    type: "swarmer",
  }));
}

export function deactivateExplosion(pool: PooledExplosion[], id: string): PooledExplosion[] {
  for (let i = 0; i < pool.length; i++) {
    if (pool[i].id === id && pool[i].active) {
      pool[i] = { ...pool[i], active: false };
      return pool;
    }
  }
  return pool;
}

export function activateQueuedAsteroidsWithDelta(
  pool: PooledAsteroid[],
  spawns: Array<{ pos: [number, number, number]; type: AsteroidType }>,
): PoolUpdate<PooledAsteroid> {
  if (spawns.length === 0) {
    return { items: pool, activeDelta: 0 };
  }

  let nextAvailableIdx = 0;
  let activeDelta = 0;

  for (const spawn of spawns) {
    while (nextAvailableIdx < pool.length && pool[nextAvailableIdx].active) {
      nextAvailableIdx++;
    }

    if (nextAvailableIdx >= pool.length) {
      markTelemetry("pool:asteroid-starved", {
        requested: spawns.length,
        capacity: pool.length,
      });
      console.warn("Asteroid pool starved! Dropping spawn.");
      break;
    }

    pool[nextAvailableIdx] = {
      ...pool[nextAvailableIdx],
      active: true,
      pos: spawn.pos,
      type: spawn.type,
    };
    activeDelta++;
    nextAvailableIdx++;
  }

  return { items: pool, activeDelta };
}

export function activateQueuedAsteroids(
  pool: PooledAsteroid[],
  spawns: Array<{ pos: [number, number, number]; type: AsteroidType }>,
): PooledAsteroid[] {
  return activateQueuedAsteroidsWithDelta(pool, spawns).items;
}

export function deactivateAsteroidWithDelta(
  pool: PooledAsteroid[],
  id: string,
): PoolUpdate<PooledAsteroid> {
  for (let i = 0; i < pool.length; i++) {
    if (pool[i].id === id && pool[i].active) {
      pool[i] = { ...pool[i], active: false };
      return { items: pool, activeDelta: -1 };
    }
  }
  return { items: pool, activeDelta: 0 };
}

export function deactivateAsteroid(pool: PooledAsteroid[], id: string): PooledAsteroid[] {
  return deactivateAsteroidWithDelta(pool, id).items;
}

export function spawnSplitterFragmentsWithDelta(
  pool: PooledAsteroid[],
  pos: [number, number, number],
): PoolUpdate<PooledAsteroid> {
  const offset = 2.0;
  let splitsLeft = 2;
  let spawnedCount = 0;

  for (let i = 0; i < pool.length && splitsLeft > 0; i++) {
    if (!pool[i].active) {
      pool[i] = {
        ...pool[i],
        active: true,
        type: "swarmer",
        pos: [pos[0] + (splitsLeft === 2 ? offset : -offset), pos[1], pos[2]],
      };
      splitsLeft--;
      spawnedCount++;
    }
  }

  return { items: pool, activeDelta: spawnedCount };
}

export function spawnSplitterFragments(
  pool: PooledAsteroid[],
  pos: [number, number, number],
): PooledAsteroid[] {
  return spawnSplitterFragmentsWithDelta(pool, pos).items;
}

export function countActiveItems<T extends { active: boolean }>(items: T[]): number {
  let activeCount = 0;
  for (let i = 0; i < items.length; i++) {
    if (items[i].active) {
      activeCount++;
    }
  }
  return activeCount;
}
