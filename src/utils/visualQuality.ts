export type EffectsQuality = "full" | "reduced" | "off";

export interface VisualProfile {
  effectsQuality: EffectsQuality;
  dpr: number;
}

export const FULL_EFFECTS_MAX_DPR = 1.25;
export const REDUCED_EFFECTS_MAX_DPR = 1.0;
export const REDUCED_MOTION_MAX_DPR = 0.75;
export const EFFECTS_OFF_MAX_DPR = 0.75;
export const PERFORMANCE_FALLBACK_DPR = 0.5;

function normalizeEffectsQuality(quality: EffectsQuality, reducedMotion: boolean): EffectsQuality {
  if (reducedMotion && quality === "full") {
    return "reduced";
  }

  return quality;
}

export function getPreferredEffectsQuality(reducedMotion: boolean): EffectsQuality {
  return reducedMotion ? "reduced" : "full";
}

export function getMaxDprForEffectsQuality(
  quality: EffectsQuality,
  reducedMotion: boolean,
): number {
  const normalizedQuality = normalizeEffectsQuality(quality, reducedMotion);

  switch (normalizedQuality) {
    case "full":
      return FULL_EFFECTS_MAX_DPR;
    case "reduced":
      return reducedMotion ? REDUCED_MOTION_MAX_DPR : REDUCED_EFFECTS_MAX_DPR;
    case "off":
      return EFFECTS_OFF_MAX_DPR;
  }
}

export function createVisualProfile(
  quality: EffectsQuality,
  reducedMotion: boolean,
): VisualProfile {
  const normalizedQuality = normalizeEffectsQuality(quality, reducedMotion);

  return {
    effectsQuality: normalizedQuality,
    dpr: getMaxDprForEffectsQuality(normalizedQuality, reducedMotion),
  };
}

export function getInitialVisualProfile(reducedMotion: boolean): VisualProfile {
  return createVisualProfile(getPreferredEffectsQuality(reducedMotion), reducedMotion);
}

export function improveVisualProfile(
  current: VisualProfile,
  reducedMotion: boolean,
): VisualProfile {
  const normalizedQuality = normalizeEffectsQuality(current.effectsQuality, reducedMotion);

  if (normalizedQuality === "off") {
    return createVisualProfile("reduced", reducedMotion);
  }

  if (normalizedQuality === "reduced" && !reducedMotion) {
    return createVisualProfile("full", reducedMotion);
  }

  return createVisualProfile(normalizedQuality, reducedMotion);
}

export function degradeVisualProfile(
  current: VisualProfile,
  reducedMotion: boolean,
): VisualProfile {
  const normalizedQuality = normalizeEffectsQuality(current.effectsQuality, reducedMotion);

  if (normalizedQuality === "full") {
    return createVisualProfile("reduced", reducedMotion);
  }

  if (normalizedQuality === "off") {
    return {
      effectsQuality: "off",
      dpr: Math.min(current.dpr, EFFECTS_OFF_MAX_DPR),
    };
  }

  return createVisualProfile("off", reducedMotion);
}

export function fallbackVisualProfile(): VisualProfile {
  return {
    effectsQuality: "off",
    dpr: PERFORMANCE_FALLBACK_DPR,
  };
}

export function clampVisualProfile(current: VisualProfile, reducedMotion: boolean): VisualProfile {
  const normalizedQuality = normalizeEffectsQuality(current.effectsQuality, reducedMotion);
  const maxDpr = getMaxDprForEffectsQuality(normalizedQuality, reducedMotion);

  return {
    effectsQuality: normalizedQuality,
    dpr: Math.min(current.dpr, maxDpr),
  };
}
