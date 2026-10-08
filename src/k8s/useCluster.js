// Copyright (c) 2026 rmd Studio Inc. MIT License.
import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchCluster } from './api';
import { demoCluster } from './demo';
import { buildGraph } from './graph';

const POLL_MS = 5000;

const forcedDemo =
  process.env.REACT_APP_DEMO === '1' || new URLSearchParams(window.location.search).has('demo');

// Polls the cluster and returns its graph. Falls back to the demo cluster when
// no cluster can be reached; `retry` tries the live one again.
export function useCluster() {
  const [state, setState] = useState({ graph: null, mode: forcedDemo ? 'demo' : 'connecting', error: null });
  const [attempt, setAttempt] = useState(0);
  const signature = useRef('');

  useEffect(() => {
    let cancelled = false;
    let timer;

    const show = (raw, mode, error = null) => {
      const graph = buildGraph(raw);
      const changed = graph.signature !== signature.current;
      signature.current = graph.signature;
      setState((prev) =>
        !changed && prev.mode === mode && prev.error === error ? prev : { graph: changed ? graph : prev.graph, mode, error }
      );
    };

    const poll = async () => {
      try {
        const raw = await fetchCluster();
        if (cancelled) return;
        show(raw, 'live');
        timer = setTimeout(poll, POLL_MS);
      } catch (err) {
        if (cancelled) return;
        // Polling stops here; the toolbar offers a retry.
        show(demoCluster(), 'demo', err.message);
      }
    };

    signature.current = '';
    if (forcedDemo) show(demoCluster(), 'demo');
    else poll();

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  return { ...state, canRetry: !forcedDemo, retry };
}
