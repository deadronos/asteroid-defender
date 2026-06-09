# Performance Review: Asteroid Spawn Frequency & Burstiness

**Branch:** `review/asteroid-spawn-burstiness`
**Date:** 2026-06-09
**Scope:** How often and how dynamically/bursty asteroid spawning actually is at runtime,
plus the downstream cost on the pool, ECS, and per-frame React subscribers.

This review complements (does not replace) the broader hot-path review in
[`PERFORMANCE-REVIEW.md`](PERFORMANCE-REVIEW.md), which is now ~10 days old and
predates several pool-perf refactors ([#116](https://github.com/deadronos/asteroid-defender/issues/116),
issue-113, #115).

---

## Executive Summary

Asteroid spawning is **tame on paper but bursty in practice**:

- The `AsteroidSpawner` produces at most **one spawn per useFrame tick** (the
  spawner throttles on its own `currentInterval` timer, not on `delta`).
- The **theoretical floor is 0.5 s/spawn** (≈ 120 spawns/min) and the ceiling is
  5 s/spawn (≈ 12 spawns/min).
- The **feedback controller** compares the *close-asteroid count* (radius 25)
  against a `PROXIMITY_THRESHOLD = 3` and adjusts the interval by
  `±0.2 s` per spawn — meaning the loop walks the full 0.5–5 s range in
  **23 spawns (≈ 30 s of perfect pressure / 230 s of perfect quiet)**.
- **Splitter cascades** can layer on top of regular spawns: each destroyed
  `splitter` synchronously activates **2 new `swarmer`s** in the same frame
  via `activateSplitterFragments`, and that code path *bypasses the spawn
  queue entirely*. This is the dominant burst source and is invisible to
  `useFrame` queue telemetry.
- A previously-undocumented per-frame allocation was found in
  `useAsteroidManager.useFrame` (the `.filter().length` for the active count
  recompute — allocates a 60-element array on every frame). Combined with the
  immer-style shallow array copies in `poolStore.activateAsteroids`, a
  splitter-cascade plus a regular spawn in the same frame allocates
  **~7 short-lived arrays per frame** and clones one `Map<string, number>`.

The actual frame-budget impact today is small (everything is sub-millisecond
on the hot path per the existing benchmarks), but the **architectural concern**
is that spawns are *uncorrelated with frame budget*: nothing in the pipeline
asks "is this frame cheap?" before adding work. If the game ever pushes
past the 60-pool ceiling or runs on a constrained device, the existing
splitter-cascade fast path will be the first thing to bite.

---

## Spawn-Frequency Map (Steady State)

### Per-tick analysis

The `AsteroidSpawner` is the only place that calls `enqueueAsteroidSpawn`.
Reading [`src/components/AsteroidSpawner.tsx`](src/components/AsteroidSpawner.tsx):

```ts
const INITIAL_SPAWN_INTERVAL = 2.0;
const MIN_SPAWN_INTERVAL = 0.5;
const MAX_SPAWN_INTERVAL = 5.0;
const SPAWN_ADJUSTMENT = 0.2;
const SPAWN_RADIUS = 40;
const PROXIMITY_THRESHOLD = 3;
```

The spawner runs inside `useFrame`, but only **enqueues one asteroid per
fire**, regardless of how much real time elapsed during the gate interval.
At a healthy 60 FPS, the cadence is bounded by:

| Mode | Interval | Spawns/min | Spawns/sec |
|------|---------:|-----------:|-----------:|
| Maximum pressure (`closeCount < 3` and `currentInterval` already at min) | 0.5 s | 120 | 2.0 |
| Equilibrium (steady state, `closeCount == 3`) | any | n/a (oscillates ±0.2 s) | n/a |
| Maximum quiet (all asteroids destroyed) | 5.0 s | 12 | 0.2 |

Because the controller adds ±0.2 s *per spawn event* (not per second), the
**time to reach `MIN_SPAWN_INTERVAL` from `INITIAL_SPAWN_INTERVAL` is**:

- Going faster: `(2.0 − 0.5) / 0.2 = 7.5 → 8 spawns` ⇒ ≈ 4 s of in-game time
  (assuming the close-count condition stays true every spawn).
- Going slower: `(5.0 − 2.0) / 0.2 = 15 spawns` ⇒ ≈ 75 s of in-game time.

The asymmetric speed-up vs. slow-down is intentional (the game wants to
ramp pressure), but it also means **a player who clears the field suddenly
gets slammed** — 8 consecutive spawns in 4 seconds, all spawning at the
40-unit shell. That is the closest the game gets to "bursty" from the
spawner itself.

### Burst source: the splitter cascade

A `splitter` asteroid destruction triggers
`activateSplitterFragments(pos)` in [`src/components/gameScene/AsteroidLayer.tsx:37`](src/components/gameScene/AsteroidLayer.tsx#L37).
This calls into [`poolStore.activateSplitterFragments`](src/store/poolStore.ts#L258)
which **does not go through the spawn queue at all** — it mutates the pool
directly. It always activates exactly 2 `swarmer`s.

The maximum theoretical spawn rate is therefore the regular spawner
**plus** all the splitter fragments currently exploding in the same frame.
The worst case is N splitters detonating in a single frame after a
concentrated volley: each contributes 2 to the pool *that frame*, on top
of the spawner's own enqueue. With the `POOL_SIZE = 60` ceiling, the pool
can fill from 0 → 60 in a single frame if the spawner has been silent for a
while and 30 splitters happen to die simultaneously (e.g., a chain
explosion from a single high-damage laser pulse).

This is **not a hypothetical**: the splitters, by config, have only
**100 HP** ([`src/components/asteroid/config.ts`](src/components/asteroid/config.ts))
and turrets deal up to 100 damage at point-blank range. Multiple splitters
can be killed in the same `useFrame` tick.

### Burst source: pause/resume

The `currentInterval` ref in `AsteroidSpawner` is reset on `sessionId`
change via `useEffect`, but it is **not paused** when `gameState !== 'playing'`
beyond the early return. If the player pauses for 60 seconds and resumes,
the accumulated `delta` is discarded, so the next spawn happens at the
"normal" cadence — not a burst. (Good.) But `useEffect` resets the timer
to 0 on session change, which means **after a restart the first spawn can
arrive in `INITIAL_SPAWN_INTERVAL` = 2 s flat**, even if the player is
still figuring out the controls. Minor UX issue, not a perf issue.

### Burst source: pool drain in `useFrame`

[`src/components/gameScene/useAsteroidManager.ts:69`](src/components/gameScene/useAsteroidManager.ts#L69-L75):

```ts
const spawns = drainAsteroidSpawns();
if (spawns.length > 0) {
  markTelemetry("asteroids:drain-spawns", { count: spawns.length });
  usePoolStore.getState().activateAsteroids(spawns);
}
```

In practice, `drainAsteroidSpawns()` returns an array of length 0 or 1 per
frame under normal play (because the spawner gates itself). The burst
case is: spawn enqueued this frame *and* 1+ splitters just died in the
same frame. The store's `activateAsteroids` allocates a fresh
`[...state.asteroids]` (60 elements), a fresh `newFreeList` (up to 60
elements), and a fresh `newIdToIndex` (cloned `Map<string, number>`) on
every call. **This is the only mutating call in the frame that scales
with the spawn batch size.** At batch size 1, it is one Map clone + two
60-element array clones. At batch size 60 (theoretical worst case, see
above), it is one Map clone of 60 entries + two 60-element array clones
— still bounded, but every entry is a new object. See Finding #3 below.

---

## Findings

### Finding #1 — Splitter cascade bypasses the spawn queue (MEDIUM PRIORITY, DESIGN)

**File:** [`src/components/gameScene/AsteroidLayer.tsx:30-40`](src/components/gameScene/AsteroidLayer.tsx#L30-L40),
[`src/store/poolStore.ts:258-302`](src/store/poolStore.ts#L258-L302)

The splitter fragment activation lives in `poolStore.activateSplitterFragments`
and mutates the pool *directly* — it does not call `enqueueAsteroidSpawn`.
That means:

1. **No telemetry event** is emitted for fragment spawns, only for the
   destruction that triggered them. The
   `__DEV_TELEMETRY__` overlay's `spawn-queue:enqueue` rate is half the
   truth (regular spawns only). The full activation rate is the sum of
   `spawn-queue:enqueue` and the implicit activations from
   `asteroids:destroy` (type === 'splitter' && !isHit).
2. **No rate limit** applies to fragments. The spawner's "back off when
   the field is full" controller doesn't see them, so the field can
   exceed `PROXIMITY_THRESHOLD` for a window after a chain explosion,
   and the *next* regular spawn fires before the controller has
   observed the new population.
3. **No backpressure**: if both pool slots and the `asteroidFreeList`
   bookkeeping are partially out of sync, `activateSplitterFragments`
   silently returns. The two free slots are dropped without
   `markTelemetry('pool:asteroid-starved', …)` — which is the path
   `activateAsteroids` *does* report. Inconsistent observability.

**Recommendation:** Route fragment spawns through the same queue (or a
parallel `enqueueAsteroidFragment`) so the spawner controller, telemetry,
and pool-starvation reports are unified. This also makes it trivial to
add a soft cap on "splitters this frame" if the chain-explosion scenario
becomes a problem on lower-end hardware.

### Finding #2 — Per-frame active-count filter allocates an array (LOW-MEDIUM PRIORITY)

**File:** [`src/components/gameScene/useAsteroidManager.ts:78-82`](src/components/gameScene/useAsteroidManager.ts#L78-L82)

```ts
const count = usePoolStore.getState().asteroids.filter((a) => a.active).length;
if (count !== activeCount) {
  setActiveAsteroidsCount(count);
  setActiveAsteroids(count);
}
```

`.filter()` returns a new array. With `POOL_SIZE = 60`, that's a 60-element
short-lived array every frame (≈ 60 allocations/s at 60 FPS). The bench
[`src/ecs/world.bench.ts:155-160`](src/ecs/world.bench.ts#L155-L160) uses a
plain `for` loop for the same operation; the manager is one abstraction
level higher and didn't get the same treatment.

A `for` loop with a counter (or — better — a maintained `activeCount`
in the pool store that's incremented on activate and decremented on
deactivate) would be allocation-free.

**Recommendation:** Either:

- Inline a `for` loop in the `useFrame` body:
  ```ts
  let count = 0;
  const arr = usePoolStore.getState().asteroids;
  for (let i = 0; i < arr.length; i++) if (arr[i].active) count++;
  ```
- Or expose a `getActiveAsteroidCount()` selector on `usePoolStore` that
  maintains the count as part of `activateAsteroids` / `deactivateAsteroid`.
  This is the more correct fix because it eliminates the *read* allocation
  *and* the per-frame `usePoolStore.getState().asteroids` subscription
  churn from `useAsteroidLayer`.

### Finding #3 — Pool activation clones a 60-element `Map<string, number>` per batch (LOW PRIORITY)

**File:** [`src/store/poolStore.ts:84-122`](src/store/poolStore.ts#L84-L122)

Every call to `activateAsteroids` (in both fast and slow paths) does
`new Map(state.asteroidIdToIndex)` and then `.set(...)` for each new entry.
This is the "structural sharing" pattern from the old pools, retained
after [#116](https://github.com/deadronos/asteroid-defender/issues/116)
added the free-list bookkeeping. The cost is small (60 entries) but it
runs on the same frame as the free-list array clones and the new
`asteroids[idx] = { ...asteroids[idx], active: true, ... }` shallow copy
that creates a new object per activated slot.

For a batch of 1 spawn + 2 fragments, that's:

- 1 new `asteroids[]` (60 elements, ref-bumped)
- 1 new `asteroidFreeList` (≤ 60 elements, ref-bumped)
- 1 new `asteroidIdToIndex` `Map` clone (≤ 60 entries, deep-copied)
- 3 new `PooledAsteroid` objects (spread copies)

All four allocations are unavoidable for a Zustand store that wants
referential-change notifications for React subscribers, but the
**last one is the worst offender** because each `PooledAsteroid` allocates
an inner tuple for `pos`. This is what the prior review's
[Finding #2](PERFORMANCE-REVIEW.md) was about. The current `poolStore.ts`
is better than the old `pools.ts` (it has the free list), but the
spread pattern is still here.

**Recommendation:** Consider an `immer`-style helper or a hand-rolled
"mutate the slot in place + bump a version counter" approach. The
existing `useShallow` subscribers in `AsteroidLayer` would still update
correctly if the array length changed, but in-place mutation of slot
fields would *not* trigger re-renders of `<Asteroid key={ast.id}>` if
those components don't re-render based on `pos`/`type` (they only
react to `active`). This is a larger refactor — see
[Refactor 1 in `refactoring_suggestions.md`](refactoring_suggestions.md)
for the original motivation.

### Finding #4 — `getRandomSpherePosition` calls `Math.acos` per spawn (LOW PRIORITY)

**File:** [`src/utils/math.ts:33-43`](src/utils/math.ts#L33-L43)

```ts
const phi = Math.acos(-1 + 2 * Math.random());
```

The prior review (Finding #6) already flagged this as a per-spawn cost.
It is repeated here because the spawn rate is the relevant multiplier.
At a steady-state 1 spawn/sec it's 1 `Math.acos` per second — entirely
negligible. At the maximum-pressure rate of 2 spawns/sec plus a chain of
splitter fragments, the worst case is ~10–20 `Math.acos` calls per second,
still cheap. **This finding stays LOW.**

The unusual `theta = sqrt(radius * PI) * phi` formulation (a deliberate
azimuthal bias) is preserved as-is, since changing it would alter
gameplay feel.

### Finding #5 — Controller walks full interval range on a single clearing event (LOW PRIORITY)

**File:** [`src/components/AsteroidSpawner.tsx:30-50`](src/components/AsteroidSpawner.tsx#L30-L50)

When the field is suddenly empty (e.g., a multi-kill from one volley),
the controller wants to go from `MAX_SPAWN_INTERVAL` (5.0) to
`MIN_SPAWN_INTERVAL` (0.5) in 8 spawns. The spawns themselves are
spaced 5.0, 4.8, 4.6, …, 0.6 s apart — which means the first new spawn
takes 5 s to appear. The "burst" only manifests **after** the controller
has accelerated, not when the field is first clear. This is by design
(it gives breathing room), but a player who clears 30 asteroids and
expects 30 replacements immediately will be surprised.

**Recommendation:** None — this is gameplay tuning, not a perf issue.
Documenting it here so the next reviewer doesn't re-open the question.

### Finding #6 — `useEffect` resets the spawner on every `sessionId` change (LOW PRIORITY)

**File:** [`src/components/AsteroidSpawner.tsx:24-28`](src/components/AsteroidSpawner.tsx#L24-L28)

`currentInterval.current` and `spawnTimer.current` are reset on every
`sessionId` change. This is the same behavior as the prior review
[Finding #5 in `useAsteroidManager.ts`](PERFORMANCE-REVIEW.md), and
is also correct: it prevents a stale interval from a previous game
session being applied to a fresh one. **No change recommended.**

### Finding #7 — Telemetry undercounts the activation rate (OBSERVABILITY)

**File:** [`src/ecs/asteroidSpawnQueue.ts`](src/ecs/asteroidSpawnQueue.ts),
[`src/store/poolStore.ts`](src/store/poolStore.ts)

The telemetry hooks `spawn-queue:enqueue`, `spawn-queue:drain`, and
`pool:asteroid-starved` give a partial view. The full activation rate
should be observable as a histogram in the dev overlay. A useful new
metric would be `asteroids:activations` emitted from the *post-pool*
side, capturing all sources (regular spawns, splitter fragments, and
anything added in the future) uniformly.

---

## Frame-Budget Impact (Quantified)

The existing bench suite
[`src/ecs/world.bench.ts:131-178`](src/ecs/world.bench.ts#L131-L178) shows
that the full "worst-case frame" (spatial index rebuild + 4 turret targetings
+ active count scan) at 60 asteroids costs **well under 0.01 ms** on the
hot-path CPU. The only budget-affecting thing *added* by spawning is:

| Operation | Cost per spawn | Worst case (1 spawn + 2 fragments) |
|---|---:|---:|
| `enqueueAsteroidSpawn` push | O(1), 1 array push | 3 array pushes total |
| `drainAsteroidSpawns` slice | O(n) of queue length | 3 elements |
| `activateAsteroids` Map clone + 2 array clones + 3 object spreads | ~0.005 ms typical | ~0.015 ms worst case |
| `markAsteroidDirty` + 4× `findNearestAsteroidInRange` | unchanged | unchanged |
| React re-render of `<Asteroid>` for 3 newly active slots | one-time mount cost | one-time mount cost |

**Headroom estimate:** 60 FPS = 16.67 ms/frame. Rapier + Three.js + post-fx
dominate. The spawn pipeline costs < 0.5 % of frame time under worst case,
*on top of* the existing hot-path work. **The game is not at risk of a
spawn-related frame drop today.**

The risk is **scaling**: if the pool cap is ever raised to 120 or 200
(see also issue #117 about raising the cap), the per-spawn array
clones grow linearly, and the splitter cascade's worst case grows as
`N_splitters * 2` new objects per frame. None of this is being measured
in CI; it would be worth adding a bench analogous to
[`simulated worst-case frame at 60 asteroids`](src/ecs/world.bench.ts#L156-L178)
but varying the *spawn batch size* (1, 2, 4, 8) and the *splitter cascade
count* (0, 1, 5, 20) instead of the entity count.

---

## Recommended Follow-up Bench

Add to [`src/ecs/world.bench.ts`](src/ecs/world.bench.ts):

```ts
describe("spawn-batch hot paths at 60-asteroid steady state", () => {
  beforeAll(() => seedAsteroids(60));
  afterAll(clearWorld);

  for (const batch of [1, 2, 4, 8]) {
    bench(`activateAsteroids(batch=${batch})`, () => {
      // Simulate the store's activateAsteroids fast path against
      // 60 already-active asteroids, then deactivate 1 to refill the
      // free list, then call again to measure per-batch cost.
      // (Tracked as a TODO once a public store accessor lands.)
    });
  }
});
```

This is a code-shaped placeholder; the actual bench will need a hook into
`poolStore` (which is currently not importable from the bench because the
bench runs in plain Node, not the React tree). The earlier hot-path
benchmarks in the file are pure-function, so the store-based bench
deserves a dedicated `src/store/poolStore.bench.ts` and a small
`--experimental-vm-modules` setup. Track as a separate issue.

---

## Summary of Recommendations (Prioritized)

| # | Priority | Title | File |
|---|----------|-------|------|
| 1 | MEDIUM | Route splitter fragments through the spawn queue | `AsteroidLayer.tsx`, `poolStore.ts` |
| 2 | LOW-MEDIUM | Replace per-frame `.filter().length` with a for-loop or store-maintained counter | `useAsteroidManager.ts` |
| 3 | LOW | Reduce per-batch `Map<string, number>` clone in `activateAsteroids` | `poolStore.ts` |
| 4 | LOW | (Already known) `Math.acos` per spawn — no change | `utils/math.ts` |
| 5 | LOW | Document, do not fix, the controller's "ramp after clear" behavior | `AsteroidSpawner.tsx` |
| 6 | — | No change recommended; `useEffect` reset is correct | `AsteroidSpawner.tsx` |
| 7 | OBSERVABILITY | Add `asteroids:activations` telemetry for a unified activation view | `poolStore.ts` |
| — | DEFERRED | Add spawn-batch + splitter-cascade bench (needs store accessor) | new `poolStore.bench.ts` |

---

## Non-Issues (Confirmed OK)

- **Per-tick gating** of the spawner prevents multi-spawn per frame from the
  regular path; the only multi-spawn source is splitters.
- **`closeCount` query** uses the linear-scan path under 80 entities and
  the spatial index above — see [issue-113](https://github.com/deadronos/asteroid-defender/issues/113).
  No additional cost when spawning.
- **`pendingSpawns` is bounded by 1** under normal play. The `slice()` in
  `drainAsteroidSpawns` is O(1) and the `.length = 0` is a true zero-cost
  truncation. No GC churn.
- **Pause/resume** discards accumulated `delta`, so resuming is not a burst.
- **Pool pre-allocation** in `resetPools` is done once per session, not per
  spawn. No per-spawn array sizing.

---

## Related Reviews

- [`PERFORMANCE-REVIEW.md`](PERFORMANCE-REVIEW.md) — Broader hot-path review
  from 2026-05-31. Findings #2, #3, #5 directly overlap with this review's
  #3, #2, and the immer-style suggestion in the refactoring backlog.
- [`docs/PERFORMANCE.md`](docs/PERFORMANCE.md) — Bundle and adaptive
  quality tier docs. The "Asteroid visuals now follow those same tiers"
  section is the most relevant for spawn-pressure interaction.
- [`refactoring_suggestions.md`](refactoring_suggestions.md) — Contains the
  original motivation for the pool-store free-list refactor (#116).
