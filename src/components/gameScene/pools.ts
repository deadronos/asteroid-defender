import type { AsteroidType } from "../../ecs/world";
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
  const idx = pool.findIndex((explosion) => explosion.id === id);
  if (idx === -1 || !pool[idx].active) {
    return pool;
  }

  const nextPool = [...pool];
  nextPool[idx] = { ...nextPool[idx], active: false };
  return nextPool;
}

export function activateQueuedAsteroidsWithDelta(
  pool: PooledAsteroid[],
  spawns: Array<{ pos: [number, number, number]; type: AsteroidType }>,
): PoolUpdate<PooledAsteroid> {
  const nextPool = [...pool];
  let modified = false;
  let nextAvailableIdx = 0;
  let activeDelta = 0;

  for (const spawn of spawns) {
    while (nextAvailableIdx < nextPool.length && nextPool[nextAvailableIdx].active) {
      nextAvailableIdx++;
    }

    if (nextAvailableIdx >= nextPool.length) {
      console.warn("Asteroid pool starved! Dropping spawn.");
      break;
    }

    nextPool[nextAvailableIdx] = {
      ...nextPool[nextAvailableIdx],
      active: true,
      pos: spawn.pos,
      type: spawn.type,
    };
    modified = true;
    activeDelta++;
    nextAvailableIdx++;
  }

  return {
    items: modified ? nextPool : pool,
    activeDelta,
  };
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
  const idx = pool.findIndex((asteroid) => asteroid.id === id);
  if (idx === -1 || !pool[idx].active) {
    return { items: pool, activeDelta: 0 };
  }

  const nextPool = [...pool];
  nextPool[idx] = { ...nextPool[idx], active: false };
  return { items: nextPool, activeDelta: -1 };
}

export function deactivateAsteroid(pool: PooledAsteroid[], id: string): PooledAsteroid[] {
  return deactivateAsteroidWithDelta(pool, id).items;
}

export function spawnSplitterFragmentsWithDelta(
  pool: PooledAsteroid[],
  pos: [number, number, number],
): PoolUpdate<PooledAsteroid> {
  const nextPool = [...pool];
  const offset = 2.0;
  let splitsLeft = 2;
  let spawnedCount = 0;

  for (let i = 0; i < nextPool.length && splitsLeft > 0; i++) {
    if (!nextPool[i].active) {
      nextPool[i] = {
        ...nextPool[i],
        active: true,
        type: "swarmer",
        pos: [pos[0] + (splitsLeft === 2 ? offset : -offset), pos[1], pos[2]],
      };
      splitsLeft--;
      spawnedCount++;
    }
  }

  return {
    items: spawnedCount > 0 ? nextPool : pool,
    activeDelta: spawnedCount,
  };
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
