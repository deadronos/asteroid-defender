import type { RapierRigidBody } from '@react-three/rapier';
import * as THREE from 'three';

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
    body.setAngvel({
        x: (Math.random() - 0.5) * 0.9,
        y: (Math.random() - 0.5) * 0.9,
        z: (Math.random() - 0.5) * 0.9,
    }, true);
}

export function deactivateAsteroidBody(body: RapierRigidBody | null) {
    if (!body) {
        return;
    }

    body.setTranslation({ x: 0, y: -1000, z: 0 }, true);
    body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    body.setAngvel({ x: 0, y: 0, z: 0 }, true);
}
