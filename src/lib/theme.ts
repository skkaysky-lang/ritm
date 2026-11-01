import { setTelegramColors, telegramScheme } from './telegram';

export type ThemePref = 'auto' | 'dark' | 'light';
export const BG = { dark: '#0d0e12', light: '#f2f3f7' };

export function resolveTheme(pref: ThemePref): 'dark' | 'light' {
  if (pref !== 'auto') return pref;
  return telegramScheme() ?? (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
}

export function readThemePref(): ThemePref {
  try {
    return (localStorage.getItem('ritm-theme') as ThemePref) || 'auto';
  } catch {
    return 'auto';
  }
}

export function applyTheme(pref: ThemePref) {
  try {
    localStorage.setItem('ritm-theme', pref);
  } catch {
    /* приватный режим */
  }
  const t = resolveTheme(pref);
  document.documentElement.dataset.theme = t;
  setTelegramColors(BG[t]);
}
