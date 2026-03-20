import * as THREE from 'three';

export function createNebulaTexture() {
    const width = 256;
    const height = 128;
    const data = new Uint8Array(width * height * 4);
    const smooth = (t: number) => t * t * (3 - 2 * t);
    const hash = (x: number, y: number, z: number) => {
        const h = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453123;
        return h - Math.floor(h);
    };
    const noise = (x: number, y: number, z: number) => {
        const ix = Math.floor(x);
        const iy = Math.floor(y);
        const iz = Math.floor(z);
        const fx = smooth(x - ix);
        const fy = smooth(y - iy);
        const fz = smooth(z - iz);
        const x00 = hash(ix, iy, iz) * (1 - fx) + hash(ix + 1, iy, iz) * fx;
        const x10 = hash(ix, iy + 1, iz) * (1 - fx) + hash(ix + 1, iy + 1, iz) * fx;
        const x01 = hash(ix, iy, iz + 1) * (1 - fx) + hash(ix + 1, iy, iz + 1) * fx;
        const x11 = hash(ix, iy + 1, iz + 1) * (1 - fx) + hash(ix + 1, iy + 1, iz + 1) * fx;
        return (x00 * (1 - fy) + x10 * fy) * (1 - fz) + (x01 * (1 - fy) + x11 * fy) * fz;
    };
    const fbm = (x: number, y: number, z: number) => {
        let v = 0;
        let a = 0.5;
        let px = x;
        let py = y;
        let pz = z;
        for (let i = 0; i < 6; i++) {
            v += a * noise(px, py, pz);
            px = px * 2.1 + 1.7;
            py = py * 2.1 + 9.2;
            pz = pz * 2.1 + 3.3;
            a *= 0.5;
        }
        return v;
    };

    let index = 0;
    for (let y = 0; y < height; y++) {
        const v = y / (height - 1);
        const phi = (v - 0.5) * Math.PI;
        const cosPhi = Math.cos(phi);
        const sinPhi = Math.sin(phi);
        for (let x = 0; x < width; x++) {
            const u = x / (width - 1);
            const theta = (u - 0.5) * Math.PI * 2;
            const dirX = Math.cos(theta) * cosPhi * 4;
            const dirY = sinPhi * 4;
            const dirZ = Math.sin(theta) * cosPhi * 4;

            data[index++] = Math.floor(fbm(dirX + 1.3, dirY + 2.1, dirZ + 0.7) * 255);
            data[index++] = Math.floor(fbm(dirX * 1.2 + 5.3, dirY * 1.2 + 2.4, dirZ * 1.2 + 1.1) * 255);
            data[index++] = Math.floor(fbm(dirX * 0.5 + 9.1, dirY * 0.5 + 3.2, dirZ * 0.5 + 4.6) * 255);
            data[index++] = 255;
        }
    }

    const texture = new THREE.DataTexture(data, width, height, THREE.RGBAFormat);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.magFilter = THREE.LinearFilter;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.generateMipmaps = true;
    texture.needsUpdate = true;
    return texture;
}
