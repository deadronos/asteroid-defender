import { describe, expect, it } from "vite-plus/test";
import { PROXIMITY_PROBE_RADIUS, SPAWN_RADIUS } from "./arena";
import {
  AMBIENT_ACTIVE_CAP,
  FRAGMENT_RESERVE_SLOTS,
  INITIAL_SPAWN_INTERVAL,
  MAX_SPAWN_INTERVAL,
  MIN_SPAWN_INTERVAL,
  PROXIMITY_TARGET_COUNT,
  SPAWN_ADJUSTMENT,
} from "./spawning";

/**
 * Cross-module relationships between the arena and spawn tuning values.
 *
 * Deliberately not asserted: `SPAWN_RADIUS` vs `TURRET_RANGE`. The issue
 * proposed `SPAWN_RADIUS > TURRET_RANGE`, but it is false (40 < 50), and the
 * two distances have different origins (arena centre vs each turret), so they
 * are not meant to compare. `config/arena.ts` documents the behaviour instead.
 *
 * Also not asserted: `AMBIENT_ACTIVE_CAP === ASTEROID_POOL_SIZE -
 * FRAGMENT_RESERVE_SLOTS`, because that is the definition of the cap. The
 * assertions below guard the parts the derivation does not: a positive reserve
 * and a cap that still lets the ambient spawner run.
 */
describe("arena and spawn tuning invariants", () => {
  it("probes inside the spawn radius so the count reflects inward travel", () => {
    // At or beyond the spawn shell every asteroid would count immediately and
    // backpressure could never speed the spawner back up.
    expect(PROXIMITY_PROBE_RADIUS).toBeLessThan(SPAWN_RADIUS);
  });

  it("keeps the starting spawn interval inside the clamp range", () => {
    // The spawner starts at INITIAL and clamps every step; outside the range
    // the opening interval would snap on the first spawn decision.
    expect(MIN_SPAWN_INTERVAL).toBeLessThan(INITIAL_SPAWN_INTERVAL);
    expect(INITIAL_SPAWN_INTERVAL).toBeLessThan(MAX_SPAWN_INTERVAL);
  });

  it("moves the spawn interval by a positive step", () => {
    // A zero or negative step freezes backpressure or reverses it.
    expect(SPAWN_ADJUSTMENT).toBeGreaterThan(0);
  });

  it("treats at least one nearby asteroid as crowding", () => {
    // The speed-up branch is `closeCount < threshold`, so a threshold of 0 is
    // never reached and the spawner would only ever slow down.
    expect(PROXIMITY_TARGET_COUNT).toBeGreaterThanOrEqual(1);
  });

  it("reserves pool slots without starving ambient spawns", () => {
    // AMBIENT_ACTIVE_CAP is derived as pool size minus this reserve.
    expect(FRAGMENT_RESERVE_SLOTS).toBeGreaterThan(0);
    expect(AMBIENT_ACTIVE_CAP).toBeGreaterThan(0);
  });
});
