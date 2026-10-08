// Copyright (c) 2026 rmd Studio Inc. MIT License.
import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { clock, place } from './shared';

const FADE_START = 90;
const FADE_END = 190;

const layerStyle = 'position:absolute;inset:0;overflow:hidden;pointer-events:none;z-index:5;';
const labelStyle = [
  'position:absolute',
  'left:0',
  'top:0',
  'white-space:nowrap',
  'text-align:center',
  'font:500 12px Roboto,Helvetica,Arial,sans-serif',
  'color:#e6f7ff',
  'background:rgba(4,16,32,0.72)',
  'border:1px solid rgba(120,200,255,0.25)',
  'border-radius:6px',
  'padding:2px 8px',
  'will-change:transform',
].join(';');

// Name tags drawn as plain DOM over the canvas and moved every frame.
// `items` is [{ id, sim, height, title, detail, pinned }]. detail is an
// optional second line; pinned labels do not fade with distance.
export default function Labels({ items }) {
  const { camera, gl, size } = useThree();
  const layer = useRef(null);
  const tags = useRef(new Map());

  useEffect(() => {
    const el = document.createElement('div');
    el.style.cssText = layerStyle;
    gl.domElement.parentNode.appendChild(el);
    layer.current = el;
    const live = tags.current;
    return () => {
      el.remove();
      live.clear();
    };
  }, [gl]);

  useEffect(() => {
    const wanted = new Set(items.map((item) => item.id));
    for (const [id, tag] of tags.current) {
      if (!wanted.has(id)) {
        tag.el.remove();
        tags.current.delete(id);
      }
    }
    for (const item of items) {
      let tag = tags.current.get(item.id);
      if (!tag) {
        const el = document.createElement('div');
        el.style.cssText = labelStyle;
        const title = document.createElement('div');
        const detail = document.createElement('div');
        detail.style.cssText = 'opacity:0.7;font-size:11px';
        el.append(title, detail);
        layer.current.appendChild(el);
        tag = { el, title, detail };
        tags.current.set(item.id, tag);
      }
      tag.item = item;
      tag.title.textContent = item.title;
      tag.detail.textContent = item.detail || '';
      tag.detail.style.display = item.detail ? '' : 'none';
      tag.el.style.zIndex = item.detail ? 2 : 1;
    }
  }, [items]);

  const point = useRef(new THREE.Vector3());
  useFrame(() => {
    const p = point.current;
    for (const { el, item } of tags.current.values()) {
      const { sim, height, pinned } = item;
      place(sim, clock.value, p);
      p.y += height;
      const distance = p.distanceTo(camera.position);
      p.project(camera);
      const fade = pinned ? 1 : 1 - THREE.MathUtils.smoothstep(distance, FADE_START, FADE_END);
      if (p.z > 1 || p.z < -1 || fade <= 0.01) {
        el.style.display = 'none';
        continue;
      }
      const x = (p.x * 0.5 + 0.5) * size.width;
      const y = (-p.y * 0.5 + 0.5) * size.height;
      el.style.display = '';
      el.style.opacity = fade;
      el.style.transform = `translate(-50%, -100%) translate(${Math.round(x)}px, ${Math.round(y)}px)`;
    }
  });

  return null;
}
