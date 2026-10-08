// Copyright (c) 2026 rmd Studio Inc. MIT License.

// One time uniform shared by every shader in the scene; advanced once a frame.
export const clock = { value: 0 };

// Lets a click be told apart from the end of a look-around drag.
export const pointer = { dragged: false };

// How spread out the scene is. `value` eases towards `target`, which the
// spacing slider sets.
export const space = { value: 1, target: 1 };

// Where a creature is at time t: its layout position, a slow bob, and for
// fish a small circle they swim around. Writes into `out` and returns the
// angle around that circle. Wires, labels and the camera use this too, so
// they stay attached to a moving creature.
export function place(sim, t, out) {
  const angle = t * sim.swimSpeed + sim.phase;
  out.x = sim.x * space.value + Math.cos(angle) * sim.swim;
  out.y = sim.y * space.value + Math.sin(t * 0.45 + sim.phase) * 0.7;
  out.z = sim.z * space.value + Math.sin(angle) * sim.swim;
  return angle;
}
