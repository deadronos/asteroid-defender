/**
 * Combat rules as plain functions: turret damage and base hits.
 *
 * These run inside frame callbacks (`Turret.tsx`, `Platform.tsx`) and need no
 * renderer, so they are tested directly in `combat.test.ts`. The frame loop
 * that orders them stays where it is.
 */
import type { GameEntity } from "../ecs/world";
import { TURRET_RANGE_SQ } from "../config/arena";

export const TURRET_MAX_DPS = 180;
export const TURRET_MIN_DPS = 10;
export const MAX_DELTA_CLAMP = 0.1;

export function calculateTurretDps(actualDistSq: number): number {
  return TURRET_MAX_DPS - (actualDistSq / TURRET_RANGE_SQ) * (TURRET_MAX_DPS - TURRET_MIN_DPS);
}

export function calculateTurretDamage(actualDistSq: number, delta: number = 1 / 60): number {
  const clampedDelta = Math.min(Math.max(delta, 0), MAX_DELTA_CLAMP);
  return calculateTurretDps(actualDistSq) * clampedDelta;
}

/** Applies one frame of turret fire to an asteroid and returns the damage dealt. */
export function applyTurretDamage(entity: GameEntity, actualDistSq: number, delta: number): number {
  const damage = calculateTurretDamage(actualDistSq, delta);
  entity.health = entity.health! - damage;
  return damage;
}

/**
 * Marks the asteroid as a base hit, once. A dead asteroid is ignored, so a
 * repeat collision cannot count as a second hit. Returns whether it marked.
 */
export function markBaseHit(entities: readonly GameEntity[], asteroidId: string): boolean {
  for (let i = 0; i < entities.length; i++) {
    const entity = entities[i];
    if (entity.id === asteroidId && entity.health! > 0) {
      entity.isBaseHit = true;
      entity.health = 0;
      return true;
    }
  }
  return false;
}
