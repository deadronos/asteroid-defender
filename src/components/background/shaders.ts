export const NEBULA_VERTEX = `
    varying vec3 vPos;
    void main() {
        vPos = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
`;

export const NEBULA_FRAGMENT = `
    uniform float uTime;
    uniform sampler2D uNebulaTex;
    varying vec3 vPos;

    float mirrorRepeat(float x) {
        return abs(fract(x) * 2.0 - 1.0);
    }

    vec2 dirToEquirect(vec3 dir) {
        float u = atan(dir.z, dir.x) / (2.0 * 3.14159265359) + 0.5;
        float v = asin(clamp(dir.y, -1.0, 1.0)) / 3.14159265359 + 0.5;
        return vec2(u, v);
    }

    void main() {
        vec2 uv = dirToEquirect(normalize(vPos));
        float t = uTime * 0.004;
        vec3 nA = texture2D(uNebulaTex, vec2(fract(uv.x + t), uv.y)).rgb;
        float vB = mirrorRepeat(uv.y * 1.3 - t * 0.8);
        vec3 nB = texture2D(uNebulaTex, vec2(fract(uv.x * 1.7 + 0.17), vB)).rgb;
        float n1 = nA.r;
        float n2 = nB.g;
        float shape = smoothstep(0.3, 0.7, n1 * n2 * 2.0);

        vec3 deepBlue    = vec3(0.02, 0.04, 0.18);
        vec3 nebulaPurple = vec3(0.15, 0.03, 0.25);
        vec3 nebulaTeal  = vec3(0.02, 0.12, 0.20);
        vec3 nebulaRed   = vec3(0.20, 0.04, 0.08);

        float band = nB.b;
        vec3 col = mix(mix(deepBlue, nebulaPurple, n1), mix(nebulaTeal, nebulaRed, n2), band);
        col += vec3(0.06, 0.02, 0.14) * shape * 2.5;

        float alpha = (0.22 + shape * 0.28) * 0.85;
        gl_FragColor = vec4(col, alpha);
    }
`;

export const STREAK_VERT = `void main() { gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
export const STREAK_FRAG = `uniform float uOpacity; void main() { gl_FragColor = vec4(0.87, 0.93, 1.0, uOpacity); }`;
