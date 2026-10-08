// Copyright (c) 2026 rmd Studio Inc. MIT License.
import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { WIRES } from '../constants';
import { clock, place } from './shared';

const SEGMENTS = 40;
const A = { x: 0, y: 0, z: 0 };
const B = { x: 0, y: 0, z: 0 };
const COLORS = Object.fromEntries(Object.entries(WIRES).map(([type, w]) => [type, new THREE.Color(w.color)]));

// Every connection is a slack wire: it sags under its own length and sways.
// All wires share one geometry that is rewritten each frame.
export default function Wires({ layout, selectedId, matchIds }) {
  const { geometry, positions, colors } = useMemo(() => {
    const count = layout.links.length * SEGMENTS * 2;
    const g = new THREE.BufferGeometry();
    const p = new Float32Array(count * 3);
    const c = new Float32Array(count * 3);
    g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    g.setAttribute('color', new THREE.BufferAttribute(c, 3));
    return { geometry: g, positions: p, colors: c };
  }, [layout]);

  useEffect(() => () => geometry.dispose(), [geometry]);

  useFrame(() => {
    const t = clock.value;
    let o = 0;
    for (const { source, target, type } of layout.links) {
      place(source, t, A);
      place(target, t, B);
      const dx = B.x - A.x;
      const dy = B.y - A.y;
      const dz = B.z - A.z;
      const length = Math.sqrt(dx * dx + dy * dy + dz * dz);
      const phase = source.phase + target.phase;
      const sag = 1.2 + length * 0.22;
      const sway = 0.3 + length * 0.03;
      const swayX = Math.sin(t * 0.6 + phase) * sway;
      const swayZ = Math.cos(t * 0.5 + phase * 1.3) * sway;

      const linked = source.id === selectedId || target.id === selectedId;
      const found = !matchIds || matchIds.has(source.id) || matchIds.has(target.id);
      const intensity = linked ? 1.5 : !found ? 0.05 : selectedId ? 0.18 : 0.5;
      const color = COLORS[type];

      let px = A.x;
      let py = A.y;
      let pz = A.z;
      for (let s = 1; s <= SEGMENTS; s += 1) {
        const u = s / SEGMENTS;
        const k = 4 * u * (1 - u);
        const ripple = Math.sin(u * Math.PI * 2 + t * 0.8 + phase) * 0.25 * k;
        const x = A.x + dx * u + swayX * k;
        const y = A.y + dy * u - sag * k + ripple;
        const z = A.z + dz * u + swayZ * k;
        positions[o] = px;
        positions[o + 1] = py;
        positions[o + 2] = pz;
        positions[o + 3] = x;
        positions[o + 4] = y;
        positions[o + 5] = z;
        // Brighter at the ends, fainter in the belly of the curve.
        const shade = intensity * (1 - 0.5 * k);
        colors[o] = colors[o + 3] = color.r * shade;
        colors[o + 1] = colors[o + 4] = color.g * shade;
        colors[o + 2] = colors[o + 5] = color.b * shade;
        o += 6;
        px = x;
        py = y;
        pz = z;
      }
    }
    geometry.attributes.position.needsUpdate = true;
    geometry.attributes.color.needsUpdate = true;
  });

  return (
    <lineSegments geometry={geometry} frustumCulled={false}>
      <lineBasicMaterial vertexColors transparent depthWrite={false} blending={THREE.AdditiveBlending} />
    </lineSegments>
  );
}
