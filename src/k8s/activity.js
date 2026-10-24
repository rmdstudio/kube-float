// Copyright (c) 2026 rmd Studio Inc. MIT License.
//
// How busy each pod and container is, measured by how many log lines it
// wrote recently. A stand-in for traffic: a service that logs every request
// shows up well, one that logs nothing stays dark. Each pod learns its usual
// rate, so a burst above it (requests coming in) stands out even when the
// pod chatters steadily in the background.
import { useEffect, useRef, useState } from 'react';
import { demuxer } from './docker';

const POLL_MS = 5000;
// Readings are expressed as lines per this many seconds.
const WINDOW_S = 5;
// Never look further back than this, e.g. for a pod not read for a while.
const MAX_LOOKBACK_S = 60;
// Leaves browser connections free for polling and open log windows.
const CONCURRENCY = 4;
// Enough to tell a busy pod from a quiet one without pulling megabytes.
const LIMIT_BYTES = 131072;

const lines = (text) => (text.match(/\n/g) || []).length;

// Each pod is read for everything since its previous reading, so the gaps
// while other pods are being read are not lost. Returns lines per second.
async function k8sRate(node, signal, seconds) {
  let total = 0;
  for (const container of node.containers) {
    const query = new URLSearchParams({
      sinceSeconds: String(Math.ceil(seconds)),
      limitBytes: String(LIMIT_BYTES),
      container,
    });
    const res = await fetch(`/k8s/api/v1/namespaces/${node.namespace}/pods/${node.name}/log?${query}`, { signal });
    if (res.ok) total += lines(await res.text());
  }
  return total / Math.ceil(seconds);
}

async function dockerRate(node, signal, seconds) {
  const since = Math.floor(Date.now() / 1000 - seconds);
  const query = new URLSearchParams({ stdout: '1', stderr: '1', since: String(since) });
  const res = await fetch(`/docker/containers/${node.docker.id}/logs?${query}`, { signal });
  if (!res.ok) return 0;
  const text = demuxer()(new Uint8Array(await res.arrayBuffer()), true);
  return lines(text) / Math.max(1, Math.round(seconds));
}

// lastRead maps pod ids to when they were last read (ms), and is updated.
async function measure(pods, signal, lastRead) {
  const rates = new Map();
  const queue = [...pods];
  const worker = async () => {
    while (queue.length && !signal.aborted) {
      const node = queue.shift();
      const now = Date.now();
      const seconds = Math.min(MAX_LOOKBACK_S, Math.max(1, (now - (lastRead.get(node.id) || now - WINDOW_S * 1000)) / 1000));
      try {
        rates.set(node.id, await (node.docker ? dockerRate(node, signal, seconds) : k8sRate(node, signal, seconds)));
        lastRead.set(node.id, now);
      } catch {
        // An unreadable log counts as quiet.
      }
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  return rates;
}

// Made-up activity for the demo: each pod hums along with occasional bursts.
function demoRates(pods, previous) {
  const rates = new Map();
  for (const node of pods) {
    const base = ((node.name.length * 7) % 10) / 4;
    const burst = Math.random() < 0.15 ? 4 + Math.random() * 8 : 0;
    const before = previous.get(node.id) ?? base;
    rates.set(node.id, before * 0.5 + (base * (0.5 + Math.random()) + burst) * 0.5);
  }
  return rates;
}

// For each running pod and container in `pods`: { lines, burst } over the
// last reading, where burst is how far above its usual rate it is.
export function useActivity({ enabled, demo, pods }) {
  const [rates, setRates] = useState(() => new Map());
  const latest = useRef(pods);
  latest.current = pods;

  useEffect(() => {
    if (!enabled) {
      setRates(new Map());
      return undefined;
    }
    const ctrl = new AbortController();
    let timer;
    let previous = new Map();
    const usual = new Map();
    const lastRead = new Map();

    const tick = async () => {
      const started = Date.now();
      const running = latest.current.filter((n) => n.status === 'running');
      let measured;
      if (demo) {
        measured = demoRates(running, previous);
        previous = measured;
      } else {
        measured = await measure(running, ctrl.signal, lastRead);
        if (ctrl.signal.aborted) return;
      }
      const next = new Map();
      for (const [id, rate] of measured) {
        const lines = rate * WINDOW_S;
        // The usual rate creeps up slowly and falls quickly, so a burst is
        // not mistaken for the new normal.
        const before = usual.has(id) ? usual.get(id) : lines;
        usual.set(id, lines > before ? before + (lines - before) * 0.08 : before + (lines - before) * 0.4);
        next.set(id, { lines, burst: Math.max(0, lines - before) });
      }
      setRates(next);
      // A pass starts every 5 seconds, or straight after the previous one
      // when a large cluster takes longer than that to read.
      timer = setTimeout(tick, demo ? 2000 : Math.max(1000, POLL_MS - (Date.now() - started)));
    };
    tick();

    return () => {
      ctrl.abort();
      clearTimeout(timer);
    };
  }, [enabled, demo]);

  return rates;
}

// Turns activity into heat between 0 and 1 for every node: a pod's own, or
// for anything else the total of the pods behind it. `podsOf(id)` lists
// those pods. Steady logging only warms a little; a burst of even a few
// lines above the usual makes it glow.
export function heatOf(nodes, rates, podsOf) {
  const heat = new Map();
  if (!rates.size) return heat;
  for (const node of nodes) {
    const pods = node.kind === 'Pod' ? [node] : podsOf(node.id);
    let lines = 0;
    let burst = 0;
    for (const p of pods) {
      const r = rates.get(p.id);
      if (r) {
        lines += r.lines;
        burst += r.burst;
      }
    }
    const h = Math.min(1, 0.3 * (1 - Math.exp(-lines / 10)) + (1 - Math.exp(-burst / 2)));
    if (h > 0.01) heat.set(node.id, h);
  }
  return heat;
}
