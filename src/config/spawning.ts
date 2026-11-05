/**
 * Central tuning values for asteroid spawning and the fixed asteroid pool.
 *
 * The pool is a fixed set of pre-allocated slots reused across spawns, so
 * raising `ASTEROID_POOL_SIZE` increases steady-state React/Rapier cost.
 * Keep it aligned with the performance budget in docs/PERFORMANCE.md.
 * Spawn geometry (spawn radius, turret range) lives in `config/arena.ts`.
 */

/** Number of pre-allocated asteroid slots. */
export const ASTEROID_POOL_SIZE = 60;

/**
 * Number of pre-allocated explosion slots. Explosions live about 0.6s, so far
 * fewer are alive at once than there are asteroids. Measured peak concurrency:
 * 5 during normal play, 23 with the arena filled to `AMBIENT_ACTIVE_CAP` and
 * splitter fragments and base hits included. 32 leaves headroom over that
 * peak; a smaller pool would start dropping blasts, because `triggerExplosion`
 * returns without a slot when the pool is full.
 */
export const EXPLOSION_POOL_SIZE = 32;

/**
 * Slots held back from the ambient spawner so splitter fragments always have
 * room to activate when a splitter is destroyed.
 */
export const FRAGMENT_RESERVE_SLOTS = 10;

/**
 * Ambient spawner stops enqueuing new asteroids once this many are active,
 * leaving the reserve above for fragments.
 */
export const AMBIENT_ACTIVE_CAP = ASTEROID_POOL_SIZE - FRAGMENT_RESERVE_SLOTS;

/**
 * Maximum number of queued spawns activated per frame. Spreads bursts (e.g.
 * many splitters dying at once) across frames instead of activating at once.
 */
export const MAX_ACTIVATIONS_PER_FRAME = 4;

/**
 * Hard bound on the pending spawn queue. Acts as a safety valve so the queue
 * can never grow without limit; realistic bursts (2 fragments per splitter,
 * at most ~60 splitters) stay well under this.
 */
export const MAX_PENDING_SPAWNS = 128;

/** Spawn interval at the start of a run, before backpressure adapts it. */
export const INITIAL_SPAWN_INTERVAL = 2.0;
export const MIN_SPAWN_INTERVAL = 1.0;
export const MAX_SPAWN_INTERVAL = 5.0;

/** Step the spawn interval moves by on each spawn decision. */
export const SPAWN_ADJUSTMENT = 0.2;

/**
 * Number of asteroids inside the proximity probe radius at which the spawner
 * stops speeding up and starts slowing down.
 */
export const PROXIMITY_TARGET_COUNT = 3;
