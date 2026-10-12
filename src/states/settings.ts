import { COLORS } from '../config';
import { isIPhone } from '../core/fullscreen';
import { VIEW } from '../core/view';
import type { Game } from '../game';
import { Action } from '../input/bindings';
import { settings, type Settings } from '../settings';
import { renderPrompts } from '../ui/prompts';
import { font, glowText } from '../ui/text';
import type { GameState } from './state';

type SliderKey = 'master' | 'music' | 'sfx' | 'shake';
type ToggleKey = 'crt' | 'rumble' | 'soundInSilentMode';

type Row =
  | { kind: 'slider'; key: SliderKey; label: string }
  | { kind: 'toggle'; key: ToggleKey; label: string }
  | { kind: 'back'; label: string };

const ROW_H = 44;
const SLIDER_W = 240;
const STEP = 0.1;

function isAppleTouch(): boolean {
  return isIPhone() || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

/**
 * Settings overlay: volumes, screen shake, CRT overlay, rumble and (on
 * iPhone/iPad) whether sound plays with the silent switch on. Changes apply
 * and save immediately.
 */
export class SettingsState implements GameState {
  readonly overlay = true;
  readonly covers = true;
  private selected = 0;
  private age = 0;
  private readonly rows: Row[];
  /** Pointer currently dragging a slider (mouse held / finger down). */
  private dragging: SliderKey | null = null;

  constructor(private readonly game: Game) {
    this.rows = [
      { kind: 'slider', key: 'master', label: 'MASTER VOLUME' },
      { kind: 'slider', key: 'music', label: 'MUSIC' },
      { kind: 'slider', key: 'sfx', label: 'SOUND EFFECTS' },
      { kind: 'slider', key: 'shake', label: 'SCREEN SHAKE' },
      { kind: 'toggle', key: 'crt', label: 'CRT SCANLINES' },
      { kind: 'toggle', key: 'rumble', label: 'CONTROLLER RUMBLE' },
      ...(isAppleTouch() ? [{ kind: 'toggle', key: 'soundInSilentMode', label: 'SOUND IN SILENT MODE' } as Row] : []),
      { kind: 'back', label: 'BACK' },
    ];
  }

  private get top(): number {
    return VIEW.height / 2 - ((this.rows.length - 1) * ROW_H) / 2 + 10;
  }

  private rowY(i: number): number {
    return this.top + i * ROW_H;
  }

  private rowAt(x: number, y: number): number {
    const cx = VIEW.width / 2;
    if (Math.abs(x - cx) > 320) return -1;
    for (let i = 0; i < this.rows.length; i++) if (Math.abs(y - this.rowY(i)) < ROW_H / 2) return i;
    return -1;
  }

  /** Slider value (0..1) for a pointer x, or null if outside the bar. */
  private sliderValueAt(x: number): number | null {
    const x0 = VIEW.width / 2 + 40;
    if (x < x0 - 30 || x > x0 + SLIDER_W + 30) return null;
    return Math.max(0, Math.min(1, Math.round(((x - x0) / SLIDER_W) * 20) / 20));
  }

  private sfx(name: 'uiMove' | 'uiSelect' | 'uiBack'): void {
    this.game.audio.sfx.play(name);
  }

  private close(): void {
    this.sfx('uiBack');
    this.game.pop();
  }

  private adjust(row: Row, dir: number): void {
    if (row.kind === 'slider') {
      const v = settings.get()[row.key];
      const nv = Math.round(Math.max(0, Math.min(1, v + dir * STEP)) * 10) / 10;
      if (nv !== v) {
        settings.set(row.key, nv);
        this.sfx('uiMove');
      }
    } else if (row.kind === 'toggle') {
      settings.set(row.key, !settings.get()[row.key]);
      this.sfx('uiSelect');
    }
  }

  private activate(row: Row): void {
    if (row.kind === 'back') this.close();
    else if (row.kind === 'toggle') this.adjust(row, 1);
  }

  update(dt: number): void {
    this.age += dt;
    const input = this.game.input;
    const n = this.rows.length;

    // Pointer: hover selects; click/tap toggles or sets a slider; holding the mouse drags it.
    if (input.mouseMoved && input.device === 'keyboard') {
      const hover = this.rowAt(input.mouse.x, input.mouse.y);
      if (hover >= 0 && hover !== this.selected) this.selected = hover;
      if (this.dragging && input.isDown(Action.FIRE)) {
        const v = this.sliderValueAt(input.mouse.x);
        if (v !== null) settings.set(this.dragging, v);
      }
    }
    if (!input.isDown(Action.FIRE)) this.dragging = null;
    for (const t of input.taps) {
      const i = this.rowAt(t.x, t.y);
      if (i < 0) continue;
      this.selected = i;
      const row = this.rows[i];
      if (row.kind === 'slider') {
        const v = this.sliderValueAt(t.x);
        if (v !== null) {
          settings.set(row.key, v);
          this.dragging = row.key;
          this.sfx('uiMove');
        }
      } else {
        this.activate(row);
        if (row.kind === 'back') return;
      }
    }

    if (input.pressed(Action.MENU_UP)) {
      this.selected = (this.selected + n - 1) % n;
      this.sfx('uiMove');
    }
    if (input.pressed(Action.MENU_DOWN)) {
      this.selected = (this.selected + 1) % n;
      this.sfx('uiMove');
    }
    const row = this.rows[this.selected];
    if (input.pressed(Action.MENU_LEFT)) this.adjust(row, -1);
    if (input.pressed(Action.MENU_RIGHT)) this.adjust(row, 1);
    if (input.pressed(Action.CONFIRM)) this.activate(row);
    else if (input.pressed(Action.BACK) || input.pressed(Action.PAUSE)) this.close();
  }

  render(ctx: CanvasRenderingContext2D): void {
    const W = VIEW.width;
    const H = VIEW.height;
    const fade = Math.min(1, this.age / 0.12);
    const s = settings.get();

    ctx.save();
    ctx.globalAlpha = 0.85 * fade;
    ctx.fillStyle = '#05010d';
    ctx.fillRect(0, 0, W, H);
    ctx.restore();

    glowText(ctx, 'SETTINGS', W / 2, this.top - 70, { size: 40, color: COLORS.white, glow: COLORS.cyan, blur: 20, align: 'center', alpha: fade });

    const lx = W / 2 - 300;
    const vx = W / 2 + 40;
    this.rows.forEach((row, i) => {
      const y = this.rowY(i);
      const sel = i === this.selected;
      if (sel) {
        ctx.save();
        ctx.globalAlpha = fade;
        ctx.fillStyle = 'rgba(0, 240, 255, 0.08)';
        ctx.strokeStyle = 'rgba(0, 240, 255, 0.5)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(W / 2 - 320, y - ROW_H / 2 + 4, 640, ROW_H - 8, 6);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }
      if (row.kind === 'back') {
        glowText(ctx, sel ? '>  BACK  <' : 'BACK', W / 2, y, { size: sel ? 22 : 19, color: sel ? COLORS.cyan : '#8c7fb0', align: 'center', alpha: fade, blur: sel ? 12 : 0 });
        return;
      }
      glowText(ctx, row.label, lx, y, { size: 17, color: sel ? COLORS.white : '#a99bd1', align: 'left', alpha: fade, blur: 0 });

      ctx.save();
      ctx.globalAlpha = fade;
      if (row.kind === 'slider') {
        const v = s[row.key];
        ctx.fillStyle = 'rgba(255,255,255,0.12)';
        ctx.fillRect(vx, y - 4, SLIDER_W, 8);
        ctx.fillStyle = sel ? COLORS.cyan : COLORS.purple;
        ctx.shadowColor = ctx.fillStyle;
        ctx.shadowBlur = sel ? 10 : 0;
        ctx.fillRect(vx, y - 4, SLIDER_W * v, 8);
        ctx.shadowBlur = 0;
        ctx.fillStyle = COLORS.white;
        ctx.fillRect(vx + SLIDER_W * v - 2, y - 9, 4, 18);
        ctx.font = font(15, 'normal');
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(row.key === 'shake' && v === 0 ? 'OFF' : `${Math.round(v * 100)}%`, vx + SLIDER_W + 16, y + 1);
      } else {
        const on = s[row.key as keyof Settings] as boolean;
        ctx.fillStyle = on ? COLORS.cyan : 'rgba(255,255,255,0.12)';
        ctx.beginPath();
        ctx.roundRect(vx, y - 11, 52, 22, 11);
        ctx.fill();
        ctx.fillStyle = on ? '#05010d' : '#8c7fb0';
        ctx.beginPath();
        ctx.arc(on ? vx + 41 : vx + 11, y, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.font = font(15, 'normal');
        ctx.fillStyle = on ? COLORS.cyan : '#8c7fb0';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(on ? 'ON' : 'OFF', vx + 66, y + 1);
      }
      ctx.restore();
    });

    const py = this.rowY(this.rows.length - 1) + 54;
    if (this.game.input.device === 'touch') {
      glowText(ctx, 'TAP A ROW · TAP THE BAR TO SET VOLUME', W / 2, py, { size: 13, color: COLORS.white, align: 'center', alpha: fade * 0.75, blur: 0 });
    } else {
      renderPrompts(
        ctx,
        [
          { navigate: true, label: 'SELECT' },
          { action: Action.MENU_RIGHT, label: 'ADJUST' },
          { action: Action.BACK, label: 'BACK' },
        ],
        this.game.input,
        W / 2,
        py,
        'center',
        13,
        fade,
      );
    }
  }
}
