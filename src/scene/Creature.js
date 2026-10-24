// Copyright (c) 2026 rmd Studio Inc. MIT License.
import { memo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { creatureColor } from '../constants';
import { clock, place, pointer } from './shared';

const HALF_TURN = Math.PI / 2;
const HIT = new THREE.SphereGeometry(1, 10, 10);

// One resource in the scene. The theme draws its body; this places it,
// moves it and takes clicks.
function Creature({ theme, node, heat, sim, selected, hovered, dim, onSelect, onGlide, onHover }) {
  const group = useRef();
  const shape = theme.shapes[node.kind];
  const look = {
    color: creatureColor(node, theme.colors),
    opacity: dim ? 0.05 : node.status === 'done' ? 0.5 : 1,
    // Busy creatures glow brighter.
    glow: (selected ? 1.7 : hovered ? 1.35 : 1) + heat * 0.8,
  };

  useFrame(() => {
    const t = clock.value;
    const g = group.current;
    const angle = place(sim, t, g.position);
    if (shape.motion === 'swim') {
      // Face along the circle being travelled, with a slight roll.
      g.rotation.set(0, -(angle + Math.sign(sim.swimSpeed) * HALF_TURN), Math.sin(t * 0.5 + sim.phase) * 0.08);
    } else if (shape.motion === 'spin') {
      // A fixed axial tilt; the body itself turns.
      g.rotation.set(0.25 * Math.sin(sim.phase), 0, 0.35 * Math.cos(sim.phase));
    } else {
      g.rotation.z = Math.sin(t * 0.3 + sim.phase) * 0.12;
      g.rotation.x = Math.cos(t * 0.25 + sim.phase) * 0.1;
    }
  });

  const { Body } = theme;
  return (
    <group ref={group} scale={shape.scale}>
      <Body shape={shape} sim={sim} look={look} />
      <mesh
        geometry={HIT}
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
