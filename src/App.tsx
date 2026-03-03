import { Suspense, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Physics } from '@react-three/rapier';
import { EffectComposer, Bloom, DepthOfField } from '@react-three/postprocessing';
import * as THREE from 'three';
import GameScene from './components/GameScene';
import HUD from './components/HUD';
import { dofSettings } from './components/CinematicCamera';
import './index.css';

/**
 * Bridges the imperative dofSettings singleton (mutated by CinematicCamera on
 * each shot change) into the scene so DepthOfField interpolates smoothly
 * instead of snapping instantly to the next focus distance.
 */
function DynamicDepthOfField() {
  const dofRef = useRef<any>(null);

  useFrame((_, delta) => {
    if (dofRef.current) {
      // Smoothly interpolate current focus distance towards the target distance
      dofRef.current.target = THREE.MathUtils.lerp(
        dofRef.current.target,
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

function App() {
  return (
    <>
      <HUD />
      <Canvas camera={{ position: [0, 15, 25], fov: 60 }}>
        <color attach="background" args={['#050510']} />
        <Suspense fallback={null}>
          <Physics>
            <GameScene />
          </Physics>
        </Suspense>
        <EffectComposer>
          <Bloom luminanceThreshold={1.0} luminanceSmoothing={0.9} intensity={2.0} />
          <DynamicDepthOfField />
        </EffectComposer>
      </Canvas>
    </>
  );
}

export default App;
