# Code Duplication & Refactoring Analysis

This report identifies duplicated logic across the project and provides structured suggestions for refactoring.

## Cluster 1: Visual Quality Profiles

**Files Involved:**

- `src/utils/visualQuality.ts`
- `src/utils/asteroidVisualQuality.ts`
- `src/utils/backgroundVisualQuality.ts`

**Observations:**
The project uses a shared quality model based on `EffectsQuality` ("full", "reduced", "off") and a `reducedMotion` boolean flag. `src/utils/visualQuality.ts` already centralises the shared quality normalization and DPR behavior, while the asteroid and background modules intentionally map that shared state to different domain-specific visuals.

**Refactoring Suggestion:**
Keep the current split between shared quality normalization and domain-specific visuals. If more domains start re-implementing the same reduced/full/off mapping, extract a smaller shared helper or profile builder for just the repeated pieces rather than introducing a broad `QualityManager` abstraction.

## Cluster 2: Object Pooling Logic

**Files Involved:**

- `src/components/gameScene/pools.ts`
- `src/components/gameScene/pools.test.ts`

**Observations:**
There is small, local duplication in the pool initializers:
`createAsteroidPool(size: number): PooledAsteroid[]`
`createExplosionPool(size: number): PooledExplosion[]`

Both functions return an array of objects populated in the same way via `Array.from({ length: size }, () => (...))`. The test file also repeats some setup and assertions between asteroid and explosion pool cases, though that repetition is modest and keeps the tests explicit.

**Refactoring Suggestion:**
A small generic factory could reduce duplication if more pool types are added:

```typescript
function createPool<T>(size: number, factory: () => T): T[] {
  return Array.from({ length: size }, factory);
}
```

That said, the current code is still straightforward and type-safe. If you keep the explicit wrappers, a parameterized test helper would probably be the better payoff than fully collapsing the public constructors into one generic API.

## Cluster 3: ECS Spatial Index Querying

**Files Involved:**

- `src/ecs/world.ts`

**Observations:**
The spatial indexing logic uses a `visitAsteroidsInRange` higher-order function, which is a *good* example of avoiding duplication. `queryAsteroidsInRange`, `countAsteroidsInRange`, and `findNearestAsteroidInRange` all correctly leverage this visitor.

**Refactoring Suggestion:**
The implementation is solid, but the logic is intentionally specialized to "Asteroids" (`asteroidCells`, `visitAsteroidsInRange`). If the ECS later needs the same range-query pattern for other entity kinds, then a generic `SpatialIndex<T>` abstraction would make sense. At the current scale, the specialized implementation reads well and avoids abstraction overhead.

## Conclusion

The codebase is generally well-structured and uses React Three Fiber and ECS patterns cleanly. The most significant gains in maintainability will come from unifying the Object Pooling logic and centralising the Visual Profile resolution.
