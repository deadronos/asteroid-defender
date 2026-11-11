/**
 * Rapier interaction groups pack membership in the high 16 bits and the filter
 * in the low 16 bits; two colliders interact only when each one's membership is
 * in the other's filter.
 *
 * Deliberate choice: asteroids collide with the base and pass through each
 * other (#180). The approach line is then the line the spawner chose instead of
 * one bent by asteroid-on-asteroid shoving, and the broadphase has nothing to
 * resolve among up to 60 mutual dynamic bodies.
 */
export const GROUP_BASE = 0x0001;
export const GROUP_ASTEROID = 0x0002;

export const ASTEROID_COLLISION_GROUPS = (GROUP_ASTEROID << 16) | GROUP_BASE;
export const BASE_COLLISION_GROUPS = (GROUP_BASE << 16) | GROUP_ASTEROID;
