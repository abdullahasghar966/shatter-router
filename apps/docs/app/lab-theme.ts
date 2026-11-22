/** Theme and material of the "Material lab" site (ADR-050). */

export const MATERIALS = ['glass', 'ice', 'obsidian', 'paper'] as const;
export type Material = (typeof MATERIALS)[number];
export type Theme = 'light' | 'dark';

/** Swatch colours for the switcher (the surfaces they stand for). */
export const SWATCHES: Readonly<Record<Material, string>> = {
  glass: '#bfe0fa',
  ice: '#e2f2fa',
  obsidian: '#3a3243',
  paper: '#e9ddc3',
};

const THEME_KEY = 'lab-theme';
const SOUND_KEY = 'lab-sound';
const MATERIAL_KEY = 'lab-material';

function store(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Private mode or blocked storage: the choice lasts for this page only.
  }
}

/** The theme in effect: the visitor's choice, else the system's. */
export function currentTheme(): Theme {
  const chosen = document.documentElement.getAttribute('data-theme');
  if (chosen === 'light' || chosen === 'dark') return chosen;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function currentMaterial(): Material {
  const value = document.documentElement.getAttribute('data-material');
  return MATERIALS.find((material) => material === value) ?? 'glass';
}

export function applyTheme(theme: Theme): void {
  document.documentElement.setAttribute('data-theme', theme);
  store(THEME_KEY, theme);
}

export function applyMaterial(material: Material): void {
  document.documentElement.setAttribute('data-material', material);
  store(MATERIAL_KEY, material);
}

/** Whether the visitor turned sound on (ADR-060). Off unless chosen. */
export function soundChosen(): boolean {
  try {
    return localStorage.getItem(SOUND_KEY) === 'on';
  } catch {
    return false;
  }
}

export function applySound(on: boolean): void {
  store(SOUND_KEY, on ? 'on' : 'off');
}
