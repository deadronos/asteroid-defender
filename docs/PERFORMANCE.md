# Performance Budget

This document tracks Asteroid Defender's front-end performance targets and records the bundle analysis carried out as part of the initial JS payload audit (see [issue #46](https://github.com/deadronos/asteroid-defender/issues/46)).

---

## Bundle Analysis

### Before optimisation (baseline)

Vite produced a **single monolithic chunk** containing all vendor libraries and application code.

| File | Raw size | Gzip size |
|------|----------|-----------|
| `index-*.js` (entire app) | 3,521.58 kB | 1,186.58 kB |

All 3.5 MB had to be downloaded, parsed, and executed before the page became interactive. Browsers could not parallelise the download, and any change to application code invalidated the entire cached asset.

### After optimisation

Three targeted changes were made:

1. **Manual chunk splitting** – `build.rollupOptions.output.manualChunks` added to `vite.config.js` groups heavy vendor libraries into separate chunks.
2. **Lazy-load `PostEffects`** – `EffectComposer`, `Bloom`, and `DepthOfField` were extracted into `src/components/PostEffects.tsx` and imported via `React.lazy()` so the heavy postprocessing chunk is fetched *after* the first frame renders.
3. **Lazy-load `SpaceBackground`** – The cosmetic nebula/star backdrop is now a `React.lazy` import inside `GameScene`, letting core gameplay geometry render first.

| Chunk | Raw size | Gzip size | Load timing |
|-------|----------|-----------|-------------|
| `vendor-rapier-*.js` | 2,260.51 kB | 838.04 kB | Parallel with others (physics required for gameplay) |
| `vendor-three-*.js` | 724.60 kB | 187.46 kB | Parallel download |
| `vendor-r3f-*.js` | 391.25 kB | 122.54 kB | Parallel download |
| `vendor-postprocessing-*.js` | 83.99 kB | 20.05 kB | Deferred – fetched after first render |
| `index-*.js` | 35.64 kB | 11.02 kB | Entry point |
| `vendor-state-*.js` | 16.11 kB | 4.34 kB | Parallel download |
| `SpaceBackground-*.js` | 5.76 kB | 2.43 kB | Deferred – fetched after first render |
| `PostEffects-*.js` | 0.67 kB | 0.41 kB | Deferred – fetched after first render |

**Total gzip: ~1,186 kB** — the raw transfer bytes are unchanged (same code ships), but the payload is now split into independently-cacheable chunks that the browser downloads in parallel.

### Key improvements

| Concern | Before | After |
|---------|--------|-------|
| Parallel chunk downloads | ❌ Single file, sequential | ✅ 9 chunks downloaded concurrently |
| Incremental cache invalidation | ❌ Whole bundle re-fetched on any code change | ✅ Only changed chunks re-fetched |
| PostEffects blocks first frame | ❌ Bloom/DoF eager-imported | ✅ `React.lazy` defers until after first render |
| SpaceBackground blocks gameplay | ❌ Eager-imported in GameScene | ✅ `React.lazy` defers cosmetic background |
| Build warning | ⚠️ "Some chunks are larger than 500 kB" | ✅ Warning is expected/documented for Rapier WASM only |

> **Note on Rapier:** The 838 kB gzip rapier chunk contains a compiled WebAssembly physics engine. This cannot be tree-shaken further without replacing the physics library. It is fetched in parallel with all other chunks and cached aggressively between sessions.

---

## Performance Budget

These are the targets for the production build. Measurements should be taken on a mid-range device over a simulated **Fast 4G** network (40 Mbps down, 20 ms RTT) with the browser cache cleared.

| Metric | Target | Notes |
|--------|--------|-------|
| Initial JS transferred (gzip) | < 1,500 kB total; < 500 kB per chunk | Rapier WASM (~838 kB) is the sole documented exception |
| Time to Interactive (TTI) | < 5 s | 4× CPU throttle, Fast 4G network |
| First Contentful Paint (FCP) | < 2 s | Background colour / HUD visible |
| Steady-state frame rate | ≥ 60 FPS | Device with a dedicated GPU |
| Minimum frame rate (adaptive fallback) | ≥ 30 FPS | `dpr` auto-scaled to 0.5 via `PerformanceMonitor` |
| Memory (heap) at steady state | < 256 MB | — |

### Existing runtime safeguards

- **`<PerformanceMonitor>`** (from `@react-three/drei`) automatically adjusts the canvas device pixel ratio (`dpr`) between 0.5 and 2 based on measured frame times, with a three-strike flip-flop guard before adjusting.
- **`<Suspense fallback={null}>`** wraps the physics world, postprocessing, and background so the canvas is presented immediately while heavier assets hydrate in the background.

---

## Recommendations for further reduction

If the budget needs to be tightened in the future, consider:

1. **WASM streaming compilation** – Serve `rapier_wasm*` assets with `Content-Type: application/wasm` so the browser can compile the WASM module while it downloads, rather than after.
2. **Three.js tree-shaking** – Replace `import * as THREE from 'three'` with named imports in files that only use a subset of the library (e.g. `import { Vector3, MathUtils } from 'three'`). This can reduce `vendor-three` by 20–40%.
3. **Brotli at the server/CDN layer** – Enable Brotli compression on the hosting platform; Brotli typically achieves 15–20% better compression than gzip on JS payloads at no runtime cost.
4. **Route-level code splitting** – If a main-menu / settings screen is added in the future, split it into its own route chunk so gameplay code is only loaded when the game actually starts.
