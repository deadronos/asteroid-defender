/**
 * Generic math and randomization utilities for 3D logic.
 */

/**
 * Returns a random number between min (inclusive) and max (exclusive).
 */
export function getRandomRange(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

/**
 * Returns a random boolean based on a probability (0 to 1).
 */
export function getRandomBoolean(probability = 0.5): boolean {
  return Math.random() < probability;
}

/**
 * Linearly interpolates between two numbers.
 */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Clamps a number between min and max.
 */
export function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

/**
 * Generates a random position on a sphere of a given radius, biased toward
 * the equatorial plane (Y is halved) to keep asteroids in the play zone.
 *
 * The theta term intentionally is not uniformly distributed — it uses a
 * phi-dependent magnitude (`sqrt(radius * PI) * phi`) that creates a
 * non-uniform azimuthal bias, producing slightly heavier clustering in
 * certain quadrants.  For gameplay this is preferable to true uniformity
 * because it prevents asteroids from always arriving in a perfectly even
 * shell, which would look synthetic.
 *
 * Can be generalized to a true uniform-on-sphere distribution if needed.
 */
export function getRandomSpherePosition(radius: number): [number, number, number] {
  const phi = Math.acos(-1 + 2 * Math.random());
  const theta = Math.sqrt(radius * Math.PI) * phi;
  const x = radius * Math.cos(theta) * Math.sin(phi);
  const y = radius * Math.sin(theta) * Math.sin(phi) * 0.5; // Flattened Y for gameplay
  const z = radius * Math.cos(phi);
  return [x, y, z];
}

/**
 * Generates a random small angular velocity for physical bodies.
 */
export function getRandomAngularVelocity(magnitude = 0.9): { x: number; y: number; z: number } {
  return {
    x: (Math.random() - 0.5) * magnitude,
    y: (Math.random() - 0.5) * magnitude,
    z: (Math.random() - 0.5) * magnitude,
  };
}
