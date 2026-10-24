// Copyright (c) 2026 rmd Studio Inc. MIT License.
import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { WIRES } from '../constants';
import { clock, place } from './shared';
import { dotTexture } from './themes/ocean';

const A = { x: 0, y: 0, z: 0 };
const B = { x: 0, y: 0, z: 0 };
const COLORS = Object.fromEntries(Object.entries(WIRES).map(([type, w]) => [type, new THREE.Color(w.color)]));
const HOT = new THREE.Color('#ff9a3c');
const WHITE_HOT = new THREE.Color('#fff4e0');
// Sparks: bright dots that travel along busy wires, much easier to see than
// the one-pixel wire itself.
const MAX_SPARKS = 600;
const SPARK = new THREE.Color();

// Every connection is a slack wire: it sags under its own length and sways.
// All wires share one geometry; positions are rewritten each frame, colours
// only when the selection, search or activity changes, except on hot wires,
// which carry moving pulses.
//
// heat maps node ids to 0..1. A wire takes the heat of what it leads into,
// except a mount, which takes the heat of the pod doing the mounting.
export default function Wires({ layout, selectedId, matchIds, heat, segments, sag: sagScale }) {
  const { geometry, positions, colors, base } = useMemo(() => {
    const count = layout.links.length * segments * 2;
    const g = new THREE.BufferGeometry();
    const p = new Float32Array(count * 3);
    const c = new Float32Array(count * 3);
    g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    g.setAttribute('color', new THREE.BufferAttribute(c, 3));
    return { geometry: g, positions: p, colors: c, base: new Float32Array(c.length) };
  }, [layout, segments]);

  useEffect(() => () => geometry.dispose(), [geometry]);

  const sparks = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(MAX_SPARKS * 3), 3));
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(MAX_SPARKS * 3), 3));
    g.setDrawRange(0, 0);
    return g;
  }, []);
  const sparkMap = useMemo(dotTexture, []);
  useEffect(() => () => sparks.dispose(), [sparks]);

  const linkHeat = useMemo(
    () =>
      Float32Array.from(layout.links, ({ source, target, type }) =>
        heat ? heat.get(type === 'mounts' ? source.id : target.id) || 0 : 0
      ),
    [layout, heat]
  );

  useEffect(() => {
    let o = 0;
    const color = new THREE.Color();
    layout.links.forEach(({ source, target, type }, i) => {
      const h = linkHeat[i];
      const linked = source.id === selectedId || target.id === selectedId;
      const found = !matchIds || matchIds.has(source.id) || matchIds.has(target.id);
      const intensity = (linked ? 1.5 : !found ? 0.05 : selectedId ? 0.18 : 0.5) * (1 + 1.5 * h);
      // Warm wires shift towards orange, the hottest towards white.
      color.copy(COLORS[type]).lerp(HOT, Math.min(1, h * 1.4)).lerp(WHITE_HOT, Math.max(0, h - 0.6));
      // Brighter at the ends, fainter in the belly of the curve.
      const shade = (u) => intensity * (1 - 2 * u * (1 - u));
      for (let s = 1; s <= segments; s += 1) {
        const a = shade((s - 1) / segments);
        const b = shade(s / segments);
        base.set([color.r * a, color.g * a, color.b * a, color.r * b, color.g * b, color.b * b], o);
        o += 6;
      }
    });
    colors.set(base);
    geometry.attributes.color.needsUpdate = true;
  }, [layout, segments, geometry, colors, base, linkHeat, selectedId, matchIds]);

  useFrame(() => {
    const t = clock.value;
    let o = 0;
    let spark = 0;
    const sparkPositions = sparks.attributes.position.array;
    const sparkColors = sparks.attributes.color.array;
    for (let i = 0; i < layout.links.length; i += 1) {
      const { source, target } = layout.links[i];
      place(source, t, A);
      place(target, t, B);
      const dx = B.x - A.x;
      const dy = B.y - A.y;
      const dz = B.z - A.z;
      const length = Math.sqrt(dx * dx + dy * dy + dz * dz);
      const phase = source.phase + target.phase;
      const sag = (1.2 + length * 0.22) * sagScale;
      const sway = 0.3 + length * 0.03;
      const swayX = Math.sin(t * 0.6 + phase) * sway;
      const swayZ = Math.cos(t * 0.5 + phase * 1.3) * sway;

      let px = A.x;
      let py = A.y;
      let pz = A.z;
      for (let s = 1; s <= segments; s += 1) {
        const u = s / segments;
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
        o += 6;
        px = x;
        py = y;
        pz = z;
      }

      // More and faster sparks the hotter the wire, running source to target.
      const h = linkHeat[i];
      if (h >= 0.08) {
        const count = 1 + Math.floor(h * 4);
        const speed = 0.15 + 0.5 * h;
        SPARK.copy(HOT).lerp(WHITE_HOT, h).multiplyScalar(0.6 + 0.8 * h);
        for (let k = 0; k < count && spark < MAX_SPARKS; k += 1) {
          const u = (((t * speed + k / count + source.phase) % 1) + 1) % 1;
          const bend = 4 * u * (1 - u);
          const ripple = Math.sin(u * Math.PI * 2 + t * 0.8 + phase) * 0.25 * bend;
          sparkPositions.set(
            [A.x + dx * u + swayX * bend, A.y + dy * u - sag * bend + ripple, A.z + dz * u + swayZ * bend],
            spark * 3
          );
          // Fade in and out at the ends so sparks do not pop.
          const fade = Math.min(1, u * 8, (1 - u) * 8);
          sparkColors.set([SPARK.r * fade, SPARK.g * fade, SPARK.b * fade], spark * 3);
          spark += 1;
        }
      }
    }
    sparks.setDrawRange(0, spark);
    if (spark) {
      sparks.attributes.position.needsUpdate = true;
      sparks.attributes.color.needsUpdate = true;
    }
    geometry.attributes.position.needsUpdate = true;

    // Pulses run from source to target, faster and brighter the hotter the
    // wire. Only hot wires are touched.
    let pulsed = false;
    const stride = segments * 6;
    for (let i = 0; i < linkHeat.length; i += 1) {
      const h = linkHeat[i];
      if (h < 0.05) continue;
      pulsed = true;
      const phase = layout.links[i].source.phase;
      const speed = 0.25 + 0.9 * h;
      for (let s = 0; s < segments; s += 1) {
        const u = (s + 0.5) / segments;
        const p = (((u * 3 - t * speed * 3 + phase) % 1) + 1) % 1;
        const boost = 1 + h * 3 * Math.max(0, (p - 0.75) / 0.25) ** 2;
        const at = i * stride + s * 6;
        for (let k = 0; k < 6; k += 1) colors[at + k] = base[at + k] * boost;
      }
    }
    if (pulsed) geometry.attributes.color.needsUpdate = true;
  });

  return (
    <>
      <lineSegments geometry={geometry} frustumCulled={false}>
        <lineBasicMaterial vertexColors transparent depthWrite={false} blending={THREE.AdditiveBlending} />
      </lineSegments>
      <points geometry={sparks} frustumCulled={false}>
        <pointsMaterial
          map={sparkMap}
          vertexColors
          size={1.6}
          sizeAttenuation
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
    </>
  );
}
