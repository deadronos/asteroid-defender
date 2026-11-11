/**
 * The per-frame jobs an asteroid runs, split by what they change: physics
 * position sync, hit flash, proximity glow and the tank danger ring.
 *
 * `Asteroid.tsx` owns the single `useFrame` and calls these in a fixed order,
 * because a dying slot is only reused safely if the spawn side of a frame runs
 * before the death side. Every function takes its mutable state as an argument
 * instead of holding a ref, so it stays a plain function and allocates nothing
 * per frame.
 */
import type { RapierRigidBody } from "@react-three/rapier";
import * as THREE from "three";
import { markAsteroidDirty, type GameEntity } from "../../ecs/world";
import type { AsteroidVisualProfile } from "../../utils/asteroidVisualQuality";

// Threshold below which emissive/opacity writes are skipped to avoid material churn
export const MATERIAL_WRITE_THRESHOLD = 0.01;

// Pre-allocated colour scratch to avoid per-frame GC pressure in proximity glow
const _proxColor = new THREE.Color();

/** Mutable values the per-frame jobs carry between frames. */
export interface AsteroidFrameState {
  isFirstActiveFrame: boolean;
  lastHealthChangedAt: number;
  flashTimer: number;
  prevEmissiveIntensity: number;
  prevTankRingOpacity: number;
}

/** Sync Rapier's body position into the ECS entity turrets read. */
export function syncAsteroidPosition(entity: GameEntity, body: RapierRigidBody) {
  const translation = body.translation();
  entity.position!.set(translation.x, translation.y, translation.z);
  markAsteroidDirty();
  return translation;
}

export function getImminentRatio(x: number, y: number, z: number) {
  const distSq = x * x + y * y + z * z;
  return Math.max(0, 1 - Math.sqrt(distSq) / 35);
}

export function getProximityGlowIntensity(
  imminentRatio: number,
  animate: boolean,
  reducedMotion: boolean,
  elapsedTime: number,
) {
  if (imminentRatio <= 0) {
    return 0;
  }

  if (animate && !reducedMotion) {
    const pulseSpeed = 3 + imminentRatio * 8;
    const pulseFactor = Math.sin(elapsedTime * pulseSpeed) * 0.5 + 0.5;
    return imminentRatio * 1.2 * pulseFactor;
  }

  return imminentRatio > 0.5 ? imminentRatio * 0.4 : 0;
}

export function getTankRingOpacity(
  imminentRatio: number,
  showTankRing: boolean,
  animate: boolean,
  reducedMotion: boolean,
  elapsedTime: number,
) {
  if (!showTankRing) {
    return 0;
  }

  if (animate && !reducedMotion) {
    const ringPulse = Math.sin(elapsedTime * (1.5 + imminentRatio * 3)) * 0.25 + 0.75;
    return ringPulse * (0.25 + imminentRatio * 0.45);
  }

  return 0.3 + imminentRatio * 0.3;
}

/** Arm the white flash when turret damage arrives, then fade it out. */
export function updateHitFlash(
  entity: GameEntity,
  material: THREE.MeshStandardMaterial | null,
  frame: AsteroidFrameState,
  delta: number,
) {
  // A damage tick bumps the timestamp; watching health directly would miss
  // two ticks that land in the same frame and needs a float compare (#182).
  const changedAt = entity.healthChangedAt ?? 0;
  if (changedAt !== frame.lastHealthChangedAt) {
    frame.lastHealthChangedAt = changedAt;
    frame.flashTimer = 0.1;
  }

  if (frame.flashTimer > 0) {
    frame.flashTimer -= delta;
    if (material) {
      material.emissive.setHex(0xffffff);
      const newIntensity = 2.0;
      if (Math.abs(newIntensity - frame.prevEmissiveIntensity) > MATERIAL_WRITE_THRESHOLD) {
        material.emissiveIntensity = newIntensity;
        frame.prevEmissiveIntensity = newIntensity;
      }
    }
    if (frame.flashTimer <= 0 && material) {
      material.emissive.setHex(0x000000);
      const newIntensity = 0;
      if (Math.abs(newIntensity - frame.prevEmissiveIntensity) > MATERIAL_WRITE_THRESHOLD) {
        material.emissiveIntensity = newIntensity;
        frame.prevEmissiveIntensity = newIntensity;
      }
    }
  }
}

export function updateProximityGlow(
  material: THREE.MeshStandardMaterial | null,
  color: string,
  imminentRatio: number,
  flashing: boolean,
  profile: AsteroidVisualProfile,
  reducedMotion: boolean,
  elapsedTime: number,
  frame: AsteroidFrameState,
) {
  if (flashing || !material || !profile.showProximityGlow) {
    return;
  }

  if (imminentRatio > 0) {
    _proxColor.set(color);
    material.emissive.copy(_proxColor);
  } else {
    material.emissive.setHex(0x000000);
  }

  const newIntensity = getProximityGlowIntensity(
    imminentRatio,
    profile.animateProximityGlow,
    reducedMotion,
    elapsedTime,
  );
  if (Math.abs(newIntensity - frame.prevEmissiveIntensity) > MATERIAL_WRITE_THRESHOLD) {
    material.emissiveIntensity = newIntensity;
    frame.prevEmissiveIntensity = newIntensity;
  }
}

export function updateTankRing(
  material: THREE.MeshBasicMaterial | null,
  imminentRatio: number,
  profile: AsteroidVisualProfile,
  reducedMotion: boolean,
  elapsedTime: number,
  frame: AsteroidFrameState,
) {
  if (!material || !profile.showTankRing) {
    return;
  }

  const newOpacity = getTankRingOpacity(
    imminentRatio,
    profile.showTankRing,
    profile.animateTankRing,
    reducedMotion,
    elapsedTime,
  );
  if (Math.abs(newOpacity - frame.prevTankRingOpacity) > MATERIAL_WRITE_THRESHOLD) {
    material.opacity = newOpacity;
    frame.prevTankRingOpacity = newOpacity;
  }
}
