import { Suspense, useState, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Physics } from '@react-three/rapier';
import { EffectComposer, Bloom, DepthOfField } from '@react-three/postprocessing';
import GameScene from './components/GameScene';
import HUD from './components/HUD';
import { dofSettings } from './components/CinematicCamera';
import './index.css';

/**
 * Bridges the imperative dofSettings singleton (mutated by CinematicCamera on
 * each shot change) into React state so DepthOfField re-renders only when the
 * focus distance actually changes (~every 17 s), not every frame.
 */
function DynamicDepthOfField() {
  const [focusDistance, setFocusDistance] = useState(dofSettings.focusDistance);
  const lastApplied = useRef(dofSettings.focusDistance);

  useFrame(() => {
    if (dofSettings.focusDistance !== lastApplied.current) {
      lastApplied.current = dofSettings.focusDistance;
      setFocusDistance(dofSettings.focusDistance);
    }
  });

  return (
    <DepthOfField
      focusDistance={focusDistance}
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
