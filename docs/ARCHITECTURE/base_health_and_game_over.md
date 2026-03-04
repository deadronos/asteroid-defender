# Base Health & Game Over State Architecture

## Overview
The application was modified to introduce a lose condition where asteroids that reach the central platform deal damage to it. Once platform health is depleted, the game transitions to a Game Over state and freezes the simulation.

## Components Modified

### 1. Store (`gameStore.js`)
- Introduced `health` and `maxHealth` to track platform integrity.
- Introduced `gameState` to distinguish between `'playing'` and `'gameover'` modes.
- Added `takeDamage(amount)` action that deducts health and triggers the `'gameover'` state if health reaches 0.
- Added `resetGame()` action.

### 2. Collision & Damage Logic (`Asteroid.jsx`)
- Modifed the movement logic inside `useFrame`.
- Asteroids continuously compute their distance to the origin `(0,0,0)`. If `currentPos.length() <= 3` (simulating hitting the platform collider), the asteroid is destroyed, triggering the explosion UI and deducting 10 health from the base via the `useGameStore`.
- During `'gameover'` state, the rigid bodies are frozen by setting `linvel` and `angvel` to zero.

### 3. Destruction Handling (`GameScene.jsx`)
- Modified `handleDestroy` to take an `isBaseHit` boolean to differentiate between asteroids destroyed by turrets vs. asteroids destroyed by impact.
- The score (`asteroidsDestroyed`) is only incremented if `isBaseHit === false` (i.e. if the asteroid was destroyed by a turret and not by colliding with the base).
- Both cases spawn an `Explosion` component at the impact site.

### 4. Game Pause Hooks (`AsteroidSpawner.jsx`, `Turret.jsx`)
- `useFrame` loops now check for `gameState === 'gameover'`.
- If true, `AsteroidSpawner` stops spawning new entities.
- Turrets stop looking for targets and clear their `targetPos`.

### 5. UI Layer (`HUD.jsx`)
- Added a health bar widget to the main HUD showing `Base Integrity`.
- Added a fullscreen overlay that appears when `gameState === 'gameover'`, showing a "BASE DESTROYED" message, the final score, and a "Restart Protocol" button.
- The restart button currently calls `window.location.reload()`, which efficiently resets the entire React Three Fiber canvas, Rapier physics world, and custom ECS data.
