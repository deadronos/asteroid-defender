/**
 * Arena geometry: where asteroids enter play and how far turrets reach.
 *
 * These values live together because they interact, but they do not share an
 * origin: `SPAWN_RADIUS` is measured from the arena centre, `TURRET_RANGE` from
 * each turret's own position. The two numbers are therefore not directly
 * comparable. With today's values a turret can reach an asteroid the moment it
 * spawns, so there is no approach time before engagement. That is existing
 * behaviour, not a design contract, so nothing asserts it.
 */

/** Distance from the arena centre at which asteroids spawn. */
export const SPAWN_RADIUS = 40;

/**
 * Radius around the arena centre in which the spawner counts asteroids for
 * backpressure. Smaller than `SPAWN_RADIUS` on purpose: it counts asteroids
 * that have travelled inward, not ones just placed on the spawn shell.
 */
export const PROXIMITY_PROBE_RADIUS = 25;

/** Distance a turret can target, measured from the turret itself. */
export const TURRET_RANGE = 50;
export const TURRET_RANGE_SQ = TURRET_RANGE * TURRET_RANGE; // 2500

/**
 * How much an asteroid another turret already holds costs, as a multiple of its
 * real squared distance: a turret takes a free target up to this much farther
 * away, and only doubles up when everything else is beyond that (#183).
 */
export const TARGETED_DISTANCE_MULTIPLIER = 2;
