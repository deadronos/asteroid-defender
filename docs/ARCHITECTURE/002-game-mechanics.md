# Architecture Decision Record: 002 - Game Entities & Mechanics

Reviewed: 2026-11-04 @ 855355f

## Context

The game "Asteroid Defender" requires automated entities (Turrets) to independently track and destroy incoming threats (Asteroids) before they reach a central objective (Platform).

## Decision

We define the game world through isolated, querying systems interacting within the Miniplex ECS.

### 1. The Central Platform

The origin `[0, 0, 0]` serves as the critical defense point. It is a fixed Rapier body with a `CylinderCollider`, serving as the anchor for the turrets, the target vector for the asteroids, and the collider that reports base hits (see `base_health_and_game_over.md`).

Collision groups are explicit in `config/physics.ts`: asteroids collide with the platform and pass through each other. Deliberate choice (#180) — an asteroid's approach line stays the line the spawner chose instead of being bent by shoving, and the solver does no work on asteroid-on-asteroid pairs. Turning it back on is one bit in `ASTEROID_COLLISION_GROUPS`.

### 2. The Asteroid Swarm (Threats)

- **Spawning System**: A `<useFrame>` timer in `AsteroidSpawner` operating on a dynamic interval between `1.0s` and `5.0s`. It evaluates the "danger level" (how many asteroids are currently in close proximity via ECS queries) and adjusts its throttle accordingly.
- **Asteroid Classes**: Asteroids are assigned one of three classes on spawn, dictating their base stats:
  1. `swarmer`: Fast, low health, low damage.
  2. `tank`: Slow, very high health, massive damage on impact.
  3. `splitter`: Medium speed and health. Upon destruction by a turret, it shatters into multiple `swarmer` fragments.
- **Movement**: Asteroids are spawned roughly along a 40-unit radius shell (with a slight vertical flattening to keep the swarm focused in the play area). Upon creation, their `<RigidBody>` is assigned a constant linear velocity directly towards the origin.
- **Data Structure**: Asteroids write their position back into the ECS on every frame and manage their own `health` value (which can be fractional due to continuous DPS damage).

### 3. The Turret Defenses (Automata)

There are four turrets rigidly mounted to the top and bottom of the platform.

- **AI Targeting**: Turrets operate their own `useFrame` logic, using `findNearestAsteroidInRange` over the spatial index (with a linear-scan fallback below 80 entities) for nearby `isAsteroid=true` entities to avoid $O(N)$ full-world scans in hot loops.
- **Hemispheric Restriction**: Turrets only evaluate asteroids in their respective hemisphere (Y > 0 or Y < 0) to prevent firing lasers "through" the platform hull.
- **Target Distribution**: Turrets utilize collaborative targeting. They observe if an asteroid's `targetedBy` ECS field is populated by a _different_ Turret ID. If so, they charge that asteroid `TARGETED_DISTANCE_MULTIPLIER` (2) times its squared distance, so a turret takes a free target up to 41% farther away and only doubles up beyond that (#183).
- **Damage Model**: Framerate-independent continuous Damage-Per-Second (DPS) scaling with `delta` (clamped to prevent hitch spikes). Base DPS scales linearly based on proximity (from `TURRET_MAX_DPS = 180` at point-blank to `TURRET_MIN_DPS = 10` at max range `TURRET_RANGE = 50`), preventing instant-kills at spawn distance and ensuring identical damage output across 60Hz, 120Hz, and 144Hz displays.
- **Splitting Mechanics**: If a turret destroys an asteroid of the `splitter` class, the explosion callback explicitly enqueues two new `swarmer` class asteroids near the impact site, forcing turrets to dynamically re-acquire the new targets.

## Consequences

- **Positive:** Self-contained entity logic scales infinitely. We could add 100 turrets or 1,000 asteroids and they would organically acquire targets based on the ECS queries without needing to refactor a top-down orchestration manager.
