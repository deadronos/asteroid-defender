import { describe, expect, it } from "vite-plus/test";
import { getBackgroundVisualProfile } from "./backgroundVisualQuality";

describe("backgroundVisualQuality", () => {
  it("keeps the richest background on full quality without reduced motion", () => {
    expect(getBackgroundVisualProfile("full", false)).toEqual({
      starCount: 7000,
      starFactor: 5,
      starSaturation: 0.15,
      starSpeed: 0.5,
      showNebula: true,
      dustCount: 400,
      animateDust: true,
      showShootingStars: true,
    });
  });

  it("trims background motion and density on reduced quality", () => {
    expect(getBackgroundVisualProfile("reduced", false)).toEqual({
      starCount: 3200,
      starFactor: 4.2,
      starSaturation: 0.08,
      starSpeed: 0.35,
      showNebula: true,
      dustCount: 220,
      animateDust: false,
      showShootingStars: true,
    });
  });

  it("biases further toward readability when reduced motion is enabled", () => {
    expect(getBackgroundVisualProfile("reduced", true)).toEqual({
      starCount: 1800,
      starFactor: 3.5,
      starSaturation: 0.04,
      starSpeed: 0.2,
      showNebula: true,
      dustCount: 140,
      animateDust: false,
      showShootingStars: false,
    });
  });

  it("keeps only a sparse static backdrop when effects are off", () => {
    expect(getBackgroundVisualProfile("off", false)).toEqual({
      starCount: 900,
      starFactor: 3.2,
      starSaturation: 0,
      starSpeed: 0,
      showNebula: false,
      dustCount: 0,
      animateDust: false,
      showShootingStars: false,
    });
  });
});
