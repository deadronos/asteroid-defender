import {
  AMBIENT_ACTIVE_CAP,
  MAX_SPAWN_INTERVAL,
  MIN_SPAWN_INTERVAL,
  PROXIMITY_TARGET_COUNT,
  SPAWN_ADJUSTMENT,
} from "../../config/spawning";
import { clamp } from "../../utils/math";

import type { AsteroidType } from "../../ecs/world";
import { random } from "../../utils/rng";

/**
 * The ambient class mix: 50% swarmer, 25% tank, 25% splitter.
 */
export function pickAsteroidType(): AsteroidType {
  const roll = random();
  if (roll < 0.5) return "swarmer";
  if (roll < 0.75) return "tank";
  return "splitter";
}

/**
 * Proximity backpressure: when fewer than `PROXIMITY_TARGET_COUNT` asteroids
 * are within the probe radius the spawner speeds up, otherwise it slows down.
 * The result is always clamped to `[MIN_SPAWN_INTERVAL, MAX_SPAWN_INTERVAL]`.
 */
export function nextSpawnInterval(currentInterval: number, closeCount: number): number {
  if (closeCount < PROXIMITY_TARGET_COUNT) {
    return clamp(currentInterval - SPAWN_ADJUSTMENT, MIN_SPAWN_INTERVAL, MAX_SPAWN_INTERVAL);
  }

  return clamp(currentInterval + SPAWN_ADJUSTMENT, MIN_SPAWN_INTERVAL, MAX_SPAWN_INTERVAL);
}

/**
 * Whether the ambient spawner may enqueue another asteroid. Ambient spawning
 * stops at `AMBIENT_ACTIVE_CAP`, reserving the remaining pool slots for
 * splitter fragments.
 */
export function shouldEnqueueAmbient(
  activeAsteroidCount: number,
  cap: number = AMBIENT_ACTIVE_CAP,
): boolean {
  return activeAsteroidCount < cap;
}
