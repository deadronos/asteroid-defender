# Architecture Decision Record: 001 - Technology Stack

## Context

Building a real-time 3D game in the browser requires a stack that can maintain 60 frames per second while handling complex data flows (physics, input, rendering, and game logic). Traditional React state management inherently causes re-renders, which dramatically impacts the performance of a `requestAnimationFrame` based game loop.

## Decision

We elected to use the **React Three Fiber (R3F)** ecosystem coupled with an **Entity Component System (ECS)** and a **WASM-based Physics Engine**.

### Core Renderer

- **`three.js`**: WebGL abstraction for 3D mathematics and scene graph.
- **`@react-three/fiber`**: A React reconciler for Three.js. Allows us to declare the 3D scene using React components.
- **`@react-three/drei`**: Supplementary helpers for R3F (e.g., `<OrbitControls>`, `<Stars>`, `<Edges>`).

### Physics Engine

- **`@react-three/rapier`**: A React wrapper for Rapier3D, a hardware-accelerated physics engine compiled to WebAssembly.
- _Why:_ It uses Rapier compiled to WebAssembly to perform physics calculations efficiently (running on the main thread in this project). We use it to drive Asteroid velocity and handle potential entity collisions.

### Game State Management (ECS)

- **`miniplex` & `miniplex-react`**: A lightweight Entity Component System tailored for React and R3F.
- _Why:_ It detaches game logic (position tracking, health deduction, target locking) from React's render cycle. Data mutates instantly in memory without triggering expensive React component tree updates.

### High-Level UI State

- **`zustand`**: A minimal global state manager.
- _Why:_ Used strictly for high-level, low-frequency UI updates like Score and HUD indicators.

## Consequences

- **Positive:** Exceptionally high frame rates and a clean separation of concerns. Physics and Game Logic operate independently of Visual Rendering.
- **Negative:** Increased architectural complexity. Developers must carefully manage refs and query Miniplex for state instead of relying purely on React hooks.
