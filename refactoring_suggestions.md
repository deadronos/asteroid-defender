# Code Duplication & Refactoring Analysis

This report identifies duplicated logic across the project and provides structured suggestions for refactoring.

## Cluster 1: Visual Quality Profiles

**Files Involved:**
- `src/utils/visualQuality.ts`
- `src/utils/asteroidVisualQuality.ts`
- `src/utils/backgroundVisualQuality.ts`

**Observations:**
The project uses a repeating pattern to resolve visual settings based on `EffectsQuality` ("full", "reduced", "off") and a `reducedMotion` boolean flag. Each domain (Asteroids, Backgrounds) implements its own `get*VisualProfile` factory function that independently interprets the global `EffectsQuality`.

**Refactoring Suggestion:**
Create a unified `QualityManager` or use a standard strategy pattern. Instead of separate modules hardcoding logic per domain, use a centralised profile object.

```typescript
// Proposed unified interface concept:
export interface QualityProfile {
  dpr: number;
  asteroid: AsteroidVisualProfile;
  background: BackgroundVisualProfile;
  postProcessing: PostProcessingProfile;
}

export function createVisualProfile(quality: EffectsQuality, reducedMotion: boolean): QualityProfile {
    // Generate the full profile once rather than per-component lookups
}
```

## Cluster 2: Object Pooling Logic

**Files Involved:**
- `src/components/gameScene/pools.ts`
- `src/components/gameScene/useExplosionPool.ts`
- `src/components/gameScene/pools.test.ts` (jscpd detected a clone here)

**Observations:**
There is clear boilerplate duplication in creating pools:
`createAsteroidPool(size: number): PooledAsteroid[]`
`createExplosionPool(size: number): PooledExplosion[]`

Both functions return an array of objects populated identically via `Array.from({ length: size }, () => (...))`. Additionally, the testing logic (`pools.test.ts`) has literal cloned blocks when testing asteroid and explosion pools.

**Refactoring Suggestion:**
Implement a generic Pool Factory that accepts an item generator.

```typescript
// Proposed Refactor:
function createPool<T>(size: number, factory: () => T): T[] {
  return Array.from({ length: size }, factory);
}

// Usage:
export const createAsteroidPool = (size: number) => createPool(size, () => ({ id: nextId(), active: false, pos: getStoragePosition(), type: "swarmer" as AsteroidType }));
```
This would eliminate the `createAsteroidPool` and `createExplosionPool` duplication, and the tests could be streamlined to just test the generic `createPool` behavior once.

## Cluster 3: ECS Spatial Index Querying

**Files Involved:**
- `src/ecs/world.ts`

**Observations:**
The spatial indexing logic uses a `visitAsteroidsInRange` higher-order function, which is a *good* example of avoiding duplication. `queryAsteroidsInRange`, `countAsteroidsInRange`, and `findNearestAsteroidInRange` all correctly leverage this visitor.

**Refactoring Suggestion:**
The implementation is solid, but the logic is tightly coupled specifically to "Asteroids" (`asteroidCells`, `visitAsteroidsInRange`). If the ECS expands to include other entities (e.g. friendly ships, projectiles that need collision), this will need to be refactored into a generic `SpatialIndex<T>` class or module.

## Conclusion

The codebase is generally well-structured and uses React Three Fiber and ECS patterns cleanly. The most significant gains in maintainability will come from unifying the Object Pooling logic and centralising the Visual Profile resolution.
