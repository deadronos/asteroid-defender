import { describe, expect, it } from "vite-plus/test";
import { getRandomSeed, random, randomRange, seedRandom } from "./rng";

describe("rng", () => {
  it("repeats the same sequence from the same seed", () => {
    seedRandom(1234);
    const first = Array.from({ length: 20 }, random);
    seedRandom(1234);

    expect(Array.from({ length: 20 }, random)).toEqual(first);
  });

  it("produces different sequences from different seeds", () => {
    seedRandom(1);
    const first = random();
    seedRandom(2);

    expect(random()).not.toBe(first);
  });

  it("stays in [0, 1) and inside randomRange bounds", () => {
    seedRandom(99);

    for (let i = 0; i < 1000; i++) {
      const value = random();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);

      const ranged = randomRange(3, 8);
      expect(ranged).toBeGreaterThanOrEqual(3);
      expect(ranged).toBeLessThan(8);
    }
  });

  it("reports the seed the sequence started from", () => {
    seedRandom(42);
    expect(getRandomSeed()).toBe(42);
  });
});
