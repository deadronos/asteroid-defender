/**
 * Asteroid rendering strategy: per-asteroid components with physics simulation.
 *
 * Each asteroid is a pooled React component backed by a Rapier RigidBody.  Physics
 * simulation (collision, velocity) is delegated to Rapier, which gives accurate
 * hit detection and natural tumble without manual matrix math.  A fixed-size pool
 * (see ASTEROID_POOL_SIZE in config/spawning.ts) is pre-allocated at startup; inactive entries
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
import { useRef, memo } from "react";
import { useFrame } from "@react-three/fiber";
import { RigidBody, BallCollider, RapierRigidBody } from "@react-three/rapier";
import * as THREE from "three";
import { AsteroidType } from "../ecs/world";
import useGameStore from "../store/gameStore";
import { getAsteroidVisualProfile, type LoadTier } from "../utils/asteroidVisualQuality";
import type { EffectsQuality } from "../utils/visualQuality";
import AsteroidVisual from "./asteroid/AsteroidVisual";
import { ASTEROID_CONFIGS } from "./asteroid/config";
import {
  type AsteroidFrameState,
  getImminentRatio,
  syncAsteroidPosition,
  updateHitFlash,
  updateProximityGlow,
  updateTankRing,
} from "./asteroid/frameJobs";
import { useAsteroidLifecycle } from "./asteroid/useAsteroidLifecycle";

interface AsteroidProps {
  id: string;
  startPos: [number, number, number];
  type: AsteroidType;
  active: boolean; // Pooling: Object avoids physics/rendering workloads when inactive
  effectsQuality: EffectsQuality;
  loadTier: LoadTier;
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
  loadTier,
  onDestroy,
}: AsteroidProps) {
  const rbRef = useRef<RapierRigidBody>(null);
  const materialRef = useRef<THREE.MeshStandardMaterial>(null);
  const dangerRingMaterialRef = useRef<THREE.MeshBasicMaterial>(null);
  const frameState = useRef<AsteroidFrameState>({
    isFirstActiveFrame: false,
    prevHealth: 0,
    flashTimer: 0,
    // Track previously applied material values to skip redundant writes
    prevEmissiveIntensity: -1,
    prevTankRingOpacity: -1,
  });

  const cfg = ASTEROID_CONFIGS[type] || ASTEROID_CONFIGS["swarmer"];
  const visualProfile = getAsteroidVisualProfile(type, effectsQuality, loadTier);

  const entityRef = useAsteroidLifecycle({
    id,
    startPos,
    type,
    active,
    cfg,
    bodyRef: rbRef,
    materialRef,
    frameState,
  });

  // One frame callback, because job order is load-bearing: hit flash, death,
  // position sync, then the two material animations. Splitting this into several
  // useFrame callbacks would reorder them against every other subscriber.
  useFrame((state, delta) => {
    const entity = entityRef.current;
    const body = rbRef.current;
    if (!body || !entity || !active) return;

    // Let the first frame pass to apply translation before moving towards center so Trail starts smooth
    if (frameState.current.isFirstActiveFrame) {
      frameState.current.isFirstActiveFrame = false;
      return;
    }

    const { gameState, reducedMotion } = useGameStore.getState();
    if (gameState !== "playing") return;

    updateHitFlash(entity, materialRef.current, frameState.current, delta);

    if (entity.health! <= 0) {
      const t = body.translation();
      onDestroy(id, [t.x, t.y, t.z], entity.isBaseHit ?? false, type, cfg.damage);
      return;
    }

    const translation = syncAsteroidPosition(entity, body);
    const tx = translation.x;
    const ty = translation.y;
    const tz = translation.z;

    const currentMaterial = materialRef.current;
    const currentDangerRingMaterial = dangerRingMaterialRef.current;
    const shouldUpdateGlow =
      frameState.current.flashTimer <= 0 &&
      currentMaterial !== null &&
      visualProfile.showProximityGlow;
    const shouldUpdateTankRing =
      type === "tank" && currentDangerRingMaterial !== null && visualProfile.showTankRing;

    let imminentRatio = 0;
    if (shouldUpdateGlow || shouldUpdateTankRing) {
      // Base-hit detection is now handled by Rapier collision events on the
      // platform CylinderCollider (see Platform.tsx onCollisionEnter).
      imminentRatio = getImminentRatio(tx, ty, tz);
    }

    updateProximityGlow(
      currentMaterial,
      cfg.color,
      imminentRatio,
      frameState.current.flashTimer > 0,
      visualProfile,
      reducedMotion,
      state.clock.elapsedTime,
      frameState.current,
    );

    // Tank-specific: pulse the outer danger ring opacity
    updateTankRing(
      currentDangerRingMaterial,
      imminentRatio,
      visualProfile,
      reducedMotion,
      state.clock.elapsedTime,
      frameState.current,
    );
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
