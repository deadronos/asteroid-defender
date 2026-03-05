import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import useGameStore from '../store/gameStore';

/** Seconds each shot is held before the next transition begins */
const SHOT_DURATION = 17;
/** Seconds the smooth transition between shots takes */
const TRANSITION_DURATION = 2.5;
/** Orbit angular speed for the wide-orbit shot (radians / second) */
const ORBIT_SPEED = 0.035;
/**
 * Minimum seconds to hold a shot after a transition completes before
 * allowing the next cut (target-lock hysteresis).
 */
const POST_TRANSITION_MIN_HOLD = 3;
/**
 * Maximum transition duration (seconds) enforced during active combat.
 * Keeps occlusion periods below the ~1.5 s threshold specified in the
 * readability requirements.
 */
const COMBAT_MAX_TRANSITION_DURATION = 1.5;
/**
 * Shot indices that are skipped during active combat because they obstruct
 * readability (e.g. occlusion of the base center or low-angle that puts
 * turrets/asteroids mostly off-screen).
 *
 * Shot 2 – low-angle from the platform edge (camera y = -9) – is excluded
 * because the base platform is fully off-screen below the camera and the
 * incoming asteroid swarm appears too far in the background.
 */
const COMBAT_BLOCKED_SHOTS = new Set([2]);

// Read dynamic turret positions avoiding hardcodes. This is acceptable for simple
// visual polling of existing fixed-position entities. If these were moving we
// would use function getters that check ECS
const t1 = new THREE.Vector3(5, 1, 0);
const getTurret1 = () => t1;
const t2 = new THREE.Vector3(-5, 1, 0);
const getTurret2 = () => t2;

const lookZero = new THREE.Vector3(0, 0, 0);
const lookHigh = new THREE.Vector3(0, 12, 0);

/** Fixed camera position and look-at used in static (non-cinematic) mode */
const STATIC_CAMERA_POS = new THREE.Vector3(0, 18, 30);
const STATIC_CAMERA_LOOK = new THREE.Vector3(0, 0, 0);

interface ShotDef {
    /** Camera world position; receives the running orbit angle, elapsed shot time, and target vector */
    getPos: (angle: number, t: number, target: THREE.Vector3) => THREE.Vector3;
    /** World-space look-at target */
    getLookAt: () => THREE.Vector3;
    /**
     * Normalized focus distance for the Depth-of-Field effect.
     * Approximate formula: worldDistance / camera.far (far = 1000 default).
     */
    focusDist: number;
}

const SHOTS: ShotDef[] = [
    {
        // 0 – Wide cinematic orbit: slow 360° sweep high above the battle
        getPos: (angle, _, target) => target.set(
            Math.cos(angle) * 32,
            18,
            Math.sin(angle) * 32,
        ),
        getLookAt: () => lookZero,
        focusDist: 0.032, // focus ~32 units away (platform centre)
    },
    {
        // 1 – Tight close-up of turret #1 tracking an incoming asteroid
        getPos: (_, t, target) => target.set(
            10 + Math.sin(t * 0.25) * 0.35,
            6 + Math.cos(t * 0.2) * 0.2,
            10,
        ),
        getLookAt: getTurret1,
        focusDist: 0.012, // focus ~12 units away (turret)
    },
    {
        // 2 – Low-angle shot from the platform edge looking up at the swarm
        getPos: (_, t, target) => target.set(
            10 + Math.cos(t * 0.3) * 0.3,
            -9,
            10 + Math.sin(t * 0.2) * 0.3,
        ),
        getLookAt: () => lookHigh,
        focusDist: 0.025, // focus ~25 units away (mid-swarm)
    },
    {
        // 3 – Diagonal side view featuring turret #2
        getPos: (_, t, target) => target.set(
            -18 + Math.sin(t * 0.2) * 0.35,
            8,
            16 + Math.cos(t * 0.25) * 0.3,
        ),
        getLookAt: getTurret2,
        focusDist: 0.022, // focus ~22 units away (turret)
    },
];

/** Smoothstep easing: smooth start and stop for camera transitions */
function smoothstep(t: number): number {
    return t * t * (3 - 2 * t);
}

/**
 * Returns the next shot index that is not in the blocked set, starting from
 * `currentIdx + 1` and wrapping around.  Falls back to `currentIdx` if every
 * shot is blocked (should never happen with the current SHOTS definition, but
 * keeps the camera moving rather than crashing).
 */
function findNextSafeShot(currentIdx: number, blockedShots: Set<number>): number {
    let candidate = (currentIdx + 1) % SHOTS.length;
    for (let i = 0; i < SHOTS.length; i++) {
        if (!blockedShots.has(candidate)) return candidate;
        candidate = (candidate + 1) % SHOTS.length;
    }
    // All shots are blocked – return current so behaviour is well-defined.
    return currentIdx;
}

/**
 * Shared mutable object – mutated by CinematicCamera on every shot change,
 * read by DynamicDepthOfField in App.tsx.  Using a plain object avoids the
 * overhead of Zustand or React context for per-shot (not per-frame) updates.
 */
export const dofSettings = {
    focusDistance: SHOTS[0].focusDist,
    focalLength: 0.025,
    bokehScale: 3,
};

/**
 * Cinematic camera manager.
 *
 * Cycles through four directed "shots" (wide orbit, turret close-up,
 * low-angle swarm shot, diagonal side view), transitioning smoothly
 * between them every ~17 seconds.  Replaces the static OrbitControls.
 *
 * Supports two modes controlled via the game store:
 *  - `cinematic`: full shot-cycling behaviour with eased transitions.
 *  - `static`: smoothly transitions to a fixed overview position and holds.
 *
 * A `reducedMotion` flag (also in the store) halves the orbit speed,
 * doubles the time between cuts, reduces positional drift, and softens
 * camera shake for players sensitive to motion.
 *
 * Returns null – no rendered geometry.
 */
export default function CinematicCamera() {
    const { camera } = useThree();

    const shotIdx = useRef(0);
    const shotTimer = useRef(0);
    const orbitAngle = useRef(0.1); // small initial offset so orbit feels natural

    const inTransition = useRef(false);
    const transitionT = useRef(0);

    // "From" state captured at the moment a transition begins
    const fromPos = useRef(new THREE.Vector3(0, 15, 25)); // matches Canvas initial pos
    const fromLook = useRef(new THREE.Vector3(0, 0, 0));

    // "To" state for the incoming shot
    const toPos = useRef(new THREE.Vector3());
    const toLook = useRef(new THREE.Vector3());

    // Interpolated look-at used every frame for camera.lookAt()
    const activeLook = useRef(new THREE.Vector3(0, 0, 0));

    const firstFrame = useRef(true);

    // Tracks time spent in the current shot *after* a transition has fully
    // completed.  This enforces target-lock hysteresis: the camera will not
    // cut to the next shot until at least POST_TRANSITION_MIN_HOLD seconds
    // have passed since the last transition finished.
    const postTransitionHold = useRef(0);

    // Previous camera mode – used to detect runtime mode switches.
    // Initialized to the store default so no spurious transition fires on mount.
    const prevCameraMode = useRef<string>('cinematic');

    // Mirrors inTransition.current so we only push a store update on change.
    const prevInTransitionForStore = useRef(false);

    useFrame((_, delta) => {
        const { cameraMode, reducedMotion, gameState, activeAsteroids } = useGameStore.getState();

        // Active combat: game is running and at least one asteroid is present
        const isActiveCombat = gameState === 'playing' && activeAsteroids > 0;

        // Multipliers applied when reducedMotion is active
        const orbitMult = reducedMotion ? 0.4 : 1.0;
        const driftMult = reducedMotion ? 0.3 : 1.0;
        const activeShotDuration = reducedMotion ? SHOT_DURATION * 2 : SHOT_DURATION;
        const activeTransitionDuration = reducedMotion ? TRANSITION_DURATION * 1.5 : TRANSITION_DURATION;
        const minHold = reducedMotion ? POST_TRANSITION_MIN_HOLD * 2 : POST_TRANSITION_MIN_HOLD;

        // During active combat, cap transitions to COMBAT_MAX_TRANSITION_DURATION
        // to avoid occlusion periods longer than ~1.5 s.
        const effectiveTransitionDuration = isActiveCombat
            ? Math.min(activeTransitionDuration, COMBAT_MAX_TRANSITION_DURATION)
            : activeTransitionDuration;

        orbitAngle.current += delta * ORBIT_SPEED * orbitMult;
        shotTimer.current += delta;

        const shot = SHOTS[shotIdx.current];

        // ── One-time initialisation: kick off a transition into shot 0 ──────
        if (firstFrame.current) {
            firstFrame.current = false;
            fromPos.current.copy(camera.position);
            fromLook.current.set(0, 0, 0);
            shot.getPos(orbitAngle.current, 0, toPos.current);
            toLook.current.copy(shot.getLookAt());
            inTransition.current = true;
            transitionT.current = 0;
            shotTimer.current = 0;
            postTransitionHold.current = 0;
            dofSettings.focusDistance = shot.focusDist;
        }

        // ── Detect runtime camera-mode switch and start a smooth transition ──
        if (prevCameraMode.current !== cameraMode) {
            prevCameraMode.current = cameraMode;
            fromPos.current.copy(camera.position);
            fromLook.current.copy(activeLook.current);
            if (cameraMode === 'static') {
                toPos.current.copy(STATIC_CAMERA_POS);
                toLook.current.copy(STATIC_CAMERA_LOOK);
            } else {
                // Re-entering cinematic: smoothly move to the current shot's start
                shot.getPos(orbitAngle.current, 0, toPos.current);
                toLook.current.copy(shot.getLookAt());
                shotTimer.current = 0;
                postTransitionHold.current = 0;
                dofSettings.focusDistance = shot.focusDist;
            }
            inTransition.current = true;
            transitionT.current = 0;
        }

        // ── Static mode: handle transition to overview then hold ─────────────
        if (cameraMode === 'static') {
            if (inTransition.current) {
                transitionT.current = Math.min(
                    transitionT.current + delta / TRANSITION_DURATION,
                    1,
                );
                const t = smoothstep(transitionT.current);
                camera.position.lerpVectors(fromPos.current, toPos.current, t);
                activeLook.current.lerpVectors(fromLook.current, toLook.current, t);
                if (transitionT.current >= 1) {
                    inTransition.current = false;
                }
            }
            camera.lookAt(activeLook.current);
            // Static mode is never mid-cinematic-transition from the HUD's perspective.
            if (prevInTransitionForStore.current) {
                prevInTransitionForStore.current = false;
                useGameStore.getState().setCinematicTransition(false);
            }
            return;
        }

        // ── Cinematic mode ───────────────────────────────────────────────────

        // During active combat, if the current shot is a readability-blocked
        // shot (e.g. the low-angle shot) and we are not already transitioning,
        // immediately begin an eased cut to the next safe shot regardless of
        // the normal hold/duration timers.
        if (
            isActiveCombat &&
            COMBAT_BLOCKED_SHOTS.has(shotIdx.current) &&
            !inTransition.current
        ) {
            fromPos.current.copy(camera.position);
            fromLook.current.copy(activeLook.current);

            const safeIdx = findNextSafeShot(shotIdx.current, COMBAT_BLOCKED_SHOTS);
            shotIdx.current = safeIdx;
            const safeShot = SHOTS[safeIdx];
            safeShot.getPos(orbitAngle.current, 0, toPos.current);
            toLook.current.copy(safeShot.getLookAt());
            inTransition.current = true;
            transitionT.current = 0;
            shotTimer.current = 0;
            postTransitionHold.current = 0;
            dofSettings.focusDistance = safeShot.focusDist;
        }

        // Trigger transition to next shot only after the shot duration AND the
        // minimum post-transition hold (hysteresis) have both elapsed.
        if (
            !inTransition.current &&
            shotTimer.current >= activeShotDuration &&
            postTransitionHold.current >= minHold
        ) {
            fromPos.current.copy(camera.position);
            fromLook.current.copy(activeLook.current);

            // Advance to the next shot, skipping any that are blocked during
            // active combat to preserve readability.
            const nextIdx = isActiveCombat
                ? findNextSafeShot(shotIdx.current, COMBAT_BLOCKED_SHOTS)
                : (shotIdx.current + 1) % SHOTS.length;
            shotIdx.current = nextIdx;
            const next = SHOTS[nextIdx];

            next.getPos(orbitAngle.current, 0, toPos.current);
            toLook.current.copy(next.getLookAt());
            inTransition.current = true;
            transitionT.current = 0;
            shotTimer.current = 0;
            postTransitionHold.current = 0;
            dofSettings.focusDistance = next.focusDist;
        }

        // ── Animate camera this frame ────────────────────────────────────────
        if (inTransition.current) {
            transitionT.current = Math.min(
                transitionT.current + delta / effectiveTransitionDuration,
                1,
            );
            const t = smoothstep(transitionT.current);
            camera.position.lerpVectors(fromPos.current, toPos.current, t);
            activeLook.current.lerpVectors(fromLook.current, toLook.current, t);
            if (transitionT.current >= 1) {
                inTransition.current = false;
                postTransitionHold.current = 0;
            }
        } else {
            // Steady shot – orbit continuously for shot 0, subtle drift for others.
            // driftMult scales down oscillation time so reduced-motion produces
            // significantly less positional movement.
            postTransitionHold.current += delta;
            shot.getPos(orbitAngle.current, shotTimer.current * driftMult, camera.position);
            activeLook.current.copy(shot.getLookAt());
        }

        camera.lookAt(activeLook.current);

        // Notify the store when transition state changes so the HUD indicator
        // can show / hide the "Cinematic sweep" label.
        const nowTransitioning = inTransition.current;
        if (nowTransitioning !== prevInTransitionForStore.current) {
            prevInTransitionForStore.current = nowTransitioning;
            useGameStore.getState().setCinematicTransition(nowTransitioning);
        }

        // Apply Camera Shake on Impact (attenuated in reduced-motion mode)
        const lastDamageTime = useGameStore.getState().lastDamageTime;
        if (lastDamageTime > 0) {
            const timeSinceDamage = (Date.now() - lastDamageTime) / 1000;
            if (timeSinceDamage < 0.5) {
                const shakeScale = reducedMotion ? 0.3 : 1.0;
                const shakeIntensity = (0.5 - timeSinceDamage) * 2.0 * shakeScale;
                camera.position.x += (Math.random() - 0.5) * shakeIntensity;
                camera.position.y += (Math.random() - 0.5) * shakeIntensity;
                camera.position.z += (Math.random() - 0.5) * shakeIntensity * 0.5;
            }
        }
    });

    return null;
}
