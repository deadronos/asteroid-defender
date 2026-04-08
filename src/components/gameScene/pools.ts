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
  timer?: ReturnType<typeof setTimeout>;
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

export function clearExplosionTimers(pool: PooledExplosion[]) {
  for (const explosion of pool) {
    if (explosion.timer) {
      clearTimeout(explosion.timer);
    }
  }
  // Invalidate cache since items might have been modified to inactive elsewhere,
  // or this function might be used in a way that clears active state.
  Object.defineProperty(pool, "activeCount", {
    value: undefined,
    writable: true,
    configurable: true,
    enumerable: false,
  });
}

export function activateQueuedAsteroids(
  pool: PooledAsteroid[],
  spawns: Array<{ pos: [number, number, number]; type: AsteroidType }>,
): PooledAsteroid[] {
  const nextPool = [...pool];
  let modifiedCount = 0;
  let nextAvailableIdx = 0;

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
    modifiedCount++;
    nextAvailableIdx++;
  }

  if (modifiedCount > 0) {
    Object.defineProperty(nextPool, "activeCount", {
      value: countActiveItems(pool) + modifiedCount,
      writable: true,
      configurable: true,
      enumerable: false,
    });
    return nextPool;
  }
  return pool;
}

export function deactivateAsteroid(pool: PooledAsteroid[], id: string): PooledAsteroid[] {
  const idx = pool.findIndex((asteroid) => asteroid.id === id);
  if (idx === -1 || !pool[idx].active) {
    return pool;
  }

  const nextPool = [...pool];
  nextPool[idx] = { ...nextPool[idx], active: false };
  Object.defineProperty(nextPool, "activeCount", {
    value: Math.max(0, countActiveItems(pool) - 1),
    writable: true,
    configurable: true,
    enumerable: false,
  });
  return nextPool;
}

export function spawnSplitterFragments(
  pool: PooledAsteroid[],
  pos: [number, number, number],
): PooledAsteroid[] {
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

  if (spawnedCount > 0) {
    Object.defineProperty(nextPool, "activeCount", {
      value: countActiveItems(pool) + spawnedCount,
      writable: true,
      configurable: true,
      enumerable: false,
    });
    return nextPool;
  }

  return pool;
}

export function countActiveItems<T extends { active: boolean }>(items: T[]): number {
  const cached = (items as any).activeCount;
  if (typeof cached === "number") {
    return cached;
  }

  let activeCount = 0;
  for (let i = 0; i < items.length; i++) {
    if (items[i].active) {
      activeCount++;
    }
  }

  // Non-enumerable to avoid showing up in console/spreads
  Object.defineProperty(items, "activeCount", {
    value: activeCount,
    writable: true,
    configurable: true,
    enumerable: false,
  });

  return activeCount;
}
