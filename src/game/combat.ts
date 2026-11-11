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

/**
 * Applies one frame of turret fire to an asteroid, attributes it to `turretId`
 * and returns the damage actually dealt — never more health than it had left,
 * so a kill lands exactly on zero and the shot cannot be double-counted (#182).
 */
export function applyTurretDamage(
  entity: GameEntity,
  actualDistSq: number,
  delta: number,
  turretId: string,
): number {
  const remaining = entity.health ?? 0;
  const damage = Math.min(calculateTurretDamage(actualDistSq, delta), remaining);
  entity.health = remaining - damage;
  entity.lastHitBy = turretId;
  entity.healthChangedAt = performance.now();
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
      // The base killed it, not whichever turret hit it last.
      entity.lastHitBy = null;
      entity.healthChangedAt = performance.now();
      return true;
    }
  }
  return false;
}
