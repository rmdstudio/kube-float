// Copyright (c) 2026 rmd Studio Inc. MIT License.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Bloom, EffectComposer, Vignette } from '@react-three/postprocessing';
import * as THREE from 'three';
import Creature, { SHAPES } from './Creature';
import FlyControls from './FlyControls';
import Labels from './Labels';
import Wires from './Wires';
import { clock, pointer, space } from './shared';
import { useLayout } from './useLayout';

const WATER = '#020a18';

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
  return (
    <mesh material={material} renderOrder={-1}>
      <sphereGeometry args={[1200, 24, 16]} />
    </mesh>
  );
}

// A soft round dot, so specks are not drawn as squares.
function dotTexture() {
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
function Plankton({ count = 3000, range = 320 }) {
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
      <bufferGeometry>
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

function Scene({ graph, selectedId, matchIds, showLabels, presentation, spacing, glide, onSelect, onGlide }) {
  const layout = useLayout(graph);
  const [hoveredId, setHoveredId] = useState(null);

  const onHover = useCallback((id) => {
    setHoveredId(id);
    document.body.style.cursor = id ? 'pointer' : '';
  }, []);

  useFrame((_, dt) => {
    clock.value += Math.min(dt, 0.1);
    space.value += (space.target - space.value) * (1 - Math.exp(-4 * dt));
    if (layout.sim.alpha() > 0.02) layout.sim.tick();
  });

  useEffect(() => {
    space.target = spacing;
  }, [spacing]);

  // Pods are only named when pointed at or selected; there are too many.
  const labels = useMemo(() => {
    const items = [];
    for (const node of graph.nodes) {
      const sim = layout.nodes.get(node.id);
      if (!sim) continue;
      sim.size = SHAPES[node.kind].hit * SHAPES[node.kind].scale;
      const focused = node.id === selectedId || node.id === hoveredId;
      // While searching, the matches are named and nothing else is.
      const named = matchIds ? matchIds.has(node.id) : showLabels && node.kind !== 'Pod';
      if (!(focused || named)) continue;
      const where = presentation ? '' : ` · ${node.namespace}`;
      items.push({
        id: node.id,
        sim,
        height: SHAPES[node.kind].top * SHAPES[node.kind].scale,
        title: node.name,
        pinned: focused || Boolean(matchIds),
        detail: focused ? `${node.kind}${where} · ${node.statusText}` : '',
      });
    }
    return items;
  }, [graph, layout, selectedId, hoveredId, matchIds, showLabels, presentation]);

  return (
    <>
      {graph.nodes.map((node) => {
        const sim = layout.nodes.get(node.id);
        return (
          sim && (
            <Creature
              key={node.id}
              node={node}
              sim={sim}
              selected={node.id === selectedId}
              hovered={node.id === hoveredId}
              dim={Boolean(matchIds) && !matchIds.has(node.id)}
              onSelect={onSelect}
              onGlide={onGlide}
              onHover={onHover}
            />
          )
        );
      })}
      <Wires layout={layout} selectedId={selectedId} matchIds={matchIds} />
      <Labels items={labels} />
      <FlyControls layout={layout} glide={glide} />
    </>
  );
}

export default function Ocean({ onSelect, ...props }) {
  return (
    <Canvas
      camera={{ position: [0, 12, 95], fov: 60, near: 0.1, far: 3000 }}
      dpr={[1, 2]}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      onPointerMissed={() => {
        if (!pointer.dragged) onSelect(null);
      }}
    >
      <color attach="background" args={[WATER]} />
      <fogExp2 attach="fog" args={[WATER, 0.005]} />
      <Backdrop />
      <Plankton />
      <Scene onSelect={onSelect} {...props} />
      <EffectComposer>
        <Bloom mipmapBlur luminanceThreshold={0.2} luminanceSmoothing={0.3} intensity={1.1} />
        <Vignette darkness={0.6} offset={0.25} />
      </EffectComposer>
    </Canvas>
  );
}
