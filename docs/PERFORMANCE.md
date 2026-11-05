# Performance Guide

Reviewed: 2026-11-04 @ 855355f

This document tracks Asteroid Defender's front-end performance targets and records the bundle analysis carried out as part of the initial JS payload audit (see [issue #46](https://github.com/deadronos/asteroid-defender/issues/46)).

---

## Bundle Analysis

### Before optimisation (baseline)

Vite produced a **single monolithic chunk** containing all vendor libraries and application code.

| File                      | Raw size    | Gzip size   |
| ------------------------- | ----------- | ----------- |
| `index-*.js` (entire app) | 3,521.58 kB | 1,186.58 kB |

All 3.5 MB had to be downloaded, parsed, and executed before the page became interactive. Browsers could not parallelise the download, and any change to application code invalidated the entire cached asset.

### After optimisation

Three targeted changes were made:

1. **Manual chunk splitting** – `build.rollupOptions.output.manualChunks` in `vite.config.js` groups heavy vendor libraries into separate chunks.
2. **Lazy-load `PostEffects`** – `EffectComposer`, `Bloom`, and `DepthOfField` were extracted into `src/components/PostEffects.tsx` and imported via `React.lazy()` so the heavy postprocessing chunk is fetched _after_ the first frame renders.
3. **Lazy-load `SpaceBackground`** – The cosmetic nebula/star backdrop is now a `React.lazy` import inside `GameScene`, letting core gameplay geometry render first.

The current Vite 8 / Rolldown build still preserves those startup wins, but its emitted chunk layout differs from the original issue #46 snapshot. The table below reflects the production build validated on **20 Mar 2026**.

| Chunk                        | Raw size    | Gzip size | Load timing                                          |
| ---------------------------- | ----------- | --------- | ---------------------------------------------------- |
| `vendor-rapier-*.js`         | 2,259.28 kB | 850.61 kB | Parallel with others (physics required for gameplay) |
| `vendor-postprocessing-*.js` | 1,055.76 kB | 323.21 kB | Deferred – fetched after first render                |
| `vendor-react-*.js`          | 178.26 kB   | 55.95 kB  | Parallel download                                    |
| `index-*.js`                 | 42.57 kB    | 12.76 kB  | Entry point                                          |
| `vendor-r3f-*.js`            | 37.72 kB    | 10.81 kB  | Parallel download                                    |
| `vendor-state-*.js`          | 22.26 kB    | 5.42 kB   | Parallel download                                    |
| `SpaceBackground-*.js`       | 6.72 kB     | 2.72 kB   | Deferred – fetched after first render                |
| `rapier-*.js`                | 2.68 kB     | 1.19 kB   | Parallel download                                    |
| `rolldown-runtime-*.js`      | 0.68 kB     | 0.41 kB   | Runtime bootstrap                                    |
| `PostEffects-*.js`           | 0.73 kB     | 0.45 kB   | Deferred – fetched after first render                |

**Total gzip: ~1,263 kB for emitted JavaScript (~1,264 kB including HTML/CSS)** — the payload remains split into independently-cacheable chunks, with the optional background and postprocessing assets deferred until after the first frame.

### Key improvements

| Concern                         | Before                                        | After                                                                                                     |
| ------------------------------- | --------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Parallel chunk downloads        | ❌ Single file, sequential                    | ✅ 10 JS chunks emitted; optional background/postprocessing chunks defer until after first render         |
| Incremental cache invalidation  | ❌ Whole bundle re-fetched on any code change | ✅ Only changed chunks re-fetched                                                                         |
| PostEffects blocks first frame  | ❌ Bloom/DoF eager-imported                   | ✅ `React.lazy` defers until after first render                                                           |
| SpaceBackground blocks gameplay | ❌ Eager-imported in GameScene                | ✅ `React.lazy` defers cosmetic background                                                                |
| Build warning                   | ⚠️ "Some chunks are larger than 500 kB"       | ⚠️ Warning still fires for `vendor-rapier` and `vendor-postprocessing`; documented and acceptable for now |

- **Note on the current chunk layout:** Rolldown no longer emits the same `vendor-three` split captured in the original audit. The startup deferral strategy still works, but future bundle investigations should use fresh build output rather than assuming the older chunk names and boundaries.
- **Note on Rapier:** The 851 kB gzip rapier chunk contains a compiled WebAssembly physics engine. This cannot be tree-shaken further without replacing the physics library. It is fetched in parallel with all other required chunks and cached aggressively between sessions.

---

## Performance Budget

These are the targets for the production build. Measurements should be taken on a mid-range device over a simulated **Fast 4G** network (40 Mbps down, 20 ms RTT) with the browser cache cleared.

| Metric                                 | Target                               | Notes                                                                                                            |
| -------------------------------------- | ------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| Initial JS transferred (gzip)          | < 1,500 kB total; < 500 kB per chunk | Rapier WASM (~851 kB) is the sole documented exception                                                           |
| Time to Interactive (TTI)              | < 5 s                                | 4× CPU throttle, Fast 4G network                                                                                 |
| First Contentful Paint (FCP)           | < 2 s                                | Background colour / HUD visible                                                                                  |
| Steady-state frame rate                | ≥ 60 FPS                             | Device with a dedicated GPU                                                                                      |
| Minimum frame rate (adaptive fallback) | ≥ 30 FPS                             | `PerformanceMonitor` can step effects down to Bloom-only, disable them entirely, and drop `dpr` to 0.5 if needed |
| Memory (heap) at steady state          | < 256 MB                             | —                                                                                                                |

### Existing runtime safeguards

- **`<PerformanceMonitor>`** (from `@react-three/drei`) now applies adaptive visual-quality tiers based on measured frame times, with a three-strike flip-flop guard before adjusting. On healthy frame times it caps at **full effects + `dpr` 1.25**; under pressure it steps down to **Bloom-only + `dpr` 1.0** (or **`dpr` 0.75** with reduced motion), then **disables postprocessing** before finally dropping to **`dpr` 0.5** on fallback.
- **Asteroid visuals now follow those same tiers** – on **reduced** quality the busiest asteroid class (`swarmer`) loses its trail, outline edges are removed, splitter rings are hidden, and the remaining trails/ring cues switch to cheaper static presentation. On **off**, asteroids render as bare gameplay meshes with no trails or decorative rings, keeping collision/targeting behavior intact while cutting steady-state render cost.
- **Background visuals now follow those same tiers** – on **reduced** quality the star field becomes sparser, dust particles are cut roughly in half and stop updating every frame, and reduced-motion disables shooting stars entirely. On **off**, the scene keeps only a sparse static star field and skips the nebula shader, dust system, and shooting-star spawns to preserve readability under fallback mode.
- **`<Suspense fallback={null}>`** wraps the physics world, postprocessing, and background so the canvas is presented immediately while heavier assets hydrate in the background.
- **Reduced motion lowers the quality ceiling** – when `reducedMotion` is enabled, the app avoids the expensive Depth of Field tier entirely and clamps the adaptive profile to the cheaper Bloom-only path with lower DPR.
- **Explosion effects are hidden while idle** – the pre-allocated explosion pool stays mounted, but inactive slots hide their group (including the point light and fragments) and return from `useFrame` without running animation work, so idle slots cost little between blasts.

---

## Store hot-path benchmarks

`src/store/poolStore.bench.ts` (issue #172) covers the pool store, where the asteroid and explosion allocations actually happen. It complements the ECS benchmarks in `src/ecs/world.bench.ts`; both run under `vp test bench`. The store is a plain Zustand module, so the benchmarks run in Node without React or a DOM. Each iteration resets a 60-slot pool with `resetPools(60)` in a `beforeEach` hook, which tinybench runs outside the timed window; every task takes 20,000 samples.

Measured 2026-11-05 on a quiet Apple M4 (macOS 27.2, Node 26.12.0) at `01b577d`: the median of 5 runs of the mean over 20,000 samples. `vp test bench` runs under Vite's dev pipeline, so the telemetry plugin instruments these functions. The first column is what the command measures today, and the second is the same run with `devTelemetryVitePlugin()` temporarily removed, which is closer to production. Absolute numbers are still not production numbers, because the benchmark runs in Node through Vite's module runner.

| Case                                                    | `vp test bench` | Without telemetry plugin | Per call                                                            |
| ------------------------------------------------------- | --------------- | ------------------------ | ------------------------------------------------------------------- |
| Activate 1 into 10 active slots (fast path)             | 436 ns          | 298 ns                   | 1 array copy, 1 slot replacement, 1 `Map.set`                       |
| Activate 4 (`MAX_ACTIVATIONS_PER_FRAME`) into 10 active | 734 ns          | 654 ns                   | 1 array copy, 4 slot replacements, 4 `Map.set`                      |
| Deactivate 1 of 20                                      | 280 ns          | 121 ns                   | 1 array copy, 1 slot replacement, 1 `Map.delete`, 1 free-list push  |
| Activate 4 with 1 free slot (slow path)                 | 3.47 µs         | 3.42 µs                  | free-list and id-map rebuild, 119 `Map.set`, 1 activated, 3 starved |

The `useShallow`-style asteroid subscriber from `AsteroidLayer` adds one array-reference check plus a per-slot reference loop. Its runs (433 ns, 824 ns, 285 ns and 3.32 µs on the four cases) are close to those above. This only covers the store notification and selector comparison, not the React re-render of 60 `Asteroid` components, which a Node benchmark cannot measure.

The slow path is roughly 8–11× the cost of activating a single asteroid, and most of that is the rebuilt id-to-index map: 119 `Map.set` calls versus 1 on the fast path. It is also rare in play. `deactivateAsteroid` pushes the freed index back onto the free list, so deactivating never forces a rebuild; the slow path fires only when an activation asks for more slots than remain free. With the 50-slot ambient cap and the 10-slot fragment reserve, that needs the pool near full, which is why the benchmark seeds 59 of 60 slots rather than the "deactivate 4" setup suggested in the issue.

---

## Recommendations for further reduction

If the budget needs to be tightened in the future, consider:

1. **WASM streaming compilation** – Serve `rapier_wasm*` assets with `Content-Type: application/wasm` so the browser can compile the WASM module while it downloads, rather than after.
2. **Three.js tree-shaking** – Replace `import * as THREE from 'three'` with named imports in files that only use a subset of the library (e.g. `import { Vector3, MathUtils } from 'three'`). Even though the current Rolldown build no longer emits a separate `vendor-three` chunk, this can still shrink emitted runtime/vendor code.
3. **Brotli at the server/CDN layer** – Enable Brotli compression on the hosting platform; Brotli typically achieves 15–20% better compression than gzip on JS payloads at no runtime cost.
4. **Route-level code splitting** – If a main-menu / settings screen is added in the future, split it into its own route chunk so gameplay code is only loaded when the game actually starts.
