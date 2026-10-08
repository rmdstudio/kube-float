// Copyright (c) 2026 rmd Studio Inc. MIT License.

// Order here is the order used in the toolbar and legend.
export const KINDS = {
  Pod: { label: 'Pods', color: '#35e0d0', creature: 'jellyfish' },
  Deployment: { label: 'Deployments', color: '#a78bfa', creature: 'whale' },
  StatefulSet: { label: 'StatefulSets', color: '#5b9dff', creature: 'shark' },
  DaemonSet: { label: 'DaemonSets', color: '#f77fd3', creature: 'school of fish' },
  Job: { label: 'Jobs', color: '#a6e86b', creature: 'small fish' },
  CronJob: { label: 'CronJobs', color: '#c6f0ff', creature: 'ringed angelfish' },
  Service: { label: 'Services', color: '#ffd98a', creature: 'anglerfish' },
  Ingress: { label: 'Ingresses', color: '#7dffb0', creature: 'manta ray' },
  PersistentVolumeClaim: { label: 'Volume claims', color: '#c9b79c', creature: 'shell' },
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
};

export function creatureColor(node) {
  return STATUS[node.status]?.color || KINDS[node.kind].color;
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
