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
    const [targetPos, setTargetPos] = useState<THREE.Vector3 | null>(null);
    const pulseRef = useRef(0);
    const laserMaterialRef = useRef<any>(null);
    const impactRef = useRef<THREE.Mesh>(null);
    const coreMaterialRef = useRef<THREE.MeshStandardMaterial>(null);
    const beamLightRef = useRef<THREE.PointLight>(null);
    const impactLightRef = useRef<THREE.PointLight>(null);

    useFrame(() => {
        if (!turretGroup.current) return;

        if (useGameStore.getState().gameState === 'gameover') {
            setTargetPos(null);
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
            if (targetPos && nearestEntity.position!.distanceTo(targetPos) > 0.1) {
                for (const entity of ECS.with('isAsteroid')) {
                    if (entity.targetedBy === id) entity.targetedBy = null;
                }
            }

            turretGroup.current.lookAt(nearestEntity.position!);
            setTargetPos(nearestEntity.position!.clone());
            nearestEntity.targetedBy = id;

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
            setTargetPos(null);
        }

        // Pulse Animation for Laser & Impact
        pulseRef.current += 0.5;
        const pulse = Math.sin(pulseRef.current) * 0.5 + 0.5;

        if (coreMaterialRef.current) {
            coreMaterialRef.current.emissiveIntensity = 1.6 + pulse * 1.8;
        }
        if (laserMaterialRef.current && localTarget) {
            // Pulse between 1 and 4 linewidth thickness
            laserMaterialRef.current.linewidth = 1 + pulse * 3;
        }
        if (impactRef.current && localTarget) {
            // Pulse scale between 0.8 and 1.5
            const scale = 0.8 + (Math.sin(pulseRef.current * 1.5) * 0.5 + 0.5) * 0.7;
            impactRef.current.scale.set(scale, scale, scale);
        }
        if (beamLightRef.current && localTarget) {
            beamLightRef.current.position.set(localTarget.x * 0.5, localTarget.y * 0.5, LASER_ORIGIN_Z + (localTarget.z - LASER_ORIGIN_Z) * 0.5);
            beamLightRef.current.intensity = 4 + pulse * 2.5;
        }
        if (impactLightRef.current && localTarget) {
            impactLightRef.current.intensity = 5 + pulse * 3;
        }
    });

    const localTarget = useMemo(() => {
        if (!targetPos || !turretGroup.current) return null;
        turretGroup.current.updateMatrixWorld();
        return turretGroup.current.worldToLocal(targetPos.clone());
    }, [targetPos]);

    return (
        <group position={position} rotation={rotation} ref={turretGroup}>
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

            {localTarget && (
                <>
                    <Line
                        points={[[0, 0, LASER_ORIGIN_Z], [localTarget.x, localTarget.y, localTarget.z]]}
                        color={new THREE.Color(10, 2, 2)}
                        lineWidth={3}
                        material={laserMaterialRef.current}
                    />
                    <mesh ref={impactRef} position={[localTarget.x, localTarget.y, localTarget.z]}>
                        <sphereGeometry args={[0.6, 8, 8]} />
                        <meshBasicMaterial color={new THREE.Color(10, 2, 2)} toneMapped={false} transparent opacity={0.9} />
                    </mesh>
                    <pointLight ref={beamLightRef} position={[localTarget.x * 0.5, localTarget.y * 0.5, localTarget.z * 0.5]} color="#ff4a4a" intensity={5} distance={14} decay={2} />
                    <pointLight ref={impactLightRef} position={[localTarget.x, localTarget.y, localTarget.z]} color="#ff7a5f" intensity={7} distance={10} decay={2} />
                </>
            )}
        </group>
    );
}
