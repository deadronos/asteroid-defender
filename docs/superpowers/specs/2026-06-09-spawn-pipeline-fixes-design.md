# Spawn Pipeline Refactor — Design

**Date:** 2026-06-09
**Branch:** `perf/spawn-pipeline-fixes`
**Source review:** [`PERFORMANCE-REVIEW-spawn-burstiness.md`](../../PERFORMANCE-REVIEW-spawn-burstiness.md)
**Status:** Approved (user gave explicit "iterate until done" directive)

## Goal

Implement Findings #1, #2, #3, and #7 from the burstiness review, plus the
follow-up benchmark, while keeping the public surface (game behaviour,
telemetry event names where observable by the existing test suite) stable.

## Findings → Tasks

| #     | Finding                                              | File(s)                                 | Approach                                                                                                                                                 |
| ----- | ---------------------------------------------------- | --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F1    | Splitter cascade bypasses the spawn queue            | `poolStore.ts`, `AsteroidLayer.tsx`     | Add `enqueueAsteroidFragment(pos)` that builds a `SpawnData` and enqueues it; delete `activateSplitterFragments`; `AsteroidLayer` calls the new enqueue. |
| F2    | Per-frame `.filter().length` in `useAsteroidManager` | `poolStore.ts`, `useAsteroidManager.ts` | Maintain `activeCount` in `poolStore`; increment on activate, decrement on deactivate; expose `getActiveCount()` and replace the filter with a selector. |
| F3    | `Map<string, number>` clone per batch                | `poolStore.ts`                          | Switch to **mutate-in-place + version counter** pattern; keep the existing `useShallow` subscriber contract by bumping a top-level counter.              |
| F4–F6 | (LOW / non-issues)                                   | —                                       | No code change.                                                                                                                                          |
| F7    | Telemetry undercounts activation rate                | `poolStore.ts`                          | Emit a unified `asteroids:activations` event with `{ source: "spawn" \| "fragment" }` whenever a slot is activated.                                      |

## Out of Scope

- The follow-up bench (`src/store/poolStore.bench.ts`) needs the store to
  be importable from a non-React context. That's a structural change to
  the test harness. Document the recommended setup in the spec; defer
  the actual bench to a follow-up PR.
- The `Math.acos` per spawn (Finding #4) is already noted as LOW; the
  non-uniform-azimuth bias is gameplay-feel, so we don't change it.
- The `useEffect` reset on sessionId (Finding #6) is correct; no change.

## Design Decisions

### F1 — Fragment enqueue

`enqueueAsteroidFragment(pos)` lives in
[`src/ecs/asteroidSpawnQueue.ts`](../../src/ecs/asteroidSpawnQueue.ts) and
emits a new `SpawnData` with `type: "swarmer"` and `id: nextId()`. The
queue is drained by the manager's `useFrame`, so fragments now respect
the same per-frame cadence and pool-starvation telemetry as regular
spawns.

**No offset trick.** The current `activateSplitterFragments` offsets the
two fragments by `±2` on the X axis to avoid them spawning on top of
each other. The fragment-enqueue path preserves this by computing the
two positions in `AsteroidLayer` (or a helper) and calling
`enqueueAsteroidSpawn` twice. This keeps the queue format unchanged.

### F2 — Maintained active count

`poolStore` gains a numeric `activeAsteroidCount` field, incremented
inside `activateAsteroids` and decremented inside `deactivateAsteroid`.
`resetPools` zeros it. The manager's `useFrame` reads
`usePoolStore.getState().activeAsteroidCount` directly — no per-frame
allocation.

The React subscriber in `AsteroidLayer` already does its own
`.filter(...).length` for `activeAsteroidCount` (local component prop
for `Asteroid` visual quality). That stays — the _file-local_ count
is a different value (used to drive visual tier) and only updates
when the `asteroids` array reference changes, which still happens
on activate/deactivate. The _manager's_ count is the value pushed
into `gameStore.activeAsteroids`.

### F3 — Mutate-in-place with version counter

Switch the Zustand `set` calls in `poolStore` to mutate the array in
place and bump a `version` field on the state. Subscribers using
`useShallow` still see a state diff on the `version` field; subscribers
using `state.asteroids` directly still get the same reference and need
to re-read via `useShallow(state => state.asteroids)` to re-render
when slot content changes (which is the existing pattern in
`AsteroidLayer`).

This is a non-trivial change. To keep risk low, **land F3 as a
follow-up commit** that runs alongside a focused test verifying the
React subscriber contract. The first commit (F1, F2, F7) leaves F3
untouched (still cloning the Map).

### F7 — Unified activations telemetry

Add a single `markTelemetry('asteroids:activations', { count, source })`
call inside the new "activate a slot" code path that both the regular
spawner and the fragment path use. Drop the old `pool:asteroid-starved`
metadata, replace it with `asteroids:starved` carrying the same payload.

## Test Strategy

- New file: `src/store/poolStore.test.ts` covering `activateAsteroids`,
  `deactivateAsteroid`, `activateAsteroidFragment` (replacing
  `activateSplitterFragments`), `resetPools`, and the maintained
  `activeAsteroidCount`.
- New file: `src/ecs/asteroidSpawnQueue.test.ts` already exists.
  Add a test for `enqueueAsteroidFragment` and for the queue correctly
  ordering regular + fragment spawns in the same drain.
- Existing tests must continue to pass:
  - `src/ecs/asteroidSpawnQueue.test.ts` (no contract changes to
    `SpawnData` / `enqueueAsteroidSpawn`).
  - `src/store/gameStore.test.ts` (no contract changes to `gameStore`).
  - `src/ecs/world.test.ts` and `src/ecs/world.bench.ts` (no changes
    to ECS world).

## Verification

- `npm test` — all tests pass.
- `npm run lint` — no new warnings/errors.
- `npm run check` — type-check passes.
- `npm run bench` — existing bench numbers within noise; no
  regression on the spatial-index hot path.
