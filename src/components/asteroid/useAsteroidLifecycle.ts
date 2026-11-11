/**
 * An asteroid's pooling lifecycle: the ECS entity, the Rapier body and the
 * `userData` the platform's collision handler reads. All of it is one effect
 * keyed on `active`, because a slot is only ever reused after both halves of
 * the swap have run.
 */
import { useEffect, useRef, type RefObject } from "react";
import type { RapierRigidBody } from "@react-three/rapier";
import * as THREE from "three";
import { ECS, type AsteroidType, type GameEntity } from "../../ecs/world";
import { activateAsteroidBody, deactivateAsteroidBody } from "./bodyLifecycle";
import type { AsteroidConfig } from "./config";
import type { AsteroidFrameState } from "./frameJobs";

interface AsteroidUserData {
  asteroidId?: string;
  asteroidType?: AsteroidType;
  asteroidDamage?: number;
}

interface AsteroidLifecycleParams {
  id: string;
  startPos: [number, number, number];
  type: AsteroidType;
  active: boolean;
  cfg: AsteroidConfig;
  bodyRef: RefObject<RapierRigidBody | null>;
  materialRef: RefObject<THREE.MeshStandardMaterial | null>;
  frameState: RefObject<AsteroidFrameState>;
}

export function useAsteroidLifecycle({
  id,
  startPos,
  type,
  active,
  cfg,
  bodyRef,
  materialRef,
  frameState,
}: AsteroidLifecycleParams) {
  const entityRef = useRef<GameEntity | null>(null);

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
      activateAsteroidBody(bodyRef.current, startPos, cfg.speed);
      frameState.current.lastHealthChangedAt = entityRef.current?.healthChangedAt ?? 0;
      frameState.current.flashTimer = 0;
      frameState.current.isFirstActiveFrame = true;

      // Tag the Rapier body so the Platform collision handler can identify this asteroid
      if (bodyRef.current) {
        (bodyRef.current.userData as AsteroidUserData) = {
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
      deactivateAsteroidBody(bodyRef.current);
      if (materialRef.current) {
        materialRef.current.emissive.setHex(0x000000);
        materialRef.current.emissiveIntensity = 0;
      }
      // Clear userData so deactivated bodies aren't mistaken for live asteroids
      if (bodyRef.current) {
        (bodyRef.current.userData as AsteroidUserData) = {};
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

  return entityRef;
}
