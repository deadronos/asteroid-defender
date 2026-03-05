import { Suspense, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { PerformanceMonitor } from '@react-three/drei';
import { Physics } from '@react-three/rapier';
import { EffectComposer, Bloom, DepthOfField } from '@react-three/postprocessing';
import * as THREE from 'three';
import GameScene from './components/GameScene';
import HUD from './components/HUD';
import { dofSettings } from './components/CinematicCamera';
import useGameStore from './store/gameStore';
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
  const [dpr, setDpr] = useState(1.5);
  const gameState = useGameStore((state) => state.gameState);

  return (
    <>
      <HUD />
      <Canvas camera={{ position: [0, 15, 25], fov: 60 }} dpr={dpr}>
        <PerformanceMonitor
          onIncline={() => setDpr(2)}
          onDecline={() => setDpr(1)}
          flipflops={3}
          onFallback={() => setDpr(0.5)}
        >
          <color attach="background" args={['#050510']} />
          <Suspense fallback={null}>
            <Physics paused={gameState !== 'playing'}>
              <GameScene />
            </Physics>
          </Suspense>
          <EffectComposer>
            <Bloom luminanceThreshold={0.2} luminanceSmoothing={0.75} intensity={3.2} mipmapBlur />
            <DynamicDepthOfField />
          </EffectComposer>
        </PerformanceMonitor>
      </Canvas>
    </>
  );
}

export default App;
