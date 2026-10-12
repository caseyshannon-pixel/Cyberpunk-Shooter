import { CONFIG } from '../config';

/**
 * Logical view size. Height is fixed (720); width is chosen per run to match
 * the screen's shape — 1280 for 16:9 and narrower screens, up to
 * CONFIG.view.maxWidth on wide phones (iPhone ≈ 19.5:9) so the arena fills
 * the display instead of showing black bars. Set via Display.setLogicalWidth.
 */
export const VIEW = {
  width: CONFIG.view.width as number,
  height: CONFIG.view.height as number,
};
