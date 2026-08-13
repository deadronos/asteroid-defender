import * as THREE from "three";
import { findNearestAsteroidInRange, type GameEntity } from "../../ecs/world";

export const LASER_ORIGIN_Z = 3.5;
export const TURRET_RANGE = 50;
export const TURRET_RANGE_SQ = TURRET_RANGE * TURRET_RANGE; // 2500
export const TARGETING_PENALTY = 400;

export function releaseTarget(target: GameEntity | null, turretId: string) {
  if (target?.targetedBy === turretId) {
    target.targetedBy = null;
  }
}

export function findTurretTarget(turret: THREE.Group, turretId: string): GameEntity | null {
  const turretPosition = turret.position;
  const isTopTurret = turretPosition.y > 0;

  return findNearestAsteroidInRange(turretPosition, TURRET_RANGE, (entity, distSq) => {
    const entityPosition = entity.position;
    if (!entityPosition) {
      return Infinity;
    }

    if (entityPosition.y > 0 !== isTopTurret) {
      return Infinity;
    }

    const targetedBy = entity.targetedBy;
    const penalty = targetedBy && targetedBy !== turretId ? TARGETING_PENALTY : 0;
    return distSq + penalty;
  });
}

export function applyIdleTurretRotation(
  turret: THREE.Group,
  baseRotation: THREE.Euler,
  elapsedTime: number,
  idleOffset: number,
) {
  const idleTime = elapsedTime + idleOffset;
  turret.rotation.set(
    baseRotation.x + Math.sin(idleTime * 0.6) * 0.04,
    baseRotation.y + Math.sin(idleTime * 0.35) * 0.65,
    baseRotation.z,
  );
}

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
