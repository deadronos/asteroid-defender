import type { RapierRigidBody } from "@react-three/rapier";
import * as THREE from "three";

import { getRandomAngularVelocity } from "../../utils/math";

const tempVec = new THREE.Vector3();
const tempDir = new THREE.Vector3();

export function activateAsteroidBody(
  body: RapierRigidBody | null,
  startPos: [number, number, number],
  speed: number,
) {
  if (!body) {
    return;
  }

  body.setTranslation({ x: startPos[0], y: startPos[1], z: startPos[2] }, true);

  tempVec.set(startPos[0], startPos[1], startPos[2]);
  tempDir.copy(tempVec).negate().normalize();
  body.setLinvel({ x: tempDir.x * speed, y: tempDir.y * speed, z: tempDir.z * speed }, true);
  body.setAngvel(getRandomAngularVelocity(), true);

  // Rejoin the simulation only after the new transform and velocity are set,
  // so the first step after activation already sees the spawn state.
  body.setEnabled(true);
}

export function deactivateAsteroidBody(body: RapierRigidBody | null) {
  if (!body) {
    return;
  }

  // Out of the simulation entirely: no broadphase entry, no contact solving
  // and no collision events while parked (#170). The collider is kept for reuse.
  body.setEnabled(false);
  body.setTranslation({ x: 0, y: -1000, z: 0 }, false);
  body.setLinvel({ x: 0, y: 0, z: 0 }, false);
  body.setAngvel({ x: 0, y: 0, z: 0 }, false);
}
