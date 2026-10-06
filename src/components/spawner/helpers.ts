import { AMBIENT_ACTIVE_CAP } from "../../config/spawning";
import { clamp } from "../../utils/math";

export const INITIAL_SPAWN_INTERVAL = 2.0;
export const MIN_SPAWN_INTERVAL = 1.0;
export const MAX_SPAWN_INTERVAL = 5.0;
export const SPAWN_ADJUSTMENT = 0.2;
export const PROXIMITY_THRESHOLD = 3;

/**
 * Proximity backpressure: when fewer than `PROXIMITY_THRESHOLD` asteroids are
 * within the probe radius the spawner speeds up, otherwise it slows down. The
 * result is always clamped to `[MIN_SPAWN_INTERVAL, MAX_SPAWN_INTERVAL]`.
 */
export function nextSpawnInterval(currentInterval: number, closeCount: number): number {
  if (closeCount < PROXIMITY_THRESHOLD) {
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
