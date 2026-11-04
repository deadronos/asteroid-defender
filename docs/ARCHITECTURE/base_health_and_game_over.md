# Base Health & Game Over State Architecture

Reviewed: 2026-11-04 @ 855355f

## Overview

Asteroids that reach the central platform deal damage to it. Once platform health is depleted, the game transitions to a Game Over state and pauses the simulation.

## Components

### 1. Store (`src/store/gameStore.ts`)

- `health` and `maxHealth` track platform integrity.
- `gameState` distinguishes `'menu'`, `'playing'`, `'paused'` and `'gameover'`.
- `takeDamage(amount)` deducts health and switches to `'gameover'` when health reaches 0.
- `startGame()`, `restartGame()` and `resetGame()` create a fresh run, incrementing `sessionId` and resetting health, score and run timing.

### 2. Collision & Damage Logic (`src/components/Platform.tsx`, `src/components/gameScene/AsteroidLayer.tsx`)

- The platform is a fixed Rapier body with a `CylinderCollider`. Its `onCollisionEnter` handler reads the `asteroidId` from the other body's `userData`, finds the matching ECS entity, and sets `isBaseHit = true` and `health = 0`.
- `Asteroid.tsx` no longer checks its distance to the origin. It calls `onDestroy` when its ECS health reaches 0, whether from turret damage or a platform collision.
- `handleDestroy` in `AsteroidLayer.tsx` applies `takeDamage(damage)` for base hits. Damage comes from the asteroid class config: 5 for `swarmer`, 10 for `splitter` and 30 for `tank`.

### 3. Destruction Handling (`src/components/gameScene/AsteroidLayer.tsx`)

- `handleDestroy(id, pos, isHit, type, damage)` deactivates the pooled asteroid slot and triggers an explosion at the impact position.
- The score (`asteroidsDestroyed`) is only incremented when `isHit === false`, i.e. when a turret destroyed the asteroid rather than the base collision.
- Base hits deduct health and emit a shield-impact effect; both cases spawn an explosion.
- A `splitter` destroyed by a turret also enqueues two `swarmer` fragments through the shared spawn queue.

### 4. Game Pause Hooks (`src/App.tsx`, `src/components/AsteroidSpawner.tsx`, `src/components/Turret.tsx`)

- `App.tsx` mounts the physics world with `<Physics paused={gameState !== "playing"}>`, so Rapier stops simulating outside active play. Bodies are not manually zeroed on game over.
- `AsteroidSpawner` and `Turret` `useFrame` loops return early when `gameState !== 'playing'`, so no new asteroids spawn and turrets release their targets.
- `Asteroid.tsx` likewise skips its movement and visual updates outside active play.

### 5. UI Layer (`src/components/hud/HUDStats.tsx`, `src/components/hud/GameOverOverlay.tsx`)

- `HUDStats` renders the `Base Integrity` bar from `health` and `maxHealth`.
- `GameOverOverlay` appears when `gameState === 'gameover'` and shows "BASE DESTROYED", the number of asteroids destroyed, the time survived, and a "Restart Protocol" button.
- The restart button calls `restartGame()`, which resets health, score and session state. The new `sessionId` resets the asteroid pool and spawn queue without a full page reload.
