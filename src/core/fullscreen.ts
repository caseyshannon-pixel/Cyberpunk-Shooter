/**
 * Fullscreen helpers covering the standard API and Safari's webkit-prefixed
 * one. iPadOS and macOS Safari support element fullscreen; iPhone Safari does
 * not (there, "Add to Home Screen" gives a full-screen web app instead).
 */

interface WebkitDocument {
  webkitFullscreenEnabled?: boolean;
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => void;
}
interface WebkitElement {
  webkitRequestFullscreen?: () => void;
}

/** iPhone / iPod (iPads report as Macs with touch, and do support fullscreen). */
export function isIPhone(): boolean {
  return /iPhone|iPod/.test(navigator.userAgent);
}

/** Whether to offer the ⛶ control at all: real fullscreen, or the iPhone home-screen guide. */
export function canExpand(): boolean {
  if (isStandalone()) return false;
  return fullscreenSupported() || isIPhone();
}

/**
 * Expand the game: real fullscreen where the browser allows it, otherwise (iPhone
 * Safari) show the "Add to Home Screen" guide. Call from a user-gesture handler.
 */
export function expand(): void {
  if (fullscreenSupported()) {
    toggleFullscreen();
    return;
  }
  if (isIPhone()) showHomeScreenGuide();
}

/** Fired on window when a DOM overlay covers the game, so gameplay can pause. */
export const INTERRUPT_EVENT = 'neongrid:interrupt';

function showHomeScreenGuide(): void {
  const el = document.getElementById('fsguide');
  const close = document.getElementById('fsguide-close');
  if (!el || !close) return;
  el.classList.add('show');
  window.dispatchEvent(new Event(INTERRUPT_EVENT));
  // Keep these touches away from the game's own pointer handling.
  const stop = (e: Event) => e.stopPropagation();
  el.addEventListener('pointerdown', stop);
  el.addEventListener('pointerup', stop);
  close.addEventListener(
    'pointerup',
    () => {
      el.classList.remove('show');
      el.removeEventListener('pointerdown', stop);
      el.removeEventListener('pointerup', stop);
    },
    { once: true },
  );
}

export function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: fullscreen)').matches ||
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

export function fullscreenSupported(): boolean {
  const d = document as Document & WebkitDocument;
  return !!(d.fullscreenEnabled || d.webkitFullscreenEnabled);
}

export function isFullscreen(): boolean {
  const d = document as Document & WebkitDocument;
  return !!(d.fullscreenElement || d.webkitFullscreenElement);
}

/** Must be called from inside a user-gesture event handler (keydown, pointerup…). */
export function toggleFullscreen(): void {
  const d = document as Document & WebkitDocument;
  const el = document.documentElement as HTMLElement & WebkitElement;
  try {
    if (isFullscreen()) {
      if (d.exitFullscreen) d.exitFullscreen().catch(() => {});
      else d.webkitExitFullscreen?.();
    } else if (el.requestFullscreen) {
      el.requestFullscreen().catch(() => {});
    } else {
      el.webkitRequestFullscreen?.();
    }
  } catch {
    /* not allowed here — ignore */
  }
}

export function onFullscreenChange(fn: () => void): void {
  document.addEventListener('fullscreenchange', fn);
  document.addEventListener('webkitfullscreenchange', fn);
}
