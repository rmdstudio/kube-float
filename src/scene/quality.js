// Copyright (c) 2026 rmd Studio Inc. MIT License.

// Graphics settings. Light keeps a laptop cool; Full is for presenting.
// fps: null draws at the display's own rate. bloom: 'cheap' blurs at half
// resolution in one pass, 'full' uses the smoother multi-level blur.
export const QUALITY = {
  light: { label: 'Light', fps: 30, dpr: 1, bloom: 'cheap', particles: 1200, wireSegments: 16 },
  full: { label: 'Full', fps: null, dpr: [1, 2], bloom: 'full', particles: 3000, wireSegments: 40 },
};

const KEY = 'kube-float.quality';

export function savedQuality() {
  try {
    const saved = localStorage.getItem(KEY);
    return QUALITY[saved] ? saved : 'light';
  } catch {
    return 'light';
  }
}

export function saveQuality(quality) {
  try {
    localStorage.setItem(KEY, quality);
  } catch {
    // Private windows can refuse storage; the choice then lasts this visit.
  }
}
