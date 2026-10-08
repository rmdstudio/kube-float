// Copyright (c) 2026 rmd Studio Inc. MIT License.
import { memo, useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { creatureColor } from '../constants';
import { clock, place, pointer } from './shared';
import {
  GEOMETRY,
  bellMaterial,
  fishGeometry,
  fishMaterial,
  tentacleGeometry,
  tentacleMaterial,
} from './materials';

// body: 'bell' is a jellyfish, 'fish' a single animal of `species`, 'school'
// several small ones, 'shell' a still shape. speed is the pulse or tail beat,
// hit the radius that takes clicks, top how far above it the label sits
// (both before scaling).
export const SHAPES = {
  Pod: { body: 'bell', scale: 1.1, squash: 1, tentacles: 8, length: 3, speed: 1.6, hit: 1.5, top: 1.8 },
  Deployment: { body: 'fish', species: 'whale', scale: 2.4, speed: 1.5, hit: 1.7, top: 1.3 },
  StatefulSet: { body: 'fish', species: 'shark', scale: 2, speed: 2.5, hit: 1.6, top: 1.6 },
  DaemonSet: { body: 'school', species: 'minnow', scale: 1.7, count: 7, speed: 7, hit: 2.1, top: 1.5 },
  Job: { body: 'fish', species: 'minnow', scale: 1.2, speed: 8, hit: 0.9, top: 0.9 },
  CronJob: { body: 'fish', species: 'angelfish', scale: 1.7, speed: 3, hit: 1.3, top: 2, ring: true },
  Service: { body: 'fish', species: 'anglerfish', scale: 1.4, speed: 3, hit: 1, top: 1.5, lure: [0.98, 1.08, 0] },
  Ingress: { body: 'fish', species: 'manta', scale: 1.5, speed: 1.8, hit: 1.8, top: 0.8 },
  PersistentVolumeClaim: { body: 'shell', scale: 0.9, squash: 0.8, speed: 0.5, hit: 1.1, top: 1.5 },
};

const HALF_TURN = Math.PI / 2;

function Creature({ node, sim, selected, hovered, dim, onSelect, onGlide, onHover }) {
  const group = useRef();
  const ring = useRef();
  const school = useRef([]);
  const shape = SHAPES[node.kind];
  const isBell = shape.body === 'bell';
  const isFish = shape.body === 'fish';
  const color = creatureColor(node);

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

  const opacity = dim ? 0.05 : node.status === 'done' ? 0.5 : 1;
  const glow = selected ? 1.7 : hovered ? 1.35 : 1;
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
    const g = group.current;
    const angle = place(sim, t, g.position);
    if (isFish) {
      // Face along the circle being swum, with a slight roll.
      g.rotation.set(0, -(angle + Math.sign(sim.swimSpeed) * HALF_TURN), Math.sin(t * 0.5 + sim.phase) * 0.08);
    } else {
      g.rotation.z = Math.sin(t * 0.3 + sim.phase) * 0.12;
      g.rotation.x = Math.cos(t * 0.25 + sim.phase) * 0.1;
    }
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
    <group ref={group} scale={shape.scale}>
      {isFish && <mesh geometry={fishGeometry(shape.species)} material={materials.body} frustumCulled={false} />}
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
      <mesh
        geometry={GEOMETRY.hit}
        scale={shape.hit}
        onClick={(e) => {
          e.stopPropagation();
          if (!pointer.dragged) onSelect(node.id);
        }}
        onDoubleClick={(e) => {
          e.stopPropagation();
          onGlide(node.id);
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          onHover(node.id);
        }}
        onPointerOut={() => onHover(null)}
      >
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  );
}

export default memo(Creature);
