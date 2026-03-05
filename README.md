# Asteroid Defender

A visually polished, 3D browser-based space defense simulation built with React Three Fiber.

## Overview
Asteroid Defender is an interactive idle clicker / automatic defense simulation where a central platform survives endless swarms of incoming space debris and asteroids. The game features an automated targeting system where four dual-barrel turrets continually scan for, track, and destroy enemy space rocks using dynamic laser beams. 

Built using modern web technologies, the game emphasizes visual fidelity with a procedurally baked nebula skybox, real-time lighting, post-processing bloom, and dynamic particle explosion effects when asteroids are shattered.

## Features
- **3D Procedural Environment**: A seamless, procedurally generated nebula texture sampled on a skybox representing deep space.
- **Automated Combat**: Turrets automatically select targets, track them, and fire lasers to defend the central platform.
- **Dynamic Spawning**: A continuous flow of different asteroid types (Basic, Fast, Heavy, Swarmer, Splitter) with varying behaviors.
- **Entity Component System**: Built on top of `miniplex` for managing game entities and logic efficiently.
- **Visual Polish**: 
  - Post-processing bloom for glowing lasers and explosions.
  - Custom shader streaks for shooting stars.
  - Fragmented particle physics for destroyed asteroids.
  - Smooth camera movements and UI overlays.

## Tech Stack
- **Framework**: [React 19](https://react.dev/)
- **3D Rendering**: [Three.js](https://threejs.org/) + [@react-three/fiber](https://docs.pmnd.rs/react-three-fiber/)
- **Utility / Helpers**: [@react-three/drei](https://github.com/pmndrs/drei)
- **Physics & Effects**: [@react-three/rapier](https://github.com/pmndrs/react-three-rapier) + [@react-three/postprocessing](https://github.com/pmndrs/react-postprocessing)
- **ECS Engine**: [miniplex](https://miniplex.dev/)
- **State Management**: [Zustand](https://zustand-demo.pmnd.rs/)
- **Build Tool**: [Vite](https://vitejs.dev/)

## Getting Started

### Prerequisites
Make sure you have [Node.js](https://nodejs.org/) installed on your machine.

### Installation & Running Locally

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the development server:
   ```bash
   npm run dev
   ```

3. Open your browser and navigate to the address shown in your terminal (usually `http://localhost:5173`).

## License
This project is licensed under the [MIT License](LICENSE.md).

## Performance Budget

These targets guide optimization work and help detect regressions.

| Metric | Target |
|---|---|
| Initial JS payload (gzip) | < 500 kB per chunk (see note), < 1.5 MB total |
| Time to Interactive (TTI) | < 5 s on a mid-range device (4× CPU throttle) |
| Gameplay frame rate | ≥ 60 FPS on a discrete GPU; ≥ 30 FPS on integrated graphics |
| Memory (heap) at steady state | < 256 MB |

> **Note on chunk size:** `vendor-rapier` (~838 kB gzip) exceeds the per-chunk cap because it contains the compiled Rust/WASM Rapier physics engine — an upstream constraint that cannot be reduced by tree-shaking. All other chunks meet the < 500 kB target.

### Bundle strategy

The build is split into six vendor chunks so browsers can cache them independently and download them in parallel:

| Chunk | Contents |
|---|---|
| `vendor-react` | `react`, `react-dom` |
| `vendor-three` | `three` |
| `vendor-r3f` | `@react-three/fiber`, `@react-three/drei` |
| `vendor-rapier` | `@react-three/rapier` |
| `vendor-postprocessing` | `@react-three/postprocessing`, `postprocessing` |
| `vendor-state` | `zustand`, `miniplex`, `miniplex-react` |

Post-processing effects (`EffectComposer`, `Bloom`, `DepthOfField`) and the cosmetic `SpaceBackground` are lazy-loaded so the core game canvas becomes interactive before those chunks finish downloading.
