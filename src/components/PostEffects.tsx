import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { EffectComposer, Bloom, DepthOfField } from '@react-three/postprocessing';
import { DepthOfFieldEffect } from 'postprocessing';
import { MathUtils } from 'three';
import { dofSettings } from './cinematicCameraDof';
import type { EffectsQuality } from '../utils/visualQuality';

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
            // Update the material's focusDistance directly because the effect's
            // top-level target is reserved for Vector3 auto-focus targets.
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

interface PostEffectsProps {
    quality: EffectsQuality;
}

export default function PostEffects({ quality }: PostEffectsProps) {
    if (quality === 'off') {
        return null;
    }

    const bloomOnly = quality === 'reduced';

    return (
        <EffectComposer>
            <Bloom
                luminanceThreshold={bloomOnly ? 0.32 : 0.2}
                luminanceSmoothing={bloomOnly ? 0.82 : 0.75}
                intensity={bloomOnly ? 1.8 : 3.2}
                mipmapBlur={!bloomOnly}
            />
            {!bloomOnly && <DynamicDepthOfField />}
        </EffectComposer>
    );
}
