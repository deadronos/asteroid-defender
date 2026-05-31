import { describe, expect, it } from "vite-plus/test";
import { createTelemetryStore } from "./core";

describe("createTelemetryStore", () => {
  it("records paired call and return events with durations", () => {
    let now = 100;
    const store = createTelemetryStore({
      clock: () => now,
      notifyIntervalMs: 0,
    });

    const callId = store.enter("demo");
    now = 112;
    store.exit(callId);

    const events = store.exportEvents();
    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({ type: "call", name: "demo" });
    expect(events[1]).toMatchObject({ type: "return", name: "demo", duration: 12 });
  });

  it("drops the oldest events once the buffer reaches capacity", () => {
    const store = createTelemetryStore({
      maxEvents: 2,
      notifyIntervalMs: 0,
    });

    store.mark("one");
    store.mark("two");
    store.mark("three");

    expect(store.exportEvents().map((event) => event.name)).toEqual(["two", "three"]);
    expect(store.getSnapshot().droppedEvents).toBe(1);
  });

  it("stops capturing while paused or disabled", () => {
    const store = createTelemetryStore({ notifyIntervalMs: 0 });

    store.setPaused(true);
    store.mark("paused");
    expect(store.exportEvents()).toHaveLength(0);

    store.setPaused(false);
    store.setEnabled(false);
    store.mark("disabled");
    expect(store.exportEvents()).toHaveLength(0);
  });

  it("returns a stable snapshot object until state changes", () => {
    const store = createTelemetryStore({ notifyIntervalMs: 0 });

    const firstSnapshot = store.getSnapshot();
    const secondSnapshot = store.getSnapshot();
    expect(firstSnapshot).toBe(secondSnapshot);

    store.mark("changed");
    const thirdSnapshot = store.getSnapshot();
    expect(thirdSnapshot).not.toBe(secondSnapshot);
    expect(thirdSnapshot.eventCount).toBe(1);
  });

  it("builds grouped summaries and recent signals for the overlay", () => {
    let now = 0;
    const store = createTelemetryStore({
      clock: () => now,
      notifyIntervalMs: 0,
      maxEvents: 32,
    });

    const alphaFirst = store.enter("alpha");
    now = 5;
    store.exit(alphaFirst);

    now = 8;
    const beta = store.enter("beta");
    now = 11;
    store.exit(beta);

    now = 12;
    const alphaSecond = store.enter("alpha");
    now = 22;
    store.exit(alphaSecond);

    now = 24;
    const gamma = store.enter("gamma");
    now = 25;
    store.fail(gamma, new Error("boom"));
    store.exit(gamma);

    now = 30;
    store.mark("signal:spawn", { count: 3 });

    const snapshot = store.getSnapshot();

    expect(snapshot.recentSignals.map((event) => event.name)).toEqual(["signal:spawn", "gamma"]);
    expect(snapshot.topByCallCount[0]).toMatchObject({
      name: "alpha",
      callCount: 2,
      returnCount: 2,
      totalDuration: 15,
      averageDuration: 7.5,
      maxDuration: 10,
    });
    expect(snapshot.topByTotalDuration[0].name).toBe("alpha");
    expect(snapshot.topByCallCount.find((summary) => summary.name === "gamma")?.throwCount).toBe(1);
    expect(snapshot.recentEventRate).toBe(snapshot.eventCount);
  });
});