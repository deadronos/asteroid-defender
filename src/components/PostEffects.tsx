import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { EffectComposer, Bloom, DepthOfField } from "@react-three/postprocessing";
import { DepthOfFieldEffect } from "postprocessing";
import { MathUtils } from "three";
import useGameStore from "../store/gameStore";
import type { EffectsQuality } from "../utils/visualQuality";

const DOF_FOCAL_LENGTH = 0.025;
const DOF_BOKEH_SCALE = 3;

/**
 * Bridges the target dofFocusDistance from the store (mutated by
 * CinematicCamera on each shot change) into the scene so DepthOfField
 * interpolates smoothly instead of snapping instantly to the next focus distance.
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
        useGameStore.getState().dofFocusDistance,
        delta * 2, // Lerp speed
      );
    }
  });

  return (
    <DepthOfField
      ref={dofRef}
      focusDistance={useGameStore.getState().dofFocusDistance} // Initial state
      focalLength={DOF_FOCAL_LENGTH}
      bokehScale={DOF_BOKEH_SCALE}
    />
  );
}

interface PostEffectsProps {
  quality: EffectsQuality;
}

export default function PostEffects({ quality }: PostEffectsProps) {
  if (quality === "off") {
    return null;
  }

  const bloomOnly = quality === "reduced";

  if (bloomOnly) {
    return (
      <EffectComposer>
        <Bloom
          luminanceThreshold={0.32}
          luminanceSmoothing={0.82}
          intensity={1.8}
          mipmapBlur={false}
        />
      </EffectComposer>
    );
  }

  return (
    <EffectComposer>
      <Bloom luminanceThreshold={0.2} luminanceSmoothing={0.75} intensity={3.2} mipmapBlur />
      <DynamicDepthOfField />
    </EffectComposer>
  );
}
