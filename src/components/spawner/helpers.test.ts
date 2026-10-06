import { describe, expect, it } from "vite-plus/test";
import { AMBIENT_ACTIVE_CAP } from "../../config/spawning";
import {
  MAX_SPAWN_INTERVAL,
  MIN_SPAWN_INTERVAL,
  nextSpawnInterval,
  PROXIMITY_THRESHOLD,
  shouldEnqueueAmbient,
} from "./helpers";

describe("nextSpawnInterval", () => {
  it("speeds up (shrinks) when fewer than the threshold are nearby", () => {
    expect(nextSpawnInterval(2.0, 0)).toBeCloseTo(1.8);
  });

  it("slows down (grows) when the threshold is reached", () => {
    expect(nextSpawnInterval(2.0, PROXIMITY_THRESHOLD)).toBeCloseTo(2.2);
  });

  it("never drops below the floor", () => {
    expect(nextSpawnInterval(MIN_SPAWN_INTERVAL, 0)).toBe(MIN_SPAWN_INTERVAL);
  });

  it("never rises above the ceiling", () => {
    expect(nextSpawnInterval(MAX_SPAWN_INTERVAL, 99)).toBe(MAX_SPAWN_INTERVAL);
  });
});

describe("shouldEnqueueAmbient", () => {
  it("allows ambient spawns below the cap", () => {
    expect(shouldEnqueueAmbient(AMBIENT_ACTIVE_CAP - 1)).toBe(true);
  });

  it("blocks ambient spawns at the cap", () => {
    expect(shouldEnqueueAmbient(AMBIENT_ACTIVE_CAP)).toBe(false);
  });

  it("blocks ambient spawns above the cap", () => {
    expect(shouldEnqueueAmbient(AMBIENT_ACTIVE_CAP + 5)).toBe(false);
  });
});
