// Copyright (c) 2026 rmd Studio Inc. MIT License.
import ocean from './ocean';
import space from './space';

// Each theme supplies the look; the scene, wires, labels and controls are
// shared. A theme is { key, label, background, fog, wireSag, shapes, names,
// colors, Body, Environment }; shapes and names have an entry for every kind
// in constants.js, and colors may override any kind's colour.
export const THEMES = { ocean, space };

const KEY = 'kube-float.theme';

export function savedTheme() {
  try {
    const saved = localStorage.getItem(KEY);
    return THEMES[saved] ? saved : 'ocean';
  } catch {
    return 'ocean';
  }
}

export function saveTheme(theme) {
  try {
    localStorage.setItem(KEY, theme);
  } catch {
    // Private windows can refuse storage; the choice then lasts this visit.
  }
}
