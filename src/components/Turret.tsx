import { useRef, useState, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Edges, Line } from '@react-three/drei';
import * as THREE from 'three';
import { ECS, GameEntity } from '../ecs/world';
import useGameStore from '../store/gameStore';

interface TurretProps {
    id: string;
    position: [number, number, number];
    rotation: [number, number, number];
}

const LASER_ORIGIN_Z = 3.5;

export default function Turret({ id, position, rotation }: TurretProps) {
    const turretGroup = useRef<THREE.Group>(null);
    const [hasTarget, setHasTarget] = useState(false);
    const baseRotation = useMemo(() => new THREE.Euler(rotation[0], rotation[1], rotation[2]), [rotation]);
    const idleOffsetRef = useRef(Math.random() * Math.PI * 2);
    const nextRecalibrationRef = useRef(6 + Math.random() * 5);
    const recalibrationStartRef = useRef<number | null>(null);
    const pulseRef = useRef(0);
    const laserMaterialRef = useRef<any>(null);
    const impactRef = useRef<THREE.Mesh>(null);
    const coreMaterialRef = useRef<THREE.MeshStandardMaterial>(null);
    const beamLightRef = useRef<THREE.PointLight>(null);
    const impactLightRef = useRef<THREE.PointLight>(null);
    const lineRef = useRef<any>(null);
    const barrelGroupRef = useRef<THREE.Group>(null);

    // Keep vectors around instead of full React states to avoid unneeded renders
    const targetPosRef = useRef(new THREE.Vector3());
    const localTargetRef = useRef(new THREE.Vector3());

    useFrame((state) => {
        if (!turretGroup.current) return;

        if (useGameStore.getState().gameState === 'gameover') {
            if (hasTarget) setHasTarget(false);
            return;
        }

        let nearestDist = Infinity;
        let nearestEntity: GameEntity | null = null;

        for (const entity of ECS.with('isAsteroid')) {
            if (entity.position) {
                const isTopTurret = turretGroup.current.position.y > 0;
                const isTopAsteroid = entity.position.y > 0;

                if (isTopTurret === isTopAsteroid) {
                    let dist = turretGroup.current.position.distanceTo(entity.position);

                    // Artificially inflate the distance if this asteroid is already targeted by ANOTHER turret
                    // This encourages turrets to pick unique targets if there is more than 1 in range
                    if (entity.targetedBy && entity.targetedBy !== id) {
                        dist += 20; // 20 units penalty
                    }

                    if (dist < nearestDist && dist < 50) {
                        nearestDist = dist;
                        nearestEntity = entity;
                    }
                }
            }
        }

        if (nearestEntity) {
            // Un-mark previous target if we switched
            if (hasTarget && nearestEntity.position!.distanceTo(targetPosRef.current) > 0.1) {
                for (const entity of ECS.with('isAsteroid')) {
                    if (entity.targetedBy === id) entity.targetedBy = null;
                }
            }

            turretGroup.current.lookAt(nearestEntity.position!);
            targetPosRef.current.copy(nearestEntity.position!);

            // Calculate and maintain localTarget reference since the meshes are nested 
            turretGroup.current.updateMatrixWorld();
            const worldToLocal = turretGroup.current.worldToLocal(targetPosRef.current.clone());
            localTargetRef.current.copy(worldToLocal);

            nearestEntity.targetedBy = id;

            if (!hasTarget) setHasTarget(true);
            recalibrationStartRef.current = null;
            if (barrelGroupRef.current) barrelGroupRef.current.rotation.set(0, 0, 0);

            // Calculate damage falloff
            // Max distance is 50. Closer = more damage.
            // At dist 0: 5 damage per frame. At dist 50: 0.1 damage per frame.
            const maxDamage = 5;
            const minDamage = 0.1;
            // Un-penalize the distance for damage calculations if it was penalized
            const actualDist = turretGroup.current.position.distanceTo(nearestEntity.position!);
            const damageVal = maxDamage - ((actualDist / 50) * (maxDamage - minDamage));

            nearestEntity.health! -= damageVal;
        } else {
            // Clear our lock if no target
            for (const entity of ECS.with('isAsteroid')) {
                if (entity.targetedBy === id) entity.targetedBy = null;
            }
            if (hasTarget) setHasTarget(false);

            const idleTime = state.clock.elapsedTime + idleOffsetRef.current;
            turretGroup.current.rotation.set(
                baseRotation.x + Math.sin(idleTime * 0.6) * 0.04,
                baseRotation.y + Math.sin(idleTime * 0.35) * 0.65,
                baseRotation.z
            );

            if (state.clock.elapsedTime >= nextRecalibrationRef.current && recalibrationStartRef.current === null) {
                recalibrationStartRef.current = state.clock.elapsedTime;
                nextRecalibrationRef.current = state.clock.elapsedTime + 8 + Math.random() * 6;
            }

            if (recalibrationStartRef.current !== null && barrelGroupRef.current) {
                const progress = Math.min((state.clock.elapsedTime - recalibrationStartRef.current) / 1.2, 1);
                const raise = Math.sin(progress * Math.PI) * 0.35;
                barrelGroupRef.current.rotation.set(-raise, 0, progress * Math.PI * 7);
                if (progress >= 1) {
                    recalibrationStartRef.current = null;
                    barrelGroupRef.current.rotation.set(0, 0, 0);
                }
            }
        }

        // Pulse Animation for Laser & Impact
        pulseRef.current += 0.5;
        const pulse = Math.sin(pulseRef.current) * 0.5 + 0.5;

        if (coreMaterialRef.current) {
            coreMaterialRef.current.emissiveIntensity = 1.6 + pulse * 1.8;
        }

        if (!hasTarget) return;

        if (laserMaterialRef.current) {
            // Pulse between 1 and 4 linewidth thickness
            laserMaterialRef.current.linewidth = 1 + pulse * 3;
        }

        if (lineRef.current) {
            lineRef.current.geometry.setPositions([
                0, 0, LASER_ORIGIN_Z,
                localTargetRef.current.x, localTargetRef.current.y, localTargetRef.current.z
            ]);
        }

        if (impactRef.current) {
            // Pulse scale between 0.8 and 1.5
            const scale = 0.8 + (Math.sin(pulseRef.current * 1.5) * 0.5 + 0.5) * 0.7;
            impactRef.current.scale.set(scale, scale, scale);
            impactRef.current.position.copy(localTargetRef.current);
        }
        if (beamLightRef.current) {
            beamLightRef.current.position.set(localTargetRef.current.x * 0.5, localTargetRef.current.y * 0.5, LASER_ORIGIN_Z + (localTargetRef.current.z - LASER_ORIGIN_Z) * 0.5);
            beamLightRef.current.intensity = 4 + pulse * 2.5;
        }
        if (impactLightRef.current) {
            impactLightRef.current.position.copy(localTargetRef.current);
            impactLightRef.current.intensity = 5 + pulse * 3;
        }
    });

    return (
        <group position={position} rotation={rotation} ref={turretGroup}>
            <group ref={barrelGroupRef}>
                <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 1.5]}>
                    <cylinderGeometry args={[0.8, 0.8, 3, 12]} />
                    <meshStandardMaterial color="#888c8d" flatShading />
                    <Edges scale={1} threshold={15} color="black" />
                </mesh>
                <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, LASER_ORIGIN_Z]}>
                    <coneGeometry args={[0.8, 1, 12]} />
                    <meshStandardMaterial ref={coreMaterialRef} color="#e03131" emissive="#ff4040" emissiveIntensity={2.2} flatShading />
                    <Edges scale={1} threshold={15} color="black" />
                </mesh>
                <mesh position={[0, 0, 3.9]}>
                    <sphereGeometry args={[0.22, 10, 10]} />
                    <meshBasicMaterial color={new THREE.Color(10, 2, 2)} toneMapped={false} />
                </mesh>
            </group>

            {hasTarget && (
                <>
                    <Line
                        ref={lineRef}
                        points={[[0, 0, LASER_ORIGIN_Z], [0, 0, LASER_ORIGIN_Z]]} // Initialized coords, replaced in useFrame
                        color={new THREE.Color(10, 2, 2)}
                        lineWidth={3}
                        material={laserMaterialRef.current}
                    />
                    <mesh ref={impactRef} position={[0, 0, 0]}>
                        <sphereGeometry args={[0.6, 8, 8]} />
                        <meshBasicMaterial color={new THREE.Color(10, 2, 2)} toneMapped={false} transparent opacity={0.9} />
                    </mesh>
                    <pointLight ref={beamLightRef} position={[0, 0, 0]} color="#ff4a4a" intensity={5} distance={14} decay={2} />
                    <pointLight ref={impactLightRef} position={[0, 0, 0]} color="#ff7a5f" intensity={7} distance={10} decay={2} />
                </>
            )}
        </group>
    );
}
