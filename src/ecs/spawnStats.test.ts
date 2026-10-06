import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import {
  getSpawnStatsSnapshot,
  recordSpawnActivations,
  recordSpawnEnqueued,
  recordSpawnOverflow,
  resetSpawnStats,
  setSpawnQueueDepth,
  subscribeSpawnStats,
} from "./spawnStats";

describe("spawnStats", () => {
  beforeEach(() => {
    resetSpawnStats();
  });

  it("starts at zero", () => {
    expect(getSpawnStatsSnapshot()).toEqual({
      ambientEnqueued: 0,
      fragmentsEnqueued: 0,
      activations: 0,
      starvedDrops: 0,
      overflowDrops: 0,
      queueDepth: 0,
    });
  });

  it("counts ambient and fragment enqueues separately", () => {
    recordSpawnEnqueued("ambient");
    recordSpawnEnqueued("ambient");
    recordSpawnEnqueued("fragment");

    const snapshot = getSpawnStatsSnapshot();
    expect(snapshot.ambientEnqueued).toBe(2);
    expect(snapshot.fragmentsEnqueued).toBe(1);
  });

  it("records activations and starved drops", () => {
    recordSpawnActivations(3, 1);

    const snapshot = getSpawnStatsSnapshot();
    expect(snapshot.activations).toBe(3);
    expect(snapshot.starvedDrops).toBe(1);
  });

  it("records overflow drops", () => {
    recordSpawnOverflow(2);
    expect(getSpawnStatsSnapshot().overflowDrops).toBe(2);
  });

  it("tracks queue depth independently of counters", () => {
    setSpawnQueueDepth(7);
    expect(getSpawnStatsSnapshot().queueDepth).toBe(7);
  });

  it("resets all counters", () => {
    recordSpawnEnqueued("ambient");
    recordSpawnOverflow(1);
    setSpawnQueueDepth(5);

    resetSpawnStats();

    const snapshot = getSpawnStatsSnapshot();
    expect(snapshot.ambientEnqueued).toBe(0);
    expect(snapshot.overflowDrops).toBe(0);
    expect(snapshot.queueDepth).toBe(0);
  });

  it("notifies subscribers after a throttled delay and stops after unsubscribe", () => {
    vi.useFakeTimers();
    try {
      let calls = 0;
      const unsubscribe = subscribeSpawnStats(() => {
        calls += 1;
      });

      recordSpawnEnqueued("ambient");
      expect(calls).toBe(0);
      vi.advanceTimersByTime(250);
      expect(calls).toBe(1);

      unsubscribe();
      recordSpawnEnqueued("ambient");
      vi.advanceTimersByTime(250);
      expect(calls).toBe(1);
    } finally {
      vi.useRealTimers();
    }
  });
});
