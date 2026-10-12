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
