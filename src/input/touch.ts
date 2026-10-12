import { CONFIG } from '../config';
import { applyRadialDeadzone, len, vec, type Vec2 } from '../core/math';
import { Action } from './bindings';

const T = CONFIG.touch;

export interface TouchStick {
  active: boolean;
  pointerId: number;
  baseX: number;
  baseY: number;
  knobX: number;
  knobY: number;
  /** Deadzoned output, magnitude 0..1. */
  readonly value: Vec2;
}

export type TouchButtonId = keyof typeof T.buttons;

export interface TouchButton {
  id: TouchButtonId;
  x: number;
  y: number;
  /** Visual radius. */
  r: number;
  /** Touch target radius (bigger than the visual so it's easy to hit). */
  hit: number;
  action: Action | null;
  visible: boolean;
}

type Role =
  | { kind: 'stick'; stick: TouchStick }
  | { kind: 'button'; button: TouchButton }
  | { kind: 'tap' }
  | { kind: 'ignore' };

function makeStick(): TouchStick {
  return { active: false, pointerId: -1, baseX: 0, baseY: 0, knobX: 0, knobY: 0, value: vec() };
}

/**
 * Virtual twin-stick controls for phones and tablets. Touches on the left
 * half spawn a floating move stick, touches on the right half spawn a
 * floating aim stick (which auto-fires), and on-screen buttons map to the
 * same actions as physical buttons. In menus every touch is just a tap.
 *
 * Coordinates are logical game units (touches in the letterbox bars still
 * count, they're just outside 0..width).
 */
export class TouchControls {
  /** When false (menus), touches only produce taps. */
  gameplay = false;
  readonly left = makeStick();
  readonly right = makeStick();
  readonly buttons: TouchButton[];

  private readonly roles = new Map<number, Role>();
  private readonly buttonsDown = new Set<TouchButtonId>();
  private readonly buttonsLatched = new Set<TouchButtonId>();

  constructor(
    private readonly onTap: (x: number, y: number) => void,
    private readonly onFullscreen: () => void,
  ) {
    const actions: Record<TouchButtonId, Action | null> = {
      dash: Action.DASH,
      weapon: Action.WEAPON_NEXT,
      pause: Action.PAUSE,
      fullscreen: null,
    };
    this.buttons = (Object.keys(T.buttons) as TouchButtonId[]).map((id) => ({
      id,
      ...T.buttons[id],
      action: actions[id],
      visible: true,
    }));
  }

  get anyActive(): boolean {
    return this.roles.size > 0;
  }

  setButtonVisible(id: TouchButtonId, visible: boolean): void {
    const b = this.buttons.find((b) => b.id === id);
    if (b) b.visible = visible;
  }

  isButtonDown(id: TouchButtonId): boolean {
    return this.buttonsDown.has(id);
  }

  /** True if an on-screen button bound to `action` is held (or was tapped since the last tick). */
  isActionDown(action: Action): boolean {
    for (const b of this.buttons) {
      if (b.action === action && (this.buttonsDown.has(b.id) || this.buttonsLatched.has(b.id))) return true;
    }
    return false;
  }

  /** Called once per tick after actions are read. */
  endTick(): void {
    this.buttonsLatched.clear();
  }

  down(id: number, x: number, y: number): void {
    if (!this.gameplay) {
      this.roles.set(id, { kind: 'tap' });
      this.onTap(x, y);
      return;
    }

    for (const b of this.buttons) {
      if (!b.visible) continue;
      if (len(x - b.x, y - b.y) <= b.hit) {
        this.roles.set(id, { kind: 'button', button: b });
        this.buttonsDown.add(b.id);
        this.buttonsLatched.add(b.id);
        return;
      }
    }

    const stick = x < CONFIG.view.width / 2 ? this.left : this.right;
    if (stick.active) {
      this.roles.set(id, { kind: 'ignore' });
      return;
    }
    stick.active = true;
    stick.pointerId = id;
    stick.baseX = stick.knobX = x;
    stick.baseY = stick.knobY = y;
    stick.value.x = stick.value.y = 0;
    this.roles.set(id, { kind: 'stick', stick });
  }

  move(id: number, x: number, y: number): void {
    const role = this.roles.get(id);
    if (!role || role.kind !== 'stick') return;
    const s = role.stick;
    s.knobX = x;
    s.knobY = y;
    let dx = x - s.baseX;
    let dy = y - s.baseY;
    const d = len(dx, dy);
    const R = T.stickRadius;
    // Drag the base along when the finger overshoots, so reversing direction is instant.
    if (d > R) {
      s.baseX = x - (dx / d) * R;
      s.baseY = y - (dy / d) * R;
      dx = (dx / d) * R;
      dy = (dy / d) * R;
    }
    applyRadialDeadzone(dx / R, dy / R, T.stickDeadzone, s.value);
  }

  up(id: number, cancelled = false): void {
    const role = this.roles.get(id);
    this.roles.delete(id);
    if (!role) return;
    if (role.kind === 'stick') {
      const s = role.stick;
      s.active = false;
      s.pointerId = -1;
      s.value.x = s.value.y = 0;
    } else if (role.kind === 'button') {
      this.buttonsDown.delete(role.button.id);
      // Fullscreen must be requested from a user-activation event; for touch
      // that's pointerup/touchend, not pointerdown.
      if (role.button.id === 'fullscreen' && !cancelled) this.onFullscreen();
    }
  }

  releaseAll(): void {
    for (const id of [...this.roles.keys()]) this.up(id, true);
  }
}
