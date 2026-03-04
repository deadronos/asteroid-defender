# Architecture Decision Record: 002 - Game Entities & Mechanics

## Context
The game "Asteroid Defender" requires automated entities (Turrets) to independently track and destroy incoming threats (Asteroids) before they reach a central objective (Platform). 

## Decision
We define the game world through isolated, querying systems interacting within the Miniplex ECS.

### 1. The Central Platform
The origin `[0, 0, 0]` serves as the critical defense point. It is a static mesh with no complex physics updates, serving merely as the anchor point for the turrets and the target vector for the asteroids.

### 2. The Asteroid Swarm (Threats)
- **Spawning System**: An asynchronous `<useFrame>` loop operating on a dynamic interval. It evaluates the "danger level" (how many asteroids are currently in close proximity via ECS queries) and adjusts its throttle accordingly.
- **Asteroid Classes**: Asteroids are assigned one of three classes on spawn, dictating their base stats:
  1. `swarmer`: Fast, low health, low damage.
  2. `tank`: Slow, very high health, massive damage on impact.
  3. `splitter`: Medium speed and health. Upon destruction by a turret, it shatters into multiple `swarmer` fragments.
- **Movement**: Asteroids are spawned perfectly along the boundary of a 40-unit radius sphere. Upon creation, their `<RigidBody>` is assigned a constant linear velocity directly towards the origin.
- **Data Structure**: Asteroids write their position back into the ECS on every frame and manage their own `health` integer.

### 3. The Turret Defenses (Automata)
There are four turrets rigidly mounted to the top and bottom of the platform.
- **AI Targeting**: Turrets operate their own `useFrame` logic, scanning the ECS for the closest `isAsteroid=true` entity.
- **Hemispheric Restriction**: Turrets only evaluate asteroids in their respective hemisphere (Y > 0 or Y < 0) to prevent firing lasers "through" the platform hull.
- **Target Distribution**: Turrets utilize collaborative targeting. They observe if an asteroid's `targetedBy` ECS field is populated by a *different* Turret ID. If so, they artificially inflate the distance calculation to that asteroid, encouraging turrets spread their fire across multiple targets to maximize swarm suppression.
- **Damage Model**: Damage scales linearly based on proximity. A laser deals maximum damage when an asteroid is near the hull, preventing instant-kills at spawn distance and allowing targets to visually close in on the base.
- **Splitting Mechanics**: If a turret destroys an asteroid of the `splitter` class, the explosion callback explicitly spawns two new `swarmer` class asteroids near the impact site, forcing turrets to dynamically re-acquire the new targets.

## Consequences
- **Positive:** Self-contained entity logic scales infinitely. We could add 100 turrets or 1,000 asteroids and they would organically acquire targets based on the ECS queries without needing to refactor a top-down orchestration manager.
