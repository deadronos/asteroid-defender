import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { createNebulaTexture } from './createNebulaTexture';
import { NEBULA_FRAGMENT, NEBULA_VERTEX } from './shaders';

export default function Nebula() {
    const matRef = useRef<THREE.ShaderMaterial>(null);
    const timeWrapSeconds = 1250;
    const nebulaTexture = useMemo(() => createNebulaTexture(), []);

    useEffect(() => {
        return () => {
            nebulaTexture.dispose();
        };
    }, [nebulaTexture]);

    const uniforms = useMemo(() => ({ uTime: { value: 0 }, uNebulaTex: { value: nebulaTexture } }), [nebulaTexture]);

    useFrame((_, delta) => {
        if (matRef.current) {
            matRef.current.uniforms.uTime.value = (matRef.current.uniforms.uTime.value + delta) % timeWrapSeconds;
        }
    });

    return (
        <mesh>
            <sphereGeometry args={[185, 32, 32]} />
            <shaderMaterial
                ref={matRef}
                uniforms={uniforms}
                vertexShader={NEBULA_VERTEX}
                fragmentShader={NEBULA_FRAGMENT}
                side={THREE.BackSide}
                transparent
                depthWrite={false}
            />
        </mesh>
    );
}
