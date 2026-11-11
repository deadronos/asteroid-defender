export const REDUCED_MOTION_MEDIA_QUERY = "(prefers-reduced-motion: reduce)";

/** The matchMedia query, or `null` where the environment has no matchMedia (tests, SSR). */
export function reducedMotionMediaQuery(): MediaQueryList | null {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return null;
  }

  return window.matchMedia(REDUCED_MOTION_MEDIA_QUERY);
}

/** The OS-level motion preference. False where `matchMedia` is unavailable. */
export function prefersReducedMotion(): boolean {
  return reducedMotionMediaQuery()?.matches === true;
}
