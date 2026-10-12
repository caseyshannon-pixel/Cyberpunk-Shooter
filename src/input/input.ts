import { CONFIG } from '../config';
import type { Display } from '../core/display';
import { applyRadialDeadzone, len, vec, type Vec2 } from '../core/math';
import {
  ALL_ACTIONS,
  ANALOG_BUTTONS,
  Action,
  GAMEPAD_BINDINGS,
  KEYBOARD_BINDINGS,
  KEYBOARD_MOVE,
  MOUSE_BINDINGS,
  PREVENT_DEFAULT_KEYS,
  PadAxes,
} from './bindings';

export type Device = 'keyboard' | 'gamepad';
export type PadStyle = 'xbox' | 'playstation' | 'generic';

export interface PadInfo {
  index: number;
  id: string;
  style: PadStyle;
  standard: boolean;
}

type PadListener = (pad: PadInfo, wasActive: boolean) => void;

// Minimal shapes for haptics so we don't depend on lib.dom versions.
interface DualRumbleActuator {
  playEffect?: (type: string, params: Record<string, number>) => Promise<unknown>;
}
interface LegacyHaptic {
  pulse?: (value: number, duration: number) => Promise<unknown>;
}

function detectStyle(id: string): PadStyle {
  const s = id.toLowerCase();
  // Xbox first: "Xbox Wireless Controller" would otherwise match the PS4's generic "Wireless Controller" name.
  if (s.includes('xbox') || s.includes('045e') || s.includes('xinput')) return 'xbox';
  if (s.includes('054c') || s.includes('playstation') || s.includes('dualshock') || s.includes('dualsense') || s.includes('wireless controller')) {
    return 'playstation';
  }
  return 'generic';
}

/**
 * Input abstraction. Each fixed update calls `update()`, which polls the
 * gamepad and folds keyboard/mouse events into per-action state. Game code
 * only asks about actions: `isDown(Action.FIRE)`, `pressed(Action.DASH)`,
 * `move`, `getAimDirection()`.
 */
export class Input {
  /** Most recently used device — drives on-screen prompts. */
  device: Device = 'keyboard';
  /** Normalised movement vector, magnitude 0..1. */
  readonly move: Vec2 = vec();
  /** Deadzoned right stick, magnitude 0..1. */
  readonly aimStick: Vec2 = vec();
  /** Mouse position in logical game coordinates. */
  readonly mouse: Vec2 = vec(CONFIG.view.width / 2, CONFIG.view.height / 2);
  mouseInside = false;

  /** Active controller, if any. */
  pad: PadInfo | null = null;
  rumbleEnabled = true;

  private readonly keysDown = new Set<string>();
  private readonly keysLatched = new Set<string>();
  private readonly mouseDown = new Set<number>();
  private readonly mouseLatched = new Set<number>();
  private readonly wheelLatched = new Set<Action>();
  private mouseTravel = 0;

  private readonly curr = new Map<Action, boolean>();
  private readonly prev = new Map<Action, boolean>();
  private readonly consumed = new Set<Action>();

  private readonly knownPads = new Map<number, PadInfo>();
  private readonly padButtons: boolean[] = [];
  private readonly rawStick = vec();

  private readonly connectListeners: PadListener[] = [];
  private readonly disconnectListeners: PadListener[] = [];

  constructor(private readonly display: Display) {
    for (const a of ALL_ACTIONS) {
      this.curr.set(a, false);
      this.prev.set(a, false);
    }
    this.attach();
  }

  // ---------------------------------------------------------------- queries

  isDown(action: Action): boolean {
    return this.curr.get(action) === true;
  }

  /** True only on the tick the action went from up to down. */
  pressed(action: Action): boolean {
    return this.curr.get(action) === true && this.prev.get(action) !== true && !this.consumed.has(action);
  }

  released(action: Action): boolean {
    return this.curr.get(action) !== true && this.prev.get(action) === true;
  }

  /** Swallow this tick's press so another system doesn't also react to it. */
  consume(action: Action): void {
    this.consumed.add(action);
  }

  /** Any menu-ish "confirm" style input (used by "press any button" screens). */
  anyPressed(): boolean {
    for (const a of ALL_ACTIONS) if (this.pressed(a)) return true;
    return false;
  }

  /**
   * Direction the player wants to aim from (fromX, fromY), written into `out`
   * as a unit vector. Returns false when there is no aim input this tick
   * (gamepad right stick at rest) so the caller can keep its last facing.
   */
  getAimDirection(fromX: number, fromY: number, out: Vec2): boolean {
    if (this.device === 'gamepad') {
      const m = len(this.aimStick.x, this.aimStick.y);
      if (m <= 0) return false;
      out.x = this.aimStick.x / m;
      out.y = this.aimStick.y / m;
      return true;
    }
    const dx = this.mouse.x - fromX;
    const dy = this.mouse.y - fromY;
    const d = len(dx, dy);
    if (d < 1) return false;
    out.x = dx / d;
    out.y = dy / d;
    return true;
  }

  onPadConnected(fn: PadListener): void {
    this.connectListeners.push(fn);
  }

  onPadDisconnected(fn: PadListener): void {
    this.disconnectListeners.push(fn);
  }

  /** Rumble the active controller. Silently does nothing when unsupported. */
  rumble(strong: number, weak: number, durationMs: number): void {
    if (!this.rumbleEnabled || !this.pad || this.device !== 'gamepad') return;
    const gp = navigator.getGamepads?.()[this.pad.index];
    if (!gp) return;
    try {
      const act = (gp as unknown as { vibrationActuator?: DualRumbleActuator }).vibrationActuator;
      if (act?.playEffect) {
        act
          .playEffect('dual-rumble', {
            startDelay: 0,
            duration: durationMs,
            strongMagnitude: Math.min(1, strong),
            weakMagnitude: Math.min(1, weak),
          })
          .catch(() => {});
        return;
      }
      const legacy = (gp as unknown as { hapticActuators?: LegacyHaptic[] }).hapticActuators;
      legacy?.[0]?.pulse?.(Math.max(strong, weak), durationMs)?.catch(() => {});
    } catch {
      /* haptics unsupported — ignore */
    }
  }

  // ---------------------------------------------------------------- per-tick

  update(): void {
    for (const a of ALL_ACTIONS) this.prev.set(a, this.curr.get(a) === true);
    this.consumed.clear();

    this.pollGamepads();

    // Keyboard movement.
    let kx = 0;
    let ky = 0;
    if (this.anyKey(KEYBOARD_MOVE.left)) kx -= 1;
    if (this.anyKey(KEYBOARD_MOVE.right)) kx += 1;
    if (this.anyKey(KEYBOARD_MOVE.up)) ky -= 1;
    if (this.anyKey(KEYBOARD_MOVE.down)) ky += 1;
    const kl = len(kx, ky);
    if (kl > 0) {
      kx /= kl;
      ky /= kl;
    }

    // Combine keyboard + stick, clamp to unit length.
    let mx = kx + this.rawStick.x;
    let my = ky + this.rawStick.y;
    const ml = len(mx, my);
    if (ml > 1) {
      mx /= ml;
      my /= ml;
    }
    this.move.x = mx;
    this.move.y = my;

    const autoFire =
      this.device === 'gamepad' && len(this.aimStick.x, this.aimStick.y) > CONFIG.input.aimFireThreshold;
    const t = CONFIG.input.menuStickThreshold;

    for (const a of ALL_ACTIONS) {
      let down = false;
      for (const code of KEYBOARD_BINDINGS[a]) {
        if (this.keysDown.has(code) || this.keysLatched.has(code)) {
          down = true;
          break;
        }
      }
      if (!down) {
        const mb = MOUSE_BINDINGS[a];
        if (mb) {
          for (const b of mb) {
            if (this.mouseDown.has(b) || this.mouseLatched.has(b)) {
              down = true;
              break;
            }
          }
        }
      }
      if (!down && this.pad) {
        for (const b of GAMEPAD_BINDINGS[a]) {
          if (this.padButtons[b]) {
            down = true;
            break;
          }
        }
      }
      if (!down && this.wheelLatched.has(a)) down = true;
      this.curr.set(a, down);
    }

    // Virtual actions derived from analog input.
    if (autoFire) this.curr.set(Action.FIRE, true);
    if (this.pad) {
      if (this.rawStick.y < -t) this.curr.set(Action.MENU_UP, true);
      if (this.rawStick.y > t) this.curr.set(Action.MENU_DOWN, true);
      if (this.rawStick.x < -t) this.curr.set(Action.MENU_LEFT, true);
      if (this.rawStick.x > t) this.curr.set(Action.MENU_RIGHT, true);
    }

    this.keysLatched.clear();
    this.mouseLatched.clear();
    this.wheelLatched.clear();
  }

  // ---------------------------------------------------------------- gamepad

  private pollGamepads(): void {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    this.reconcilePads(pads);

    this.rawStick.x = 0;
    this.rawStick.y = 0;
    this.aimStick.x = 0;
    this.aimStick.y = 0;
    this.padButtons.length = 0;
    if (!this.pad) return;

    // Let whichever controller is touched become the active one.
    for (const gp of pads) {
      if (!gp || !gp.connected || gp.index === this.pad.index) continue;
      if (gp.buttons.some((b) => b.pressed)) {
        const info = this.knownPads.get(gp.index);
        if (info) this.pad = info;
        break;
      }
    }

    const gp = pads[this.pad.index];
    if (!gp || !gp.connected) return;

    const dz = CONFIG.input.stickDeadzone;
    applyRadialDeadzone(gp.axes[PadAxes.MOVE.x] ?? 0, gp.axes[PadAxes.MOVE.y] ?? 0, dz, this.rawStick);
    applyRadialDeadzone(gp.axes[PadAxes.AIM.x] ?? 0, gp.axes[PadAxes.AIM.y] ?? 0, dz, this.aimStick);

    let active = this.rawStick.x !== 0 || this.rawStick.y !== 0 || this.aimStick.x !== 0 || this.aimStick.y !== 0;
    for (let i = 0; i < gp.buttons.length; i++) {
      const b = gp.buttons[i];
      const down = ANALOG_BUTTONS.has(i) ? b.value > CONFIG.input.triggerThreshold : b.pressed;
      this.padButtons[i] = down;
      if (down) active = true;
    }
    if (active) this.device = 'gamepad';
  }

  /** Diff the browser's pad list against what we know; robust even if connect events are missed. */
  private reconcilePads(pads: (Gamepad | null)[]): void {
    const seen = new Set<number>();
    for (const gp of pads) {
      if (!gp || !gp.connected) continue;
      seen.add(gp.index);
      if (!this.knownPads.has(gp.index)) {
        const info: PadInfo = {
          index: gp.index,
          id: gp.id,
          style: detectStyle(gp.id),
          standard: gp.mapping === 'standard',
        };
        this.knownPads.set(gp.index, info);
        if (!this.pad) this.pad = info;
        for (const fn of this.connectListeners) fn(info, this.pad === info);
      }
    }
    for (const [index, info] of this.knownPads) {
      if (seen.has(index)) continue;
      this.knownPads.delete(index);
      const wasActive = this.pad?.index === index;
      const usingPad = wasActive && this.device === 'gamepad';
      if (wasActive) {
        const next = this.knownPads.values().next();
        this.pad = next.done ? null : next.value;
        if (!this.pad) this.device = 'keyboard';
      }
      for (const fn of this.disconnectListeners) fn(info, usingPad);
    }
  }

  // ---------------------------------------------------------------- DOM

  private anyKey(codes: readonly string[]): boolean {
    for (const c of codes) if (this.keysDown.has(c)) return true;
    return false;
  }

  private attach(): void {
    window.addEventListener('keydown', (e) => {
      if (PREVENT_DEFAULT_KEYS.has(e.code)) e.preventDefault();
      if (e.repeat) return;
      this.keysDown.add(e.code);
      this.keysLatched.add(e.code);
      this.device = 'keyboard';
    });
    window.addEventListener('keyup', (e) => {
      this.keysDown.delete(e.code);
    });
    window.addEventListener('blur', () => this.releaseAll());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.releaseAll();
    });

    const canvas = this.display.canvas;
    window.addEventListener('mousemove', (e) => {
      const px = this.mouse.x;
      const py = this.mouse.y;
      this.display.clientToLogical(e.clientX, e.clientY, this.mouse);
      this.mouseTravel += len(this.mouse.x - px, this.mouse.y - py);
      if (this.mouseTravel > CONFIG.input.mouseSwitchDistance) {
        this.device = 'keyboard';
        this.mouseTravel = 0;
      }
    });
    canvas.addEventListener('mouseenter', () => (this.mouseInside = true));
    canvas.addEventListener('mouseleave', () => (this.mouseInside = false));
    canvas.addEventListener('mousedown', (e) => {
      e.preventDefault();
      canvas.focus();
      this.mouseDown.add(e.button);
      this.mouseLatched.add(e.button);
      this.device = 'keyboard';
      this.mouseTravel = 0;
    });
    window.addEventListener('mouseup', (e) => {
      this.mouseDown.delete(e.button);
    });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        if (e.deltaY > 0) this.wheelLatched.add(Action.WEAPON_NEXT);
        else if (e.deltaY < 0) this.wheelLatched.add(Action.WEAPON_PREV);
      },
      { passive: false },
    );

    // Connection events just trigger an early reconcile; polling is the source of truth.
    window.addEventListener('gamepadconnected', () => this.reconcilePads(navigator.getGamepads()));
    window.addEventListener('gamepaddisconnected', () => this.reconcilePads(navigator.getGamepads()));
  }

  private releaseAll(): void {
    this.keysDown.clear();
    this.mouseDown.clear();
  }
}
