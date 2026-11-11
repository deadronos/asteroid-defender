import { describe, expect, it } from "vite-plus/test";
import {
  AMBIENT_ACTIVE_CAP,
  MAX_SPAWN_INTERVAL,
  MIN_SPAWN_INTERVAL,
  PROXIMITY_TARGET_COUNT,
} from "../../config/spawning";
import { seedRandom } from "../../utils/rng";
import { nextSpawnInterval, pickAsteroidType, shouldEnqueueAmbient } from "./helpers";

describe("nextSpawnInterval", () => {
  it("speeds up (shrinks) when fewer than the threshold are nearby", () => {
    expect(nextSpawnInterval(2.0, 0)).toBeCloseTo(1.8);
  });

  it("slows down (grows) when the threshold is reached", () => {
    expect(nextSpawnInterval(2.0, PROXIMITY_TARGET_COUNT)).toBeCloseTo(2.2);
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

describe("pickAsteroidType", () => {
  const rolls = (count: number) => Array.from({ length: count }, pickAsteroidType);

  it("repeats the same class sequence from the same seed", () => {
    seedRandom(7);
    const first = rolls(100);
    seedRandom(7);

    expect(rolls(100)).toEqual(first);
  });

  it("keeps the 50/25/25 class mix", () => {
    seedRandom(1);
    const types = rolls(4000);
    const share = (type: string) => types.filter((t) => t === type).length / types.length;

    expect(share("swarmer")).toBeCloseTo(0.5, 1);
    expect(share("tank")).toBeCloseTo(0.25, 1);
    expect(share("splitter")).toBeCloseTo(0.25, 1);
  });
});
