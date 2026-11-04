# What to do next

Reviewed: 2026-11-04 @ `d8e913d`, after #205-#207 and #209 merged. `v1.0.21` was released from `32cfa2d`, so everything merged since then is not live yet.
Working note, not documentation: delete it once the items below are done or filed.

## The short version

- `v1.0.21` is live from `32cfa2d` and includes the #156 jam fix (#184), so "fixed but not released" is no longer true.
- `check` is a required status check on `main`, through the "main: require CI" ruleset, which has an admin bypass.
- Scene tests (#192) and DOM tests for the HUD (#206) now exist. Session restart at scene level, mounting the full `GameScene`, keyboard shortcuts, `PauseOverlay` and `CinematicIndicator` are still untested.
- Balance: on a real Metal GPU at about 39 fps, 12 production runs of 3 minutes took no damage at all (kill rate about 1.4/s, peak Active Swarm 3). Four 10-minute software-rendered runs took one hit in total. In 18 software-rendered side-by-side runs, all damage came in the first minute at 1-8 fps, so early damage looks like a very-low-frame-rate problem. A real low-end device is untested. The game plays correctly, but it is not threatening and does not get harder. #126 is the real fix.

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
- `v1.0.21`: tagged from `32cfa2d`; contains #184 and #192, and nothing merged after #192.
- #197 tracks the shield ripple that draws near the platform centre instead of at the impact.

## Open work

| Item       | Note                                                                                                                        |
| ---------- | --------------------------------------------------------------------------------------------------------------------------- |
| #126 waves | The real difficulty fix. #4 is a duplicate; #161 and #181 are groundwork                                                    |
| #172, #173 | Unblocked by #184: slots are copy-on-write, so the layer can stop subscribing to the raw count                              |
| #125 audio | No dependencies, biggest cheap feel upgrade. Kill and base-hit events exist; a continuous laser needs a loop, not one-shots |

### Modularity, in suggested order

1. **#164:** split `Asteroid.tsx`. This file also holds the frame-order risk below, so keep the scene tests green. #170 and #173 touch the same file. The issue proposes hooks but also a single `useFrame` calling three functions; pick one.
2. **#163:** extract the camera state machine. It touches none of the above, so it can run at any time, but it has no player benefit and needs checking by eye.

### Later or only on demand

- **#182:** both this and #161 define `src/game/combat.ts` and `applyTurretDamage`, but #182 changes how damage works, so do it after #161 rather than together.
- **#170 + #180:** do these together, since both change physics.
- **#177, #174, #178:** #178 has no visible effect while `maxHealth` is always 100.
- **#179:** gameplay RNG pass only (see below).

## Known risks and small findings

- **Slot reuse is still only protected by frame order.** A slot that dies and is reused in the same React batch with the same type keeps `active`, `id` and `type`, so the effect in `src/components/Asteroid.tsx` wouldn't re-run. This didn't happen (0 of 169 reuses in a 121s measurement) because spawns currently run before deaths each frame. That order may come from `<group key={sessionId}>` remounting the children, so a refactor could change it unnoticed. #192 doesn't pin this.
- **Limits of the runtime evidence:** one Apple GPU in headless Chromium and software rendering, few runs. The live site got one 60s check on `v1.0.21`. No real low-end device or other browser has been tested.
- **Not filed yet:** load-time work, most likely `createNebulaTexture.ts`, records about 14.6M telemetry events and overflows the buffer before play starts.
- **Not filed yet:** Pi reports the dev telemetry overlay covers the onboarding dialog\'s Close help button in `vp dev`. Not checked.

## Quick housekeeping (about 10 minutes)

- **Close PR #145.** `main` has `fflate` 0.8.3 at the top level and 0.6.11 under `three-stdlib`, so the 0.6.10 -> 0.6.11 bump is redundant.
- **Close #119.** All six children (#112-#117) are closed.
- **Close #4 as a duplicate of #126.** Copy #4's pacing comment across first; it's the most useful part.
- **Repair #125 and #126.** Their code spans are blank (e.g. "Could use / to spatialize"). #126 also says the spawn interval is 0.5s-5s, while the code uses 1.0-5.0.

## Corrections to the issues

Worth fixing in the issue text before anyone implements from it.

- **#183 math:** the penalty is not "exactly 20 units". It's `D² < d² + 400`, so the allowance is 10 units at d=15 and about 4 at d=45. The real effect is weaker than the issue says.
- **#183 blocker:** the claim that a test is impossible until #161 is wrong. `src/components/turret/helpers.test.ts:108-165` already calls `findTurretTarget` with a `THREE.Group`. #161 also never proposes that signature change. The test at `:136-165` pins the current penalty and will need updating.
- **#183 fix:** "DPS loss" is doubtful. Stacking wastes little beyond overkill, and damage falls with distance, so splitting can lower total DPS. Hard reservation also leaves a turret idle with a target in range, which will look like a bug. Simpler: set the penalty to `TURRET_RANGE_SQ`, so a free target in range always wins, and stacking happens only when nothing else is available. This changes balance, so playtest it.
- **#171:** the proposed size of 12 comes from `MAX_ACTIVATIONS_PER_FRAME`, which limits spawns, not deaths. A full pool silently drops explosions (`src/store/poolStore.ts:237-238`). Explosions peaked at 5 under normal play but 11 under a heavy injected swarm, so 12 leaves almost no margin. Measure under real load before picking a number.
- **#171, unverified lead:** each explosion has its own `pointLight` toggled through `visible`, and turrets have more. Three.js builds shader variants per light count, so a changing count could cause hitches that pool size won't fix. Check with a trace before acting on this.
- **#179:** seeding alone won't give replays. Turret damage and spawn timers integrate render-frame `delta`, and `StrictMode` (`src/main.tsx:89`) double-invokes render-time initialisers in dev, which is exactly where `?seed=` is used, so they'd consume extra draws from a shared stream. Seed only the spawn roll and position, keep cosmetics on `Math.random()`, and promise "reproducible spawn sequence" rather than "replay". #177 already has a fallback that doesn't need this.
- **#170:** `setBodyType` on the handle can be overwritten, because `@react-three/rapier` re-applies the `type` prop when it changes. Prefer `setEnabled`, or drive `type` from `active`. From reading the library; not tested.

## Decisions only you can make

- **#176:** is starting at `reduced` deliberate? I'd keep it (option A) and delete the dead ternary.
- **#180:** should asteroids hit each other? I'd say no: it's cheaper and keeps approach lines predictable. It also makes the ±2 fragment offset unnecessary. It changes difficulty, so decide alongside #126.
- **#183:** focus fire or spread? This decides the targeting policy, more than the penalty's maths does.
- **Root-level review docs:** `idea.md` and `refactoring_suggestions.md` need a call on whether to archive them. The performance reviews moved to `docs/reviews/` in #205.
