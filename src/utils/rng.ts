/**
 * Seeded RNG (mulberry32) for gameplay decisions.
 *
 * The seed comes from `?seed=<n>` so a run can be replayed exactly, and from
 * `crypto` otherwise so production stays unpredictable. Dev telemetry records it
 * as `rng:seed`. Cosmetic systems (background dust, shooting stars) deliberately
 * keep `Math.random()` so visual variety stays unrepeatable.
 */
let seed = 0;
let state = 0;

export function seedRandom(nextSeed: number): void {
  seed = nextSeed >>> 0;
  state = seed;
}

/** The seed the current sequence started from — replay it with `?seed=<seed>`. */
export function getRandomSeed(): number {
  return seed;
}

/** Uniform in `[0, 1)`. */
export function random(): number {
  state = (state + 0x6d2b79f5) >>> 0;
  let t = state;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** Uniform in `[min, max)`. */
export function randomRange(min: number, max: number): number {
  return min + random() * (max - min);
}

function readSeed(): number {
  if (typeof location !== "undefined") {
    const raw = new URLSearchParams(location.search).get("seed");
    const parsed = raw === null || raw.trim() === "" ? Number.NaN : Number(raw);

    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  const values = new Uint32Array(1);
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    crypto.getRandomValues(values);
    return values[0];
  }

  return Math.floor(Math.random() * 0x100000000);
}

seedRandom(readSeed());
