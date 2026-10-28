// Accessibility and display preferences, saved per browser.
// Applied as attributes on <html> so CSS can react to them.

export type ThemePref = 'auto' | 'light' | 'dark';

export interface Prefs {
  theme: ThemePref;
  /** text size multiplier */
  scale: number;
  contrast: boolean;
  /** true = stop animations */
  stillMotion: boolean;
  underline: boolean;
  readableFont: boolean;
}

export const DEFAULT_PREFS: Prefs = {
  theme: 'auto',
  scale: 1,
  contrast: false,
  stillMotion: false,
  underline: false,
  readableFont: false,
};

const KEY = 'okeat-prefs';

export function loadPrefs(): Prefs {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...DEFAULT_PREFS, ...JSON.parse(raw) } : DEFAULT_PREFS;
  } catch {
    return DEFAULT_PREFS;
  }
}

export function savePrefs(p: Prefs) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* private mode: preferences last for this visit only */
  }
}

export function applyPrefs(p: Prefs) {
  const el = document.documentElement;
  if (p.theme === 'auto') el.removeAttribute('data-theme');
  else el.setAttribute('data-theme', p.theme);
  el.style.setProperty('--scale', String(p.scale));
  el.toggleAttribute('data-contrast', p.contrast);
  el.toggleAttribute('data-still', p.stillMotion);
  el.toggleAttribute('data-underline', p.underline);
  el.toggleAttribute('data-readable', p.readableFont);
  window.dispatchEvent(new CustomEvent('okeat-prefs', { detail: p }));
}

/** Is the page currently dark, taking the saved choice and the system setting into account? */
export function isDarkNow(): boolean {
  const t = document.documentElement.getAttribute('data-theme');
  if (t === 'dark') return true;
  if (t === 'light') return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export function motionAllowed(): boolean {
  return !document.documentElement.hasAttribute('data-still') && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Runs before first paint (inlined in <head>) so the saved theme doesn't flash. */
export const PREFS_BOOT_SCRIPT = `try{var p=JSON.parse(localStorage.getItem('${KEY}')||'{}'),e=document.documentElement;if(p.theme&&p.theme!=='auto')e.setAttribute('data-theme',p.theme);if(p.scale)e.style.setProperty('--scale',p.scale);if(p.contrast)e.setAttribute('data-contrast','');if(p.stillMotion)e.setAttribute('data-still','');if(p.underline)e.setAttribute('data-underline','');if(p.readableFont)e.setAttribute('data-readable','')}catch(_){}`;
