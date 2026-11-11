import * as THREE from "three";
import { findNearestAsteroidInRange, type GameEntity } from "../../ecs/world";
import { TARGETED_DISTANCE_MULTIPLIER, TURRET_RANGE } from "../../config/arena";

export const LASER_ORIGIN_Z = 3.5;

export function releaseTarget(target: GameEntity | null, turretId: string) {
  if (target?.targetedBy === turretId) {
    target.targetedBy = null;
  }
}

export function findTurretTarget(turret: THREE.Group, turretId: string): GameEntity | null {
  const turretPosition = turret.position;
  const isTopTurret = turretPosition.y > 0;

  return findNearestAsteroidInRange(turretPosition, TURRET_RANGE, (entity, distSq) =>
    turretTargetCost(distSq, entity.position?.y, isTopTurret, entity.targetedBy ?? null, turretId),
  );
}

/**
 * Cost of a candidate target: its squared distance, scaled up when another
 * turret already holds it so this one looks elsewhere. Infinity for the other
 * hemisphere's asteroids.
 */
export function turretTargetCost(
  distSq: number,
  asteroidY: number | undefined,
  isTopTurret: boolean,
  targetedBy: string | null,
  turretId: string,
): number {
  if (asteroidY === undefined || asteroidY > 0 !== isTopTurret) {
    return Infinity;
  }

  const takenByOther = targetedBy !== null && targetedBy !== turretId;
  return takenByOther ? distSq * TARGETED_DISTANCE_MULTIPLIER : distSq;
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
