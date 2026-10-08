// Copyright (c) 2026 rmd Studio Inc. MIT License.
import * as THREE from 'three';
import { clock } from './shared';

// Fades distant creatures into the water, matching the scene fog.
const FADE = 'exp(-dist * dist * 0.00003)';

const bellVertex = /* glsl */ `
  uniform float uTime;
  uniform float uPhase;
  uniform float uSpeed;
  uniform float uPulse;
  varying vec3 vNormal;
  varying vec3 vView;
  varying float vAngle;
  varying float vRim;
  varying float vFade;

  void main() {
    vec3 p = position;
    float beat = sin(uTime * uSpeed + uPhase);
    float rim = 1.0 - clamp(p.y, 0.0, 1.0);
    p.xz *= 1.0 + beat * uPulse * rim;
    p.y += beat * uPulse * 0.4 * (1.0 - rim);
    p.xz += 0.03 * sin(uTime * 1.7 + p.y * 6.0 + uPhase) * rim;

    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    float dist = length(mv.xyz);
    vNormal = normalize(normalMatrix * normal);
    vView = normalize(-mv.xyz);
    vAngle = atan(position.z, position.x);
    vRim = rim;
    vFade = ${FADE};
    gl_Position = projectionMatrix * mv;
  }
`;

const bellFragment = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  uniform float uGlow;
  uniform float uRibs;
  varying vec3 vNormal;
  varying vec3 vView;
  varying float vAngle;
  varying float vRim;
  varying float vFade;

  void main() {
    float fresnel = pow(1.0 - abs(dot(normalize(vNormal), normalize(vView))), 2.0);
    float ribs = uRibs * smoothstep(0.75, 1.0, sin(vAngle * 12.0)) * vRim;
    vec3 color = uColor * (0.22 + 1.5 * fresnel + 0.5 * ribs) * uGlow;
    float alpha = (0.16 + 0.8 * fresnel + 0.25 * ribs) * uOpacity * vFade;
    gl_FragColor = vec4(color, alpha);
  }
`;

// Fish share the bell's fragment shader. uMode picks how the body moves:
// 0 sweeps the tail sideways, 1 beats it up and down (whales), 2 flaps wings.
const fishVertex = /* glsl */ `
  uniform float uTime;
  uniform float uPhase;
  uniform float uSpeed;
  uniform float uLen;
  uniform float uMode;
  varying vec3 vNormal;
  varying vec3 vView;
  varying float vAngle;
  varying float vRim;
  varying float vFade;

  void main() {
    vec3 p = position;
    float tail = clamp(0.5 - p.x / uLen, 0.0, 1.3);
    float wave = sin(uTime * uSpeed - p.x * (5.0 / uLen) + uPhase);
    if (uMode < 0.5) {
      p.z += wave * 0.14 * uLen * tail * tail;
    } else if (uMode < 1.5) {
      p.y += wave * 0.12 * uLen * tail * tail;
    } else {
      float span = abs(p.z);
      p.y += sin(uTime * uSpeed + uPhase - span * 0.9) * span * 0.3;
    }

    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    float dist = length(mv.xyz);
    vNormal = normalize(normalMatrix * normal);
    vView = normalize(-mv.xyz);
    vAngle = 0.0;
    vRim = 0.0;
    vFade = ${FADE};
    gl_Position = projectionMatrix * mv;
  }
`;

const tentacleVertex = /* glsl */ `
  uniform float uTime;
  uniform float uPhase;
  uniform float uSpeed;
  uniform float uLength;
  attribute float aT;
  attribute float aSeed;
  varying float vT;
  varying float vFade;

  void main() {
    vec3 p = position;
    float w = uTime * 1.2 + uPhase + aSeed * 6.283;
    p.y = -aT * uLength + sin(uTime * uSpeed + uPhase - aT * 2.5) * 0.18 * aT;
    p.x += sin(w + aT * 5.0) * 0.4 * aT - position.x * 0.35 * aT;
    p.z += cos(w * 0.9 + aT * 4.0) * 0.4 * aT - position.z * 0.35 * aT;

    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    float dist = length(mv.xyz);
    vT = aT;
    vFade = ${FADE};
    gl_Position = projectionMatrix * mv;
  }
`;

const tentacleFragment = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  uniform float uGlow;
  varying float vT;
  varying float vFade;

  void main() {
    gl_FragColor = vec4(uColor * uGlow, (1.0 - vT * 0.85) * 0.7 * uOpacity * vFade);
  }
`;

const common = {
  transparent: true,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
};

export function bellMaterial({ phase, speed, pulse, ribs }) {
  return new THREE.ShaderMaterial({
    ...common,
    side: THREE.DoubleSide,
    vertexShader: bellVertex,
    fragmentShader: bellFragment,
    uniforms: {
      uTime: clock,
      uPhase: { value: phase },
      uSpeed: { value: speed },
      uPulse: { value: pulse },
      uRibs: { value: ribs },
      uColor: { value: new THREE.Color() },
      uOpacity: { value: 1 },
      uGlow: { value: 1 },
    },
  });
}

export function fishMaterial({ phase, speed, species }) {
  const { length, mode } = SPECIES[species];
  return new THREE.ShaderMaterial({
    ...common,
    side: THREE.DoubleSide,
    vertexShader: fishVertex,
    fragmentShader: bellFragment,
    uniforms: {
      uTime: clock,
      uPhase: { value: phase },
      uSpeed: { value: speed },
      uLen: { value: length },
      uMode: { value: mode },
      uRibs: { value: 0 },
      uColor: { value: new THREE.Color() },
      uOpacity: { value: 1 },
      uGlow: { value: 1 },
    },
  });
}

export function tentacleMaterial({ phase, speed, length }) {
  return new THREE.ShaderMaterial({
    ...common,
    vertexShader: tentacleVertex,
    fragmentShader: tentacleFragment,
    uniforms: {
      uTime: clock,
      uPhase: { value: phase },
      uSpeed: { value: speed },
      uLength: { value: length },
      uColor: { value: new THREE.Color() },
      uOpacity: { value: 1 },
      uGlow: { value: 1 },
    },
  });
}

export const GEOMETRY = {
  bell: new THREE.SphereGeometry(1, 40, 20, 0, Math.PI * 2, 0, Math.PI * 0.58),
  shell: new THREE.OctahedronGeometry(1, 1),
  hit: new THREE.SphereGeometry(1, 10, 10),
  core: new THREE.SphereGeometry(1, 12, 12),
  ring: new THREE.TorusGeometry(1.5, 0.025, 6, 64),
};

const SEGMENTS = 14;
const tentacleCache = new Map();

// Line segments for `count` tentacles hanging from a ring under the bell. The
// vertex shader gives them their length and movement.
export function tentacleGeometry(count) {
  if (tentacleCache.has(count)) return tentacleCache.get(count);
  const position = [];
  const t = [];
  const seed = [];
  for (let i = 0; i < count; i += 1) {
    const angle = (i / count) * Math.PI * 2;
    const r = i % 2 ? 0.8 : 0.45;
    const x = Math.cos(angle) * r;
    const z = Math.sin(angle) * r;
    const s = (i * 0.618) % 1;
    for (let j = 0; j < SEGMENTS; j += 1) {
      position.push(x, 0, z, x, 0, z);
      t.push(j / SEGMENTS, (j + 1) / SEGMENTS);
      seed.push(s, s);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(position, 3));
  geometry.setAttribute('aT', new THREE.Float32BufferAttribute(t, 1));
  geometry.setAttribute('aSeed', new THREE.Float32BufferAttribute(seed, 1));
  tentacleCache.set(count, geometry);
  return geometry;
}

// A bulge that is zero at both ends. `k` moves the fattest point towards the
// nose (k > 1) and `e` below 1 makes it fuller.
const lobe = (u, k, e) => Math.pow(Math.sin(Math.PI * Math.pow(u, k)), e);
const mirror = (tri) => tri.map(([x, y, z]) => [x, y, -z]);
const flip = (tri) => tri.map(([x, y, z]) => [x, -y, z]);
const both = (tri) => [tri, mirror(tri)];

// Each animal faces +X and is `length` long, centred on the origin.
// half(u) gives [half width, half height] of the body from tail (0) to nose (1);
// fins are flat triangles.
const SPECIES = {
  whale: {
    length: 4.2,
    mode: 1,
    half: (u) => [lobe(u, 1.9, 0.6) * 0.8, lobe(u, 1.9, 0.6) * 0.75],
    fins: [
      ...both([[-1.9, 0, 0], [-2.8, 0, 1.1], [-2.45, 0, 0]]),
      ...both([[0.9, -0.3, 0.55], [0.1, -0.8, 1.6], [0.2, -0.3, 0.6]]),
      [[-0.4, 0.6, 0], [-1.0, 0.85, 0], [-1.0, 0.5, 0]],
    ],
  },
  shark: {
    length: 4,
    mode: 0,
    half: (u) => [lobe(u, 1.5, 0.7) * 0.42, lobe(u, 1.5, 0.7) * 0.5],
    fins: [
      [[-1.8, 0, 0], [-2.7, 1.1, 0], [-2.2, 0, 0]],
      [[-1.8, 0, 0], [-2.5, -0.6, 0], [-2.2, 0, 0]],
      [[0.5, 0.42, 0], [-0.5, 1.35, 0], [-0.5, 0.4, 0]],
      ...both([[0.7, -0.2, 0.35], [-0.2, -0.6, 1.4], [0, -0.2, 0.35]]),
    ],
  },
  minnow: {
    length: 1.6,
    mode: 0,
    half: (u) => [lobe(u, 1.5, 0.7) * 0.2, lobe(u, 1.5, 0.7) * 0.36],
    fins: [
      [[-0.7, 0, 0], [-1.25, 0.5, 0], [-0.95, 0, 0]],
      [[-0.7, 0, 0], [-1.25, -0.5, 0], [-0.95, 0, 0]],
      [[0.2, 0.32, 0], [-0.3, 0.6, 0], [-0.35, 0.3, 0]],
    ],
  },
  angelfish: {
    length: 1.6,
    mode: 0,
    half: (u) => [lobe(u, 1.3, 0.7) * 0.16, lobe(u, 1.3, 0.7) * 0.85],
    fins: [
      [[0.1, 0.8, 0], [-0.9, 1.7, 0], [-0.4, 0.6, 0]],
      flip([[0.1, 0.8, 0], [-0.9, 1.7, 0], [-0.4, 0.6, 0]]),
      [[-0.7, 0, 0], [-1.2, 0.45, 0], [-1.2, -0.45, 0]],
    ],
  },
  anglerfish: {
    length: 1.5,
    mode: 0,
    half: (u) => [lobe(u, 2.4, 0.6) * 0.6, lobe(u, 2.4, 0.6) * 0.68],
    fins: [
      [[-0.65, 0, 0], [-1.1, 0.4, 0], [-1.1, -0.4, 0]],
      // The stalk that carries the lure.
      [[0.3, 0.6, 0], [0.95, 1.05, 0], [0.38, 0.52, 0]],
    ],
  },
  manta: {
    length: 2.4,
    mode: 2,
    half: (u) => [Math.pow(Math.sin(Math.PI * Math.pow(u, 1.2)), 2) * 2.2, lobe(u, 1.3, 0.6) * 0.22],
    fins: [
      [[-1.1, 0, 0.05], [-3.4, 0, 0], [-1.1, 0, -0.05]],
      ...both([[1.1, 0, 0.25], [1.55, 0, 0.4], [1.1, 0, 0.5]]),
    ],
  },
};

const RINGS = 30;
const SIDES = 14;
const fishCache = new Map();

export function fishGeometry(species) {
  if (fishCache.has(species)) return fishCache.get(species);
  const { length, half, fins } = SPECIES[species];

  const vertices = [];
  for (let i = 0; i <= RINGS; i += 1) {
    const u = i / RINGS;
    const [w, h] = half(u);
    for (let j = 0; j < SIDES; j += 1) {
      const angle = (j / SIDES) * Math.PI * 2;
      vertices.push((u - 0.5) * length, Math.sin(angle) * h, Math.cos(angle) * w);
    }
  }
  const index = [];
  for (let i = 0; i < RINGS; i += 1) {
    for (let j = 0; j < SIDES; j += 1) {
      const a = i * SIDES + j;
      const b = i * SIDES + ((j + 1) % SIDES);
      index.push(a, b, a + SIDES, b, b + SIDES, a + SIDES);
    }
  }
  const body = new THREE.BufferGeometry();
  body.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  body.setIndex(index);
  body.computeVertexNormals();
  const flat = body.toNonIndexed();
  body.dispose();

  const position = Array.from(flat.attributes.position.array);
  const normal = Array.from(flat.attributes.normal.array);
  flat.dispose();
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  for (const tri of fins) {
    a.set(...tri[0]);
    b.set(...tri[1]);
    c.set(...tri[2]);
    const n = b.clone().sub(a).cross(c.clone().sub(a)).normalize();
    for (const corner of tri) {
      position.push(...corner);
      normal.push(n.x, n.y, n.z);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(position, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normal, 3));
  fishCache.set(species, geometry);
  return geometry;
}
