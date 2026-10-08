# kube-float features

Everything kube-float does, and how each part behaves. For installing and
starting it, see the [README](../README.md).

- [The scene](#the-scene)
- [Creatures](#creatures)
- [Health colours](#health-colours)
- [Wires](#wires)
- [Flying](#flying)
- [Selecting and details](#selecting-and-details)
- [Pod logs](#pod-logs)
- [Toolbar](#toolbar)
- [Presentation mode](#presentation-mode)
- [Full screen](#full-screen)
- [Live data](#live-data)
- [Demo mode](#demo-mode)
- [Safety](#safety)
- [Settings](#settings)
- [Limits](#limits)

## The scene

The cluster is laid out in three dimensions by a force simulation: things
that are connected pull together, everything else pushes apart.

- **Namespaces form shoals.** Each namespace is pulled towards its own point
  on a circle, so namespaces sit apart from each other.
- **Depth has meaning.** Ingresses float highest, then Services and CronJobs,
  then workloads, then pods, with volume claims at the bottom. Traffic
  therefore reads from top to bottom.
- **Positions are kept.** When the cluster changes, existing creatures stay
  where they are and new ones drift into place.

Every creature bobs slowly, plankton drifts past to give a sense of
speed, and distant things fade into the water.

## Creatures

| Kind | Creature | How to recognise it |
| --- | --- | --- |
| Pod | Jellyfish | Small, teal, pulsing bell with tentacles |
| Deployment | Whale | Violet, the largest animal, slow up-and-down tail |
| StatefulSet | Shark | Blue, tall back fin, sweeping tail |
| DaemonSet | School of fish | Seven small pink fish circling together |
| Job | Small fish | Green, quick tail, swims a tight circle |
| CronJob | Angelfish | Pale blue, tall body, inside a tumbling ring |
| Service | Anglerfish | Gold, round, with a glowing lure |
| Ingress | Manta ray | Mint, flat, flapping wings and a long tail |
| PersistentVolumeClaim | Shell | Sand-coloured, faceted, still |

Jellyfish and shells drift in place. Fish swim slow circles around their
spot, and their wires follow them.

ReplicaSets are not drawn. A pod created through a ReplicaSet is wired
straight to the Deployment that owns it.

Nodes, ConfigMaps, Secrets and other kinds are not shown.

## Health colours

A healthy creature has the colour of its kind. Otherwise:

| Colour | Meaning |
| --- | --- |
| Orange | Pending or not ready |
| Red | Failing |
| Grey-blue, half transparent | Completed, suspended or scaled to zero |

How each kind is judged:

| Kind | Healthy | Orange | Red | Grey-blue |
| --- | --- | --- | --- | --- |
| Pod | Running, every container ready | Not ready, starting, terminating | Failed, or a container is stuck in a back-off or error state such as `CrashLoopBackOff` or `ImagePullBackOff` | Completed |
| Deployment, StatefulSet, DaemonSet | All wanted replicas ready | Fewer ready than wanted | | Scaled to zero |
| Job | Running | Waiting to start | Failed | Completed |
| CronJob | Scheduled | | | Suspended |
| PersistentVolumeClaim | Bound | Any other phase | | |

Services and Ingresses are always drawn in their own colour.

## Wires

Connections are slack wires that sag and sway. None of them are straight.

| Colour | Meaning | Drawn between |
| --- | --- | --- |
| Blue | Owns | Deployment, StatefulSet, DaemonSet or Job and its pods; CronJob and the Jobs it started |
| Gold | Routes to | Service and the pods its selector matches in the same namespace; Ingress and its backend Services |
| Sand | Mounts | Pod and the volume claims it mounts |

Selecting a creature brightens its wires and dims all the others.

A Service with no selector has no wires.

## Flying

| Input | Action |
| --- | --- |
| Drag | Look around |
| `W` `A` `S` `D` or arrow keys | Forwards, left, backwards, right |
| `E` or `Space` | Up |
| `Q` | Down |
| `Shift` | Three times faster |
| Scroll | Thrust forwards or backwards |
| Double-click a creature | Fly to it |

- Movement has momentum: you coast to a stop after letting go.
- You start outside the cluster, looking in.
- Flying to a creature stops in front of it, further back for larger ones,
  and follows it as it swims. Any key, drag or scroll cancels the flight.
- After 25 seconds without input the camera circles the cluster slowly.
  Any input stops it.
- Movement keys are ignored while you type in the search or namespace fields.

## Selecting and details

Pointing at a creature shows its name, kind, namespace and status. Clicking
selects it, makes it glow and opens a details card at the bottom left.

The card shows:

| Row | Shown for |
| --- | --- |
| Namespace, status, age, number of connections | Everything |
| Containers, restart count, node, pod IP | Pods |
| Schedule | CronJobs |
| Ports, cluster IP | Services |
| Hostnames | Ingresses |
| Requested size | Volume claims |

The card has a **Fly to** button and, for anything with pods behind it, a
**Logs** button.

Click empty water or press `Esc` to deselect. Ending a drag does not count as
a click, so looking around never changes the selection.

## Pod logs

Clicking a pod opens its log in a floating window.

Clicking something that runs pods does the same for its pods: a Deployment,
StatefulSet, DaemonSet, Job or CronJob. When it has more than one pod, the
window has a pod picker, with healthy pods listed first. Services and
Ingresses do not open logs on a click, but their details card has a **Logs**
button for the pods they route to.

- **Move** it by dragging its header; **resize** it from the bottom-right
  corner. Clicking a window brings it to the front.
- **Pod picker**, shown when the window covers more than one pod.
- **Container picker**, shown when the pod has more than one container.
- **Tail length**: the last 100, 500 or 2000 lines.
- **Follow** (on by default): new lines stream in and the window scrolls with
  them. Turn it off to read a fixed snapshot.
- **Wrap** long lines, off by default.
- **Fly to** the pod the log belongs to.

Up to four log windows can be open; opening a fifth closes the oldest. A
window keeps the most recent 3000 lines.

Changing the container, the tail length or follow reloads the log.

If the log cannot be read, for example because the pod has not started, the
window shows the cluster's error message.

## Toolbar

- **Status chip.** *Live* when reading a cluster, *Connecting…* at start-up,
  *Demo* when showing the demo cluster. If the demo is showing because no
  cluster was reachable, hovering the chip shows the reason and clicking it
  tries the live cluster again.
- **Namespaces.** Pick one or more to show only those. With nothing picked,
  every namespace is shown except those starting with `kube-`; pick those by
  name to see them.
- **Find by name.** Fades out everything whose name does not contain the
  text, along with its label and wires, and names every match. The field
  shows how many were found. Press `Enter` to fly to a match; press it again
  for the next one. Case does not matter.
- **Spacing slider.** Pulls the whole scene closer together or spreads it
  apart, from 0.4 to 3 times the normal distance. Creatures keep their size.
- **Name labels.** Shows or hides the permanent name labels. Pods never have
  a permanent label; they are named when pointed at or selected. Labels fade
  with distance.
- **Kind chips.** One per kind, with a count for the namespaces in view.
  Click a chip to hide or show that kind and its wires.
- **Presentation mode** and **full screen**, described below.

A collapsible legend at the bottom right lists the creatures, colours, wires
and controls.

## Presentation mode

For showing a cluster to people outside your team. It:

- hides the toolbar controls and the legend, leaving the presentation and
  full-screen buttons;
- removes namespaces from labels and from the details card;
- removes node names, pod IPs, cluster IPs and Ingress hostnames from the
  details card.

Resource names and log contents are still shown. Close any log window you do
not want on screen.

## Full screen

Press `F` or use the toolbar button. Log windows, the details card and menus
all stay available in full screen. `F` or the browser's own `Esc` leaves it.

## Live data

The cluster is read again every five seconds. Creatures appear, disappear and
change colour without the scene being rebuilt, and nothing moves unless the
set of resources or connections changed.

If a read fails, kube-float switches to the demo cluster and stops polling.
Click the status chip to go back to the live cluster.

## Demo mode

An invented cluster with three namespaces, containing every kind kube-float
draws, one pending pod and one crash-looping pod, and made-up log lines.

It is used when:

- you run `yarn demo`;
- the address contains `?demo`;
- no cluster can be reached.

## Safety

- **Read-only.** Only `GET` requests reach the cluster.
- **Allow-list.** Only two kinds of request are forwarded: listing the kinds
  in the table above, and reading a pod's log. Everything else is refused,
  including Secrets, ConfigMaps, `exec` and port-forwarding.
- **No stored credentials.** `kubectl proxy` uses your existing kubectl
  context. kube-float never sees a token or certificate.
- **Nothing is saved.** Cluster data and logs exist only in the browser tab.
- **Local only.** The proxy listens on `127.0.0.1`. While kube-float runs,
  other programs on the same machine can read the same data through the dev
  server, so do not expose its port to a network.

## Settings

| Variable | Effect | Default |
| --- | --- | --- |
| `KUBE_FLOAT_PROXY` | Address of the Kubernetes API proxy the dev server forwards to | `http://127.0.0.1:8717` |
| `REACT_APP_DEMO` | Set to `1` to always show the demo cluster | unset |
| `PORT` | Port of the web app | `3000` |

The cluster shown is whichever one your current kubectl context points at.

## Limits

- Your account must be allowed to list pods across all namespaces. Any other
  kind it cannot list is shown as absent.
- There are no CPU or memory figures, and no events.
- Everything is read in full every five seconds, which suits clusters of up
  to a few hundred resources.
- Flying needs a keyboard and mouse or trackpad; there are no touch controls
  for movement.
- A browser with WebGL 2 is required.
