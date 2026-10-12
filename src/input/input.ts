import { CONFIG } from '../config';
import type { Display } from '../core/display';
import { canExpand, expand, toggleFullscreen } from '../core/fullscreen';
import { applyRadialDeadzone, len, vec, type Vec2 } from '../core/math';
import {
  ALL_ACTIONS,
  ANALOG_BUTTONS,
  Action,
  FULLSCREEN_KEYS,
  GAMEPAD_BINDINGS,
  KEYBOARD_BINDINGS,
  KEYBOARD_MOVE,
  MOUSE_BINDINGS,
  PREVENT_DEFAULT_KEYS,
  PadAxes,
} from './bindings';
import { TouchControls } from './touch';
import { VIEW } from '../core/view';

export type Device = 'keyboard' | 'gamepad' | 'touch';
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

/** `PointerEvent.buttons` bit → `MouseEvent.button` index. */
const MOUSE_BUTTON_BITS: readonly [bit: number, button: number][] = [
  [1, 0],
  [2, 2],
  [4, 1],
];

/** Phones/tablets without a precise pointer start in touch mode so the right prompts show immediately. */
function prefersTouch(): boolean {
  return window.matchMedia('(pointer: coarse)').matches && !window.matchMedia('(any-pointer: fine)').matches;
}

/**
 * Input abstraction. Each fixed update calls `update()`, which polls the
 * gamepad and folds keyboard / mouse / touch events into per-action state.
 * Game code only asks about actions: `isDown(Action.FIRE)`,
 * `pressed(Action.DASH)`, `move`, `getAimDirection()`, `taps`.
 */
export class Input {
  /** Most recently used device — drives on-screen prompts and touch HUD visibility. */
  device: Device = prefersTouch() ? 'touch' : 'keyboard';
  /** Normalised movement vector, magnitude 0..1. */
  readonly move: Vec2 = vec();
  /** Deadzoned aim stick (gamepad right stick or touch right stick), magnitude 0..1. */
  readonly aimStick: Vec2 = vec();
  /** Mouse position in logical game coordinates. */
  readonly mouse: Vec2 = vec(VIEW.width / 2, VIEW.height / 2);
  mouseInside = false;
  /** Mouse moved since last tick (menus use it for hover selection). */
  mouseMoved = false;
  /** Clicks / taps since the last tick, in logical coordinates (for menus). */
  readonly taps: Vec2[] = [];

  readonly touch: TouchControls;

  /** Active controller, if any. */
  pad: PadInfo | null = null;
  rumbleEnabled = true;

  private readonly keysDown = new Set<string>();
  private readonly keysLatched = new Set<string>();
  private readonly mouseDown = new Set<number>();
  private readonly mouseLatched = new Set<number>();
  private mouseButtons = 0;
  private readonly wheelLatched = new Set<Action>();
  private mouseTravel = 0;
  private mouseMovedPending = false;
  private readonly pendingTaps: Vec2[] = [];

  private readonly curr = new Map<Action, boolean>();
  private readonly prev = new Map<Action, boolean>();
  private readonly consumed = new Set<Action>();

  private readonly knownPads = new Map<number, PadInfo>();
  private readonly padButtons: boolean[] = [];
  private readonly prevPadButtons: boolean[] = [];
  /** Any key / mouse button / tap / controller button went down this tick. */
  private anyRaw = false;
  private readonly padMove = vec();
  private readonly padAim = vec();
  private readonly tmp = vec();

  private readonly connectListeners: PadListener[] = [];
  private readonly disconnectListeners: PadListener[] = [];

  constructor(private readonly display: Display) {
    for (const a of ALL_ACTIONS) {
      this.curr.set(a, false);
      this.prev.set(a, false);
    }
    this.touch = new TouchControls(
      (x, y) => this.pendingTaps.push({ x, y }),
      () => expand(),
    );
    // ⛶ toggles real fullscreen (iPad/desktop) or shows the Add-to-Home-Screen guide (iPhone).
    // Hidden when already running as a home-screen app.
    this.touch.setButtonVisible('fullscreen', canExpand());
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

  /** "Press any button": any key, click, tap or controller button this tick. */
  anyPressed(): boolean {
    if (this.anyRaw || this.taps.length) return true;
    for (const a of ALL_ACTIONS) if (this.pressed(a)) return true;
    return false;
  }

  /**
   * Direction the player wants to aim from (fromX, fromY), written into `out`
   * as a unit vector. Returns false when there is no aim input this tick
   * (stick at rest) so the caller can keep its last facing.
   */
  getAimDirection(fromX: number, fromY: number, out: Vec2): boolean {
    if (this.device !== 'keyboard') {
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

  /** Enable virtual sticks/buttons (gameplay) or treat every touch as a menu tap. */
  setTouchGameplay(on: boolean): void {
    this.touch.gameplay = on;
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

    this.taps.length = 0;
    for (const t of this.pendingTaps) this.taps.push(t);
    this.pendingTaps.length = 0;
    this.mouseMoved = this.mouseMovedPending;
    this.mouseMovedPending = false;

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

    // Combine keyboard + gamepad stick + touch stick, clamp to unit length.
    const tl = this.touch.left.value;
    let mx = kx + this.padMove.x + tl.x;
    let my = ky + this.padMove.y + tl.y;
    const ml = len(mx, my);
    if (ml > 1) {
      mx /= ml;
      my /= ml;
    }
    this.move.x = mx;
    this.move.y = my;

    // Aim: the touch stick wins while a finger is on it, otherwise the right stick.
    const tr = this.touch.right;
    const src = tr.active ? tr.value : this.padAim;
    this.aimStick.x = src.x;
    this.aimStick.y = src.y;

    const autoFire = this.device !== 'keyboard' && len(this.aimStick.x, this.aimStick.y) > CONFIG.input.aimFireThreshold;
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
      if (!down && this.touch.isActionDown(a)) down = true;
      this.curr.set(a, down);
    }

    // Virtual actions derived from analog input.
    if (autoFire) this.curr.set(Action.FIRE, true);
    if (this.pad) {
      if (this.padMove.y < -t) this.curr.set(Action.MENU_UP, true);
      if (this.padMove.y > t) this.curr.set(Action.MENU_DOWN, true);
      if (this.padMove.x < -t) this.curr.set(Action.MENU_LEFT, true);
      if (this.padMove.x > t) this.curr.set(Action.MENU_RIGHT, true);
    }

    this.anyRaw = this.keysLatched.size > 0 || this.mouseLatched.size > 0 || this.padButtons.some((d, i) => d && !this.prevPadButtons[i]);
    this.prevPadButtons.length = 0;
    for (let i = 0; i < this.padButtons.length; i++) this.prevPadButtons[i] = this.padButtons[i];
    this.keysLatched.clear();
    this.mouseLatched.clear();
    this.wheelLatched.clear();
    this.touch.endTick();
  }

  // ---------------------------------------------------------------- gamepad

  private pollGamepads(): void {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    this.reconcilePads(pads);

    this.padMove.x = this.padMove.y = 0;
    this.padAim.x = this.padAim.y = 0;
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
    applyRadialDeadzone(gp.axes[PadAxes.MOVE.x] ?? 0, gp.axes[PadAxes.MOVE.y] ?? 0, dz, this.padMove);
    applyRadialDeadzone(gp.axes[PadAxes.AIM.x] ?? 0, gp.axes[PadAxes.AIM.y] ?? 0, dz, this.padAim);

    let active = this.padMove.x !== 0 || this.padMove.y !== 0 || this.padAim.x !== 0 || this.padAim.y !== 0;
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
        if (!this.pad && this.device === 'gamepad') this.device = prefersTouch() ? 'touch' : 'keyboard';
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
      if (FULLSCREEN_KEYS.has(e.code)) {
        e.preventDefault();
        toggleFullscreen();
      }
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

    // Pointer Events cover mouse, trackpad (incl. iPad), touch and Apple Pencil
    // with one API, and unlike mouse events they don't produce the "fake" mouse
    // events Safari synthesises after a touch.
    window.addEventListener('pointerdown', this.onPointerDown, { passive: false });
    window.addEventListener('pointermove', this.onPointerMove, { passive: false });
    window.addEventListener('pointerup', this.onPointerUp);
    window.addEventListener('pointercancel', (e) => {
      if (e.pointerType === 'mouse') this.setMouseButtons(0);
      else this.touch.up(e.pointerId, true);
    });
    document.documentElement.addEventListener('pointerleave', (e) => {
      if (e.pointerType === 'mouse') this.mouseInside = false;
    });

    // Belt and braces for iOS: block scroll / bounce / pinch-zoom / double-tap zoom.
    const block = (e: Event) => e.preventDefault();
    document.addEventListener('touchstart', block, { passive: false });
    document.addEventListener('touchmove', block, { passive: false });
    document.addEventListener('gesturestart', block as EventListener, { passive: false });
    document.addEventListener('gesturechange', block as EventListener, { passive: false });
    document.addEventListener('dblclick', block, { passive: false });
    window.addEventListener('contextmenu', block);

    this.display.canvas.addEventListener(
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

  private onPointerDown = (e: PointerEvent): void => {
    const p = this.display.clientToLogical(e.clientX, e.clientY, this.tmp);
    if (e.pointerType === 'mouse') {
      e.preventDefault();
      this.display.canvas.focus();
      this.updateMousePos(e);
      this.device = 'keyboard';
      this.mouseTravel = 0;
      if (e.button === 0) this.pendingTaps.push({ x: p.x, y: p.y });
      this.setMouseButtons(e.buttons);
      return;
    }
    // touch / pen
    e.preventDefault();
    this.device = 'touch';
    this.touch.down(e.pointerId, p.x, p.y);
  };

  private onPointerMove = (e: PointerEvent): void => {
    if (e.pointerType === 'mouse') {
      this.updateMousePos(e);
      // Pressing a second mouse button while one is held arrives as a pointermove.
      if (e.buttons !== this.mouseButtons) this.setMouseButtons(e.buttons);
      return;
    }
    e.preventDefault();
    const p = this.display.clientToLogical(e.clientX, e.clientY, this.tmp);
    this.touch.move(e.pointerId, p.x, p.y);
  };

  private onPointerUp = (e: PointerEvent): void => {
    if (e.pointerType === 'mouse') {
      this.setMouseButtons(e.buttons);
      return;
    }
    this.touch.up(e.pointerId);
  };

  private updateMousePos(e: PointerEvent): void {
    const px = this.mouse.x;
    const py = this.mouse.y;
    this.display.clientToLogical(e.clientX, e.clientY, this.mouse);
    this.mouseInside =
      this.mouse.x >= 0 && this.mouse.y >= 0 && this.mouse.x <= VIEW.width && this.mouse.y <= VIEW.height;
    const moved = len(this.mouse.x - px, this.mouse.y - py);
    if (moved > 0) this.mouseMovedPending = true;
    this.mouseTravel += moved;
    if (this.mouseTravel > CONFIG.input.mouseSwitchDistance) {
      this.device = 'keyboard';
      this.mouseTravel = 0;
    }
  }

  private setMouseButtons(buttons: number): void {
    for (const [bit, button] of MOUSE_BUTTON_BITS) {
      const now = (buttons & bit) !== 0;
      const was = (this.mouseButtons & bit) !== 0;
      if (now && !was) {
        this.mouseDown.add(button);
        this.mouseLatched.add(button);
      } else if (!now && was) {
        this.mouseDown.delete(button);
      }
    }
    this.mouseButtons = buttons;
  }

  private releaseAll(): void {
    this.keysDown.clear();
    this.setMouseButtons(0);
    this.touch.releaseAll();
  }
}
