import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { getSpawnStatsSnapshot, resetSpawnStats } from "../ecs/spawnStats";
import { usePoolStore } from "./poolStore";

const initialState = usePoolStore.getInitialState();

beforeEach(() => {
  usePoolStore.setState(initialState, true);
  usePoolStore.getState().resetPools(60);
  resetSpawnStats();
});

describe("poolStore: activateAsteroids", () => {
  it("activates the requested slots", () => {
    const store = usePoolStore.getState();

    store.activateAsteroids([
      { pos: [1, 0, 0], type: "swarmer" },
      { pos: [2, 0, 0], type: "tank" },
    ]);

    const after = usePoolStore.getState();
    const active = after.asteroids.filter((a) => a.active);
    expect(active).toHaveLength(2);
    // Slot assignment is free-list driven, so the order positions are
    // read out is non-deterministic. Compare the sorted sets.
    const activePositions = active.map((a) => a.pos).sort((a, b) => a[0] - b[0]);
    expect(activePositions).toEqual([
      [1, 0, 0],
      [2, 0, 0],
    ]);
    expect(active.map((a) => a.type).sort()).toEqual(["swarmer", "tank"]);
    expect(after.activeAsteroidCount).toBe(2);
  });

  it("no-op on empty input", () => {
    const store = usePoolStore.getState();
    const before = usePoolStore.getState().asteroids;

    store.activateAsteroids([]);

    const after = usePoolStore.getState();
    expect(after.asteroids).toBe(before);
    expect(after.activeAsteroidCount).toBe(0);
  });

  it("warns and drops excess spawns when the pool is full", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const store = usePoolStore.getState();

    // Fill the pool
    store.activateAsteroids(
      Array.from({ length: 60 }, (_, i) => ({
        pos: [i, 0, 0] as [number, number, number],
        type: "swarmer" as const,
      })),
    );
    expect(usePoolStore.getState().activeAsteroidCount).toBe(60);

    // Try to activate one more
    store.activateAsteroids([{ pos: [99, 0, 0], type: "swarmer" }]);

    // Should be a no-op: count unchanged, no slot activated
    expect(usePoolStore.getState().activeAsteroidCount).toBe(60);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe("poolStore: saturation handling", () => {
  const fill = (count: number) =>
    Array.from({ length: count }, (_, i) => ({
      pos: [i, 0, 0] as [number, number, number],
      type: "swarmer" as const,
    }));

  it("records successful activations", () => {
    usePoolStore.getState().activateAsteroids([
      { pos: [1, 0, 0], type: "swarmer" },
      { pos: [2, 0, 0], type: "tank" },
    ]);

    const snapshot = getSpawnStatsSnapshot();
    expect(snapshot.activations).toBe(2);
    expect(snapshot.starvedDrops).toBe(0);
  });

  it("warns only once per saturation episode and counts starved drops", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    try {
      const store = usePoolStore.getState();
      store.activateAsteroids(fill(60));
      expect(warn).toHaveBeenCalledTimes(0);

      // First drop in the episode warns.
      store.activateAsteroids([{ pos: [99, 0, 0], type: "swarmer" }]);
      expect(warn).toHaveBeenCalledTimes(1);

      // Subsequent drops in the same episode stay quiet.
      store.activateAsteroids([{ pos: [98, 0, 0], type: "swarmer" }]);
      expect(warn).toHaveBeenCalledTimes(1);

      // Freeing a slot ends the episode; the next activation succeeds quietly.
      const activeId = usePoolStore.getState().asteroids.find((a) => a.active)!.id;
      usePoolStore.getState().deactivateAsteroid(activeId);
      store.activateAsteroids([{ pos: [97, 0, 0], type: "swarmer" }]);
      expect(warn).toHaveBeenCalledTimes(1);

      // Saturating again starts a new episode and warns once more.
      store.activateAsteroids([{ pos: [96, 0, 0], type: "swarmer" }]);
      expect(warn).toHaveBeenCalledTimes(2);

      expect(getSpawnStatsSnapshot().starvedDrops).toBeGreaterThanOrEqual(2);
    } finally {
      warn.mockRestore();
    }
  });
});

describe("poolStore: deactivateAsteroid", () => {
  it("deactivates by id and frees the slot", () => {
    const store = usePoolStore.getState();
    store.activateAsteroids([{ pos: [1, 0, 0], type: "swarmer" }]);
    const id = usePoolStore.getState().asteroids.find((a) => a.active)!.id;

    store.deactivateAsteroid(id);

    const after = usePoolStore.getState();
    expect(after.asteroids.find((a) => a.id === id)!.active).toBe(false);
    expect(after.activeAsteroidCount).toBe(0);
    expect(after.asteroidFreeList).toContain(after.asteroids.findIndex((a) => a.id === id));
  });

  it("ignores unknown ids", () => {
    const store = usePoolStore.getState();
    store.activateAsteroids([{ pos: [1, 0, 0], type: "swarmer" }]);

    store.deactivateAsteroid("does-not-exist");

    expect(usePoolStore.getState().activeAsteroidCount).toBe(1);
  });
});

describe("poolStore: activeAsteroidCount maintenance", () => {
  it("is zero after resetPools", () => {
    expect(usePoolStore.getState().activeAsteroidCount).toBe(0);
  });

  it("increments on activate and decrements on deactivate", () => {
    const store = usePoolStore.getState();
    store.activateAsteroids([{ pos: [1, 0, 0], type: "swarmer" }]);
    expect(usePoolStore.getState().activeAsteroidCount).toBe(1);

    const id = usePoolStore.getState().asteroids.find((a) => a.active)!.id;
    store.deactivateAsteroid(id);
    expect(usePoolStore.getState().activeAsteroidCount).toBe(0);
  });

  it("tracks count correctly across many activations and deactivations", () => {
    const store = usePoolStore.getState();
    const ids: string[] = [];

    for (let i = 0; i < 10; i++) {
      store.activateAsteroids([{ pos: [i, 0, 0], type: "swarmer" }]);
      const active = usePoolStore.getState().asteroids.find((a) => a.active && a.pos[0] === i);
      if (active) ids.push(active.id);
    }
    expect(usePoolStore.getState().activeAsteroidCount).toBe(10);

    for (const id of ids) {
      usePoolStore.getState().deactivateAsteroid(id);
    }
    expect(usePoolStore.getState().activeAsteroidCount).toBe(0);
  });
});

describe("poolStore: resetPools", () => {
  it("zeros active count and re-initializes free lists", () => {
    const store = usePoolStore.getState();
    store.activateAsteroids([{ pos: [1, 0, 0], type: "swarmer" }]);
    expect(usePoolStore.getState().activeAsteroidCount).toBe(1);

    store.resetPools(60);

    const after = usePoolStore.getState();
    expect(after.activeAsteroidCount).toBe(0);
    expect(after.asteroids).toHaveLength(60);
    expect(after.asteroidFreeList).toHaveLength(60);
    expect(after.asteroidIdToIndex.size).toBe(0);
  });
});
