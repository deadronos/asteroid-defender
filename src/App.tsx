import { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { Physics } from '@react-three/rapier';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import GameScene from './components/GameScene';
import HUD from './components/HUD';
import './index.css';

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
        </EffectComposer>
      </Canvas>
    </>
  );
}

export default App;
