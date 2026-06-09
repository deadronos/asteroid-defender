/**
 * Asteroid rendering strategy: per-asteroid components with physics simulation.
 *
 * Each asteroid is a pooled React component backed by a Rapier RigidBody.  Physics
 * simulation (collision, velocity) is delegated to Rapier, which gives accurate
 * hit detection and natural tumble without manual matrix math.  A fixed-size pool
 * (see POOL_SIZE in GameScene.tsx) is pre-allocated at startup; inactive entries
 * are parked far off-screen so they incur no physics cost.
 *
 * Trade-offs vs. a GPU-instanced approach:
 *  - Per-component overhead is higher at extreme asteroid counts (500+), but the
 *    current design targets ≤ 60 simultaneous asteroids where per-component cost
 *    is negligible and Rapier physics are essential for turret targeting via ECS.
 *  - Visual quality benefits (Trail, Edges, per-asteroid hit-flash) would be
 *    impossible with pure instancing.
 *
 * If future waves require hundreds of simultaneous asteroids, consider a hybrid
 * where nearby / targeted asteroids keep this path and distant background debris
 * uses instanced meshes without physics.
 */
import { useRef, useEffect, memo } from "react";
import { useFrame } from "@react-three/fiber";
import { RigidBody, BallCollider, RapierRigidBody } from "@react-three/rapier";
import * as THREE from "three";
import { ECS, GameEntity, AsteroidType, markAsteroidDirty } from "../ecs/world";
import useGameStore from "../store/gameStore";
import { getAsteroidVisualProfile } from "../utils/asteroidVisualQuality";
import type { EffectsQuality } from "../utils/visualQuality";
import AsteroidVisual from "./asteroid/AsteroidVisual";
import { activateAsteroidBody, deactivateAsteroidBody } from "./asteroid/bodyLifecycle";
import { ASTEROID_CONFIGS } from "./asteroid/config";

interface AsteroidUserData {
  asteroidId?: string;
  asteroidType?: AsteroidType;
  asteroidDamage?: number;
}

// Threshold below which emissive/opacity writes are skipped to avoid material churn
const MATERIAL_WRITE_THRESHOLD = 0.01;

// Pre-allocated colour scratch to avoid per-frame GC pressure in proximity glow
const _proxColor = new THREE.Color();

interface AsteroidProps {
  id: string;
  startPos: [number, number, number];
  type: AsteroidType;
  active: boolean; // Pooling: Object avoids physics/rendering workloads when inactive
  effectsQuality: EffectsQuality;
  activeAsteroidCount: number;
  onDestroy: (
    id: string,
    pos: [number, number, number],
    isHit: boolean,
    type: AsteroidType,
    damage: number,
  ) => void;
}

function Asteroid({
  id,
  startPos,
  type,
  active,
  effectsQuality,
  activeAsteroidCount,
  onDestroy,
}: AsteroidProps) {
  const rbRef = useRef<RapierRigidBody>(null);
  const entityRef = useRef<GameEntity | null>(null);
  const materialRef = useRef<THREE.MeshStandardMaterial>(null);
  const dangerRingMaterialRef = useRef<THREE.MeshBasicMaterial>(null);

  const prevHealthRef = useRef(0);
  const flashTimerRef = useRef(0);
  const isFirstActiveFrameRef = useRef(false);

  // Track previously applied material values to skip redundant writes
  const prevEmissiveIntensityRef = useRef(-1);
  const prevTankRingOpacityRef = useRef(-1);

  const cfg = ASTEROID_CONFIGS[type] || ASTEROID_CONFIGS["swarmer"];
  const visualProfile = getAsteroidVisualProfile(type, effectsQuality, activeAsteroidCount);

  useEffect(() => {
    if (active) {
      const entity = ECS.add({
        id,
        isAsteroid: true,
        position: new THREE.Vector3(...startPos),
        health: cfg.health,
        asteroidType: type,
      });
      entityRef.current = entity;

      // Re-teleport and reset velocity when pulled from pool
      activateAsteroidBody(rbRef.current, startPos, cfg.speed);
      prevHealthRef.current = cfg.health;
      flashTimerRef.current = 0;
      isFirstActiveFrameRef.current = true;

      // Tag the Rapier body so the Platform collision handler can identify this asteroid
      if (rbRef.current) {
        (rbRef.current.userData as AsteroidUserData) = {
          asteroidId: id,
          asteroidType: type,
          asteroidDamage: cfg.damage,
        };
      }
    } else {
      // Un-pool into storage
      if (entityRef.current) {
        ECS.remove(entityRef.current);
        entityRef.current = null;
      }
      deactivateAsteroidBody(rbRef.current);
      if (materialRef.current) {
        materialRef.current.emissive.setHex(0x000000);
        materialRef.current.emissiveIntensity = 0;
      }
      // Clear userData so deactivated bodies aren't mistaken for live asteroids
      if (rbRef.current) {
        (rbRef.current.userData as AsteroidUserData) = {};
      }
    }

    return () => {
      if (entityRef.current) {
        ECS.remove(entityRef.current);
      }
    };
    // Only re-trigger pooling setup when `active` alters, not when positions rapidly shift upstream.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [active, id, type, cfg.health]);

  useFrame((state, delta) => {
    if (!rbRef.current || !entityRef.current || !active) return;

    // Let the first frame pass to apply translation before moving towards center so Trail starts smooth
    if (isFirstActiveFrameRef.current) {
      isFirstActiveFrameRef.current = false;
      return;
    }

    const { gameState, reducedMotion } = useGameStore.getState();
    if (gameState !== "playing") return;

    // Hit flash logic
    if (entityRef.current.health! < prevHealthRef.current) {
      flashTimerRef.current = 0.1;
    }
    prevHealthRef.current = entityRef.current.health!;

    const material = materialRef.current;

    if (flashTimerRef.current > 0) {
      flashTimerRef.current -= delta;
      if (material) {
        material.emissive.setHex(0xffffff);
        const newIntensity = 2.0;
        if (Math.abs(newIntensity - prevEmissiveIntensityRef.current) > MATERIAL_WRITE_THRESHOLD) {
          material.emissiveIntensity = newIntensity;
          prevEmissiveIntensityRef.current = newIntensity;
        }
      }
      if (flashTimerRef.current <= 0 && material) {
        material.emissive.setHex(0x000000);
        const newIntensity = 0;
        if (Math.abs(newIntensity - prevEmissiveIntensityRef.current) > MATERIAL_WRITE_THRESHOLD) {
          material.emissiveIntensity = newIntensity;
          prevEmissiveIntensityRef.current = newIntensity;
        }
      }
    }

    if (entityRef.current.health! <= 0) {
      const t = rbRef.current.translation();
      onDestroy(id, [t.x, t.y, t.z], entityRef.current.isBaseHit ?? false, type, cfg.damage);
      return;
    }

    const translation = rbRef.current.translation();
    const tx = translation.x;
    const ty = translation.y;
    const tz = translation.z;

    // Sync Rapier position to ECS for Turrets to read
    entityRef.current.position!.set(tx, ty, tz);
    markAsteroidDirty();

    const currentMaterial = materialRef.current;
    const currentDangerRingMaterial = dangerRingMaterialRef.current;
    const shouldUpdateGlow =
      flashTimerRef.current <= 0 && currentMaterial !== null && visualProfile.showProximityGlow;
    const shouldUpdateTankRing =
      type === "tank" && currentDangerRingMaterial !== null && visualProfile.showTankRing;

    let imminentRatio = 0;
    if (shouldUpdateGlow || shouldUpdateTankRing) {
      // Base-hit detection is now handled by Rapier collision events on the
      // platform CylinderCollider (see Platform.tsx onCollisionEnter).
      const distSq = tx * tx + ty * ty + tz * tz;
      const dist = Math.sqrt(distSq);
      imminentRatio = Math.max(0, 1 - dist / 35);
    }

    if (shouldUpdateGlow) {
      const material = currentMaterial;
      if (!material) return;

      let newIntensity = 0;
      const animateProximityGlow = visualProfile.animateProximityGlow;
      if (imminentRatio > 0) {
        _proxColor.set(cfg.color);
        material.emissive.copy(_proxColor);

        if (animateProximityGlow && !reducedMotion) {
          const pulseSpeed = 3 + imminentRatio * 8;
          const pulseFactor = Math.sin(state.clock.elapsedTime * pulseSpeed) * 0.5 + 0.5;
          newIntensity = imminentRatio * 1.2 * pulseFactor;
        } else {
          newIntensity = imminentRatio > 0.5 ? imminentRatio * 0.4 : 0;
        }
      } else {
        material.emissive.setHex(0x000000);
      }
      if (Math.abs(newIntensity - prevEmissiveIntensityRef.current) > MATERIAL_WRITE_THRESHOLD) {
        material.emissiveIntensity = newIntensity;
        prevEmissiveIntensityRef.current = newIntensity;
      }
    }

    // Tank-specific: pulse the outer danger ring opacity
    if (shouldUpdateTankRing) {
      const dangerRingMaterial = currentDangerRingMaterial;
      if (!dangerRingMaterial) return;

      let newOpacity = 0;
      const showTankRing = visualProfile.showTankRing;
      const animateTankRing = visualProfile.animateTankRing;
      if (!showTankRing) {
        newOpacity = 0;
      } else if (animateTankRing && !reducedMotion) {
        const ringPulse =
          Math.sin(state.clock.elapsedTime * (1.5 + imminentRatio * 3)) * 0.25 + 0.75;
        newOpacity = ringPulse * (0.25 + imminentRatio * 0.45);
      } else {
        newOpacity = 0.3 + imminentRatio * 0.3;
      }
      if (Math.abs(newOpacity - prevTankRingOpacityRef.current) > MATERIAL_WRITE_THRESHOLD) {
        dangerRingMaterial.opacity = newOpacity;
        prevTankRingOpacityRef.current = newOpacity;
      }
    }
  });

  return (
    <RigidBody
      ref={rbRef}
      position={startPos}
      type="dynamic"
      colliders={false}
      gravityScale={0}
      friction={0}
      linearDamping={0}
    >
      <BallCollider args={[cfg.radius]} />
      <group visible={active}>
        <AsteroidVisual
          type={type}
          cfg={cfg}
          visualProfile={visualProfile}
          materialRef={materialRef}
          dangerRingMaterialRef={dangerRingMaterialRef}
          active={active}
        />
      </group>
    </RigidBody>
  );
}

export default memo(Asteroid);
