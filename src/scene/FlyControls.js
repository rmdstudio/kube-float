// Copyright (c) 2026 rmd Studio Inc. MIT License.
import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { clock, place, pointer } from './shared';

const ACCELERATION = 70;
const DAMPING = 2.5;
const BOOST = 3;
const LOOK_SPEED = 0.0028;
const IDLE_SECONDS = 25;
const UP = new THREE.Vector3(0, 1, 0);

const KEYS = {
  KeyW: [0, 0, -1],
  ArrowUp: [0, 0, -1],
  KeyS: [0, 0, 1],
  ArrowDown: [0, 0, 1],
  KeyA: [-1, 0, 0],
  ArrowLeft: [-1, 0, 0],
  KeyD: [1, 0, 0],
  ArrowRight: [1, 0, 0],
  KeyE: [0, 1, 0],
  Space: [0, 1, 0],
  KeyQ: [0, -1, 0],
};

const isTyping = (target) =>
  target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));

// Free flight: drag to look, keys to move, wheel to thrust. `glide` ({ id })
// eases the camera to a creature. Left alone, the camera circles slowly.
export default function FlyControls({ layout, glide }) {
  const { camera, gl } = useThree();
  const state = useRef({
    yaw: 0,
    pitch: -0.1,
    velocity: new THREE.Vector3(),
    held: new Set(),
    boost: false,
    target: null,
    idle: 0,
    framed: false,
  });

  useEffect(() => {
    const s = state.current;
    const el = gl.domElement;
    camera.rotation.order = 'YXZ';
    let last = null;
    let travelled = 0;

    const active = () => {
      s.idle = 0;
    };
    const down = (e) => {
      last = [e.clientX, e.clientY];
      travelled = 0;
      pointer.dragged = false;
      el.setPointerCapture(e.pointerId);
      active();
    };
    const move = (e) => {
      if (!last) return;
      const dx = e.clientX - last[0];
      const dy = e.clientY - last[1];
      last = [e.clientX, e.clientY];
      travelled += Math.abs(dx) + Math.abs(dy);
      if (travelled > 5) {
        pointer.dragged = true;
        s.target = null;
        s.yaw -= dx * LOOK_SPEED;
        s.pitch = THREE.MathUtils.clamp(s.pitch - dy * LOOK_SPEED, -1.5, 1.5);
      }
      active();
    };
    const up = () => {
      last = null;
    };
    const wheel = (e) => {
      e.preventDefault();
      const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
      s.velocity.addScaledVector(forward, -e.deltaY * 0.06);
      s.target = null;
      active();
    };
    const keyDown = (e) => {
      s.boost = e.shiftKey;
      if (isTyping(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
      if (KEYS[e.code]) {
        s.held.add(e.code);
        s.target = null;
        e.preventDefault();
      }
      active();
    };
    const keyUp = (e) => {
      s.boost = e.shiftKey;
      s.held.delete(e.code);
    };
    const blur = () => {
      s.boost = false;
      s.held.clear();
    };

    el.addEventListener('pointerdown', down);
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('wheel', wheel, { passive: false });
    window.addEventListener('keydown', keyDown);
    window.addEventListener('keyup', keyUp);
    window.addEventListener('blur', blur);
    return () => {
      el.removeEventListener('pointerdown', down);
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
      el.removeEventListener('wheel', wheel);
      window.removeEventListener('keydown', keyDown);
      window.removeEventListener('keyup', keyUp);
      window.removeEventListener('blur', blur);
    };
  }, [camera, gl]);

  useEffect(() => {
    if (glide) {
      state.current.target = glide.id;
      state.current.idle = 0;
    }
  }, [glide]);

  useFrame((_, delta) => {
    const s = state.current;
    const dt = Math.min(delta, 0.1);
    s.idle += dt;

    if (!s.framed && layout.nodes.size) {
      // Start outside the cluster, looking in.
      let reach = 0;
      for (const n of layout.nodes.values()) reach = Math.max(reach, Math.hypot(n.x, n.y, n.z));
      camera.position.set(0, reach * 0.15, reach * 1.1 + 35);
      s.framed = true;
    }

    const sim = s.target && layout.nodes.get(s.target);
    if (sim) {
      const goal = new THREE.Vector3();
      place(sim, clock.value, goal);
      const away = camera.position.clone().sub(goal);
      const distance = away.length() || 1;
      const ease = 1 - Math.exp(-2.5 * dt);
      // Stop further back from bigger creatures.
      const standOff = 7 + (sim.size || 1.5) * 2.5;
      camera.position.lerp(goal.clone().addScaledVector(away, standOff / distance), ease);

      const dir = goal.sub(camera.position).normalize();
      const yaw = Math.atan2(-dir.x, -dir.z);
      const turn = Math.atan2(Math.sin(yaw - s.yaw), Math.cos(yaw - s.yaw));
      s.yaw += turn * ease * 1.6;
      s.pitch += (Math.asin(THREE.MathUtils.clamp(dir.y, -1, 1)) - s.pitch) * ease * 1.6;
      s.velocity.set(0, 0, 0);
      if (Math.abs(distance - standOff) < 0.2 && Math.abs(turn) < 0.01) s.target = null;
    } else {
      s.target = null;
      const push = new THREE.Vector3();
      for (const code of s.held) push.add(new THREE.Vector3(...KEYS[code]));
      if (push.lengthSq() > 0) {
        const boost = s.boost ? BOOST : 1;
        push.normalize().applyQuaternion(camera.quaternion);
        s.velocity.addScaledVector(push, ACCELERATION * boost * dt);
      }
      s.velocity.multiplyScalar(Math.exp(-DAMPING * dt));
      camera.position.addScaledVector(s.velocity, dt);

      if (s.idle > IDLE_SECONDS) {
        // Circle the scene, keeping the same view of it.
        const angle = 0.02 * dt;
        camera.position.applyAxisAngle(UP, angle);
        s.yaw += angle;
      }
    }

    camera.rotation.set(s.pitch, s.yaw, 0);
  });

  return null;
}
