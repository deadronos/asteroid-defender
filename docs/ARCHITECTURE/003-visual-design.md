# Architecture Decision Record: 003 - Visual Design & Effects

## Context

A space-defense game needs to visually communicate threat and action clearly against a dark background, without complex textures overwhelming the browser's GPU.

## Decision

We adopted a low-poly, cel-shaded art direction punctuated by high-contrast particle effects.

### Cel-Shading & Geometry

- **Primitives**: Standard Three.js geometry (`cylinder`, `dodecahedron`, `cone`) is utilized over imported GLTF models to reduce bundle size and memory footprint.
- **Outlines**: `@react-three/drei`'s `<Edges>` component is attached to all solid meshes (Platform, Turrets, Asteroids) rendering a stark black line along hard angles (`threshold={15}`). Combined with flat-shaded gray and red materials, this mimics a 3D comic-book illustration style.

### Laser Weaponry

- **Rendering**: Instant-hit lasers are drawn using Drei's `<Line>` component, spanning from the Turret's origin to the transformed local coordinates of the locked target.
- **Juice (Animation)**:
  - The line's `lineWidth` pulses rapidly via a sine wave driven by `useFrame` time, simulating intense energy output.
  - A small, translucent `<SphereGeometry>` with high `emissive` values is rendered precisely at the target intersection point, simulating a glowing impact flare.
  - A post-processing `<Bloom>` effect is applied to the root React Three Fiber `<EffectComposer>`, causing the laser lines and impacts to visibly glow against the dark space background.

### Destruction Particles (Explosions)

- **Design Pattern**: We do _not_ use complex particle systems (e.g., thousands of raw WebGL points). Instead, we use low-count Instanced or individually mapped meshes.
- **Mechanic**: When an Asteroid's ECS `health` breaches 0, or it collides with the central platform, it removes itself from the physics solver and dispatches a callback with its final world coordinates. The main `GameScene` unmounts the asteroid and mounts an `<Explosion>` component exactly at that vector.
- **Animation**: The `<Explosion>` is composed of 8 miniature `<dodecahedronGeometry>` fragments. Each fragment is assigned a random 3D trajectory velocity on initialization. The material color of the explosion matches the `AsteroidClass` color. A tight `useFrame` loop scales them down and moves them outward until they fade into zero and automatically unmount.

### Environment & Skybox (Space Background)

- **Procedural Nebula**: To simulate deep space without massive texture assets, 3D FBM noise is generated once on load into a lightweight equirectangular `DataTexture` and sampled in the fragment shader on the internal face of a large background `<Sphere>`. By deriving lookup coordinates from `normalize(position)` and repeating on the longitudinal axis, the nebula wraps seamlessly around the scene without visible seams.
- **Atmospheric Depth**: A `<SpaceDust>` component floats slowly through the actual play area, providing parallax and a sense of scale against the background sphere. Intermittent `<ShootingStar>` components fire across the skybox on randomized temporal intervals to keep the deep background feeling chaotic and active.
- **Adaptive Fallbacks**: The background consumes the same visual-quality tiers as post-processing and asteroid rendering. Reduced tiers lower the `<Stars>` count, stop the CPU dust update loop, and suppress extra motion under reduced-motion mode. The cheapest tier keeps only a sparse static star field, dropping the nebula shader and other cosmetic background systems so gameplay contrast improves when performance is under pressure.
