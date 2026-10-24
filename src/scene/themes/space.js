// Copyright (c) 2026 rmd Studio Inc. MIT License.
import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { clock } from '../shared';
import { dotTexture } from './ocean';

// Alien World: the cluster as a galaxy, coloured after the Hubble mosaic of
// the Orion Nebula: a turquoise and white glowing heart, red and rose
// hydrogen filaments, brown dust lanes, blue-white stars with four-pointed
// spikes. Planets are lit by a far-off sun from this direction (world space).
const BACKGROUND = '#030407';
const LIGHT = 'normalize(vec3(-0.5, 0.6, 0.6))';
const FADE = 'exp(-dist * dist * 0.000025)';

const NOISE = /* glsl */ `
  float hash(vec3 p) {
    p = fract(p * 0.3183099 + 0.1);
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }
  float noise(vec3 x) {
    vec3 i = floor(x);
    vec3 f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(hash(i), hash(i + vec3(1, 0, 0)), f.x), mix(hash(i + vec3(0, 1, 0)), hash(i + vec3(1, 1, 0)), f.x), f.y),
      mix(mix(hash(i + vec3(0, 0, 1)), hash(i + vec3(1, 0, 1)), f.x), mix(hash(i + vec3(0, 1, 1)), hash(i + vec3(1, 1, 1)), f.x), f.y),
      f.z);
  }
`;

// A lit sphere with a glowing rim. uBands > 0 gives gas-giant stripes,
// otherwise uRough sets how blotchy the surface is.
const planetVertex = /* glsl */ `
  varying vec3 vObj;
  varying vec3 vWorldNormal;
  varying vec3 vViewNormal;
  varying vec3 vView;
  varying float vFade;
  void main() {
    vObj = position;
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    float dist = length(mv.xyz);
    vViewNormal = normalize(normalMatrix * normal);
    vView = normalize(-mv.xyz);
    vFade = ${FADE};
    gl_Position = projectionMatrix * mv;
  }
`;

const planetFragment = /* glsl */ `
  uniform vec3 uColor;
  uniform vec3 uFogColor;
  uniform float uOpacity;
  uniform float uGlow;
  uniform float uBands;
  uniform float uRough;
  uniform float uSeed;
  uniform float uTime;
  varying vec3 vObj;
  varying vec3 vWorldNormal;
  varying vec3 vViewNormal;
  varying vec3 vView;
  varying float vFade;
  ${NOISE}
  void main() {
    vec3 p = vObj + uSeed;
    float n = noise(p * 2.5 * uRough) * 0.65 + noise(p * 7.0 * uRough) * 0.35;
    float pattern = uBands > 0.0
      ? 0.5 + 0.5 * sin(vObj.y * uBands + n * 2.5 + uTime * 0.05)
      : smoothstep(0.35, 0.7, n);
    vec3 surface = mix(uColor * 0.3, mix(uColor, vec3(1.0), 0.25), pattern);
    float light = clamp(dot(normalize(vWorldNormal), ${LIGHT}), 0.0, 1.0);
    float rim = pow(max(1.0 - abs(dot(normalize(vViewNormal), normalize(vView))), 0.0), 3.0);
    vec3 color = (surface * (0.08 + 0.8 * light) + uColor * rim * 0.9) * uGlow;
    gl_FragColor = vec4(mix(uFogColor, color, vFade), uOpacity);
  }
`;

// Additive glow that is strongest at the silhouette: atmospheres.
const haloVertex = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vView;
  varying float vFade;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    float dist = length(mv.xyz);
    vNormal = normalize(normalMatrix * normal);
    vView = normalize(-mv.xyz);
    vFade = ${FADE};
    gl_Position = projectionMatrix * mv;
  }
`;

const haloFragment = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  uniform float uGlow;
  varying vec3 vNormal;
  varying vec3 vView;
  varying float vFade;
  void main() {
    float f = pow(max(1.0 - abs(dot(normalize(vNormal), normalize(vView))), 0.0), 2.5);
    gl_FragColor = vec4(uColor * uGlow, f * 0.9 * uOpacity * vFade);
  }
`;

// Flat discs in the XY plane: banded rings, or a swirling accretion disk.
const discVertex = /* glsl */ `
  varying vec2 vPos;
  varying float vFade;
  void main() {
    vPos = position.xy;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    float dist = length(mv.xyz);
    vFade = ${FADE};
    gl_Position = projectionMatrix * mv;
  }
`;

const discFragment = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  uniform float uGlow;
  uniform float uInner;
  uniform float uOuter;
  uniform float uSwirl;
  uniform float uTime;
  varying vec2 vPos;
  varying float vFade;
  void main() {
    float r = length(vPos);
    float u = clamp((r - uInner) / (uOuter - uInner), 0.0, 1.0);
    float edge = smoothstep(0.0, 0.08, u) * smoothstep(1.0, 0.75, u);
    float a;
    vec3 color;
    if (uSwirl > 0.5) {
      float angle = atan(vPos.y, vPos.x);
      float spiral = 0.5 + 0.5 * sin(angle * 3.0 - log(r) * 9.0 + uTime * 1.6);
      a = edge * (0.25 + 0.75 * spiral) * (1.0 - u * 0.7);
      color = mix(vec3(1.0, 0.95, 0.85), uColor, u) * 0.75;
    } else {
      float bands = 0.4 + 0.6 * pow(max(sin(u * 38.0) * 0.5 + 0.5, 0.0), 2.0);
      a = edge * bands * 0.55;
      color = uColor;
    }
    gl_FragColor = vec4(color * uGlow, a * uOpacity * vFade);
  }
`;

// Streaks that fade away from the body: comet tails and pulsar beams.
// uAxis 0 fades along -X, 1 fades along |Y|.
const streakVertex = /* glsl */ `
  uniform float uLength;
  uniform float uAxis;
  varying float vS;
  varying float vFade;
  void main() {
    vS = clamp((uAxis < 0.5 ? -position.x : abs(position.y)) / uLength, 0.0, 1.0);
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    float dist = length(mv.xyz);
    vFade = ${FADE};
    gl_Position = projectionMatrix * mv;
  }
`;

const streakFragment = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  uniform float uGlow;
  varying float vS;
  varying float vFade;
  void main() {
    // Interpolation can nudge vS a hair past 1; a negative base would make
    // pow() return NaN, which the Full-quality blur smears across the screen.
    gl_FragColor = vec4(uColor * uGlow, pow(max(1.0 - vS, 0.0), 1.6) * 0.6 * uOpacity * vFade);
  }
`;

// A star's face: a hot, slowly churning surface bright enough to bloom.
const starFragment = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  uniform float uGlow;
  uniform float uTime;
  uniform float uSeed;
  varying vec3 vObj;
  varying vec3 vViewNormal;
  varying vec3 vView;
  varying float vFade;
  ${NOISE}
  void main() {
    float n = noise(vObj * 4.0 + uSeed + uTime * 0.3);
    float limb = abs(dot(normalize(vViewNormal), normalize(vView)));
    vec3 color = mix(uColor, vec3(1.0), 0.25 + 0.3 * n) * (0.8 + 0.4 * limb) * uGlow;
    gl_FragColor = vec4(color * vFade, uOpacity);
  }
`;

const additive = { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending };

function look(uniforms) {
  return {
    uColor: { value: new THREE.Color() },
    uOpacity: { value: 1 },
    uGlow: { value: 1 },
    ...uniforms,
  };
}

const makers = {
  planet: (phase, shape) =>
    new THREE.ShaderMaterial({
      transparent: true,
      vertexShader: planetVertex,
      fragmentShader: planetFragment,
      uniforms: look({
        uFogColor: { value: new THREE.Color(BACKGROUND) },
        uBands: { value: shape.bands || 0 },
        uRough: { value: shape.rough || 1 },
        uSeed: { value: phase * 10 },
        uTime: clock,
      }),
    }),
  halo: () =>
    new THREE.ShaderMaterial({
      ...additive,
      side: THREE.BackSide,
      vertexShader: haloVertex,
      fragmentShader: haloFragment,
      uniforms: look({}),
    }),
  disc: (phase, { inner, outer, swirl }) =>
    new THREE.ShaderMaterial({
      ...additive,
      side: THREE.DoubleSide,
      vertexShader: discVertex,
      fragmentShader: discFragment,
      uniforms: look({
        uInner: { value: inner },
        uOuter: { value: outer },
        uSwirl: { value: swirl ? 1 : 0 },
        uTime: clock,
      }),
    }),
  streak: (phase, { length, axis }) =>
    new THREE.ShaderMaterial({
      ...additive,
      side: THREE.DoubleSide,
      vertexShader: streakVertex,
      fragmentShader: streakFragment,
      uniforms: look({ uLength: { value: length }, uAxis: { value: axis } }),
    }),
  star: (phase) =>
    new THREE.ShaderMaterial({
      transparent: true,
      vertexShader: planetVertex,
      fragmentShader: starFragment,
      uniforms: look({ uTime: clock, uSeed: { value: phase * 10 } }),
    }),
};

function tail(length, radius) {
  // A cone with its point at the origin, opening backwards along -X.
  const g = new THREE.ConeGeometry(radius, length, 20, 1, true);
  g.translate(0, -length / 2, 0);
  g.rotateZ(-Math.PI / 2);
  return g;
}

function beams(length, radius) {
  // Two cones pointing out of the poles, points at the origin.
  const up = new THREE.ConeGeometry(radius, length, 16, 1, true);
  up.rotateX(Math.PI);
  up.translate(0, length / 2, 0);
  const down = up.clone();
  down.rotateX(Math.PI);
  const position = [...up.attributes.position.array, ...down.attributes.position.array];
  const index = [...up.index.array, ...Array.from(down.index.array, (i) => i + up.attributes.position.count)];
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(position, 3));
  g.setIndex(index);
  up.dispose();
  down.dispose();
  return g;
}

function rock() {
  const g = new THREE.IcosahedronGeometry(1, 0).toNonIndexed();
  const p = g.attributes.position;
  // Knock the corners about so no two rocks look machined.
  for (let i = 0; i < p.count; i += 1) {
    const k = 0.75 + 0.5 * Math.abs(Math.sin(p.getX(i) * 12.9 + p.getY(i) * 78.2 + p.getZ(i) * 37.7));
    p.setXYZ(i, p.getX(i) * k, p.getY(i) * k, p.getZ(i) * k);
  }
  g.computeVertexNormals();
  return g;
}

const GEOMETRY = {
  sphere: new THREE.SphereGeometry(1, 40, 24),
  small: new THREE.SphereGeometry(1, 16, 12),
  rock: rock(),
  rings: new THREE.RingGeometry(1.45, 2.4, 96, 1),
  disk: new THREE.RingGeometry(1.15, 3.2, 96, 1),
  photonRing: new THREE.TorusGeometry(1.08, 0.04, 8, 64),
  tail: tail(4.5, 0.55),
  beams: beams(5, 0.28),
};

// body: what it is. motion: 'spin' turns on its axis, 'swim' (comets) faces
// along the circle it travels. hit and top are before scaling.
const SHAPES = {
  Pod: { body: 'planet', motion: 'spin', scale: 1, rough: 1, halo: true, hit: 1.4, top: 1.6 },
  Deployment: { body: 'planet', motion: 'spin', scale: 2.2, bands: 9, rings: true, hit: 1.6, top: 1.5 },
  StatefulSet: { body: 'planet', motion: 'spin', scale: 1.8, rough: 1.7, halo: true, moon: true, hit: 1.5, top: 1.5 },
  DaemonSet: { body: 'belt', motion: 'spin', scale: 1.6, count: 9, hit: 2.2, top: 1.2 },
  Job: { body: 'comet', motion: 'swim', scale: 1.1, hit: 1, top: 1 },
  CronJob: { body: 'pulsar', motion: 'spin', scale: 1.3, hit: 1.1, top: 1.6 },
  Service: { body: 'star', motion: 'spin', scale: 1.1, hit: 1.2, top: 1.8 },
  Ingress: { body: 'wormhole', motion: 'spin', scale: 1.5, hit: 1.8, top: 1.5 },
  PersistentVolumeClaim: { body: 'planet', motion: 'spin', scale: 0.8, rough: 2.4, hit: 1.1, top: 1.4 },
};

// What each kind is called in this theme, for the legend.
const NAMES = {
  Pod: 'small planet',
  Deployment: 'ringed gas giant',
  StatefulSet: 'planet with a moon',
  DaemonSet: 'asteroid belt',
  Job: 'comet',
  CronJob: 'pulsar',
  Service: 'star',
  Ingress: 'wormhole',
  PersistentVolumeClaim: 'moon',
};

// Closer to real bodies than the interface colours: a tan gas giant, an
// ice-blue world, brown and grey rock, a white-hot accretion disk.
const COLORS = {
  Pod: '#4fc3d9',
  Deployment: '#d9a066',
  StatefulSet: '#5b8de0',
  DaemonSet: '#a8917a',
  Job: '#d8f3ff',
  CronJob: '#8fb8ff',
  Service: '#ffd98a',
  Ingress: '#f5e6c8',
  PersistentVolumeClaim: '#9c968c',
};

// What each body is made of: [material kind, options]. Order is draw order.
function partsFor(shape) {
  switch (shape.body) {
    case 'planet':
      return {
        surface: ['planet', shape],
        ...(shape.halo && { halo: ['halo'] }),
        ...(shape.rings && { rings: ['disc', { inner: 1.45, outer: 2.4 }] }),
        ...(shape.moon && { moon: ['planet', { rough: 2.5 }] }),
      };
    case 'belt':
      return { rock: ['planet', { rough: 2.5 }] };
    case 'comet':
      return { surface: ['planet', { rough: 2 }], halo: ['halo'], tail: ['streak', { length: 4.5, axis: 0 }] };
    case 'pulsar':
      return { surface: ['star'], halo: ['halo'], beams: ['streak', { length: 5, axis: 1 }] };
    case 'star':
      return { surface: ['star'] };
    case 'wormhole':
      return { disk: ['disc', { inner: 1.15, outer: 3.2, swirl: true }], halo: ['halo'] };
    default:
      return {};
  }
}

// Hubble's secondary-mirror struts give bright stars four spikes.
function spikeTexture() {
  const size = 256;
  const c = size / 2;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.globalCompositeOperation = 'lighter';
  const spike = (angle, length, width, alpha) => {
    ctx.save();
    ctx.translate(c, c);
    ctx.rotate(angle);
    const g = ctx.createLinearGradient(0, 0, length, 0);
    g.addColorStop(0, `rgba(255,255,255,${alpha})`);
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(0, -width);
    ctx.lineTo(length, 0);
    ctx.lineTo(0, width);
    ctx.fill();
    ctx.restore();
  };
  for (let i = 0; i < 4; i += 1) spike((i * Math.PI) / 2, c, 2, 0.9);
  const core = ctx.createRadialGradient(c, c, 0, c, c, c * 0.22);
  core.addColorStop(0, 'rgba(255,255,255,1)');
  core.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = core;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(canvas);
}

let corona;
let spikes;

function SpaceBody({ shape, sim, look: { color, opacity, glow } }) {
  const spin = useRef();
  const moon = useRef();
  const beam = useRef();
  const rocks = useRef([]);
  const flare = useRef();

  const materials = useMemo(() => {
    const made = {};
    for (const [name, [kind, options]] of Object.entries(partsFor(shape))) {
      made[name] = makers[kind](sim.phase, options || {});
    }
    return made;
  }, [shape, sim.phase]);

  useEffect(() => () => Object.values(materials).forEach((m) => m.dispose()), [materials]);

  useEffect(() => {
    for (const [name, material] of Object.entries(materials)) {
      // A moon is plain grey rock whatever its planet's health.
      material.uniforms.uColor.value.set(name === 'moon' ? '#9a9aa8' : color);
      material.uniforms.uOpacity.value = opacity;
      material.uniforms.uGlow.value = glow;
      // Solid bodies stop hiding what is behind them once faded by a search.
      if (material.blending === THREE.NormalBlending) material.depthWrite = opacity >= 1;
    }
  }, [materials, color, opacity, glow]);

  const coronaMap = useMemo(() => {
    if (!corona) corona = dotTexture();
    return corona;
  }, []);
  const spikeMap = useMemo(() => {
    if (!spikes) spikes = spikeTexture();
    return spikes;
  }, []);

  useFrame(() => {
    const t = clock.value;
    if (spin.current) spin.current.rotation.y = t * 0.25 + sim.phase;
    if (moon.current) {
      const a = t * 0.7 + sim.phase;
      moon.current.position.set(Math.cos(a) * 1.9, Math.sin(a * 0.5) * 0.3, Math.sin(a) * 1.9);
    }
    if (beam.current) beam.current.rotation.set(0.5, t * 2.2 + sim.phase, 0);
    if (flare.current) flare.current.scale.setScalar(5.2 + Math.sin(t * 1.3 + sim.phase) * 0.4);
    const list = rocks.current;
    for (let i = 0; i < list.length; i += 1) {
      const a = t * 0.35 + sim.phase + (i / list.length) * Math.PI * 2;
      const r = 1.8 + 0.35 * Math.sin(i * 2.7);
      list[i].position.set(Math.cos(a) * r, Math.sin(i * 1.9) * 0.35, Math.sin(a) * r);
      list[i].rotation.set(t * 0.4 + i, t * 0.3 + i * 2, 0);
    }
  });

  return (
    <>
      {materials.surface && (
        <mesh
          ref={spin}
          geometry={GEOMETRY.sphere}
          material={materials.surface}
          scale={shape.body === 'comet' ? 0.45 : shape.body === 'pulsar' ? 0.5 : 1}
        />
      )}
      {materials.halo && (
        <mesh
          geometry={GEOMETRY.small}
          material={materials.halo}
          scale={shape.body === 'comet' ? 0.75 : shape.body === 'pulsar' ? 0.9 : shape.body === 'wormhole' ? 1.25 : 1.22}
        />
      )}
      {materials.rings && <mesh geometry={GEOMETRY.rings} material={materials.rings} rotation={[-1.2, 0.3, 0]} />}
      {materials.moon && <mesh ref={moon} geometry={GEOMETRY.small} material={materials.moon} scale={0.28} />}
      {materials.tail && <mesh geometry={GEOMETRY.tail} material={materials.tail} />}
      {materials.beams && <mesh ref={beam} geometry={GEOMETRY.beams} material={materials.beams} />}
      {shape.body === 'star' && (
        <>
          <sprite ref={flare}>
            <spriteMaterial map={coronaMap} color={color} transparent opacity={opacity * 0.6} depthWrite={false} blending={THREE.AdditiveBlending} />
          </sprite>
          <sprite scale={9}>
            <spriteMaterial map={spikeMap} color={color} transparent opacity={opacity * 0.9} depthWrite={false} blending={THREE.AdditiveBlending} />
          </sprite>
        </>
      )}
      {shape.body === 'wormhole' && (
        <group rotation={[-1.25, 0, 0.2]}>
          <mesh geometry={GEOMETRY.small}>
            <meshBasicMaterial color="#000000" transparent opacity={opacity} />
          </mesh>
          <mesh geometry={GEOMETRY.disk} material={materials.disk} />
          <mesh geometry={GEOMETRY.photonRing} rotation={[Math.PI / 2, 0, 0]}>
            <meshBasicMaterial color={color} transparent opacity={opacity * 0.6} depthWrite={false} blending={THREE.AdditiveBlending} />
          </mesh>
        </group>
      )}
      {shape.body === 'belt' &&
        Array.from({ length: shape.count }, (_, i) => (
          <mesh
            key={i}
            ref={(mesh) => {
              if (mesh) rocks.current[i] = mesh;
            }}
            geometry={GEOMETRY.rock}
            material={materials.rock}
            scale={0.28 + 0.12 * Math.abs(Math.sin(i * 3.1))}
          />
        ))}
    </>
  );
}

// A faint nebula painted on the inside of a huge sphere.
function Nebula() {
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        vertexShader: `
          varying vec3 vDir;
          void main() {
            vDir = normalize(position);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }`,
        fragmentShader: `
          varying vec3 vDir;
          ${NOISE}
          void main() {
            vec3 d = vDir * 2.4;
            // The bright heart of the nebula sits ahead of the starting view.
            float heart = smoothstep(0.55, 1.0, dot(vDir, normalize(vec3(0.3, 0.25, -0.9))));
            float n = noise(d) * 0.5 + noise(d * 2.1) * 0.3 + noise(d * 4.7) * 0.2;
            float ridge = 1.0 - abs(noise(d * 1.9 + 3.0) * 2.0 - 1.0);
            float filament = pow(max(ridge, 0.0), 6.0);
            float gas = smoothstep(0.35, 0.85, n);
            vec3 red = vec3(0.2, 0.04, 0.05);
            vec3 orange = vec3(0.21, 0.09, 0.035);
            vec3 teal = vec3(0.035, 0.14, 0.15);
            vec3 white = vec3(0.17, 0.19, 0.19);
            vec3 color = vec3(0.005, 0.006, 0.012);
            color += mix(red, orange, noise(d * 0.9 + 11.0)) * gas * (0.45 + 0.9 * filament);
            color += teal * heart * (0.35 + 0.25 * n);
            color += white * heart * heart * heart * 0.3;
            // Dark lanes of dust drawn over the glowing gas.
            float lane = smoothstep(0.55, 0.8, noise(d * 1.3 + 20.0));
            color = mix(color, vec3(0.03, 0.015, 0.008), lane * 0.75);
            gl_FragColor = vec4(color, 1.0);
          }`,
      }),
    []
  );
  useEffect(() => () => material.dispose(), [material]);
  return (
    <mesh material={material} renderOrder={-1}>
      <sphereGeometry args={[1200, 32, 20]} />
    </mesh>
  );
}

// Distant stars on a shell far beyond the cluster, in a few tints.
function Stars({ count }) {
  const points = useRef();
  const dot = useMemo(dotTexture, []);
  const { positions, colors } = useMemo(() => {
    const p = new Float32Array(count * 3);
    const c = new Float32Array(count * 3);
    const tints = [[1, 1, 1], [0.75, 0.85, 1], [0.85, 0.92, 1], [1, 0.88, 0.78]];
    for (let i = 0; i < count; i += 1) {
      const v = new THREE.Vector3().randomDirection().multiplyScalar(500 + Math.random() * 500);
      p.set([v.x, v.y, v.z], i * 3);
      const [r, g, b] = tints[i % tints.length];
      const k = 0.35 + Math.random() * 0.65;
      c.set([r * k, g * k, b * k], i * 3);
    }
    return { positions: p, colors: c };
  }, [count]);

  useFrame((_, dt) => {
    points.current.rotation.y += dt * 0.002;
  });

  return (
    <points ref={points} frustumCulled={false}>
      <bufferGeometry key={count}>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-color" args={[colors, 3]} />
      </bufferGeometry>
      <pointsMaterial map={dot} vertexColors size={2.6} sizeAttenuation={false} transparent depthWrite={false} fog={false} />
    </points>
  );
}

// Nearby dust, so flying still feels like moving.
function Dust({ count, range = 320 }) {
  const dot = useMemo(dotTexture, []);
  const positions = useMemo(() => {
    const p = new Float32Array(count * 3);
    for (let i = 0; i < p.length; i += 1) p[i] = (Math.random() - 0.5) * range;
    return p;
  }, [count, range]);
  return (
    <points frustumCulled={false}>
      <bufferGeometry key={count}>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        map={dot}
        color="#ffc9b8"
        size={0.4}
        sizeAttenuation
        transparent
        opacity={0.4}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

// A few bright stars, each with Hubble's spikes.
function BrightStars({ count }) {
  const map = useMemo(() => {
    if (!spikes) spikes = spikeTexture();
    return spikes;
  }, []);
  const { positions, colors } = useMemo(() => {
    const p = new Float32Array(count * 3);
    const c = new Float32Array(count * 3);
    for (let i = 0; i < count; i += 1) {
      const v = new THREE.Vector3().randomDirection().multiplyScalar(700 + Math.random() * 300);
      p.set([v.x, v.y, v.z], i * 3);
      const warm = Math.random();
      c.set([1, 0.9 + 0.1 * warm, 0.8 + 0.2 * (1 - warm)], i * 3);
    }
    return { positions: p, colors: c };
  }, [count]);
  return (
    <points frustumCulled={false}>
      <bufferGeometry key={count}>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-color" args={[colors, 3]} />
      </bufferGeometry>
      <pointsMaterial
        map={map}
        vertexColors
        size={34}
        sizeAttenuation={false}
        transparent
        depthWrite={false}
        fog={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

function SpaceEnvironment({ particles }) {
  return (
    <>
      <Nebula />
      <Stars count={Math.round(particles * 1.2)} />
      <BrightStars count={Math.round(particles / 60)} />
      <Dust count={Math.round(particles / 3)} />
    </>
  );
}

const space = {
  key: 'space',
  label: 'Alien World',
  background: BACKGROUND,
  fog: 0.0035,
  // Tethers in space barely sag.
  wireSag: 0.35,
  shapes: SHAPES,
  names: NAMES,
  colors: COLORS,
  Body: SpaceBody,
  Environment: SpaceEnvironment,
};

export default space;
