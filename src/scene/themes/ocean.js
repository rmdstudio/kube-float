// Copyright (c) 2026 rmd Studio Inc. MIT License.
import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { clock } from '../shared';
import {
  GEOMETRY,
  bellMaterial,
  fishGeometry,
  fishMaterial,
  tentacleGeometry,
  tentacleMaterial,
} from './oceanMaterials';

// body: 'bell' is a jellyfish, 'fish' a single animal of `species`, 'school'
// several small ones, 'shell' a still shape. speed is the pulse or tail beat.
// motion: 'drift' tilts in place, 'swim' faces along the circle being swum.
// hit is the radius that takes clicks and top how far above the centre the
// label sits, both before scaling.
const SHAPES = {
  Pod: { body: 'bell', motion: 'drift', scale: 1.1, squash: 1, tentacles: 8, length: 3, speed: 1.6, hit: 1.5, top: 1.8 },
  Deployment: { body: 'fish', motion: 'swim', species: 'whale', scale: 2.4, speed: 1.5, hit: 1.7, top: 1.3 },
  StatefulSet: { body: 'fish', motion: 'swim', species: 'shark', scale: 2, speed: 2.5, hit: 1.6, top: 1.6 },
  DaemonSet: { body: 'school', motion: 'drift', species: 'minnow', scale: 1.7, count: 7, speed: 7, hit: 2.1, top: 1.5 },
  Job: { body: 'fish', motion: 'swim', species: 'minnow', scale: 1.2, speed: 8, hit: 0.9, top: 0.9 },
  CronJob: { body: 'fish', motion: 'swim', species: 'angelfish', scale: 1.7, speed: 3, hit: 1.3, top: 2, ring: true },
  Service: { body: 'fish', motion: 'swim', species: 'anglerfish', scale: 1.4, speed: 3, hit: 1, top: 1.5, lure: [0.98, 1.08, 0] },
  Ingress: { body: 'fish', motion: 'swim', species: 'manta', scale: 1.5, speed: 1.8, hit: 1.8, top: 0.8 },
  PersistentVolumeClaim: { body: 'shell', motion: 'drift', scale: 0.9, squash: 0.8, speed: 0.5, hit: 1.1, top: 1.5 },
};

// What each kind is called in this theme, for the legend.
const NAMES = {
  Pod: 'jellyfish',
  Deployment: 'whale',
  StatefulSet: 'shark',
  DaemonSet: 'school of fish',
  Job: 'small fish',
  CronJob: 'ringed angelfish',
  Service: 'anglerfish',
  Ingress: 'manta ray',
  PersistentVolumeClaim: 'shell',
};

const HALF_TURN = Math.PI / 2;

function OceanBody({ shape, sim, look }) {
  const ring = useRef();
  const school = useRef([]);
  const isBell = shape.body === 'bell';
  const { color, opacity, glow } = look;

  const materials = useMemo(
    () => ({
      body: shape.species
        ? fishMaterial({ phase: sim.phase, speed: shape.speed, species: shape.species })
        : bellMaterial({
            phase: sim.phase,
            speed: shape.speed,
            pulse: isBell ? 0.18 : 0.04,
            ribs: isBell ? 1 : 0,
          }),
      tentacles: shape.tentacles
        ? tentacleMaterial({ phase: sim.phase, speed: shape.speed, length: shape.length })
        : null,
    }),
    [sim.phase, shape, isBell]
  );

  useEffect(
    () => () => {
      materials.body.dispose();
      materials.tentacles?.dispose();
    },
    [materials]
  );

  useEffect(() => {
    for (const material of [materials.body, materials.tentacles]) {
      if (!material) continue;
      material.uniforms.uColor.value.set(color);
      material.uniforms.uOpacity.value = opacity;
      material.uniforms.uGlow.value = glow;
    }
  }, [materials, color, opacity, glow]);

  useFrame(() => {
    const t = clock.value;
    if (ring.current) ring.current.rotation.x = t * 0.6;
    const fish = school.current;
    for (let i = 0; i < fish.length; i += 1) {
      const around = t * 0.6 + sim.phase + (i / fish.length) * Math.PI * 2;
      const radius = 1.5 + 0.4 * Math.sin(i * 2.4);
      fish[i].position.set(Math.cos(around) * radius, Math.sin(t * 0.8 + i * 1.7) * 0.6, Math.sin(around) * radius);
      fish[i].rotation.y = -(around + HALF_TURN);
    }
  });

  return (
    <>
      {shape.body === 'fish' && (
        <mesh geometry={fishGeometry(shape.species)} material={materials.body} frustumCulled={false} />
      )}
      {shape.body === 'school' &&
        Array.from({ length: shape.count }, (_, i) => (
          <mesh
            key={i}
            ref={(mesh) => {
              if (mesh) school.current[i] = mesh;
            }}
            geometry={fishGeometry(shape.species)}
            material={materials.body}
            scale={0.7}
            frustumCulled={false}
          />
        ))}
      {(isBell || shape.body === 'shell') && (
        <mesh geometry={GEOMETRY[shape.body]} material={materials.body} scale={[1, shape.squash, 1]} />
      )}
      {materials.tentacles && (
        <lineSegments
          geometry={tentacleGeometry(shape.tentacles)}
          material={materials.tentacles}
          frustumCulled={false}
        />
      )}
      {isBell && (
        <mesh geometry={GEOMETRY.core} scale={0.22} position={[0, 0.3 * shape.squash, 0]}>
          <meshBasicMaterial color={color} transparent opacity={opacity * 0.85} depthWrite={false} />
        </mesh>
      )}
      {shape.lure && (
        <mesh geometry={GEOMETRY.core} scale={0.13} position={shape.lure}>
          <meshBasicMaterial color={color} transparent opacity={opacity} depthWrite={false} />
        </mesh>
      )}
      {shape.ring && (
        <mesh ref={ring} geometry={GEOMETRY.ring}>
          <meshBasicMaterial color={color} transparent opacity={opacity * 0.7} depthWrite={false} />
        </mesh>
      )}
    </>
  );
}

// A huge inside-out sphere: faint light from above, black below.
function Backdrop() {
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
          void main() {
            float h = smoothstep(-0.3, 1.0, vDir.y);
            gl_FragColor = vec4(mix(vec3(0.004, 0.012, 0.03), vec3(0.02, 0.11, 0.2), h * h), 1.0);
          }`,
      }),
    []
  );
  useEffect(() => () => material.dispose(), [material]);
  return (
    <mesh material={material} renderOrder={-1}>
      <sphereGeometry args={[1200, 24, 16]} />
    </mesh>
  );
}

// A soft round dot, so specks are not drawn as squares.
export function dotTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 32;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 32, 32);
  return new THREE.CanvasTexture(canvas);
}

// Drifting specks that give a sense of speed and depth while flying.
function Plankton({ count, range = 320 }) {
  const points = useRef();
  const dot = useMemo(dotTexture, []);
  const positions = useMemo(() => {
    const p = new Float32Array(count * 3);
    for (let i = 0; i < p.length; i += 1) p[i] = (Math.random() - 0.5) * range;
    return p;
  }, [count, range]);

  useFrame((_, dt) => {
    points.current.rotation.y += dt * 0.004;
    points.current.position.y = Math.sin(clock.value * 0.05) * 6;
  });

  return (
    <points ref={points} frustumCulled={false}>
      <bufferGeometry key={count}>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        map={dot}
        color="#7fd6ff"
        size={0.5}
        sizeAttenuation
        transparent
        opacity={0.55}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

function OceanEnvironment({ particles }) {
  return (
    <>
      <Backdrop />
      <Plankton count={particles} />
    </>
  );
}

const ocean = {
  key: 'ocean',
  label: 'Ocean',
  background: '#020a18',
  fog: 0.005,
  wireSag: 1,
  shapes: SHAPES,
  names: NAMES,
  colors: {},
  Body: OceanBody,
  Environment: OceanEnvironment,
};

export default ocean;
