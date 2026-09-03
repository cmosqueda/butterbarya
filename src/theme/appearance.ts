import type { AppTheme } from '../state/types';

let mediaQuery: MediaQueryList | null = null;
let mediaListener: ((event: MediaQueryListEvent) => void) | null = null;

function setDark(useDark: boolean) {
  document.body.classList.toggle('butterbarya-dark', useDark);
  document.documentElement.style.colorScheme = useDark ? 'dark' : 'light';
}

export function applyTheme(theme: AppTheme) {
  if (!mediaQuery) {
    mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  }
  if (mediaListener) {
    mediaQuery.removeEventListener('change', mediaListener);
    mediaListener = null;
  }

  if (theme === 'system') {
    setDark(mediaQuery.matches);
    mediaListener = (event) => setDark(event.matches);
    mediaQuery.addEventListener('change', mediaListener);
  } else {
    setDark(theme === 'dark');
  }
}
