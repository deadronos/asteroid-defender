import * as THREE from 'three';

const tempShakeOffset = new THREE.Vector3();

/** Smoothstep easing: smooth start and stop for camera transitions */
export function smoothstep(t: number): number {
    return t * t * (3 - 2 * t);
}

export function applyDamageCameraShake(
    camera: THREE.Camera,
    reducedMotion: boolean,
    lastDamageTime: number,
) {
    if (lastDamageTime <= 0) {
        return;
    }

    const timeSinceDamage = (Date.now() - lastDamageTime) / 1000;
    if (timeSinceDamage >= 0.5) {
        return;
    }

    const shakeScale = reducedMotion ? 0.3 : 1.0;
    const shakeIntensity = (0.5 - timeSinceDamage) * 2.0 * shakeScale;
    tempShakeOffset.set(
        (Math.random() - 0.5) * shakeIntensity,
        (Math.random() - 0.5) * shakeIntensity,
        (Math.random() - 0.5) * shakeIntensity * 0.5,
    );
    camera.position.add(tempShakeOffset);
}
