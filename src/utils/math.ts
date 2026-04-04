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
 * Generates a random position on a sphere of a given radius.
 * Note: This version is specifically tuned for the asteroid spawning logic
 * but can be generalized if needed.
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
