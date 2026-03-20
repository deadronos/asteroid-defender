import { Suspense, lazy, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { PerformanceMonitor } from '@react-three/drei';
import { Physics } from '@react-three/rapier';
import GameScene from './components/GameScene';
import HUD from './components/HUD';
import useGameStore from './store/gameStore';
import {
  clampVisualProfile,
  degradeVisualProfile,
  fallbackVisualProfile,
  getInitialVisualProfile,
  improveVisualProfile,
} from './utils/visualQuality';
import './index.css';

// Lazy-load the postprocessing pass so the heavy `postprocessing` +
// `@react-three/postprocessing` chunk is fetched after first render.
const PostEffects = lazy(() => import('./components/PostEffects'));

function App() {
  const gameState = useGameStore((state) => state.gameState);
  const sessionId = useGameStore((state) => state.sessionId);
  const reducedMotion = useGameStore((state) => state.reducedMotion);
  const [visualProfile, setVisualProfile] = useState(() => getInitialVisualProfile(reducedMotion));
  const effectiveVisualProfile = clampVisualProfile(visualProfile, reducedMotion);

  return (
    <>
      <HUD />
      <Canvas camera={{ position: [0, 15, 25], fov: 60 }} dpr={effectiveVisualProfile.dpr}>
        <PerformanceMonitor
          onIncline={() => setVisualProfile((current) => improveVisualProfile(current, reducedMotion))}
          onDecline={() => setVisualProfile((current) => degradeVisualProfile(current, reducedMotion))}
          flipflops={3}
          onFallback={() => setVisualProfile(fallbackVisualProfile())}
        >
          <color attach="background" args={['#050510']} />
          <Suspense fallback={null}>
            <Physics paused={gameState !== 'playing'}>
              <GameScene
                key={sessionId}
                asteroidEffectsQuality={effectiveVisualProfile.effectsQuality}
                backgroundEffectsQuality={effectiveVisualProfile.effectsQuality}
                reducedMotion={reducedMotion}
              />
            </Physics>
          </Suspense>
          {effectiveVisualProfile.effectsQuality !== 'off' && (
            <Suspense fallback={null}>
              <PostEffects quality={effectiveVisualProfile.effectsQuality} />
            </Suspense>
          )}
        </PerformanceMonitor>
      </Canvas>
    </>
  );
}

export default App;
