// Copyright (c) 2026 rmd Studio Inc. MIT License.
import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchCluster } from './api';
import { demoCluster } from './demo';
import { dockerGraph, fetchDocker } from './docker';
import { buildGraph } from './graph';

const POLL_MS = 5000;

const forcedDemo =
  process.env.REACT_APP_DEMO === '1' || new URLSearchParams(window.location.search).has('demo');

// Polls Kubernetes and Docker Desktop together and returns one graph. Either
// source may be missing; only when neither answers does it fall back to the
// demo cluster, and `retry` tries the live sources again.
export function useCluster() {
  const [state, setState] = useState({
    graph: null,
    mode: forcedDemo ? 'demo' : 'connecting',
    sources: [],
    error: null,
  });
  const [attempt, setAttempt] = useState(0);
  const signature = useRef('');

  useEffect(() => {
    let cancelled = false;
    let timer;

    const show = (raw, extra, mode, sources, error = null) => {
      const graph = buildGraph(raw, extra);
      const changed = graph.signature !== signature.current;
      signature.current = graph.signature;
      const key = sources.join('+');
      setState((prev) =>
        !changed && prev.mode === mode && prev.sources.join('+') === key && prev.error === error
          ? prev
          : { graph: changed ? graph : prev.graph, mode, sources, error }
      );
    };

    const poll = async () => {
      const [k8s, docker] = await Promise.allSettled([fetchCluster(), fetchDocker()]);
      if (cancelled) return;
      const sources = [];
      if (k8s.status === 'fulfilled') sources.push('Kubernetes');
      if (docker.status === 'fulfilled') sources.push('Docker');
      const problems = [
        k8s.status === 'rejected' && `Kubernetes: ${k8s.reason.message}`,
        docker.status === 'rejected' && `Docker: ${docker.reason.message}`,
      ].filter(Boolean);
      if (!sources.length) {
        // Polling stops here; the toolbar offers a retry.
        show(demoCluster(), undefined, 'demo', [], problems.join(' · '));
        return;
      }
      show(
        k8s.status === 'fulfilled' ? k8s.value : {},
        docker.status === 'fulfilled' ? dockerGraph(docker.value) : undefined,
        'live',
        sources,
        problems.join(' · ') || null
      );
      timer = setTimeout(poll, POLL_MS);
    };

    signature.current = '';
    if (forcedDemo) show(demoCluster(), undefined, 'demo', []);
    else poll();

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  return { ...state, canRetry: !forcedDemo, retry };
}
