import { useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import useGameStore from "../store/gameStore";
import { applyDamageCameraShake } from "./cinematic/cameraEffects";
import {
  createCameraOutputs,
  createCameraState,
  stepCamera,
  type CameraInput,
  type CameraOutputs,
  type CameraState,
} from "./cinematic/controller";

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
 * This component is glue only: it reads the store, steps the pure state
 * machine in `cinematic/controller.ts`, applies the resulting pose and
 * mirrors the reported store writes. `cinematic/controller.test.ts` covers
 * the timing rules.
 *
 * Returns null – no rendered geometry.
 */
export default function CinematicCamera() {
  const { camera } = useThree();

  // Allocated once and mutated in place, so a frame allocates nothing.
  const stateRef = useRef<CameraState | null>(null);
  const outputsRef = useRef<CameraOutputs | null>(null);
  const inputRef = useRef<CameraInput | null>(null);
  if (stateRef.current === null) stateRef.current = createCameraState();
  if (outputsRef.current === null) outputsRef.current = createCameraOutputs();
  if (inputRef.current === null) {
    inputRef.current = {
      delta: 0,
      mode: "cinematic",
      reducedMotion: false,
      isActiveCombat: false,
      position: camera.position,
    };
  }
  const state = stateRef.current;
  const outputs = outputsRef.current;
  const input = inputRef.current;

  useFrame((_, delta) => {
    const { cameraMode, reducedMotion, gameState, activeAsteroids } = useGameStore.getState();

    input.delta = delta;
    input.mode = cameraMode;
    input.reducedMotion = reducedMotion;
    input.isActiveCombat = gameState === "playing" && activeAsteroids > 0;

    stepCamera(state, input, outputs);
    camera.lookAt(state.activeLook);

    if (outputs.dofFocusDistance !== null) {
      useGameStore.getState().setDofFocusDistance(outputs.dofFocusDistance);
    }

    if (outputs.cinematicTransition !== null) {
      useGameStore.getState().setCinematicTransition(outputs.cinematicTransition);
    }

    if (outputs.shake) {
      applyDamageCameraShake(camera, reducedMotion, useGameStore.getState().lastDamageTime);
    }
  });

  return null;
}
