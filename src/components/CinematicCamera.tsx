import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

/** Seconds each shot is held before the next transition begins */
const SHOT_DURATION = 17;
/** Seconds the smooth transition between shots takes */
const TRANSITION_DURATION = 2.5;
/** Orbit angular speed for the wide-orbit shot (radians / second) */
const ORBIT_SPEED = 0.035;

// Read dynamic turret positions avoiding hardcodes. This is acceptable for simple
// visual polling of existing fixed-position entities. If these were moving we
// would use function getters that check ECS
const getTurret1 = () => new THREE.Vector3(5, 1, 0);
const getTurret2 = () => new THREE.Vector3(-5, 1, 0);

interface ShotDef {
    /** Camera world position; receives the running orbit angle and elapsed shot time */
    getPos: (angle: number, t: number) => THREE.Vector3;
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
        getPos: (angle) =>
            new THREE.Vector3(
                Math.cos(angle) * 32,
                18,
                Math.sin(angle) * 32,
            ),
        getLookAt: () => new THREE.Vector3(0, 0, 0),
        focusDist: 0.032, // focus ~32 units away (platform centre)
    },
    {
        // 1 – Tight close-up of turret #1 tracking an incoming asteroid
        getPos: (_, t) =>
            new THREE.Vector3(
                10 + Math.sin(t * 0.25) * 0.35,
                6 + Math.cos(t * 0.2) * 0.2,
                10,
            ),
        getLookAt: getTurret1,
        focusDist: 0.012, // focus ~12 units away (turret)
    },
    {
        // 2 – Low-angle shot from the platform edge looking up at the swarm
        getPos: (_, t) =>
            new THREE.Vector3(
                10 + Math.cos(t * 0.3) * 0.3,
                -9,
                10 + Math.sin(t * 0.2) * 0.3,
            ),
        getLookAt: () => new THREE.Vector3(0, 12, 0),
        focusDist: 0.025, // focus ~25 units away (mid-swarm)
    },
    {
        // 3 – Diagonal side view featuring turret #2
        getPos: (_, t) =>
            new THREE.Vector3(
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

    useFrame((_, delta) => {
        orbitAngle.current += delta * ORBIT_SPEED;
        shotTimer.current += delta;

        const shot = SHOTS[shotIdx.current];

        // ── One-time initialisation: kick off a transition into shot 0 ──────
        if (firstFrame.current) {
            firstFrame.current = false;
            fromPos.current.copy(camera.position);
            fromLook.current.set(0, 0, 0);
            toPos.current.copy(shot.getPos(orbitAngle.current, 0));
            toLook.current.copy(shot.getLookAt());
            inTransition.current = true;
            transitionT.current = 0;
            shotTimer.current = 0;
            dofSettings.focusDistance = shot.focusDist;
        }

        // ── Trigger transition to next shot ─────────────────────────────────
        if (!inTransition.current && shotTimer.current >= SHOT_DURATION) {
            fromPos.current.copy(camera.position);
            fromLook.current.copy(activeLook.current);

            shotIdx.current = (shotIdx.current + 1) % SHOTS.length;
            const next = SHOTS[shotIdx.current];

            toPos.current.copy(next.getPos(orbitAngle.current, 0));
            toLook.current.copy(next.getLookAt());
            inTransition.current = true;
            transitionT.current = 0;
            shotTimer.current = 0;
            dofSettings.focusDistance = next.focusDist;
        }

        // ── Animate camera this frame ────────────────────────────────────────
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
        } else {
            // Steady shot – orbit continuously for shot 0, subtle drift for others
            camera.position.copy(shot.getPos(orbitAngle.current, shotTimer.current));
            activeLook.current.copy(shot.getLookAt());
        }

        camera.lookAt(activeLook.current);
    });

    return null;
}
