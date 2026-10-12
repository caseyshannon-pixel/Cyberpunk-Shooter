import { COLORS, CONFIG } from '../config';
import { VIEW } from '../core/view';
import { SPECIAL_NAMES, type SpecialPickup } from '../entities/pickup';
import type { Game } from '../game';
import { Action, Axis } from '../input/bindings';
import { actionGlyphs, axisGlyph } from '../input/glyphs';
import type { Device } from '../input/input';
import { font, glowText, keyCap } from '../ui/text';
import { WEAPONS, WEAPON_IDS } from '../weapons/definitions';
import type { GameState } from './state';

type Tab = 'keyboard' | 'gamepad' | 'touch';
const TABS: { id: Tab; label: string }[] = [
  { id: 'keyboard', label: 'KEYBOARD & MOUSE' },
  { id: 'gamepad', label: 'CONTROLLER' },
  { id: 'touch', label: 'TOUCH' },
];

const SPECIAL_BLURBS: Record<SpecialPickup, string> = {
  overclock: `Double fire rate for ${CONFIG.buffs.overclockDuration}s.`,
  shield: `Hex shield absorbs ${CONFIG.buffs.shieldHits} hits.`,
  health: 'Restores 1 HP (bonus points at full).',
  emp: 'Clears enemy shots, stuns all enemies.',
};

/**
 * Controls reference with a tab per input method (generated from the actual
 * bindings, so it can't drift out of date) plus a weapon / pickup legend.
 */
export class ControlsState implements GameState {
  readonly overlay = true;
  readonly covers = true;
  private tab: number;
  private age = 0;

  constructor(private readonly game: Game) {
    const d: Device = game.input.device;
    this.tab = Math.max(0, TABS.findIndex((t) => t.id === d));
  }

  update(dt: number): void {
    this.age += dt;
    const input = this.game.input;
    const sfx = this.game.audio.sfx;
    if (input.pressed(Action.MENU_LEFT) || input.pressed(Action.WEAPON_PREV)) {
      this.tab = (this.tab + TABS.length - 1) % TABS.length;
      sfx.play('uiMove');
    }
    if (input.pressed(Action.MENU_RIGHT) || input.pressed(Action.WEAPON_NEXT)) {
      this.tab = (this.tab + 1) % TABS.length;
      sfx.play('uiMove');
    }
    for (const t of input.taps) {
      const hit = this.tabAt(t.x, t.y);
      if (hit >= 0) {
        this.tab = hit;
        sfx.play('uiMove');
      } else if (t.y > VIEW.height - 70) {
        this.close();
        return;
      }
    }
    if (input.pressed(Action.BACK) || input.pressed(Action.CONFIRM) || input.pressed(Action.PAUSE)) this.close();
  }

  private close(): void {
    this.game.audio.sfx.play('uiBack');
    this.game.pop();
  }

  private tabX(i: number): number {
    return VIEW.width / 2 + (i - 1) * 250;
  }

  private tabAt(x: number, y: number): number {
    if (Math.abs(y - 112) > 22) return -1;
    for (let i = 0; i < TABS.length; i++) if (Math.abs(x - this.tabX(i)) < 120) return i;
    return -1;
  }

  private rows(tab: Tab): [string, string[]][] {
    const style = this.game.input.pad?.style ?? 'xbox';
    if (tab === 'touch') {
      return [
        ['MOVE', ['LEFT THUMB — anywhere on the left half']],
        ['AIM + AUTO-FIRE', ['RIGHT THUMB — anywhere on the right half']],
        ['DASH', ['DASH']],
        ['SWAP WEAPON', ['SWAP']],
        ['PAUSE', ['II']],
        ['FULL SCREEN', ['⛶']],
      ];
    }
    if (tab === 'gamepad') {
      return [
        ['MOVE', [axisGlyph(Axis.MOVE, 'gamepad', style)]],
        ['AIM + AUTO-FIRE', [axisGlyph(Axis.AIM, 'gamepad', style)]],
        ['FIRE', actionGlyphs(Action.FIRE, 'gamepad', style)],
        ['DASH', actionGlyphs(Action.DASH, 'gamepad', style)],
        ['SWAP WEAPON', [...actionGlyphs(Action.WEAPON_PREV, 'gamepad', style), ...actionGlyphs(Action.WEAPON_NEXT, 'gamepad', style)]],
        ['PAUSE', actionGlyphs(Action.PAUSE, 'gamepad', style)],
        ['MENUS', ['D-PAD', ...actionGlyphs(Action.CONFIRM, 'gamepad', style), ...actionGlyphs(Action.BACK, 'gamepad', style)]],
        ['DEBUG OVERLAY', actionGlyphs(Action.DEBUG, 'gamepad', style)],
      ];
    }
    return [
      ['MOVE', [axisGlyph(Axis.MOVE, 'keyboard'), '↑←↓→']],
      ['AIM', ['MOUSE']],
      ['FIRE', actionGlyphs(Action.FIRE, 'keyboard')],
      ['DASH', actionGlyphs(Action.DASH, 'keyboard')],
      ['SWAP WEAPON', [...actionGlyphs(Action.WEAPON_PREV, 'keyboard'), ...actionGlyphs(Action.WEAPON_NEXT, 'keyboard'), 'WHEEL']],
      ['PAUSE', actionGlyphs(Action.PAUSE, 'keyboard')],
      ['FULL SCREEN', ['F']],
      ['DEBUG OVERLAY', actionGlyphs(Action.DEBUG, 'keyboard')],
    ];
  }

  render(ctx: CanvasRenderingContext2D): void {
    const W = VIEW.width;
    const H = VIEW.height;
    const fade = Math.min(1, this.age / 0.12);
    ctx.save();
    ctx.globalAlpha = 0.96 * fade;
    ctx.fillStyle = '#05010d';
    ctx.fillRect(0, 0, W, H);
    ctx.restore();

    glowText(ctx, 'CONTROLS', W / 2, 58, { size: 36, color: COLORS.white, glow: COLORS.cyan, blur: 18, align: 'center', alpha: fade });

    // Tabs.
    TABS.forEach((t, i) => {
      const sel = i === this.tab;
      const x = this.tabX(i);
      ctx.save();
      ctx.globalAlpha = fade;
      ctx.strokeStyle = sel ? COLORS.cyan : 'rgba(140,127,176,0.5)';
      ctx.fillStyle = sel ? 'rgba(0,240,255,0.12)' : 'rgba(0,0,0,0)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(x - 115, 96, 230, 32, 6);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
      glowText(ctx, t.label, x, 112, { size: 14, color: sel ? COLORS.cyan : '#8c7fb0', align: 'center', alpha: fade, blur: sel ? 8 : 0 });
    });

    // Left column: bindings.
    const lx = W / 2 - 560;
    const kx = W / 2 - 330;
    let y = 172;
    for (const [label, glyphs] of this.rows(TABS[this.tab].id)) {
      glowText(ctx, label, lx, y, { size: 14, color: '#c9bff0', align: 'left', alpha: fade, blur: 0 });
      let x = kx;
      ctx.save();
      ctx.globalAlpha = fade;
      for (const g of glyphs) {
        if (g.length > 12) {
          ctx.font = font(13, 'normal');
          ctx.fillStyle = COLORS.white;
          ctx.textBaseline = 'middle';
          ctx.fillText(g, x, y + 1);
          break;
        }
        x += keyCap(ctx, g, x, y, COLORS.cyan, 13) + 8;
      }
      ctx.restore();
      y += 40;
    }

    // Right column: weapons and pickups.
    const rx = W / 2 + 40;
    y = 172;
    glowText(ctx, 'WEAPONS', rx, y - 6, { size: 15, color: COLORS.magenta, align: 'left', alpha: fade });
    y += 24;
    for (const id of WEAPON_IDS) {
      const d = WEAPONS[id];
      this.legendRow(ctx, rx, y, d.color, d.name, d.blurb ?? '', fade, false);
      y += 26;
    }
    y += 14;
    glowText(ctx, 'PICKUPS', rx, y - 6, { size: 15, color: COLORS.magenta, align: 'left', alpha: fade });
    y += 24;
    for (const k of Object.keys(SPECIAL_BLURBS) as SpecialPickup[]) {
      this.legendRow(ctx, rx, y, CONFIG.pickups.colors[k], SPECIAL_NAMES[k], SPECIAL_BLURBS[k], fade, true);
      y += 26;
    }

    const hint = this.game.input.device === 'touch' ? 'TAP A TAB · TAP HERE TO CLOSE' : '◄ ► SWITCH TAB   ·   BACK TO CLOSE';
    glowText(ctx, hint, W / 2, H - 36, { size: 13, color: COLORS.white, align: 'center', alpha: fade * 0.75, blur: 0 });
  }

  private legendRow(ctx: CanvasRenderingContext2D, x: number, y: number, color: string, name: string, blurb: string, alpha: number, hex: boolean): void {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 8;
    ctx.beginPath();
    if (hex) {
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
        ctx.lineTo(x + 6 + Math.cos(a) * 6, y + Math.sin(a) * 6);
      }
    } else {
      ctx.moveTo(x + 6, y - 7);
      ctx.lineTo(x + 13, y);
      ctx.lineTo(x + 6, y + 7);
      ctx.lineTo(x - 1, y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.font = font(13);
    ctx.textBaseline = 'middle';
    ctx.fillText(name, x + 24, y + 1);
    ctx.fillStyle = '#a99bd1';
    ctx.font = font(12, 'normal');
    ctx.fillText(blurb, x + 190, y + 1);
    ctx.restore();
  }
}
