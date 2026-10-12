import { COLORS } from '../config';
import { type Action, type Axis } from '../input/bindings';
import { actionGlyph, axisGlyph, navigateGlyph } from '../input/glyphs';
import type { Input } from '../input/input';
import { font, keyCap } from './text';

export type PromptEntry = { label: string } & ({ action: Action } | { axis: Axis } | { navigate: true });

function glyphFor(entry: PromptEntry, input: Input): string {
  const style = input.pad?.style ?? 'xbox';
  if ('action' in entry) return actionGlyph(entry.action, input.device, style);
  if ('axis' in entry) return axisGlyph(entry.axis, input.device, style);
  return navigateGlyph(input.device);
}

/** Measure a prompt row so it can be centred / right-aligned. */
export function measurePrompts(ctx: CanvasRenderingContext2D, entries: PromptEntry[], input: Input, size = 13): number {
  ctx.save();
  let w = 0;
  for (const e of entries) {
    ctx.font = font(size);
    const g = glyphFor(e, input);
    w += Math.max(size * 1.7, ctx.measureText(g).width + size * 0.9) + 6;
    ctx.font = font(size, 'normal');
    w += ctx.measureText(e.label).width + 18;
  }
  ctx.restore();
  return w - 18;
}

/**
 * Draw a row of "[glyph] LABEL" prompts. Glyphs follow the last-used device,
 * so prompts swap between keyboard and controller automatically.
 */
export function renderPrompts(
  ctx: CanvasRenderingContext2D,
  entries: PromptEntry[],
  input: Input,
  x: number,
  y: number,
  align: 'left' | 'center' | 'right' = 'left',
  size = 13,
  alpha = 0.9,
): void {
  if (align !== 'left') {
    const w = measurePrompts(ctx, entries, input, size);
    x = align === 'center' ? x - w / 2 : x - w;
  }
  const color = input.device === 'gamepad' ? COLORS.magenta : COLORS.cyan;
  ctx.save();
  ctx.globalAlpha = alpha;
  for (const e of entries) {
    x += keyCap(ctx, glyphFor(e, input), x, y, color, size) + 6;
    ctx.font = font(size, 'normal');
    ctx.fillStyle = COLORS.white;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(e.label, x, y + 1);
    x += ctx.measureText(e.label).width + 18;
  }
  ctx.restore();
}
