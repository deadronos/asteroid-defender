# Performance Review: Hot Paths & Optimization Opportunities

**Branch:** `review/performance-hot-paths`
**Date:** 2026-05-31
**Reviewed by:** Claude Code + Chrome DevTools profiling + benchmark suite

---

## Executive Summary

The game's ECS + object pool architecture is well-designed for the ≤60 asteroid target load. Benchmark numbers are healthy (20–28M ops/sec on spatial index hot paths). However, several hot-path patterns create unnecessary allocations and redundant computation that will compound at higher asteroid counts or on lower-end hardware.

---

## Benchmark Baseline

```
spatial index hot paths:
  rebuilds the asteroid spatial index      20.5M ops/s
  counts nearby asteroids from indexed cells  28.3M ops/s
  finds nearest turret target with scoring   26.5M ops/s

pool lifecycle hot paths:
  activates queued asteroids in a 60-slot pool   347K ops/s
  deactivates an active asteroid in a 60-slot pool 307K ops/s
  spawns splitter fragments into a partially occupied pool 271K ops/s
```

The pool operations are ~100x slower than ECS operations because they allocate new arrays on every mutation (see Finding #2).

---

## Finding #1 — Full spatial index rebuild every frame (HIGH PRIORITY)

**File:** [src/ecs/world.ts:113](src/ecs/world.ts#L113)

```ts
export function updateSpatialIndex() {
  for (const arr of asteroidCells.values()) {
    arr.length = 0;
    recycledAsteroidCellBuckets.push(arr);
  }
  asteroidCells.clear();

  for (const entity of asteroidQuery.entities) {
    // ... re-insert every entity
  }
}
```

**Problem:** The entire spatial hash is torn down and rebuilt from scratch every frame, even when most asteroids have only moved a small amount. This is O(n) regardless of how many asteroids actually moved.

**Opportunity:** Add a dirty-flag system. Track which entities moved (via Rapier's `linvel` or position delta check). Only rebuild cells for moved entities, or use incremental updates. For the common case where most asteroids move every frame (they do), the rebuild is necessary — but the current implementation pays the Map#clear + iterate-all-entities cost every frame unconditionally.

**Also:** `recycledAsteroidCellBuckets` is an unbounded-growing array. Over long sessions with many different spatial regions, this can grow. Add a size cap or periodic trim.

---

## Finding #2 — Pool array spread on every mutation (HIGH PRIORITY)

**File:** [src/components/gameScene/pools.ts:51](src/components/gameScene/pools.ts#L51), [108](src/components/gameScene/pools.ts#L108), [121](src/components/gameScene/pools.ts#L121)

```ts
const nextPool = [...pool]; // allocates a new 60-element array every time
```

Every `activateQueuedAsteroidsWithDelta`, `deactivateAsteroidWithDelta`, and `spawnSplitterFragmentsWithDelta` does a full shallow copy of the pool on every call.

**Impact:** 270K–347K ops/s in benchmarks, but each op is an allocation. Under spawn pressure, this triggers GC more frequently than necessary.

**Opportunity:** Use a structural sharing approach with a persistent vector (e.g., Immer-style patch-based updates, or a hand-rolled copy-on-write). Alternatively, switch to a mutable in-place update pattern if referential equality checks on the pool aren't required downstream.

---

## Finding #3 — `tempVec.length()` computed twice per asteroid per frame (MEDIUM)

**File:** [src/components/Asteroid.tsx:146](src/components/Asteroid.tsx#L146) and [155](src/components/Asteroid.tsx#L155)

```ts
// line 146
if (tempVec.lengthSq() <= 9) { ... }   // lengthSq, no sqrt

// line 155
const dist = tempVec.length();          // sqrt computed here
const imminentRatio = Math.max(0, 1 - dist / 35);
```

`lengthSq()` avoids the sqrt at line 146. But then `length()` is called at line 155, triggering a second sqrt on the same vector. The value from line 146 (distance-squared, not distance) isn't directly usable for line 155's ratio calculation.

**Opportunity:** Cache `dist = tempVec.length()` before the lengthSq check, or restructure the logic to reuse the distance.

---

## Finding #4 — `TURRET_RANGE * TURRET_RANGE` recomputed every frame (MEDIUM)

**File:** [src/components/turret/helpers.ts:41](src/components/turret/helpers.ts#L41)

```ts
return maxDamage - (actualDistSq / (TURRET_RANGE * TURRET_RANGE)) * (maxDamage - minDamage);
```

**Opportunity:** Precompute `TURRET_RANGE_SQ = TURRET_RANGE * TURRET_RANGE` as a module-level constant. Trivial but free.

---

## Finding #5 — `findIndex` O(n) scan on every pool deactivation (LOW-MEDIUM)

**File:** [src/components/gameScene/pools.ts:46](src/components/gameScene/pools.ts#L46), [103](src/components/gameScene/pools.ts#L103)

```ts
const idx = pool.findIndex((asteroid) => asteroid.id === id); // O(n) each time
```

With POOL_SIZE=60, this is not catastrophic. But it's called on every asteroid destruction, and at high swarm pressure with many simultaneous destructions, this adds up.

**Opportunity:** Maintain a `Map<id, index>` alongside the pool array for O(1) lookups.

---

## Finding #6 — `Math.acos(-1 + 2 * Math.random())` per spawn (LOW)

**File:** [src/utils/math.ts:47](src/utils/math.ts)

```ts
Math.acos(-1 + 2 * Math.random()); // expensive trig per spawn
```

Called once per asteroid spawn. Not a per-frame cost, but could be replaced with a faster hash-based approach for the direction vector if spawn pressure is high.

---

## Finding #7 — Camera system doesn't reuse THREE.Vector3 scratchpads (LOW)

**File:** [src/components/camera/useDynamicCamera.ts](src/components/camera/useDynamicCamera.ts)

Many camera helpers allocate temporary `THREE.Vector3` objects. These should use module-level scratch vectors to avoid GC pressure in the animation loop.

---

## Load-Test Recommendation

The current benchmark covers individual hot path performance, but there's no aggregate frame-time test. Consider adding a benchmark that simulates a full "worst case" frame: update spatial index + 4 turret target finds + 60 asteroid position syncs + pool operations, measured under `requestAnimationFrame` timing. This would give a ground-truth "ms per frame" number to compare against the 16.67ms budget.

---

## Not Issues (Confirmed OK)

- **Zustand `getState()`** is a fast O(1) store accessor — not a concern at 4 calls/frame
- **Explosion particle pre-allocation** via `useRef` is correct — no per-frame allocation
- **Linear scan fallback** at `< 80 entities` is a good heuristic
- **Rapier physics** for asteroid bodies is appropriate for the target scale
