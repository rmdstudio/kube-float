# kube-float

![The Ocean theme: jellyfish pods and whale Deployments joined by wires, busy wires glowing orange with sparks](docs/images/ocean.png)

![The Alien World theme: planets, stars and ringed gas giants joined by glowing wires against a nebula](docs/images/alien_world.png)

See a Kubernetes cluster, and the containers in Docker Desktop, as a world you
fly through. In the Ocean theme pods drift as translucent jellyfish and the
things around them swim as whales, sharks and rays; in Alien World they are
planets, stars, comets and wormholes in a nebula. Their relationships hang
between them as wires. Click a pod, or anything that runs pods, to read the
logs in a floating window.

kube-float is read-only. It cannot change a cluster or a container.

## Quick start

You need Node 18 or newer and Yarn, plus either `kubectl` pointing at a
cluster, Docker Desktop running, or both.

```sh
yarn install
yarn start
```

Then open http://localhost:3000.

No cluster handy? `yarn demo` runs the same app against a built-in, invented
cluster. The app also falls back to the demo by itself when it can reach
neither Kubernetes nor Docker, and adding `?demo` to the address forces it.

Every feature is described in [docs/features.md](docs/features.md).

## What you are looking at

| Kind | Ocean | Alien World |
| --- | --- | --- |
| Pod | Jellyfish | Small planet |
| Deployment | Whale | Ringed gas giant |
| StatefulSet | Shark | Planet with a moon |
| DaemonSet | School of fish | Asteroid belt |
| Job | Small fish | Comet |
| CronJob | Angelfish in a ring | Pulsar |
| Service | Anglerfish | Star |
| Ingress | Manta ray | Wormhole |
| PersistentVolumeClaim | Shell | Moon |

Docker Desktop containers appear too: each Compose project is a namespace
called `docker/<project>`, each Compose service is drawn like a Deployment
and each container like a pod.

A healthy creature has the colour of its kind. Orange means pending or not
ready, red means failing, grey-blue means completed or scaled to zero.

Wires show who owns what (blue), where traffic is routed (gold), which
volumes are mounted (sand) and which Compose services depend on which
(green). When a pod suddenly logs more than usual, for example while it
handles requests, the wires into it heat up to orange and white and sparks
run along them. ReplicaSets are left out; pods are wired straight to their
Deployment.

## Flying

| Input | Action |
| --- | --- |
| Drag | Look around |
| `W` `A` `S` `D` or arrow keys | Move |
| `Q` / `E` | Down / up |
| `Shift` | Faster |
| Scroll | Thrust forwards or backwards |
| Click | Select; on a pod or anything that runs pods, open the logs |
| Double-click | Fly to that creature |
| `F` | Full screen |
| `Esc` | Deselect |

Leave it alone for a while and the camera circles slowly.

The toolbar filters by namespace and kind, finds things by name, and has a
spacing slider that pulls everything closer together or apart. Namespaces
starting with `kube-` are hidden until you pick them. It also has:

- a theme menu: Ocean or Alien World;
- the flame button, which turns the activity glow on and off;
- the leaf button, which switches between Light graphics, which keep a
  laptop cool, and Full quality for presenting;
- presentation mode, which hides the controls along with namespaces, node
  names, addresses and hostnames, for showing a cluster to people outside
  your team.

## How it reaches your cluster and Docker

`yarn start` runs two things:

1. `kubectl proxy` on `127.0.0.1:8717`. It uses your current kubectl context,
   so your credentials stay where they already are. If it cannot start, the
   app carries on with Docker alone.
2. The web app. Its dev server forwards `/k8s/...` to that proxy, and
   `/docker/...` to Docker Desktop's socket (`DOCKER_HOST` if it names a
   socket, otherwise `/var/run/docker.sock` or `~/.docker/run/docker.sock`).

The dev server only forwards `GET` requests, and only for listing the kinds in
the table above and reading pod logs. Everything else is refused, including
Secrets and ConfigMaps, which kube-float never reads.

Docker is held to less still: only the container list and container logs.
Container details are refused because they include environment variables,
and so is everything that could start, stop or enter a container.

To look at another cluster, switch context (`kubectl config use-context ...`)
and restart. To use a proxy that is already running elsewhere, set
`KUBE_FLOAT_PROXY`, for example `KUBE_FLOAT_PROXY=http://127.0.0.1:8001 yarn web`.

Two things to keep in mind:

- While it runs, anything on your machine can read the same cluster data and
  container logs through `localhost:3000`. Do not expose that port to a
  network.
- Logs can contain personal or secret data, and they appear on screen.
  They are streamed to your browser and stored nowhere.

## Scripts

| Command | What it does |
| --- | --- |
| `yarn start` | `kubectl proxy` plus the app |
| `yarn web` | The app only |
| `yarn demo` | The app with the demo cluster |
| `yarn build` | Production build of the interface |

The production build has no proxy of its own. It expects something to serve
the Kubernetes API under `/k8s` and the Docker API under `/docker`.

## Built with

Create React App, [three.js](https://threejs.org) through
[react-three-fiber](https://github.com/pmndrs/react-three-fiber),
[Material UI](https://mui.com) and
[d3-force-3d](https://github.com/vasturiano/d3-force-3d).

## License

MIT. Copyright (c) 2026 [rmd Studio Inc.](https://www.rmdstudio.com)
Contact: info@rmdstudio.com
