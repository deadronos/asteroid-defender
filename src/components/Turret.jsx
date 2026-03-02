import React, { useRef, useState, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Edges, Line } from '@react-three/drei';
import * as THREE from 'three';
import { ECS } from '../ecs/world';

export default function Turret({ id, position, rotation }) {
    const turretGroup = useRef();
    const [targetPos, setTargetPos] = useState(null);
    const pulseRef = useRef(0);
    const laserMaterialRef = useRef();
    const impactRef = useRef();

    useFrame(() => {
        if (!turretGroup.current) return;

        let nearestDist = Infinity;
        let nearestEntity = null;

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
            if (targetPos && nearestEntity.position.distanceTo(targetPos) > 0.1) {
                for (const entity of ECS.with('isAsteroid')) {
                    if (entity.targetedBy === id) entity.targetedBy = null;
                }
            }

            turretGroup.current.lookAt(nearestEntity.position);
            setTargetPos(nearestEntity.position.clone());
            nearestEntity.targetedBy = id;

            // Calculate damage falloff
            // Max distance is 50. Closer = more damage.
            // At dist 0: 5 damage per frame. At dist 50: 0.1 damage per frame.
            const maxDamage = 5;
            const minDamage = 0.1;
            // Un-penalize the distance for damage calculations if it was penalized
            const actualDist = turretGroup.current.position.distanceTo(nearestEntity.position);
            const damageVal = maxDamage - ((actualDist / 50) * (maxDamage - minDamage));

            nearestEntity.health -= damageVal;
        } else {
            // Clear our lock if no target
            for (const entity of ECS.with('isAsteroid')) {
                if (entity.targetedBy === id) entity.targetedBy = null;
            }
            setTargetPos(null);
        }

        // Pulse Animation for Laser & Impact
        pulseRef.current += 0.5;
        if (laserMaterialRef.current && localTarget) {
            // Pulse between 1 and 4 linewidth thickness
            const pulse = 1 + (Math.sin(pulseRef.current) * 0.5 + 0.5) * 3;
            laserMaterialRef.current.linewidth = pulse;
        }
        if (impactRef.current && localTarget) {
            // Pulse scale between 0.8 and 1.5
            const scale = 0.8 + (Math.sin(pulseRef.current * 1.5) * 0.5 + 0.5) * 0.7;
            impactRef.current.scale.set(scale, scale, scale);
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
            <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 3.5]}>
                <coneGeometry args={[0.8, 1, 12]} />
                <meshStandardMaterial color="#e03131" flatShading />
                <Edges scale={1} threshold={15} color="black" />
            </mesh>

            {localTarget && (
                <>
                    <Line
                        points={[[0, 0, 3.5], [localTarget.x, localTarget.y, localTarget.z]]}
                        color="#ff3333"
                        lineWidth={3}
                        material={laserMaterialRef}
                    />
                    <mesh ref={impactRef} position={[localTarget.x, localTarget.y, localTarget.z]}>
                        <sphereGeometry args={[0.6, 8, 8]} />
                        <meshBasicMaterial color="#ffaaaa" transparent opacity={0.8} />
                    </mesh>
                </>
            )}
        </group>
    );
}
