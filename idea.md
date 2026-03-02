# Asteroid Defender - Game Concept

## Overview
A 3D web-based defense game where the player observes automated turrets protecting a central platform from a continuous barrage of incoming asteroids. 

## Technology Stack
The game is built using a modern React-based 3D game stack:
- **Core Renderer**: `@react-three/fiber` (R3F) and `three.js`.
- **Helpers & Environment**: `@react-three/drei` (used for the starfield background and edge outlines).
- **Architecture**: `miniplex` (an Entity Component System to manage game state outside the React render loop).
- **Physics**: `@react-three/rapier` (handles object movement, colliders, and hit detection).
- **State Management**: `zustand` (for high-level UI/app state).

## Visual Style
The game utilizes a **low-poly, cel-shaded aesthetic**. Models are constructed using simple geometric primitives (cylinders, dodecahedrons, cones) accented with stark black outlines (`<Edges>`) to provide a stylized, cartoon-like appearance against the dark backdrop of space.

## Core Gameplay Loop & Entities

### 1. The Central Platform
A static, low-poly cylinder situated at the origin `(0, 0, 0)`. It serves as the primary base that needs defending.

### 2. The Turrets
Four automated turrets are affixed to the platform (two on the top surface, two on the bottom). 
- **Aiming**: Each frame, turrets calculate the distance to all active asteroids. They lock onto the nearest target and dynamically rotate (using `lookAt`) to face it.
- **Combat**: When locked on, turrets emit a red laser beam (`<Line>`) that continuously drains the target's health.

### 3. The Asteroid Swarm
Asteroids are the primary antagonists.
- **Spawning**: An automated spawner periodically generates new asteroids. They spawn at random coordinates on the surface of a large, invisible sphere surrounding the platform.
- **Movement**: Upon spawning, asteroids are given a physical velocity that propels them directly toward the central origin.
- **Destruction**: As turrets fire upon an asteroid, its health depletes. Once health reaches zero, the asteroid is destroyed and removed from the game world before it can collide with the platform.
