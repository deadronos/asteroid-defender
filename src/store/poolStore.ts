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
  activateSplitterFragments: (pos: [number, number, number]) => void;
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
        const newFreeList = [...state.asteroidFreeList];
        const newIdToIndex = new Map(state.asteroidIdToIndex);

        for (let s = 0; s < spawns.length; s++) {
          const idx = newFreeList.pop()!;
          newAsteroids[idx] = {
            ...newAsteroids[idx],
            active: true,
            pos: spawns[s].pos,
            type: spawns[s].type,
          };
          newIdToIndex.set(newAsteroids[idx].id, idx);
        }

        return {
          asteroids: newAsteroids,
          asteroidFreeList: newFreeList,
          asteroidIdToIndex: newIdToIndex,
        };
      });
      return;
    }

    // Slow path: free list exhausted — rebuild bookkeeping then retry
    markTelemetry("pool:asteroid-starved", {
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
      const newFreeList = [...rebuilt.freeList];
      const newIdToIndex = new Map(rebuilt.idToIndex);

      // Activate as many as we can
      const toActivate = Math.min(spawns.length, newFreeList.length);
      for (let s = 0; s < toActivate; s++) {
        const idx = newFreeList.pop()!;
        newAsteroids[idx] = {
          ...newAsteroids[idx],
          active: true,
          pos: spawns[s].pos,
          type: spawns[s].type,
        };
        newIdToIndex.set(newAsteroids[idx].id, idx);
      }

      return {
        asteroids: newAsteroids,
        asteroidFreeList: newFreeList,
        asteroidIdToIndex: newIdToIndex,
      };
    });
  },

  deactivateAsteroid: (id) => {
    const { asteroidIdToIndex } = get();
    const idx = asteroidIdToIndex.get(id);
    if (idx === undefined) return;

    set((state) => {
      const newAsteroids = [...state.asteroids];
      newAsteroids[idx] = {
        ...newAsteroids[idx],
        active: false,
        pos: getStoragePosition(),
      };
      const newFreeList = [...state.asteroidFreeList, idx];
      const newIdToIndex = new Map(state.asteroidIdToIndex);
      newIdToIndex.delete(id);
      return {
        asteroids: newAsteroids,
        asteroidFreeList: newFreeList,
        asteroidIdToIndex: newIdToIndex,
      };
    });
  },

  triggerExplosion: (pos, type) => {
    const { explosions, explosionFreeList } = get();

    // Fast path: free slot available
    if (explosionFreeList.length > 0) {
      set((state) => {
        const newExplosions = [...state.explosions];
        const newFreeList = [...state.explosionFreeList];
        const newIdToIndex = new Map(state.explosionIdToIndex);

        const idx = newFreeList.pop()!;
        newExplosions[idx] = {
          ...newExplosions[idx],
          active: true,
          pos,
          type,
        };
        newIdToIndex.set(newExplosions[idx].id, idx);

        return {
          explosions: newExplosions,
          explosionFreeList: newFreeList,
          explosionIdToIndex: newIdToIndex,
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
      const newFreeList = [...rebuilt.freeList];
      const newIdToIndex = new Map(rebuilt.idToIndex);

      const idx = newFreeList.pop()!;
      newExplosions[idx] = {
        ...newExplosions[idx],
        active: true,
        pos,
        type,
      };
      newIdToIndex.set(newExplosions[idx].id, idx);

      return {
        explosions: newExplosions,
        explosionFreeList: newFreeList,
        explosionIdToIndex: newIdToIndex,
      };
    });
  },

  deactivateExplosion: (id) => {
    const { explosionIdToIndex } = get();
    const idx = explosionIdToIndex.get(id);
    if (idx === undefined) return;

    set((state) => {
      const newExplosions = [...state.explosions];
      newExplosions[idx] = {
        ...newExplosions[idx],
        active: false,
        pos: getStoragePosition(),
      };
      const newFreeList = [...state.explosionFreeList, idx];
      const newIdToIndex = new Map(state.explosionIdToIndex);
      newIdToIndex.delete(id);
      return {
        explosions: newExplosions,
        explosionFreeList: newFreeList,
        explosionIdToIndex: newIdToIndex,
      };
    });
  },

  activateSplitterFragments: (pos) => {
    const { asteroids, asteroidFreeList } = get();

    if (asteroidFreeList.length < 2) {
      // Rebuild bookkeeping to check real availability
      const rebuilt = rebuildAsteroidBookkeeping(asteroids);
      if (rebuilt.freeList.length < 2) return;

      set((state) => {
        const newAsteroids = [...state.asteroids];
        const newFreeList = [...rebuilt.freeList];
        const newIdToIndex = new Map(rebuilt.idToIndex);

        for (let f = 0; f < 2; f++) {
          const idx = newFreeList.pop()!;
          newAsteroids[idx] = {
            ...newAsteroids[idx],
            active: true,
            pos: [pos[0] + (f === 0 ? 2 : -2), pos[1], pos[2]],
            type: "swarmer",
          };
          newIdToIndex.set(newAsteroids[idx].id, idx);
        }

        return {
          asteroids: newAsteroids,
          asteroidFreeList: newFreeList,
          asteroidIdToIndex: newIdToIndex,
        };
      });
      return;
    }

    set((state) => {
      const newAsteroids = [...state.asteroids];
      const newFreeList = [...state.asteroidFreeList];
      const newIdToIndex = new Map(state.asteroidIdToIndex);

      for (let f = 0; f < 2; f++) {
        const idx = newFreeList.pop()!;
        newAsteroids[idx] = {
          ...newAsteroids[idx],
          active: true,
          pos: [pos[0] + (f === 0 ? 2 : -2), pos[1], pos[2]],
          type: "swarmer",
        };
        newIdToIndex.set(newAsteroids[idx].id, idx);
      }

      return {
        asteroids: newAsteroids,
        asteroidFreeList: newFreeList,
        asteroidIdToIndex: newIdToIndex,
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
      asteroidFreeList,
      explosionFreeList,
      asteroidIdToIndex: new Map(),
      explosionIdToIndex: new Map(),
    });
  },
}));
