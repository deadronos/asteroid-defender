import { create } from "zustand";
import type { AsteroidType } from "../ecs/world";
import { nextId } from "../utils/id";
import { markTelemetry } from "../telemetry/runtime";

// Pooled asteroid shape — must match what Asteroid component expects
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

interface PoolState {
  asteroids: PooledAsteroid[];
  explosions: PooledExplosion[];
  poolSize: number;
  /**
   * Maintained count of currently-active asteroid slots. Updated
   * incrementally by `activateAsteroids` / `deactivateAsteroid` so that
   * per-frame readers (e.g. `useAsteroidManager`) do not have to allocate
   * a filtered array each frame to compute it.
   */
  activeAsteroidCount: number;
  // Free-list bookkeeping: stack of inactive slot indices
  asteroidFreeList: number[];
  explosionFreeList: number[];
  // id-to-index maps for O(1) deactivation lookups
  asteroidIdToIndex: Map<string, number>;
  explosionIdToIndex: Map<string, number>;

  // Actions
  activateAsteroids: (spawns: Array<{ pos: [number, number, number]; type: AsteroidType }>) => void;
  deactivateAsteroid: (id: string) => void;
  triggerExplosion: (pos: [number, number, number], type: AsteroidType) => void;
  deactivateExplosion: (id: string) => void;
  resetPools: (poolSize: number) => void;
}

const getStoragePosition = (): [number, number, number] => [0, -1000, 0];

function rebuildAsteroidBookkeeping(asteroids: PooledAsteroid[]): {
  freeList: number[];
  idToIndex: Map<string, number>;
} {
  const freeList: number[] = [];
  const idToIndex = new Map<string, number>();
  for (let i = 0; i < asteroids.length; i++) {
    if (asteroids[i].active) {
      idToIndex.set(asteroids[i].id, i);
    } else {
      freeList.push(i);
    }
  }
  return { freeList, idToIndex };
}

function rebuildExplosionBookkeeping(explosions: PooledExplosion[]): {
  freeList: number[];
  idToIndex: Map<string, number>;
} {
  const freeList: number[] = [];
  const idToIndex = new Map<string, number>();
  for (let i = 0; i < explosions.length; i++) {
    if (explosions[i].active) {
      idToIndex.set(explosions[i].id, i);
    } else {
      freeList.push(i);
    }
  }
  return { freeList, idToIndex };
}

export const usePoolStore = create<PoolState>((set, get) => ({
  asteroids: [],
  explosions: [],
  poolSize: 60,
  activeAsteroidCount: 0,
  asteroidFreeList: [],
  explosionFreeList: [],
  asteroidIdToIndex: new Map(),
  explosionIdToIndex: new Map(),

  activateAsteroids: (spawns) => {
    if (spawns.length === 0) return;

    const { asteroids, asteroidFreeList } = get();

    // Fast path: enough free slots
    if (asteroidFreeList.length >= spawns.length) {
      set((state) => {
        const newAsteroids = [...state.asteroids];

        for (let s = 0; s < spawns.length; s++) {
          const idx = state.asteroidFreeList.pop()!;
          const slot = newAsteroids[idx];
          slot.active = true;
          slot.pos = spawns[s].pos;
          slot.type = spawns[s].type;
          state.asteroidIdToIndex.set(slot.id, idx);
        }

        markTelemetry("asteroids:activations", {
          count: spawns.length,
          source: "spawn-queue",
        });

        return {
          asteroids: newAsteroids,
          activeAsteroidCount: state.activeAsteroidCount + spawns.length,
        };
      });
      return;
    }

    // Slow path: free list exhausted — rebuild bookkeeping then retry
    markTelemetry("asteroids:starved", {
      requested: spawns.length,
      available: asteroidFreeList.length,
    });

    const rebuilt = rebuildAsteroidBookkeeping(asteroids);
    const stillFree = rebuilt.freeList.length;

    if (stillFree === 0) {
      console.warn("Asteroid pool starved! Dropping spawn.");
      return;
    }

    set((state) => {
      const newAsteroids = [...state.asteroids];
      state.asteroidFreeList.length = 0;
      state.asteroidFreeList.push(...rebuilt.freeList);
      state.asteroidIdToIndex.clear();
      for (const [k, v] of rebuilt.idToIndex) {
        state.asteroidIdToIndex.set(k, v);
      }

      // Activate as many as we can
      const toActivate = Math.min(spawns.length, state.asteroidFreeList.length);
      for (let s = 0; s < toActivate; s++) {
        const idx = state.asteroidFreeList.pop()!;
        const slot = newAsteroids[idx];
        slot.active = true;
        slot.pos = spawns[s].pos;
        slot.type = spawns[s].type;
        state.asteroidIdToIndex.set(slot.id, idx);
      }

      markTelemetry("asteroids:activations", {
        count: toActivate,
        source: "spawn-queue",
        starved: spawns.length - toActivate,
      });

      return {
        asteroids: newAsteroids,
        activeAsteroidCount: state.activeAsteroidCount + toActivate,
      };
    });
  },

  deactivateAsteroid: (id) => {
    const { asteroidIdToIndex } = get();
    const idx = asteroidIdToIndex.get(id);
    if (idx === undefined) return;

    set((state) => {
      const newAsteroids = [...state.asteroids];
      const slot = newAsteroids[idx];
      slot.active = false;
      slot.pos = getStoragePosition();
      state.asteroidFreeList.push(idx);
      state.asteroidIdToIndex.delete(id);
      return {
        asteroids: newAsteroids,
        activeAsteroidCount: Math.max(0, state.activeAsteroidCount - 1),
      };
    });
  },

  triggerExplosion: (pos, type) => {
    const { explosions, explosionFreeList } = get();

    // Fast path: free slot available
    if (explosionFreeList.length > 0) {
      set((state) => {
        const newExplosions = [...state.explosions];
        const idx = state.explosionFreeList.pop()!;
        const slot = newExplosions[idx];
        slot.active = true;
        slot.pos = pos;
        slot.type = type;
        state.explosionIdToIndex.set(slot.id, idx);

        return {
          explosions: newExplosions,
        };
      });
      return;
    }

    // Slow path: free list exhausted — rebuild
    const rebuilt = rebuildExplosionBookkeeping(explosions);
    if (rebuilt.freeList.length === 0) {
      return; // No space
    }

    set((state) => {
      const newExplosions = [...state.explosions];
      state.explosionFreeList.length = 0;
      state.explosionFreeList.push(...rebuilt.freeList);
      state.explosionIdToIndex.clear();
      for (const [k, v] of rebuilt.idToIndex) {
        state.explosionIdToIndex.set(k, v);
      }

      const idx = state.explosionFreeList.pop()!;
      const slot = newExplosions[idx];
      slot.active = true;
      slot.pos = pos;
      slot.type = type;
      state.explosionIdToIndex.set(slot.id, idx);

      return {
        explosions: newExplosions,
      };
    });
  },

  deactivateExplosion: (id) => {
    const { explosionIdToIndex } = get();
    const idx = explosionIdToIndex.get(id);
    if (idx === undefined) return;

    set((state) => {
      const newExplosions = [...state.explosions];
      const slot = newExplosions[idx];
      slot.active = false;
      slot.pos = getStoragePosition();
      state.explosionFreeList.push(idx);
      state.explosionIdToIndex.delete(id);
      return {
        explosions: newExplosions,
      };
    });
  },

  resetPools: (poolSize) => {
    const storagePos = getStoragePosition();
    const asteroids = Array.from({ length: poolSize }, () => ({
      id: nextId(),
      active: false,
      pos: storagePos,
      type: "swarmer" as AsteroidType,
    }));
    const explosions = Array.from({ length: poolSize }, () => ({
      id: nextId(),
      active: false,
      pos: storagePos,
      type: "swarmer" as AsteroidType,
    }));

    // Build initial free lists (all slots are free)
    const asteroidFreeList = Array.from({ length: poolSize }, (_, i) => i);
    const explosionFreeList = Array.from({ length: poolSize }, (_, i) => i);

    set({
      asteroids,
      explosions,
      poolSize,
      activeAsteroidCount: 0,
      asteroidFreeList,
      explosionFreeList,
      asteroidIdToIndex: new Map(),
      explosionIdToIndex: new Map(),
    });
  },
}));
