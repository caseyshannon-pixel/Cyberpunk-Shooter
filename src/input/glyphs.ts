import { Axis, GAMEPAD_BINDINGS, KEYBOARD_BINDINGS, KEYBOARD_MOVE, MOUSE_BINDINGS, PadButton, type Action } from './bindings';
import type { Device, PadStyle } from './input';

/** Human-readable labels for each standard-mapping button, per controller family. */
const PAD_LABELS: Record<PadStyle, Record<number, string>> = {
  xbox: {
    [PadButton.A]: 'A',
    [PadButton.B]: 'B',
    [PadButton.X]: 'X',
    [PadButton.Y]: 'Y',
    [PadButton.LB]: 'LB',
    [PadButton.RB]: 'RB',
    [PadButton.LT]: 'LT',
    [PadButton.RT]: 'RT',
    [PadButton.SELECT]: 'VIEW',
    [PadButton.START]: 'MENU',
    [PadButton.LS]: 'LS',
    [PadButton.RS]: 'RS',
    [PadButton.DPAD_UP]: 'D↑',
    [PadButton.DPAD_DOWN]: 'D↓',
    [PadButton.DPAD_LEFT]: 'D←',
    [PadButton.DPAD_RIGHT]: 'D→',
  },
  playstation: {
    [PadButton.A]: '✕',
    [PadButton.B]: '○',
    [PadButton.X]: '□',
    [PadButton.Y]: '△',
    [PadButton.LB]: 'L1',
    [PadButton.RB]: 'R1',
    [PadButton.LT]: 'L2',
    [PadButton.RT]: 'R2',
    [PadButton.SELECT]: 'SHARE',
    [PadButton.START]: 'OPTIONS',
    [PadButton.LS]: 'L3',
    [PadButton.RS]: 'R3',
    [PadButton.DPAD_UP]: 'D↑',
    [PadButton.DPAD_DOWN]: 'D↓',
    [PadButton.DPAD_LEFT]: 'D←',
    [PadButton.DPAD_RIGHT]: 'D→',
  },
  generic: {
    [PadButton.A]: 'A',
    [PadButton.B]: 'B',
    [PadButton.X]: 'X',
    [PadButton.Y]: 'Y',
    [PadButton.LB]: 'L1',
    [PadButton.RB]: 'R1',
    [PadButton.LT]: 'L2',
    [PadButton.RT]: 'R2',
    [PadButton.SELECT]: 'SELECT',
    [PadButton.START]: 'START',
    [PadButton.LS]: 'L3',
    [PadButton.RS]: 'R3',
    [PadButton.DPAD_UP]: 'D↑',
    [PadButton.DPAD_DOWN]: 'D↓',
    [PadButton.DPAD_LEFT]: 'D←',
    [PadButton.DPAD_RIGHT]: 'D→',
  },
};

const STICK_LABELS: Record<PadStyle, { move: string; aim: string }> = {
  xbox: { move: 'LS', aim: 'RS' },
  playstation: { move: 'LS', aim: 'RS' },
  generic: { move: 'LS', aim: 'RS' },
};

const MOUSE_LABELS: Record<number, string> = { 0: 'LMB', 1: 'MMB', 2: 'RMB' };

const KEY_LABELS: Record<string, string> = {
  Space: 'SPACE',
  Escape: 'ESC',
  Enter: 'ENTER',
  Backspace: 'BKSP',
  ShiftLeft: 'SHIFT',
  ShiftRight: 'SHIFT',
  ArrowUp: '↑',
  ArrowDown: '↓',
  ArrowLeft: '←',
  ArrowRight: '→',
  Backquote: '`',
};

export function keyLabel(code: string): string {
  if (KEY_LABELS[code]) return KEY_LABELS[code];
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  return code.toUpperCase();
}

/** Primary glyph for an action on the given device (the first binding wins). */
export function actionGlyph(action: Action, device: Device, style: PadStyle = 'xbox'): string {
  if (device === 'gamepad') {
    const b = GAMEPAD_BINDINGS[action][0];
    return b === undefined ? '?' : PAD_LABELS[style][b] ?? `B${b}`;
  }
  const mouse = MOUSE_BINDINGS[action]?.[0];
  if (mouse !== undefined) return MOUSE_LABELS[mouse] ?? `M${mouse}`;
  const key = KEYBOARD_BINDINGS[action][0];
  return key === undefined ? '?' : keyLabel(key);
}

export function axisGlyph(axis: Axis, device: Device, style: PadStyle = 'xbox'): string {
  if (device === 'gamepad') return axis === Axis.MOVE ? STICK_LABELS[style].move : STICK_LABELS[style].aim;
  if (axis === Axis.AIM) return 'MOUSE';
  return [KEYBOARD_MOVE.up[0], KEYBOARD_MOVE.left[0], KEYBOARD_MOVE.down[0], KEYBOARD_MOVE.right[0]].map(keyLabel).join('');
}

/** Glyph for "navigate menus" (up/down), which reads better as one cap than two. */
export function navigateGlyph(device: Device): string {
  if (device === 'gamepad') return 'D-PAD';
  return `${keyLabel(KEYBOARD_BINDINGS.MENU_UP[0])}${keyLabel(KEYBOARD_BINDINGS.MENU_DOWN[0])}`;
}
