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

// ---------------------------------------------------------------------------
// PoolState — free-list backed pool manager
// ---------------------------------------------------------------------------
// Maintains a free-list (stack of inactive slot indices) and an id-to-index
// map for O(1) slot allocation and O(1) lookup by id.
//
// The pool array itself stays as a plain PooledAsteroid[] so it can be stored
// in zustand state directly. PoolState is used by the pool utility functions
// and benches; poolStore wraps these for React use.
// ---------------------------------------------------------------------------
export class PoolState<T extends { id: string; active: boolean }> {
  private items: T[];
  private freeList: number[] = [];
  private idToIndex: Map<string, number> = new Map();

  constructor(items: T[]) {
    this.items = items;
    this.rebuild();
  }

  get items_unsafe(): T[] {
    return this.items;
  }

  private rebuild(): void {
    this.freeList = [];
    this.idToIndex.clear();
    for (let i = 0; i < this.items.length; i++) {
      if (this.items[i].active) {
        this.idToIndex.set(this.items[i].id, i);
      } else {
        this.freeList.push(i);
      }
    }
  }

  /** Allocate up to `count` inactive slots for the given update fn. */
  allocate(count: number, update: (idx: number) => void): number {
    if (this.freeList.length < count) {
      this.rebuild();
    }
    const available = Math.min(count, this.freeList.length);
    for (let i = 0; i < available; i++) {
      const idx = this.freeList.shift()!;
      update(idx);
      this.idToIndex.set(this.items[idx].id, idx);
    }
    return available;
  }

  /** Release an active slot by id. */
  release(id: string): boolean {
    const idx = this.idToIndex.get(id);
    if (idx === undefined) return false;
    this.items[idx] = { ...this.items[idx], active: false, pos: getStoragePosition() as T["pos"] };
    this.freeList.push(idx);
    this.idToIndex.delete(id);
    return true;
  }

  activeCount(): number {
    return this.items.length - this.freeList.length;
  }
}

// ---------------------------------------------------------------------------
// Public API — delegates to PoolState
// ---------------------------------------------------------------------------

export function createAsteroidPool(size: number): PooledAsteroid[] {
  const storagePos = getStoragePosition();
  return Array.from({ length: size }, () => ({
    id: nextId(),
    active: false,
    pos: storagePos,
    type: "swarmer" as AsteroidType,
  }));
}

export function createExplosionPool(size: number): PooledExplosion[] {
  const storagePos = getStoragePosition();
  return Array.from({ length: size }, () => ({
    id: nextId(),
    active: false,
    pos: storagePos,
    type: "swarmer" as AsteroidType,
  }));
}

export function deactivateExplosion(pool: PooledExplosion[], id: string): PooledExplosion[] {
  const state = new PoolState(pool);
  state.release(id);
  return pool;
}

export function activateQueuedAsteroidsWithDelta(
  pool: PooledAsteroid[],
  spawns: Array<{ pos: [number, number, number]; type: AsteroidType }>,
): PoolUpdate<PooledAsteroid> {
  if (spawns.length === 0) {
    return { items: pool, activeDelta: 0 };
  }

  const state = new PoolState(pool);
  let spawned = 0;

  state.allocate(spawns.length, (idx) => {
    const spawn = spawns[spawned];
    pool[idx] = { ...pool[idx], active: true, pos: spawn.pos, type: spawn.type };
    spawned++;
  });

  if (spawned < spawns.length) {
    markTelemetry("pool:asteroid-starved", {
      requested: spawns.length,
      capacity: pool.length,
    });
    console.warn("Asteroid pool starved! Dropping spawn.");
  }

  return { items: pool, activeDelta: spawned };
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
  const state = new PoolState(pool);
  const found = state.release(id);
  // release() already modified state; compute delta from success alone
  return { items: pool, activeDelta: found ? -1 : 0 };
}

export function deactivateAsteroid(pool: PooledAsteroid[], id: string): PooledAsteroid[] {
  return deactivateAsteroidWithDelta(pool, id).items;
}

export function spawnSplitterFragmentsWithDelta(
  pool: PooledAsteroid[],
  pos: [number, number, number],
): PoolUpdate<PooledAsteroid> {
  const offset = 2.0;
  const state = new PoolState(pool);

  let spawned = 0;
  state.allocate(2, (idx) => {
    const sign = spawned === 0 ? 1 : -1;
    pool[idx] = {
      ...pool[idx],
      active: true,
      type: "swarmer",
      pos: [pos[0] + sign * offset, pos[1], pos[2]],
    };
    spawned++;
  });

  return { items: pool, activeDelta: spawned };
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
