/**
 * Central tuning values for asteroid spawning and the fixed asteroid pool.
 *
 * The pool is a fixed set of pre-allocated slots reused across spawns, so
 * raising `ASTEROID_POOL_SIZE` increases steady-state React/Rapier cost.
 * Keep it aligned with the performance budget in docs/PERFORMANCE.md.
 */

/** Number of pre-allocated asteroid (and explosion) slots. */
export const ASTEROID_POOL_SIZE = 60;

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
