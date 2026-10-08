// Copyright (c) 2026 rmd Studio Inc. MIT License.
//
// An invented cluster, shaped like real API responses so it goes through the
// same graph builder as a live one. Nothing here comes from a real system.

const HASH = '6c9f7d5b8';
const SUFFIXES = ['x7k2p', 'm4wqz', 'h9rtc', 'b2nvd', 'q8jls', 'z5gfa'];

function build() {
  const now = Date.now();
  const raw = {
    pods: [],
    services: [],
    persistentvolumeclaims: [],
    deployments: [],
    statefulsets: [],
    daemonsets: [],
    replicasets: [],
    jobs: [],
    cronjobs: [],
    ingresses: [],
  };

  const meta = (namespace, name, ageMinutes, labels, owner) => ({
    namespace,
    name,
    labels,
    creationTimestamp: new Date(now - ageMinutes * 60000).toISOString(),
    ownerReferences: owner ? [owner] : undefined,
  });

  // state: 'ok' | 'pending' | 'crash' | 'done'
  const pod = (ns, name, app, owner, { state = 'ok', containers = ['app'], claim, age = 600 } = {}) => {
    const waiting = { ok: undefined, pending: 'ContainerCreating', crash: 'CrashLoopBackOff' }[state];
    raw.pods.push({
      metadata: meta(ns, name, age, { app }, owner),
      spec: {
        nodeName: 'demo-node',
        containers: containers.map((c) => ({ name: c })),
        volumes: claim ? [{ persistentVolumeClaim: { claimName: claim } }] : [],
      },
      status: {
        phase: state === 'done' ? 'Succeeded' : state === 'pending' ? 'Pending' : 'Running',
        containerStatuses: containers.map((c) => ({
          name: c,
          ready: state === 'ok',
          restartCount: state === 'crash' ? 17 : 0,
          state: waiting ? { waiting: { reason: waiting } } : { running: {} },
        })),
      },
    });
  };

  const service = (ns, name, app, port = 80) =>
    raw.services.push({
      metadata: meta(ns, name, 9000),
      spec: { type: 'ClusterIP', selector: { app }, ports: [{ port }] },
    });

  const deployment = (ns, name, replicas, { states = [], containers, port } = {}) => {
    const ready = replicas - states.filter((s) => s !== 'ok').length;
    raw.deployments.push({
      metadata: meta(ns, name, 9000),
      spec: { replicas },
      status: { readyReplicas: ready },
    });
    const rs = `${name}-${HASH}`;
    raw.replicasets.push({ metadata: meta(ns, rs, 4000, { app: name }, { kind: 'Deployment', name }) });
    for (let i = 0; i < replicas; i += 1) {
      pod(ns, `${rs}-${SUFFIXES[i]}`, name, { kind: 'ReplicaSet', name: rs }, { state: states[i], containers });
    }
    service(ns, name, name, port);
  };

  const statefulSet = (ns, name, replicas, size) => {
    raw.statefulsets.push({
      metadata: meta(ns, name, 20000),
      spec: { replicas },
      status: { readyReplicas: replicas },
    });
    for (let i = 0; i < replicas; i += 1) {
      const claim = `data-${name}-${i}`;
      raw.persistentvolumeclaims.push({
        metadata: meta(ns, claim, 20000),
        spec: { resources: { requests: { storage: size } } },
        status: { phase: 'Bound' },
      });
      pod(ns, `${name}-${i}`, name, { kind: 'StatefulSet', name }, { claim, age: 20000 });
    }
    service(ns, name, name, 5432);
  };

  const cronJob = (ns, name, schedule, runs) => {
    raw.cronjobs.push({ metadata: meta(ns, name, 30000), spec: { schedule } });
    runs.forEach((state, i) => {
      const job = `${name}-2900${i}`;
      raw.jobs.push({
        metadata: meta(ns, job, (runs.length - i) * 60, {}, { kind: 'CronJob', name }),
        status: state === 'done' ? { succeeded: 1 } : { active: 1 },
      });
      pod(ns, `${job}-${SUFFIXES[i]}`, job, { kind: 'Job', name: job }, { state, age: (runs.length - i) * 60 });
    });
  };

  const ingress = (ns, name, host, backends) =>
    raw.ingresses.push({
      metadata: meta(ns, name, 9000),
      spec: {
        rules: [
          {
            host,
            http: { paths: backends.map((b) => ({ backend: { service: { name: b } } })) },
          },
        ],
      },
    });

  deployment('storefront', 'web', 3);
  deployment('storefront', 'catalog', 2);
  deployment('storefront', 'cart', 2, { states: ['ok', 'pending'] });
  deployment('storefront', 'search', 1);
  statefulSet('storefront', 'catalog-db', 2, '20Gi');
  ingress('storefront', 'storefront', 'shop.example.com', ['web', 'catalog', 'cart', 'search']);
  cronJob('storefront', 'reindex', '*/30 * * * *', ['done', 'done', 'ok']);

  deployment('payments', 'checkout', 3, { containers: ['app', 'sidecar'] });
  deployment('payments', 'ledger', 2, { states: ['ok', 'crash'] });
  deployment('payments', 'fraud-check', 1);
  statefulSet('payments', 'ledger-db', 3, '50Gi');
  ingress('payments', 'payments', 'pay.example.com', ['checkout']);
  cronJob('payments', 'settlement', '0 2 * * *', ['done']);

  deployment('platform', 'gateway', 2);
  deployment('platform', 'auth', 2);
  deployment('platform', 'notifier', 1);
  statefulSet('platform', 'queue', 3, '10Gi');
  cronJob('platform', 'backup', '0 */6 * * *', ['done', 'done']);

  raw.daemonsets.push({
    metadata: meta('platform', 'log-shipper', 30000),
    status: { numberReady: 3, desiredNumberScheduled: 3 },
  });
  for (let i = 0; i < 3; i += 1) {
    pod('platform', `log-shipper-${SUFFIXES[i]}`, 'log-shipper', { kind: 'DaemonSet', name: 'log-shipper' });
  }

  return raw;
}

let cached;
export function demoCluster() {
  if (!cached) cached = build();
  return cached;
}

const ROUTES = ['/', '/health', '/api/items', '/api/items/42', '/api/session', '/api/orders'];
const pick = (list) => list[Math.floor(Math.random() * list.length)];

function demoLine(failing) {
  const time = new Date().toISOString();
  if (failing && Math.random() < 0.5) {
    return `${time} ERROR could not connect to upstream: connection refused (retrying in 5s)`;
  }
  const r = Math.random();
  if (r < 0.75) {
    const ms = Math.round(2 + Math.random() * 80);
    return `${time} INFO  ${pick(['GET', 'GET', 'POST'])} ${pick(ROUTES)} ${pick([200, 200, 200, 201, 304])} ${ms}ms`;
  }
  if (r < 0.92) return `${time} DEBUG cache ${pick(['hit', 'miss'])} key=item:${Math.round(Math.random() * 999)}`;
  return `${time} WARN  slow query took ${Math.round(200 + Math.random() * 600)}ms`;
}

// Same contract as openLogStream in api.js.
export function openDemoLogStream({ failing, tailLines, follow, onLines, onEnd }) {
  let timer;
  let closed = false;
  const tick = () => {
    if (closed) return;
    onLines([demoLine(failing)]);
    timer = setTimeout(tick, 300 + Math.random() * 1200);
  };
  timer = setTimeout(() => {
    onLines(Array.from({ length: Math.min(tailLines, 40) }, () => demoLine(failing)));
    if (follow) tick();
    else onEnd();
  }, 150);
  return () => {
    closed = true;
    clearTimeout(timer);
  };
}
