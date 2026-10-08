// Copyright (c) 2026 rmd Studio Inc. MIT License.

const BASE = '/k8s';

// Keep in step with the allow-list in src/setupProxy.js.
const RESOURCES = {
  pods: '/api/v1/pods',
  services: '/api/v1/services',
  persistentvolumeclaims: '/api/v1/persistentvolumeclaims',
  deployments: '/apis/apps/v1/deployments',
  statefulsets: '/apis/apps/v1/statefulsets',
  daemonsets: '/apis/apps/v1/daemonsets',
  replicasets: '/apis/apps/v1/replicasets',
  jobs: '/apis/batch/v1/jobs',
  cronjobs: '/apis/batch/v1/cronjobs',
  ingresses: '/apis/networking.k8s.io/v1/ingresses',
};

async function errorMessage(res) {
  try {
    return (await res.json()).message || `HTTP ${res.status}`;
  } catch {
    return `HTTP ${res.status}`;
  }
}

async function list(path) {
  const res = await fetch(BASE + path, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(await errorMessage(res));
  return (await res.json()).items || [];
}

// Pods are required; any other kind the account cannot list is shown as empty.
export async function fetchCluster() {
  const entries = await Promise.all(
    Object.entries(RESOURCES).map(async ([key, path]) => {
      try {
        return [key, await list(path)];
      } catch (err) {
        if (key === 'pods') throw err;
        return [key, []];
      }
    })
  );
  return Object.fromEntries(entries);
}

// Streams a pod's log. Returns a function that closes the stream.
export function openLogStream({ namespace, pod, container, tailLines, follow, onLines, onError, onEnd }) {
  const ctrl = new AbortController();
  const query = new URLSearchParams({ tailLines: String(tailLines), follow: String(follow) });
  if (container) query.set('container', container);

  (async () => {
    try {
      const res = await fetch(`${BASE}/api/v1/namespaces/${namespace}/pods/${pod}/log?${query}`, {
        signal: ctrl.signal,
      });
      if (!res.ok) throw new Error(await errorMessage(res));
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let rest = '';
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        rest += decoder.decode(value, { stream: true });
        const lines = rest.split('\n');
        rest = lines.pop();
        if (lines.length) onLines(lines);
      }
      if (rest) onLines([rest]);
      onEnd();
    } catch (err) {
      if (err.name !== 'AbortError') onError(err);
    }
  })();

  return () => ctrl.abort();
}
