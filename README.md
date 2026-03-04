# Asteroid Defender

A visually polished, 3D browser-based space defense simulation built with React Three Fiber.

## Overview
Asteroid Defender is an interactive idle clicker / automatic defense simulation where a central platform survives endless swarms of incoming space debris and asteroids. The game features an automated targeting system where four dual-barrel turrets continually scan for, track, and destroy enemy space rocks using dynamic laser beams. 

Built using modern web technologies, the game emphasizes visual fidelity with a procedural 3D nebula skybox, real-time lighting, post-processing bloom, and dynamic particle explosion effects when asteroids are shattered.

## Features
- **3D Procedural Environment**: A seamless, procedurally generated 3D noise skybox representing a deep space nebula.
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
