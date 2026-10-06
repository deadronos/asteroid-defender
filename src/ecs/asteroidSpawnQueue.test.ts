import { beforeEach, describe, expect, it } from "vite-plus/test";
import { MAX_PENDING_SPAWNS } from "../config/spawning";
import {
  clearAsteroidSpawns,
  drainAsteroidSpawns,
  enqueueAsteroidFragment,
  enqueueAsteroidSpawn,
  type SpawnData,
} from "./asteroidSpawnQueue";
import { getSpawnStatsSnapshot, resetSpawnStats } from "./spawnStats";

describe("asteroidSpawnQueue", () => {
  beforeEach(() => {
    clearAsteroidSpawns();
  });

  it("enqueues and drains a single asteroid spawn", () => {
    const spawn: SpawnData = {
      id: "1",
      pos: [0, 0, 0],
      type: "swarmer",
    };

    enqueueAsteroidSpawn(spawn);
    const drained = drainAsteroidSpawns();

    expect(drained).toHaveLength(1);
    expect(drained[0]).toEqual(spawn);
    expect(drainAsteroidSpawns()).toHaveLength(0);
  });

  it("enqueues and drains multiple asteroid spawns in order", () => {
    const spawn1: SpawnData = { id: "1", pos: [0, 0, 0], type: "swarmer" };
    const spawn2: SpawnData = { id: "2", pos: [1, 1, 1], type: "tank" };

    enqueueAsteroidSpawn(spawn1);
    enqueueAsteroidSpawn(spawn2);
    const drained = drainAsteroidSpawns();

    expect(drained).toHaveLength(2);
    expect(drained[0]).toEqual(spawn1);
    expect(drained[1]).toEqual(spawn2);
    expect(drainAsteroidSpawns()).toHaveLength(0);
  });

  it("returns an empty array when draining an empty queue", () => {
    const drained = drainAsteroidSpawns();
    expect(drained).toEqual([]);
  });

  it("clears the queue", () => {
    enqueueAsteroidSpawn({ id: "1", pos: [0, 0, 0], type: "swarmer" });
    clearAsteroidSpawns();
    expect(drainAsteroidSpawns()).toHaveLength(0);
  });

  it("drains should return a copy and not affect subsequent calls if modified (not applicable as it clears, but verify it returns new array)", () => {
    enqueueAsteroidSpawn({ id: "1", pos: [0, 0, 0], type: "swarmer" });
    const drained = drainAsteroidSpawns();
    drained.push({ id: "2", pos: [1, 1, 1], type: "tank" });

    expect(drainAsteroidSpawns()).toHaveLength(0);
  });
});

describe("asteroidSpawnQueue: partial drain", () => {
  beforeEach(() => {
    clearAsteroidSpawns();
  });

  it("returns at most maxCount and leaves the rest queued in FIFO order", () => {
    enqueueAsteroidSpawn({ id: "1", pos: [1, 0, 0], type: "swarmer" });
    enqueueAsteroidSpawn({ id: "2", pos: [2, 0, 0], type: "tank" });
    enqueueAsteroidSpawn({ id: "3", pos: [3, 0, 0], type: "splitter" });

    expect(drainAsteroidSpawns(2).map((spawn) => spawn.id)).toEqual(["1", "2"]);
    expect(drainAsteroidSpawns(2).map((spawn) => spawn.id)).toEqual(["3"]);
    expect(drainAsteroidSpawns(2)).toHaveLength(0);
  });

  it("drains everything when no maxCount is given", () => {
    enqueueAsteroidSpawn({ id: "1", pos: [0, 0, 0], type: "swarmer" });
    enqueueAsteroidSpawn({ id: "2", pos: [1, 0, 0], type: "tank" });

    expect(drainAsteroidSpawns()).toHaveLength(2);
  });
});

describe("asteroidSpawnQueue: safety valve and telemetry", () => {
  beforeEach(() => {
    clearAsteroidSpawns();
    resetSpawnStats();
  });

  it("caps the queue at MAX_PENDING_SPAWNS and counts overflow drops", () => {
    const excess = 5;

    for (let i = 0; i < MAX_PENDING_SPAWNS + excess; i++) {
      enqueueAsteroidSpawn({ id: String(i), pos: [i, 0, 0], type: "swarmer" });
    }

    expect(drainAsteroidSpawns()).toHaveLength(MAX_PENDING_SPAWNS);
    expect(getSpawnStatsSnapshot().overflowDrops).toBe(excess);
  });

  it("reports ambient and fragment enqueues separately", () => {
    enqueueAsteroidSpawn({ id: "a", pos: [0, 0, 0], type: "tank" });
    enqueueAsteroidFragment([0, 0, 0]);

    const snapshot = getSpawnStatsSnapshot();
    expect(snapshot.ambientEnqueued).toBe(1);
    expect(snapshot.fragmentsEnqueued).toBe(2);
  });

  it("tracks queue depth as spawns are enqueued and drained", () => {
    enqueueAsteroidSpawn({ id: "1", pos: [0, 0, 0], type: "swarmer" });
    enqueueAsteroidSpawn({ id: "2", pos: [1, 0, 0], type: "tank" });
    expect(getSpawnStatsSnapshot().queueDepth).toBe(2);

    drainAsteroidSpawns(1);
    expect(getSpawnStatsSnapshot().queueDepth).toBe(1);
  });
});

describe("enqueueAsteroidFragment", () => {
  beforeEach(() => {
    clearAsteroidSpawns();
  });

  it("queues two swarmer spawns offset on the X axis from the given position", () => {
    enqueueAsteroidFragment([10, 0, 0]);

    const drained = drainAsteroidSpawns();
    expect(drained).toHaveLength(2);
    expect(drained[0].type).toBe("swarmer");
    expect(drained[1].type).toBe("swarmer");
    expect(drained[0].pos).toEqual([12, 0, 0]);
    expect(drained[1].pos).toEqual([8, 0, 0]);
  });

  it("assigns unique ids to the two fragments", () => {
    enqueueAsteroidFragment([0, 0, 0]);
    const drained = drainAsteroidSpawns();
    expect(drained[0].id).not.toBe(drained[1].id);
  });

  it("appends to existing queued spawns in order", () => {
    enqueueAsteroidSpawn({ id: "a", pos: [0, 0, 0], type: "tank" });
    enqueueAsteroidFragment([5, 5, 5]);

    const drained = drainAsteroidSpawns();
    expect(drained.map((s) => s.type)).toEqual(["tank", "swarmer", "swarmer"]);
    expect(drained[0].pos).toEqual([0, 0, 0]);
    expect(drained[1].pos).toEqual([7, 5, 5]);
    expect(drained[2].pos).toEqual([3, 5, 5]);
  });
});
