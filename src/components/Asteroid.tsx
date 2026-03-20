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
import { useRef, useEffect, memo } from 'react';
import { useFrame } from '@react-three/fiber';
import { RigidBody, BallCollider, RapierRigidBody } from '@react-three/rapier';
import * as THREE from 'three';
import { ECS, GameEntity, AsteroidType } from '../ecs/world';
import useGameStore from '../store/gameStore';
import { getAsteroidVisualProfile } from '../utils/asteroidVisualQuality';
import type { EffectsQuality } from '../utils/visualQuality';
import AsteroidVisual from './asteroid/AsteroidVisual';
import { activateAsteroidBody, deactivateAsteroidBody } from './asteroid/bodyLifecycle';
import { ASTEROID_CONFIGS } from './asteroid/config';

const tempVec = new THREE.Vector3();

// Pre-allocated colour scratch to avoid per-frame GC pressure in proximity glow
const _proxColor = new THREE.Color();

interface AsteroidProps {
    id: string;
    startPos: [number, number, number];
    type: AsteroidType;
    active: boolean; // Pooling: Object avoids physics/rendering workloads when inactive
    effectsQuality: EffectsQuality;
    onDestroy: (id: string, pos: [number, number, number], isHit: boolean, type: AsteroidType) => void;
}

function Asteroid({ id, startPos, type, active, effectsQuality, onDestroy }: AsteroidProps) {
    const rbRef = useRef<RapierRigidBody>(null);
    const entityRef = useRef<GameEntity | null>(null);
    const materialRef = useRef<THREE.MeshStandardMaterial>(null);
    const dangerRingMaterialRef = useRef<THREE.MeshBasicMaterial>(null);

    const prevHealthRef = useRef(0);
    const flashTimerRef = useRef(0);
    const isFirstActiveFrameRef = useRef(false);

    const cfg = ASTEROID_CONFIGS[type] || ASTEROID_CONFIGS['swarmer'];
    const visualProfile = getAsteroidVisualProfile(type, effectsQuality);

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
        }

        return () => {
            if (entityRef.current) {
                ECS.remove(entityRef.current);
            }
        };
        // Only re-trigger pooling setup when `active` alters, not when positions rapidly shift upstream.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [active, id, type, cfg.health]);

    useFrame((state, delta) => {
        if (!rbRef.current || !entityRef.current || !active) return;

        // Let the first frame pass to apply translation before moving towards center so Trail starts smooth
        if (isFirstActiveFrameRef.current) {
            isFirstActiveFrameRef.current = false;
            return;
        }

        const { gameState, reducedMotion } = useGameStore.getState();
        if (gameState !== 'playing') return;

        // Hit flash logic
        if (entityRef.current.health! < prevHealthRef.current) {
            flashTimerRef.current = 0.1;
        }
        prevHealthRef.current = entityRef.current.health!;

        if (flashTimerRef.current > 0) {
            flashTimerRef.current -= delta;
            if (materialRef.current) {
                materialRef.current.emissive.setHex(0xffffff);
                materialRef.current.emissiveIntensity = 2.0;
            }
            if (flashTimerRef.current <= 0 && materialRef.current) {
                materialRef.current.emissive.setHex(0x000000);
                materialRef.current.emissiveIntensity = 0;
            }
        }

        if (entityRef.current.health! <= 0) {
            const t = rbRef.current.translation();
            onDestroy(id, [t.x, t.y, t.z], false, type);
            return;
        }

        const translation = rbRef.current.translation();

        // Sync Rapier position to ECS for Turrets to read
        entityRef.current.position!.set(translation.x, translation.y, translation.z);

        // Move Asteroid towards the center platform (0,0,0)
        tempVec.set(translation.x, translation.y, translation.z);
        if (tempVec.lengthSq() <= 9) { // Hit the platform
            useGameStore.getState().takeDamage(cfg.damage);
            onDestroy(id, [translation.x, translation.y, translation.z], true, type);
            return;
        }

        // Proximity danger glow: pulse emissive colour as asteroid closes in on the base.
        // Quality scaling trims the more expensive animated material updates first.
        const dist = tempVec.length();
        const imminentRatio = Math.max(0, 1 - dist / 35);

        if (flashTimerRef.current <= 0 && materialRef.current) {
            if (visualProfile.showProximityGlow && imminentRatio > 0) {
                _proxColor.set(cfg.color);
                materialRef.current.emissive.copy(_proxColor);

                if (visualProfile.animateProximityGlow && !reducedMotion) {
                    const pulseSpeed = 3 + imminentRatio * 8;
                    const pulseFactor = Math.sin(state.clock.elapsedTime * pulseSpeed) * 0.5 + 0.5;
                    materialRef.current.emissiveIntensity = imminentRatio * 1.2 * pulseFactor;
                } else {
                    materialRef.current.emissiveIntensity = imminentRatio > 0.5 ? imminentRatio * 0.4 : 0;
                }
            } else {
                materialRef.current.emissive.setHex(0x000000);
                materialRef.current.emissiveIntensity = 0;
            }
        }

        // Tank-specific: pulse the outer danger ring opacity
        if (type === 'tank' && dangerRingMaterialRef.current) {
            if (!visualProfile.showTankRing) {
                dangerRingMaterialRef.current.opacity = 0;
            } else if (visualProfile.animateTankRing && !reducedMotion) {
                const ringPulse = Math.sin(state.clock.elapsedTime * (1.5 + imminentRatio * 3)) * 0.25 + 0.75;
                dangerRingMaterialRef.current.opacity = ringPulse * (0.25 + imminentRatio * 0.45);
            } else {
                dangerRingMaterialRef.current.opacity = 0.3 + imminentRatio * 0.3;
            }
        }
    });

    return (
        <RigidBody ref={rbRef} position={startPos} type="dynamic" colliders={false} gravityScale={0} friction={0} linearDamping={0}>
            <BallCollider args={[cfg.radius]} />
            {active && (
                <AsteroidVisual
                    type={type}
                    cfg={cfg}
                    visualProfile={visualProfile}
                    materialRef={materialRef}
                    dangerRingMaterialRef={dangerRingMaterialRef}
                />
            )}
        </RigidBody>
    );
}

export default memo(Asteroid);
