// Copyright (c) 2026 rmd Studio Inc. MIT License.
import { useMemo, useRef } from 'react';
import { forceCollide, forceLink, forceManyBody, forceSimulation, forceX, forceY, forceZ } from 'd3-force-3d';

// Ingresses float near the surface, storage sinks, so wires hang downwards.
const DEPTH = {
  Ingress: 20,
  Service: 10,
  CronJob: 6,
  Pod: -6,
  PersistentVolumeClaim: -20,
};

// Fish circle their spot: [radius, turns in radians per second].
const SWIM = {
  Deployment: [3, 0.14],
  StatefulSet: [3.5, 0.22],
  Job: [1.6, 0.8],
  CronJob: [1.2, 0.3],
  Service: [1, 0.3],
  Ingress: [4, 0.16],
};

const jitter = (range) => (Math.random() - 0.5) * range;

function hashPhase(text) {
  let h = 0;
  for (let i = 0; i < text.length; i += 1) h = (h * 31 + text.charCodeAt(i)) | 0;
  return (Math.abs(h) % 6283) / 1000;
}

// A 3D force layout. Each namespace is pulled towards its own point so
// namespaces form separate shoals. Positions survive graph updates.
export function useLayout(graph) {
  const previous = useRef(new Map());

  return useMemo(() => {
    const namespaces = [...new Set(graph.nodes.map((n) => n.namespace))].sort();
    const radius = namespaces.length > 1 ? 26 * Math.sqrt(namespaces.length) : 0;
    const centers = new Map(
      namespaces.map((ns, i) => {
        const angle = (i / namespaces.length) * Math.PI * 2;
        return [ns, { x: Math.cos(angle) * radius, y: 0, z: Math.sin(angle) * radius }];
      })
    );

    const nodes = new Map();
    for (const n of graph.nodes) {
      const center = centers.get(n.namespace);
      const sim = previous.current.get(n.id) || {
        id: n.id,
        phase: hashPhase(n.id),
        x: center.x + jitter(24),
        y: center.y + jitter(24),
        z: center.z + jitter(24),
      };
      sim.center = center;
      sim.depth = DEPTH[n.kind] || 0;
      const [radius, speed] = SWIM[n.kind] || [0, 0];
      sim.swim = radius;
      // Half of them swim the other way round.
      sim.swimSpeed = sim.phase > Math.PI ? -speed : speed;
      nodes.set(n.id, sim);
    }

    const links = graph.links.map((l) => ({
      source: nodes.get(l.source),
      target: nodes.get(l.target),
      type: l.type,
    }));

    const sim = forceSimulation([...nodes.values()], 3)
      .force(
        'link',
        forceLink(links)
          .distance((l) => (l.type === 'owns' ? 9 : 13))
          .strength(0.5)
      )
      .force('charge', forceManyBody().strength(-70).distanceMax(90))
      .force('collide', forceCollide(5))
      .force('x', forceX((d) => d.center.x).strength(0.05))
      .force('y', forceY((d) => d.center.y + d.depth).strength(0.09))
      .force('z', forceZ((d) => d.center.z).strength(0.05))
      .stop();

    if (previous.current.size === 0) {
      // Settle the first layout off screen instead of exploding into view.
      sim.tick(150);
      sim.alpha(0.1);
    } else {
      sim.alpha(0.4);
    }
    previous.current = nodes;

    return { sim, nodes, links };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graph.topology]);
}
