// Copyright (c) 2026 rmd Studio Inc. MIT License.

// Order here is the order used in the toolbar and legend.
export const KINDS = {
  Pod: { label: 'Pods', color: '#35e0d0' },
  Deployment: { label: 'Deployments', color: '#a78bfa' },
  StatefulSet: { label: 'StatefulSets', color: '#5b9dff' },
  DaemonSet: { label: 'DaemonSets', color: '#f77fd3' },
  Job: { label: 'Jobs', color: '#a6e86b' },
  CronJob: { label: 'CronJobs', color: '#c6f0ff' },
  Service: { label: 'Services', color: '#ffd98a' },
  Ingress: { label: 'Ingresses', color: '#7dffb0' },
  PersistentVolumeClaim: { label: 'Volume claims', color: '#c9b79c' },
};

export const STATUS = {
  running: { label: 'Healthy', color: null },
  pending: { label: 'Pending / not ready', color: '#ff9f3d' },
  failed: { label: 'Failing', color: '#ff5a6a' },
  done: { label: 'Completed / idle', color: '#6f86a8' },
};

export const WIRES = {
  owns: { label: 'Owns', color: '#6fd6ff' },
  routes: { label: 'Routes to', color: '#ffd98a' },
  mounts: { label: 'Mounts', color: '#c9b79c' },
  depends: { label: 'Depends on (Compose)', color: '#8fe39a' },
};

// A theme can recolour kinds; `colors` is its { kind: colour } overrides.
export function kindColor(kind, colors = {}) {
  return colors[kind] || KINDS[kind].color;
}

export function creatureColor(node, colors) {
  return STATUS[node.status]?.color || kindColor(node.kind, colors);
}

export const isSystemNamespace = (ns) => ns.startsWith('kube-');

export function formatAge(iso) {
  if (!iso) return '';
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 90) return `${Math.round(s)}s`;
  if (s < 5400) return `${Math.round(s / 60)}m`;
  if (s < 129600) return `${Math.round(s / 3600)}h`;
  return `${Math.round(s / 86400)}d`;
}
