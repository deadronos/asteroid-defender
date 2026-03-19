import { Suspense, lazy, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { PerformanceMonitor } from '@react-three/drei';
import { Physics } from '@react-three/rapier';
import GameScene from './components/GameScene';
import HUD from './components/HUD';
import useGameStore from './store/gameStore';
import './index.css';

// Lazy-load the postprocessing pass so the heavy `postprocessing` +
// `@react-three/postprocessing` chunk is fetched after first render.
const PostEffects = lazy(() => import('./components/PostEffects'));

function App() {
  const [dpr, setDpr] = useState(1.5);
  const { gameState, sessionId } = useGameStore((state) => ({
    gameState: state.gameState,
    sessionId: state.sessionId,
  }));

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
              <GameScene key={sessionId} />
            </Physics>
          </Suspense>
          <Suspense fallback={null}>
            <PostEffects />
          </Suspense>
        </PerformanceMonitor>
      </Canvas>
    </>
  );
}

export default App;
