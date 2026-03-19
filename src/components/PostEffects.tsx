import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { EffectComposer, Bloom, DepthOfField } from '@react-three/postprocessing';
import { DepthOfFieldEffect } from 'postprocessing';
import { MathUtils } from 'three';
import { dofSettings } from './CinematicCamera';

/**
 * Bridges the imperative dofSettings singleton (mutated by CinematicCamera on
 * each shot change) into the scene so DepthOfField interpolates smoothly
 * instead of snapping instantly to the next focus distance.
 */
function DynamicDepthOfField() {
    const dofRef = useRef<DepthOfFieldEffect>(null);

    useFrame((_, delta) => {
        if (dofRef.current) {
            // Smoothly interpolate current focus distance towards the target distance.
            // Note: We interpolate the underlying material's focusDistance property
            // directly as the library's 'target' property is reserved for Vector3
            // auto-focus targets.
            dofRef.current.cocMaterial.focusDistance = MathUtils.lerp(
                dofRef.current.cocMaterial.focusDistance,
                dofSettings.focusDistance,
                delta * 2 // Lerp speed
            );
        }
    });

    return (
        <DepthOfField
            ref={dofRef}
            focusDistance={dofSettings.focusDistance} // Initial state
            focalLength={dofSettings.focalLength}
            bokehScale={dofSettings.bokehScale}
        />
    );
}

export default function PostEffects() {
    return (
        <EffectComposer>
            <Bloom luminanceThreshold={0.2} luminanceSmoothing={0.75} intensity={3.2} mipmapBlur />
            <DynamicDepthOfField />
        </EffectComposer>
    );
}
