// Copyright (c) 2026 rmd Studio Inc. MIT License.
//
// Turns raw Kubernetes lists into the creatures (nodes) and wires (links)
// that the scene draws.

const id = (kind, namespace, name) => `${kind}/${namespace}/${name}`;

function podStatus(pod) {
  const phase = pod.status?.phase;
  const containers = pod.status?.containerStatuses || [];
  const waiting = containers.map((c) => c.state?.waiting?.reason).find(Boolean);
  if (phase === 'Succeeded') return ['done', 'Completed'];
  if (phase === 'Failed') return ['failed', pod.status.reason || 'Failed'];
  if (waiting && /BackOff|Err|Invalid|Error/.test(waiting)) return ['failed', waiting];
  if (pod.metadata.deletionTimestamp) return ['pending', 'Terminating'];
  if (phase === 'Running') {
    return containers.every((c) => c.ready) ? ['running', 'Running'] : ['pending', 'Not ready'];
  }
  return ['pending', waiting || phase || 'Unknown'];
}

function replicaStatus(ready = 0, desired = 0) {
  if (desired === 0) return ['done', 'Scaled to zero'];
  return [ready >= desired ? 'running' : 'pending', `${ready}/${desired} ready`];
}

function jobStatus(job) {
  const s = job.status || {};
  if ((s.conditions || []).some((c) => c.type === 'Failed' && c.status === 'True')) return ['failed', 'Failed'];
  if (s.active) return ['running', 'Running'];
  if (s.succeeded) return ['done', 'Completed'];
  return ['pending', 'Waiting'];
}

const matches = (selector, labels = {}) => Object.entries(selector).every(([k, v]) => labels[k] === v);

// `info` rows are [label, value, sensitive]; sensitive rows are hidden in
// presentation mode.
export function buildGraph(raw) {
  const nodes = [];
  const links = [];
  const add = (kind, obj, [status, statusText], extra = {}) => {
    const { namespace, name, creationTimestamp } = obj.metadata;
    nodes.push({
      id: id(kind, namespace, name),
      kind,
      name,
      namespace,
      status,
      statusText,
      createdAt: creationTimestamp,
      info: [],
      ...extra,
    });
  };
  const link = (source, target, type) => links.push({ source, target, type });
  const owner = (obj) => (obj.metadata.ownerReferences || [])[0];

  // ReplicaSets are not drawn: pods are wired straight to the Deployment.
  const replicaSetOwner = new Map();
  for (const rs of raw.replicasets || []) {
    const o = owner(rs);
    if (o?.kind === 'Deployment') {
      replicaSetOwner.set(`${rs.metadata.namespace}/${rs.metadata.name}`, o.name);
    }
  }

  for (const d of raw.deployments || []) {
    add('Deployment', d, replicaStatus(d.status?.readyReplicas, d.spec?.replicas));
  }
  for (const s of raw.statefulsets || []) {
    add('StatefulSet', s, replicaStatus(s.status?.readyReplicas, s.spec?.replicas));
  }
  for (const d of raw.daemonsets || []) {
    add('DaemonSet', d, replicaStatus(d.status?.numberReady, d.status?.desiredNumberScheduled));
  }
  for (const c of raw.cronjobs || []) {
    add('CronJob', c, c.spec?.suspend ? ['done', 'Suspended'] : ['running', 'Scheduled'], {
      info: [['Schedule', c.spec?.schedule]],
    });
  }
  for (const j of raw.jobs || []) {
    const ns = j.metadata.namespace;
    add('Job', j, jobStatus(j));
    const o = owner(j);
    if (o?.kind === 'CronJob') link(id('CronJob', ns, o.name), id('Job', ns, j.metadata.name), 'owns');
  }

  for (const p of raw.pods || []) {
    const ns = p.metadata.namespace;
    const pid = id('Pod', ns, p.metadata.name);
    const restarts = (p.status?.containerStatuses || []).reduce((n, c) => n + (c.restartCount || 0), 0);
    add('Pod', p, podStatus(p), {
      containers: (p.spec?.containers || []).map((c) => c.name),
      info: [
        ['Restarts', String(restarts)],
        ['Node', p.spec?.nodeName, true],
        ['Pod IP', p.status?.podIP, true],
      ],
    });

    const o = owner(p);
    if (o?.kind === 'ReplicaSet') {
      const deployment = replicaSetOwner.get(`${ns}/${o.name}`);
      if (deployment) link(id('Deployment', ns, deployment), pid, 'owns');
    } else if (o && ['StatefulSet', 'DaemonSet', 'Job'].includes(o.kind)) {
      link(id(o.kind, ns, o.name), pid, 'owns');
    }

    for (const v of p.spec?.volumes || []) {
      if (v.persistentVolumeClaim) {
        link(pid, id('PersistentVolumeClaim', ns, v.persistentVolumeClaim.claimName), 'mounts');
      }
    }
  }

  for (const s of raw.services || []) {
    const ns = s.metadata.namespace;
    const ports = (s.spec?.ports || []).map((p) => p.port).join(', ');
    add('Service', s, ['running', s.spec?.type || 'ClusterIP'], {
      info: [
        ['Ports', ports],
        ['Cluster IP', s.spec?.clusterIP, true],
      ],
    });
    const selector = s.spec?.selector;
    if (!selector || !Object.keys(selector).length) continue;
    for (const p of raw.pods || []) {
      if (p.metadata.namespace === ns && matches(selector, p.metadata.labels)) {
        link(id('Service', ns, s.metadata.name), id('Pod', ns, p.metadata.name), 'routes');
      }
    }
  }

  for (const i of raw.ingresses || []) {
    const ns = i.metadata.namespace;
    const iid = id('Ingress', ns, i.metadata.name);
    const rules = i.spec?.rules || [];
    add('Ingress', i, ['running', 'Routing'], {
      info: [['Hosts', rules.map((r) => r.host).filter(Boolean).join(', '), true]],
    });
    const backends = new Set();
    if (i.spec?.defaultBackend?.service) backends.add(i.spec.defaultBackend.service.name);
    for (const r of rules) {
      for (const path of r.http?.paths || []) {
        if (path.backend?.service) backends.add(path.backend.service.name);
      }
    }
    for (const name of backends) link(iid, id('Service', ns, name), 'routes');
  }

  for (const c of raw.persistentvolumeclaims || []) {
    const bound = c.status?.phase === 'Bound';
    add('PersistentVolumeClaim', c, [bound ? 'running' : 'pending', c.status?.phase || 'Unknown'], {
      info: [['Size', c.spec?.resources?.requests?.storage]],
    });
  }

  const known = new Set(nodes.map((n) => n.id));
  const validLinks = links.filter((l) => known.has(l.source) && known.has(l.target));
  nodes.sort((a, b) => a.id.localeCompare(b.id));

  return {
    nodes,
    links: validLinks,
    signature: JSON.stringify([nodes.map((n) => [n.id, n.statusText, n.info]), validLinks]),
  };
}

// The part of a graph that is switched on in the toolbar.
export function filterGraph(graph, keep) {
  const nodes = graph.nodes.filter(keep);
  const ids = new Set(nodes.map((n) => n.id));
  const links = graph.links.filter((l) => ids.has(l.source) && ids.has(l.target));
  return {
    nodes,
    links,
    topology: nodes.map((n) => n.id).join('|') + '#' + links.map((l) => `${l.source}>${l.target}`).join('|'),
  };
}

const HEALTH_ORDER = ['running', 'pending', 'failed', 'done'];

// The pods reached from a creature by following wires of the given types
// downwards, healthiest first. A pod's own id gives just that pod.
export function podsBehind(graph, id, types) {
  const byId = new Map(graph.nodes.map((n) => [n.id, n]));
  const seen = new Set([id]);
  const queue = [id];
  const pods = [];
  while (queue.length) {
    const current = queue.shift();
    const node = byId.get(current);
    if (node?.kind === 'Pod') {
      pods.push(node);
      continue;
    }
    for (const l of graph.links) {
      if (l.source === current && types.includes(l.type) && !seen.has(l.target)) {
        seen.add(l.target);
        queue.push(l.target);
      }
    }
  }
  return pods.sort((a, b) => HEALTH_ORDER.indexOf(a.status) - HEALTH_ORDER.indexOf(b.status));
}
