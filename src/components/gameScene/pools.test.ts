import { describe, expect, it, vi, beforeEach } from "vite-plus/test";
import {
  createAsteroidPool,
  createExplosionPool,
  clearExplosionTimers,
  activateQueuedAsteroids,
  deactivateAsteroid,
  spawnSplitterFragments,
  countActiveItems,
  type PooledAsteroid,
  type PooledExplosion,
} from "./pools";

describe("Pools Utility Functions", () => {
  describe("createAsteroidPool", () => {
    it("should create a pool of the specified size", () => {
      const size = 10;
      const pool = createAsteroidPool(size);
      expect(pool.length).toBe(size);
    });

    it("should initialize items as inactive at storage position", () => {
      const pool = createAsteroidPool(1);
      expect(pool[0].active).toBe(false);
      expect(pool[0].pos).toEqual([0, -1000, 0]);
      expect(pool[0].type).toBe("swarmer");
      expect(pool[0].id).toBeDefined();
    });
  });

  describe("createExplosionPool", () => {
    it("should create a pool of the specified size", () => {
      const size = 5;
      const pool = createExplosionPool(size);
      expect(pool.length).toBe(size);
    });

    it("should initialize items as inactive", () => {
      const pool = createExplosionPool(1);
      expect(pool[0].active).toBe(false);
      expect(pool[0].type).toBe("swarmer");
    });
  });

  describe("activateQueuedAsteroids", () => {
    it("should activate inactive asteroids from spawns", () => {
      const pool = createAsteroidPool(5);
      const spawns = [
        { pos: [10, 0, 0] as [number, number, number], type: "swarmer" as const },
        { pos: [20, 0, 0] as [number, number, number], type: "swarmer" as const },
      ];

      const nextPool = activateQueuedAsteroids(pool, spawns);

      expect(countActiveItems(nextPool)).toBe(2);
      expect(nextPool[0].active).toBe(true);
      expect(nextPool[0].pos).toEqual([10, 0, 0]);
      expect(nextPool[1].active).toBe(true);
      expect(nextPool[1].pos).toEqual([20, 0, 0]);
      expect(nextPool !== pool).toBe(true);
    });

    it("should return the same pool reference when there are no spawns", () => {
      const pool = createAsteroidPool(5);
      const nextPool = activateQueuedAsteroids(pool, []);
      expect(nextPool).toBe(pool);
    });

    it("should return the same pool reference when the pool is full", () => {
      const pool = createAsteroidPool(2).map((a) => ({ ...a, active: true }));
      const spawns = [{ pos: [10, 0, 0] as [number, number, number], type: "swarmer" as const }];

      const nextPool = activateQueuedAsteroids(pool, spawns);
      expect(nextPool).toBe(pool);
    });

    it("should fill only available slots in a mixed pool", () => {
      const pool = createAsteroidPool(3);
      pool[0].active = true; // First is active
      // pool[1] is inactive
      pool[2].active = true; // Third is active

      const spawns = [{ pos: [10, 0, 0] as [number, number, number], type: "swarmer" as const }];

      const nextPool = activateQueuedAsteroids(pool, spawns);

      expect(nextPool[0].active).toBe(true);
      expect(nextPool[1].active).toBe(true); // Now active
      expect(nextPool[1].pos).toEqual([10, 0, 0]);
      expect(nextPool[2].active).toBe(true);
      expect(countActiveItems(nextPool)).toBe(3);
    });

    it("should stop when the pool is full even if there are more spawns", () => {
      const pool = createAsteroidPool(1);
      const spawns = [
        { pos: [10, 0, 0] as [number, number, number], type: "swarmer" as const },
        { pos: [20, 0, 0] as [number, number, number], type: "swarmer" as const },
      ];

      const nextPool = activateQueuedAsteroids(pool, spawns);

      expect(countActiveItems(nextPool)).toBe(1);
      expect(nextPool[0].pos).toEqual([10, 0, 0]);
    });
  });

  describe("deactivateAsteroid", () => {
    it("should deactivate an asteroid by ID", () => {
      const pool = createAsteroidPool(2);
      pool[0].active = true;
      const idToDeactivate = pool[0].id;

      const nextPool = deactivateAsteroid(pool, idToDeactivate);

      expect(nextPool[0].active).toBe(false);
      expect(nextPool !== pool).toBe(true);
    });

    it("should return the original pool if the ID is not found", () => {
      const pool = createAsteroidPool(2);
      const nextPool = deactivateAsteroid(pool, "non-existent-id");
      expect(nextPool).toBe(pool);
    });
  });

  describe("spawnSplitterFragments", () => {
    it("should spawn exactly 2 swarmer fragments if space is available", () => {
      const pool = createAsteroidPool(5);
      const pos: [number, number, number] = [10, 10, 10];

      const nextPool = spawnSplitterFragments(pool, pos);

      const activeItems = nextPool.filter((a) => a.active);
      expect(activeItems.length).toBe(2);
      expect(activeItems.every((a) => a.type === "swarmer")).toBe(true);

      // Check positions: [pos[0] + 2.0, pos[1], pos[2]] and [pos[0] - 2.0, pos[1], pos[2]]
      const positions = activeItems.map((a) => a.pos[0]);
      expect(positions).toContain(12.0);
      expect(positions).toContain(8.0);
    });

    it("should handle cases with no available space in the pool", () => {
      const pool = createAsteroidPool(1);
      pool[0].active = true;
      const pos: [number, number, number] = [10, 10, 10];

      const nextPool = spawnSplitterFragments(pool, pos);
      expect(countActiveItems(nextPool)).toBe(1); // Still only 1 active
      expect(nextPool[0].pos).not.toEqual([12, 10, 10]);
    });
  });

  describe("countActiveItems", () => {
    it("should return the correct count for mixed active/inactive pools", () => {
      const pool: PooledAsteroid[] = [
        { id: "1", active: true, pos: [0, 0, 0], type: "swarmer" },
        { id: "2", active: false, pos: [0, 0, 0], type: "swarmer" },
        { id: "3", active: true, pos: [0, 0, 0], type: "swarmer" },
        { id: "4", active: false, pos: [0, 0, 0], type: "swarmer" },
        { id: "5", active: true, pos: [0, 0, 0], type: "swarmer" },
      ];

      expect(countActiveItems(pool)).toBe(3);
    });

    it("should return 0 for an empty pool", () => {
      expect(countActiveItems([])).toBe(0);
    });
  });

  describe("clearExplosionTimers", () => {
    beforeEach(() => {
      vi.stubGlobal("clearTimeout", vi.fn());
    });

    it("should call clearTimeout for each item that has a timer", () => {
      const pool: PooledExplosion[] = [
        {
          id: "1",
          active: true,
          pos: [0, 0, 0],
          type: "swarmer",
          timer: 123 as ReturnType<typeof setTimeout>,
        },
        {
          id: "2",
          active: true,
          pos: [0, 0, 0],
          type: "swarmer",
          timer: 456 as ReturnType<typeof setTimeout>,
        },
        { id: "3", active: true, pos: [0, 0, 0], type: "swarmer" }, // No timer
      ];

      clearExplosionTimers(pool);

      expect(clearTimeout).toHaveBeenCalledTimes(2);
      expect(clearTimeout).toHaveBeenCalledWith(123);
      expect(clearTimeout).toHaveBeenCalledWith(456);
    });
  });
});
