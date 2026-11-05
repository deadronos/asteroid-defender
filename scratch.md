# What to do next

Reviewed: 2026-11-05 @ `47ea5cb`, the commit released as `v1.0.22`. Everything listed as merged below is live unless it says otherwise.
Working note, not documentation: delete it once the items below are done or filed.

## The short version

- `v1.0.22` is live from `47ea5cb`. A 60s play on the live site gave Destroyed 87, base 100%, no console errors. Nobody has yet looked at the camera, explosions or shield ripple by eye on a real display.
- `check` is a required status check on `main`, through the "main: require CI" ruleset, which has an admin bypass.
- Scene tests (#192) and DOM tests for the HUD (#206) now exist. Session restart at scene level, mounting the full `GameScene`, keyboard shortcuts, `PauseOverlay` and `CinematicIndicator` are still untested.
- Balance: on a real Metal GPU at about 40 fps, 24 production runs of 3 minutes took no damage at all (kill rate about 1.4-1.5/s, peak Active Swarm 4). In 18 software-rendered side-by-side runs, all damage came in the first minute at 1-8 fps, so early damage looks like a very-low-frame-rate problem. A real low-end device is untested. The game plays correctly, but it is not threatening and does not get harder. #126 is the real fix.

All checks stayed green while the game was jammed (#156), because nothing runs the game loop. The smoke test in #192 now covers the pool lifecycle and would have caught it.

## Done

- #185, `vp dev` crashed on load: fixed in #187.
- #165, PRs ungated: fixed in #188, then made required on `main` (see above).
- #186, shield impact never fired: fixed in #196, including the base-hit ripple wiring.
- #169, #159 and #160: merged in #193, #194 and #195, in that order.
- #157, #162 and #158: merged in #202, #203 and #204, in that order.
- #166, #167 and #168: merged in #205, #206 and #207, in that order; #167 step 2 merged earlier in #192.
- #178: merged in #198, an outside contribution.
- #161: merged in #209, adding `src/game/combat.ts`.
- #164 and #163: merged in #210 and #211. The camera trace that proved #211 is in history at `2858b83`.
- #173, #172, #171 and #170: merged in #212, #213, #214 and #215.
- Umbrellas #151 and #153: closed.
- `v1.0.21` from `32cfa2d` carried the jam fix. `v1.0.22` from `47ea5cb` carries everything above.

## Open work

| Item         | Note                                                                                                                                                                             |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| #126 waves   | The real difficulty fix. Needs pacing decisions first. #181 is groundwork. Load-tier visuals at 20, 40 and 50 asteroids will start to matter, and nobody has seen them on screen |
| #197 ripple  | The shield ripple is live but draws near the platform centre instead of at the impact. Decide how it should look first                                                           |
| #125 audio   | No dependencies, biggest cheap feel upgrade. Kill and base-hit events exist; a continuous laser needs a loop, not one-shots                                                      |
| #217 shaders | Programs climb from about 50-75 to 115-150 under stress. Measure whether that causes slow frames before changing anything; it matters more once #126 lands                       |
| #216 test    | Fixed in #218, waiting to merge                                                                                                                                                  |

### Later or only on demand

- **#182:** both this and #161 define `src/game/combat.ts` and `applyTurretDamage`, but #182 changes how damage works, so do it after #161 rather than together.
- **#180:** #170 took parked bodies out of physics, but live asteroids still collide with each other (see below).
- **#177, #174, #175, #176.** Visual baseline, shadows and accessibility.
- **#179:** gameplay RNG pass only (see below).

## Known risks and small findings

- **Slot reuse is still only protected by frame order.** A slot that dies and is reused in the same React batch with the same type keeps `active`, `id` and `type`, so the effect in `src/components/Asteroid.tsx` wouldn't re-run. This didn't happen (0 of 169 reuses in a 121s measurement) because spawns currently run before deaths each frame. That order may come from `<group key={sessionId}>` remounting the children, so a refactor could change it unnoticed. No test pins this. Since #212, `AsteroidLayer` no longer repaints when the count changes, so slot updates rely entirely on copy-on-write.
- **Limits of the runtime evidence:** one Apple GPU in headless Chromium and software rendering, few runs. No real low-end device or other browser has been tested.
- **Spatial index is unused in play.** The game only rebuilds it at `SPATIAL_INDEX_THRESHOLD` (80), and the pool holds 60. Raising the pool past 80 would turn on a path that normal play has never exercised.
- **Benchmarks include telemetry overhead.** `vp test bench` runs through the dev telemetry plugin. `docs/PERFORMANCE.md` shows both numbers for the store; `world.bench.ts` should be affected the same way, and its baselines haven't been re-measured.
- **Dev dependency audit:** `npm audit` reports 1 high and 5 moderate findings through `vitest` and `vite-plus`, all in dev tooling. Not investigated.
- **Not filed yet:** load-time work, most likely `createNebulaTexture.ts`, records about 14.6M telemetry events and overflows the buffer before play starts.
- **Not filed yet:** Pi reports the dev telemetry overlay covers the onboarding dialog's Close help button in `vp dev`. Not checked.

## Quick housekeeping

Verified on 2026-11-05 and waiting on the owner, because the tool's permission check blocked them:

- **Close PR #145.** `main` already has `fflate` 0.6.11 under `three-stdlib`, so the bump is redundant.
- **Close #119.** All six children (#112-#117) are closed.
- **Close #4 as a duplicate of #126.** Copy #4's pacing comment across first; it's the most useful part.
- **Delete the `fix-ci-workflow` branch.** Its PR #105 merged, and `main` has the fix.

Still to do:

- **Repair #125 and #126.** Their code spans are blank (e.g. "Could use / to spatialize"). #126 also says the spawn interval is 0.5s-5s, while the code uses 1.0-5.0.
- **Local branches:** 62 of 65 in the main checkout are fully merged and could be removed.

## Corrections to the issues

Worth fixing in the issue text before anyone implements from it.

- **#183 math:** the penalty is not "exactly 20 units". It's `D² < d² + 400`, so the allowance is 10 units at d=15 and about 4 at d=45. The real effect is weaker than the issue says.
- **#183 blocker:** the claim that a test is impossible until #161 is wrong. `src/components/turret/helpers.test.ts:108-165` already calls `findTurretTarget` with a `THREE.Group`. #161 also never proposes that signature change. The test at `:136-165` pins the current penalty and will need updating.
- **#183 fix:** "DPS loss" is doubtful. Stacking wastes little beyond overkill, and damage falls with distance, so splitting can lower total DPS. Hard reservation also leaves a turret idle with a target in range, which will look like a bug. Simpler: set the penalty to `TURRET_RANGE_SQ`, so a free target in range always wins, and stacking happens only when nothing else is available. This changes balance, so playtest it.
- **#179:** seeding alone won't give replays. Turret damage and spawn timers integrate render-frame `delta`, and `StrictMode` (`src/main.tsx:89`) double-invokes render-time initialisers in dev, which is exactly where `?seed=` is used, so they'd consume extra draws from a shared stream. Seed only the spawn roll and position, keep cosmetics on `Math.random()`, and promise "reproducible spawn sequence" rather than "replay". #177 already has a fallback that doesn't need this.

## Decisions only you can make

- **#176:** is starting at `reduced` deliberate? I'd keep it (option A) and delete the dead ternary.
- **#180:** should asteroids hit each other? I'd say no: it's cheaper and keeps approach lines predictable. It also makes the ±2 fragment offset unnecessary. It changes difficulty, so decide alongside #126.
- **#183:** focus fire or spread? This decides the targeting policy, more than the penalty's maths does.
- **Root-level review docs:** `idea.md` and `refactoring_suggestions.md` need a call on whether to archive them. The performance reviews moved to `docs/reviews/` in #205.
