import { RigidBody, CylinderCollider } from '@react-three/rapier';
import { Edges } from '@react-three/drei';
import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export default function Platform() {
    const stripMaterialRef = useRef<THREE.MeshStandardMaterial>(null);
    const rotatedStripMaterialRef = useRef<THREE.MeshStandardMaterial>(null);
    const coreMaterialRef = useRef<THREE.MeshStandardMaterial>(null);
    const beaconGroupRef = useRef<THREE.Group>(null);

    useFrame((state) => {
        const pulse = Math.sin(state.clock.elapsedTime * 0.8) * 0.5 + 0.5;
        if (stripMaterialRef.current) stripMaterialRef.current.emissiveIntensity = 0.8 + pulse * 1.4;
        if (rotatedStripMaterialRef.current) rotatedStripMaterialRef.current.emissiveIntensity = 0.8 + pulse * 1.4;
        if (coreMaterialRef.current) coreMaterialRef.current.emissiveIntensity = 1.5 + pulse * 2.5;
        if (beaconGroupRef.current) beaconGroupRef.current.rotation.y = state.clock.elapsedTime * 0.5;
    });

    return (
        <RigidBody type="fixed" colliders={false}>
            <CylinderCollider args={[1, 12]} />
            <group>
                <mesh receiveShadow>
                    <cylinderGeometry args={[12, 12, 2, 16]} />
                    <meshStandardMaterial color="#888c8d" flatShading />
                    {/* Outlines overlay for the stylized look */}
                    <Edges scale={1} threshold={15} color="black" />
                </mesh>
                <group position={[0, 1.05, 0]}>
                    <mesh rotation={[0, 0, 0]}>
                        <boxGeometry args={[18, 0.1, 0.35]} />
                        <meshStandardMaterial ref={stripMaterialRef} color="#7aa2ff" emissive="#4f7cff" emissiveIntensity={1.4} />
                    </mesh>
                    <mesh rotation={[0, Math.PI / 2, 0]}>
                        <boxGeometry args={[18, 0.1, 0.35]} />
                        <meshStandardMaterial ref={rotatedStripMaterialRef} color="#7aa2ff" emissive="#4f7cff" emissiveIntensity={1.4} />
                    </mesh>
                    <mesh>
                        <cylinderGeometry args={[1.6, 1.6, 0.22, 16]} />
                        <meshStandardMaterial ref={coreMaterialRef} color="#8a3ffc" emissive="#8a3ffc" emissiveIntensity={2} />
                    </mesh>
                    <group ref={beaconGroupRef}>
                        <pointLight position={[6, 0.4, 0]} color="#ff9f43" intensity={1.8} distance={10} decay={2} />
                        <pointLight position={[-6, 0.4, 0]} color="#ff9f43" intensity={1.8} distance={10} decay={2} />
                    </group>
                </group>
            </group>
        </RigidBody>
    );
}
