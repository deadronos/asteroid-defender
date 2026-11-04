import { describe, expect, it } from "vite-plus/test";
import { COMBAT_BLOCKED_SHOTS, findNextSafeShot, SHOTS } from "./shotDefinitions";

describe("findNextSafeShot", () => {
  it("walks one shot forward when nothing is blocked", () => {
    expect(findNextSafeShot(0, new Set())).toBe(1);
    expect(findNextSafeShot(1, new Set())).toBe(2);
    expect(findNextSafeShot(2, new Set())).toBe(3);
    expect(findNextSafeShot(3, new Set())).toBe(0);
  });

  it("skips the shot blocked in combat", () => {
    expect(COMBAT_BLOCKED_SHOTS.has(2)).toBe(true);
    expect(findNextSafeShot(1, COMBAT_BLOCKED_SHOTS)).toBe(3);
    expect(findNextSafeShot(2, COMBAT_BLOCKED_SHOTS)).toBe(3);
  });

  it("keeps walking past several blocked shots", () => {
    expect(findNextSafeShot(1, new Set([2, 3]))).toBe(0);
  });

  it("stays put when every other shot is blocked", () => {
    const blocked = new Set(SHOTS.map((_, index) => index));
    expect(findNextSafeShot(2, blocked)).toBe(2);
  });
});
