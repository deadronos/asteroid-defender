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

  // Actions
  activateAsteroids: (spawns: Array<{ pos: [number, number, number]; type: AsteroidType }>) => void;
  deactivateAsteroid: (id: string) => void;
  triggerExplosion: (pos: [number, number, number], type: AsteroidType) => void;
  deactivateExplosion: (id: string) => void;
  activateSplitterFragments: (pos: [number, number, number]) => void;
  resetPools: (poolSize: number) => void;
}

const getStoragePosition = (): [number, number, number] => [0, -1000, 0];

export const usePoolStore = create<PoolState>((set, get) => ({
  asteroids: [],
  explosions: [],
  poolSize: 60,

  activateAsteroids: (spawns) => {
    const { asteroids } = get();
    const inactiveSlots = asteroids.filter((a) => !a.active);

    if (inactiveSlots.length < spawns.length) {
      markTelemetry("pool:asteroid-starved", {
        requested: spawns.length,
        available: inactiveSlots.length,
      });
    }

    set((state) => {
      const newAsteroids = [...state.asteroids];
      let spawnIndex = 0;

      for (let i = 0; i < newAsteroids.length && spawnIndex < spawns.length; i++) {
        if (!newAsteroids[i].active) {
          const spawn = spawns[spawnIndex];
          newAsteroids[i] = {
            ...newAsteroids[i],
            active: true,
            pos: spawn.pos,
            type: spawn.type,
          };
          spawnIndex++;
        }
      }

      return { asteroids: newAsteroids };
    });
  },

  deactivateAsteroid: (id) => {
    set((state) => {
      const newAsteroids = state.asteroids.map((a) =>
        a.id === id ? { ...a, active: false, pos: getStoragePosition() } : a
      );
      return { asteroids: newAsteroids };
    });
  },

  triggerExplosion: (pos, type) => {
    set((state) => {
      const newExplosions = [...state.explosions];
      const idx = newExplosions.findIndex((e) => !e.active);
      if (idx !== -1) {
        newExplosions[idx] = {
          ...newExplosions[idx],
          active: true,
          pos,
          type,
        };
      }
      return { explosions: newExplosions };
    });
  },

  deactivateExplosion: (id) => {
    set((state) => {
      const newExplosions = state.explosions.map((e) =>
        e.id === id ? { ...e, active: false, pos: getStoragePosition() } : e
      );
      return { explosions: newExplosions };
    });
  },

  activateSplitterFragments: (pos) => {
    const { asteroids } = get();
    const inactiveSlots = asteroids.filter((a) => !a.active);

    if (inactiveSlots.length < 2) {
      return;
    }

    const fragments: Array<{ pos: [number, number, number]; type: AsteroidType }> = [
      { pos: [pos[0] + 2, pos[1], pos[2]], type: "swarmer" },
      { pos: [pos[0] - 2, pos[1], pos[2]], type: "swarmer" },
    ];

    set((state) => {
      const newAsteroids = [...state.asteroids];
      let fragIndex = 0;

      for (let i = 0; i < newAsteroids.length && fragIndex < fragments.length; i++) {
        if (!newAsteroids[i].active) {
          const frag = fragments[fragIndex];
          newAsteroids[i] = {
            ...newAsteroids[i],
            active: true,
            pos: frag.pos,
            type: frag.type,
          };
          fragIndex++;
        }
      }

      return { asteroids: newAsteroids };
    });
  },

  resetPools: (poolSize) => {
    const storagePos = getStoragePosition();
    const asteroids = Array.from({ length: poolSize }, () => ({
      id: nextId(),
      active: false,
      pos: storagePos,
      type: "standard" as AsteroidType,
    }));
    const explosions = Array.from({ length: poolSize }, () => ({
      id: nextId(),
      active: false,
      pos: storagePos,
      type: "standard" as AsteroidType,
    }));
    set({ asteroids, explosions, poolSize });
  },
}));