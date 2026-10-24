// Copyright (c) 2026 rmd Studio Inc. MIT License.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Bloom, EffectComposer, Vignette } from '@react-three/postprocessing';
import Creature from './Creature';
import FlyControls from './FlyControls';
import Labels from './Labels';
import { QUALITY } from './quality';
import { THEMES } from './themes';
import Wires from './Wires';
import { clock, pointer, space } from './shared';
import { useLayout } from './useLayout';

// Draws at most `fps` frames a second, in step with the display. Used with
// the canvas's on-demand mode, which otherwise only draws when asked.
function FrameLimiter({ fps }) {
  const invalidate = useThree((state) => state.invalidate);
  useEffect(() => {
    let id;
    let last = 0;
    const tick = (now) => {
      id = requestAnimationFrame(tick);
      // A little slack so a 60 Hz display reliably gets every other frame.
      if (now - last >= 1000 / fps - 4) {
        last = now;
        invalidate();
      }
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [fps, invalidate]);
  return null;
}

function Scene({ theme, graph, heat, selectedId, matchIds, showLabels, presentation, spacing, glide, wireSegments, onSelect, onGlide }) {
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
      const shape = theme.shapes[node.kind];
      sim.size = shape.hit * shape.scale;
      const focused = node.id === selectedId || node.id === hoveredId;
      // While searching, the matches are named and nothing else is.
      const named = matchIds ? matchIds.has(node.id) : showLabels && node.kind !== 'Pod';
      if (!(focused || named)) continue;
      const where = presentation ? '' : ` · ${node.namespace}`;
      items.push({
        id: node.id,
        sim,
        height: shape.top * shape.scale,
        title: node.name,
        pinned: focused || Boolean(matchIds),
        detail: focused ? `${node.kindLabel || node.kind}${where} · ${node.statusText}` : '',
      });
    }
    return items;
  }, [theme, graph, layout, selectedId, hoveredId, matchIds, showLabels, presentation]);

  return (
    <>
      {graph.nodes.map((node) => {
        const sim = layout.nodes.get(node.id);
        return (
          sim && (
            <Creature
              key={node.id}
              theme={theme}
              heat={Math.round((heat.get(node.id) || 0) * 10) / 10}
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
      <Wires
        layout={layout}
        selectedId={selectedId}
        matchIds={matchIds}
        heat={heat}
        segments={wireSegments}
        sag={theme.wireSag}
      />
      <Labels items={labels} />
      <FlyControls layout={layout} glide={glide} />
    </>
  );
}

export default function World({ theme: themeKey, quality, onSelect, ...props }) {
  const q = QUALITY[quality];
  const theme = THEMES[themeKey];
  const { Environment } = theme;
  return (
    <Canvas
      camera={{ position: [0, 12, 95], fov: 60, near: 0.1, far: 3000 }}
      dpr={q.dpr}
      frameloop={q.fps ? 'demand' : 'always'}
      gl={{ antialias: true, powerPreference: q.fps ? 'default' : 'high-performance' }}
      onPointerMissed={() => {
        if (!pointer.dragged) onSelect(null);
      }}
    >
      {q.fps && <FrameLimiter fps={q.fps} />}
      <color attach="background" args={[theme.background]} />
      <fogExp2 key={`fog-${theme.key}`} attach="fog" args={[theme.background, theme.fog]} />
      <Environment key={`environment-${theme.key}`} particles={q.particles} />
      <Scene theme={theme} onSelect={onSelect} wireSegments={q.wireSegments} {...props} />
      {q.bloom === 'full' ? (
        <EffectComposer key="full">
          <Bloom mipmapBlur luminanceThreshold={0.2} luminanceSmoothing={0.3} intensity={1.1} />
          <Vignette darkness={0.6} offset={0.25} />
        </EffectComposer>
      ) : (
        <EffectComposer key="cheap" multisampling={0}>
          <Bloom resolutionScale={0.5} luminanceThreshold={0.2} luminanceSmoothing={0.3} intensity={1.3} />
          <Vignette darkness={0.6} offset={0.25} />
        </EffectComposer>
      )}
    </Canvas>
  );
}
