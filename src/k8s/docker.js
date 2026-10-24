// Copyright (c) 2026 rmd Studio Inc. MIT License.
//
// Docker Desktop as a second source. Compose projects become namespaces,
// Compose services are drawn like Deployments and their containers like
// pods. Only the container list and container logs are read.

const BASE = '/docker';

async function errorMessage(res) {
  try {
    return (await res.json()).message || `HTTP ${res.status}`;
  } catch {
    return `HTTP ${res.status}`;
  }
}

export async function fetchDocker() {
  const res = await fetch(`${BASE}/containers/json?all=1`, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(await errorMessage(res));
  return res.json();
}

function containerStatus(c) {
  const text = c.Status || '';
  switch (c.State) {
    case 'running':
      if (/unhealthy/.test(text)) return ['failed', 'Unhealthy'];
      if (/health: starting/.test(text)) return ['pending', 'Starting'];
      return ['running', 'Running'];
    case 'exited': {
      const code = Number((text.match(/Exited \((\d+)\)/) || [])[1] || 0);
      return code === 0 ? ['done', 'Exited (0)'] : ['failed', `Exited (${code})`];
    }
    case 'restarting':
      return ['failed', 'Restarting'];
    case 'dead':
      return ['failed', 'Dead'];
    case 'paused':
      return ['pending', 'Paused'];
    default:
      return ['pending', c.State || 'Unknown'];
  }
}

function serviceStatus(containers) {
  const running = containers.filter((c) => c.status === 'running').length;
  const text = `${running}/${containers.length} running`;
  if (containers.some((c) => c.status === 'failed')) return ['failed', text];
  if (containers.every((c) => c.status === 'done')) return ['done', 'Stopped'];
  if (running === containers.length) return ['running', text];
  return ['pending', text];
}

const ports = (c) =>
  [...new Set((c.Ports || []).map((p) => (p.PublicPort ? `${p.PublicPort}→${p.PrivatePort}` : `${p.PrivatePort}`)))].join(
    ', '
  );

// Nodes and links in the same shape as graph.js produces. Nothing is taken
// from labels except the Compose project, service and depends_on: other
// labels hold local file paths.
export function dockerGraph(list) {
  const nodes = [];
  const links = [];
  const services = new Map();

  for (const c of list) {
    const labels = c.Labels || {};
    const project = labels['com.docker.compose.project'];
    const service = labels['com.docker.compose.service'];
    const namespace = project ? `docker/${project}` : 'docker';
    const name = (c.Names?.[0] || c.Id.slice(0, 12)).replace(/^\//, '');
    const [status, statusText] = containerStatus(c);
    const id = `Pod/${namespace}/${name}`;
    const node = {
      id,
      kind: 'Pod',
      kindLabel: 'Container',
      name,
      namespace,
      status,
      statusText,
      createdAt: new Date(c.Created * 1000).toISOString(),
      containers: [service || name],
      docker: { id: c.Id },
      info: [
        ['State', c.Status],
        ['Ports', ports(c)],
        ['Image', c.Image, true],
      ],
    };
    nodes.push(node);

    if (service) {
      const key = `${namespace}/${service}`;
      if (!services.has(key)) {
        services.set(key, { namespace, name: service, containers: [], dependsOn: new Set() });
      }
      const s = services.get(key);
      s.containers.push(node);
      // "db:service_healthy:false,cache:service_started:false"
      for (const entry of (labels['com.docker.compose.depends_on'] || '').split(',')) {
        const dependency = entry.split(':')[0].trim();
        if (dependency) s.dependsOn.add(dependency);
      }
    }
  }

  for (const s of services.values()) {
    const id = `Deployment/${s.namespace}/${s.name}`;
    const [status, statusText] = serviceStatus(s.containers);
    nodes.push({
      id,
      kind: 'Deployment',
      kindLabel: 'Compose service',
      name: s.name,
      namespace: s.namespace,
      status,
      statusText,
      createdAt: s.containers.map((c) => c.createdAt).sort()[0],
      info: [['Containers', String(s.containers.length)]],
    });
    for (const c of s.containers) links.push({ source: id, target: c.id, type: 'owns' });
    for (const dependency of s.dependsOn) {
      links.push({ source: id, target: `Deployment/${s.namespace}/${dependency}`, type: 'depends' });
    }
  }

  return { nodes, links };
}

// Docker interleaves stdout and stderr in frames with an 8-byte header,
// unless the container has a terminal, in which case the stream is plain.
export function demuxer() {
  const decoder = new TextDecoder();
  let pending = new Uint8Array(0);
  let framed = null;

  return (chunk, done) => {
    const joined = new Uint8Array(pending.length + chunk.length);
    joined.set(pending);
    joined.set(chunk, pending.length);
    pending = joined;
    if (framed === null && (pending.length >= 8 || done)) {
      framed = pending.length >= 8 && pending[0] <= 2 && pending[1] === 0 && pending[2] === 0 && pending[3] === 0;
    }
    let text = '';
    if (framed === false) {
      text = decoder.decode(pending, { stream: !done });
      pending = new Uint8Array(0);
    } else if (framed) {
      while (pending.length >= 8) {
        const size = ((pending[4] << 24) | (pending[5] << 16) | (pending[6] << 8) | pending[7]) >>> 0;
        if (pending.length < 8 + size) break;
        text += decoder.decode(pending.subarray(8, 8 + size), { stream: true });
        pending = pending.subarray(8 + size);
      }
    }
    return text;
  };
}

// Same contract as openLogStream in api.js.
export function openDockerLogStream({ containerId, tailLines, follow, onLines, onError, onEnd }) {
  const ctrl = new AbortController();
  const query = new URLSearchParams({ stdout: '1', stderr: '1', tail: String(tailLines), follow: follow ? '1' : '0' });

  (async () => {
    try {
      const res = await fetch(`${BASE}/containers/${containerId}/logs?${query}`, { signal: ctrl.signal });
      if (!res.ok) throw new Error(await errorMessage(res));
      const reader = res.body.getReader();
      const demux = demuxer();
      let rest = '';
      for (;;) {
        const { done, value } = await reader.read();
        rest += demux(value || new Uint8Array(0), done);
        const lines = rest.split('\n');
        rest = lines.pop();
        if (lines.length) onLines(lines);
        if (done) break;
      }
      if (rest) onLines([rest]);
      onEnd();
    } catch (err) {
      if (err.name !== 'AbortError') onError(err);
    }
  })();

  return () => ctrl.abort();
}
