# What to do next

Reviewed: 2026-11-04 @ `5681aa3`, after #192-#196 merged and `v1.0.21` released from `32cfa2d`.
Working note, not documentation: delete it once the items below are done or filed.

## The short version

- `v1.0.21` is live from `32cfa2d` and includes the #156 jam fix (#184), so "fixed but not released" is no longer true.
- `check` is a required status check on `main`, through the "main: require CI" ruleset, which has an admin bypass.
- The render smoke test (#167 step 2) merged in #192. Step 1, the DOM/render harness, is still open.
- Balance: four 10-minute production runs in headless software rendering at about 25 fps ended at base 100%, 95%, 100%, 100%, with 830-883 destroyed, a peak Active Swarm of 2-4, and a steady kill rate of about 1.4/s. The game plays correctly but in practice can't be lost and doesn't get harder. #126 waves is the real fix.
- Next up: #157, then #162, then #158.

All checks stayed green while the game was jammed (#156), because nothing runs the game loop. The smoke test in #192 now covers the pool lifecycle and would have caught it.

## Done

- #185, `vp dev` crashed on load: fixed in #187.
- #165, PRs ungated: fixed in #188, then made required on `main` (see above).
- #186, shield impact never fired: fixed in #196, including the base-hit ripple wiring.
- #169, #159 and #160: merged in #193, #194 and #195, in that order.
- #167 step 2: merged in #192; step 1 stays open.
- `v1.0.21`: tagged from `32cfa2d`; contains #184 and #192.
- #197 tracks the shield ripple that draws near the platform centre instead of at the impact.

## Open work

| Item            | Note                                                                                                                                             |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| #157            | Dead compatibility surface: `useExplosionPool`, `AsteroidPoolState`, the unused `useAsteroidManager` return, and three math exports. Do it first |
| #162, then #158 | #158's one-line fix goes in the effect #162 makes the single owner                                                                               |
| #167 step 1     | DOM/render harness; the smoke test currently covers `AsteroidLayer` only                                                                         |
| #126 waves      | The real difficulty fix. #4 is a duplicate; #168 and #181 are groundwork                                                                         |
| #172, #173      | Unblocked by #184: slots are copy-on-write, so the layer can stop subscribing to the raw count                                                   |
| #166            | Docs truth; easier once the above has landed                                                                                                     |
| #125 audio      | No dependencies, biggest cheap feel upgrade. Kill and base-hit events exist; a continuous laser needs a loop, not one-shots                      |

### Later or only on demand

- **#161 + #182:** merge these. Both define `src/game/combat.ts` and `applyTurretDamage`.
- **#170 + #180:** do these together, since both change physics.
- **#163, #164:** real refactors, but no player benefit. Do them when next changing those files.
- **#177, #174, #178:** #178 has no visible effect while `maxHealth` is always 100.
- **#179:** gameplay RNG pass only (see below).

## Known risks and small findings

- **Slot reuse is still only protected by frame order.** A slot that dies and is reused in the same React batch with the same type keeps `active`, `id` and `type`, so the effect in `src/components/Asteroid.tsx` wouldn't re-run. This didn't happen (0 of 169 reuses in a 121s measurement) because spawns currently run before deaths each frame. That order may come from `<group key={sessionId}>` remounting the children, so a refactor could change it unnoticed. #192 doesn't pin this.
- **Limits of the runtime evidence:** headless Chrome with software rendering and few runs. The live site got one 60s check on `v1.0.21`; nothing has been measured on a real GPU.
- **False comment in `src/components/gameScene/AsteroidLayer.test.tsx`:** it says `World.clear()` leaves queries stale. It doesn't: `ECS.clear()` empties the query, and the scene tests still pass using it. Fix the comment, and optionally the loop, with the next change to that file.
- **Not filed yet:** load-time work, most likely `createNebulaTexture.ts`, records about 14.6M telemetry events and overflows the buffer before play starts.

## Quick housekeeping (about 10 minutes)

- **Close PR #145.** `main` has `fflate` 0.8.3 at the top level and 0.6.11 under `three-stdlib`, so the 0.6.10 -> 0.6.11 bump is redundant.
- **Close #119.** All six children (#112-#117) are closed.
- **Close #4 as a duplicate of #126.** Copy #4's pacing comment across first; it's the most useful part.
- **Repair #125 and #126.** Their code spans are blank (e.g. "Could use / to spatialize"). #126 also says the spawn interval is 0.5s-5s, while the code uses 1.0-5.0.

## Corrections to the issues

Worth fixing in the issue text before anyone implements from it.

- **#168:** contradicts itself. It notes `SPAWN_RADIUS` (40) is less than `TURRET_RANGE` (50), then proposes a test asserting `SPAWN_RADIUS > TURRET_RANGE`, which would fail. Decide the intended relationship first. Also, range is measured from each turret and spawn radius from the origin, so the two numbers don't compare directly.
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
- **Root-level review docs:** `PERFORMANCE-REVIEW*.md`, `idea.md` and `refactoring_suggestions.md` need a call on whether to archive them (#166 covers only part of this).
