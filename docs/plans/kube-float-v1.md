# kube-float v1 plan

A Kubernetes cluster shown as a dark ocean: workloads drift as translucent
jellyfish, their relationships hang between them as slack wires, and you fly
through it. Built to be shown to clients, so it is read-only and keeps
identifying details off the screen and out of the repository.

Legend: ⬜ to do · 🔄 in progress · ✅ done · ⏸ deferred

## Decisions

| Topic | Choice | Why |
| --- | --- | --- |
| App shell | Create React App (`react-scripts` 5), JavaScript | Asked for; `yarn start` runs everything. Plain JS avoids CRA's stale TypeScript peer range. |
| 3D | three.js through `@react-three/fiber`, helpers from `drei`, bloom from `@react-three/postprocessing` | Scene stays declarative React next to the MUI interface; custom shaders are still available for the jellyfish. |
| UI | Material UI (latest), dark theme | Asked for; matches the other Protect apps. |
| Layout | `d3-force-3d` | Force layout in three dimensions; linked things drift together, namespaces form shoals. |
| Cluster access | `kubectl proxy` on 127.0.0.1:8717, reached through the CRA dev-server proxy at `/k8s` | Reuses whatever kubeconfig context is already active (the AWS one included). No tokens, certificates or cluster addresses ever enter the app or the repo. |
| Read-only | The dev-server proxy refuses everything except `GET` on an allow-list of paths (lists of the drawn kinds, and pod logs) | The tool can look but cannot change a cluster, even by mistake. |
| Live updates | Poll every 5 s; logs stream with `follow=true` | Simple and reliable; watch streams can come later. |
| Demo mode | Built-in fake cluster, used when no cluster is reachable or with `?demo` | Works out of the box for anyone cloning it, and gives a safe thing to screenshot. |

## What appears in the water

| Kind | Creature | Notes |
| --- | --- | --- |
| Pod | Jellyfish; one tentacle cluster per container | Colour by phase: running teal, pending amber, failed red, completed dim grey. Restarts make it twitch. |
| Deployment / StatefulSet / DaemonSet | Large slow "mother" jellyfish | ReplicaSets are hidden; pods wire straight to their Deployment. |
| Job | Small fast medusa | Fades when complete. |
| CronJob | Ringed medusa that pulses | Wired to the Jobs it spawned. |
| Service | Glowing orb | Wired to the pods its selector matches. |
| Ingress | Flat ray-like gateway | Wired to its backend Services. |
| PersistentVolumeClaim | Shell on a tether | Wired to pods that mount it. |

Secrets and ConfigMaps are never fetched.

Wires are sagging curves, never straight segments. They hang under a fake
gravity, sway slowly, and are tinted by relationship type: owns, routes to,
mounts. (Built as a parabola, which is indistinguishable from a true catenary
at this scale.)

## Flying

- Drag to look, `W A S D` to move, `Q` / `E` down and up, `Shift` to go faster, scroll to thrust.
- Click a creature to select it; double-click to glide to it.
- `F` or the toolbar button toggles full screen. Dialogs are mounted inside the full-screen element so they stay visible.
- With no input for a while the camera drifts slowly, for leaving it on a screen.

## Interface

- Top bar: namespace picker, kind toggles, search, live/demo indicator, full screen.
- Clicking a pod opens a floating, draggable, resizable log window: container picker, follow toggle, tail length, wrap. Up to four can be open at once (each holds a browser connection).
- Clicking anything else opens a small details card (kind, name, namespace, status, age).
- Legend and controls help, collapsible.
- "Presentation" toggle that hides namespace and node names for showing to people outside the team.

## Privacy and open source

- Nothing cluster-specific is committed: no context names, account numbers, namespaces, hostnames or sample logs from a real cluster. Demo data is invented.
- `LICENSE` and file headers read "Copyright (c) 2026 rmd Studio Inc." with contact info@rmdstudio.com; the personal name in the current `LICENSE` is replaced.
- `.env*.local` stays ignored. `.mcp.json` is local tooling and is left untracked.
- Before the first commit: check that the git author name and email for this repo are the studio's, not personal ones.
- Pod logs can contain personal data. They go from the cluster to the browser only and are never stored.

## Steps

### 1. Foundations
- ✅ CRA scaffold, dependencies, `yarn start` runs `kubectl proxy` and the dev server together
- ✅ Dev-server proxy `/k8s` → `kubectl proxy`, `GET` only
- ✅ LICENSE, README, package metadata under rmd Studio Inc.

### 2. Cluster data
- ✅ API client: list the kinds above, per namespace or all
- ✅ Graph builder: nodes plus owner / selector / ingress / volume edges, ReplicaSets collapsed
- ✅ Demo cluster and automatic fallback
- ✅ Polling that updates the graph without rebuilding the scene

### 3. The ocean
- ✅ Scene: depth fog, drifting particles, lighting, bloom
- ✅ Jellyfish: pulsing translucent bell shader, tentacles, per-kind variants
- ✅ Hanging wires that follow their endpoints
- ✅ Force layout in 3D with gentle bobbing

### 4. Flying and picking
- ✅ Fly controls
- ✅ Hover label, select, glide-to
- ✅ Full screen

### 5. Interface
- ✅ Top bar: namespaces, kind toggles, search, status
- ✅ Floating log windows with live streaming
- ✅ Details card, legend, controls help
- ✅ Presentation toggle

### 6. Check
- ✅ `yarn build` compiles cleanly
- ✅ Runs in demo mode in a browser
- ✅ Runs against the real cluster (read-only)
- ✅ Sweep the repo for identifying strings

## Added after v1
- ✅ Logs open from anything that runs pods, with a pod picker
- ✅ Non-pod kinds are fish: whale, shark, school, small fish, angelfish, anglerfish, manta ray
- ✅ Spacing slider
- ✅ Search fades non-matches, names matches, Enter flies to the next one

## Not done in v1
- Restarts do not make a pod twitch; the restart count is in the details card.
- The repo's git author is set to a personal-name address and the pushed initial commit carries a personal name (as author and in the first LICENSE); both are left for a decision before pushing.

## Later
- ⏸ Watch streams instead of polling
- ⏸ Nodes as currents or reefs, with pods grouped by node
- ⏸ Metrics (CPU and memory) driving size and pulse rate
- ⏸ Events as bubbles
- ⏸ Packaged binary so it runs without a dev server
