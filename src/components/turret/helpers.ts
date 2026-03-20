import * as THREE from 'three';
import { findNearestAsteroidInRange, type GameEntity } from '../../ecs/world';

export const LASER_ORIGIN_Z = 3.5;
export const TURRET_RANGE = 50;
export const TARGETING_PENALTY = 400;

export function releaseTarget(target: GameEntity | null, turretId: string) {
    if (target?.targetedBy === turretId) {
        target.targetedBy = null;
    }
}

export function findTurretTarget(turret: THREE.Group, turretId: string): GameEntity | null {
    const isTopTurret = turret.position.y > 0;

    return findNearestAsteroidInRange(
        turret.position,
        TURRET_RANGE,
        (entity, distSq) => {
            if (!entity.position) return Infinity;
            if ((entity.position.y > 0) !== isTopTurret) return Infinity;
            return distSq + (entity.targetedBy && entity.targetedBy !== turretId ? TARGETING_PENALTY : 0);
        }
    );
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

export function calculateTurretDamage(actualDist: number) {
    const maxDamage = 5;
    const minDamage = 0.1;
    return maxDamage - ((actualDist / TURRET_RANGE) * (maxDamage - minDamage));
}
