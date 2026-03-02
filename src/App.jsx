import React, { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { Physics } from '@react-three/rapier';
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
      </Canvas>
    </>
  );
}

export default App;
