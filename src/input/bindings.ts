/**
 * The ONLY place that knows about physical keys / buttons. Game code talks in
 * actions (see `Action`), never raw inputs. Re-map controls by editing here.
 */

/** Discrete (button-like) actions. MOVE and AIM are analog and handled separately. */
export const Action = {
  FIRE: 'FIRE',
  DASH: 'DASH',
  WEAPON_NEXT: 'WEAPON_NEXT',
  WEAPON_PREV: 'WEAPON_PREV',
  PAUSE: 'PAUSE',
  MENU_UP: 'MENU_UP',
  MENU_DOWN: 'MENU_DOWN',
  MENU_LEFT: 'MENU_LEFT',
  MENU_RIGHT: 'MENU_RIGHT',
  CONFIRM: 'CONFIRM',
  BACK: 'BACK',
  DEBUG: 'DEBUG',
} as const;
export type Action = (typeof Action)[keyof typeof Action];
export const ALL_ACTIONS = Object.values(Action) as Action[];

/** Analog actions. */
export const Axis = {
  MOVE: 'MOVE',
  AIM: 'AIM',
} as const;
export type Axis = (typeof Axis)[keyof typeof Axis];

/** W3C "standard" gamepad mapping button indices. */
export const PadButton = {
  A: 0, // Cross
  B: 1, // Circle
  X: 2, // Square
  Y: 3, // Triangle
  LB: 4, // L1
  RB: 5, // R1
  LT: 6, // L2 (analog)
  RT: 7, // R2 (analog)
  SELECT: 8, // View / Share / Create
  START: 9, // Menu / Options
  LS: 10, // L3
  RS: 11, // R3
  DPAD_UP: 12,
  DPAD_DOWN: 13,
  DPAD_LEFT: 14,
  DPAD_RIGHT: 15,
  HOME: 16,
} as const;
export type PadButton = (typeof PadButton)[keyof typeof PadButton];

/** Analog trigger buttons: read `.value` against a threshold rather than `.pressed`. */
export const ANALOG_BUTTONS: ReadonlySet<number> = new Set([PadButton.LT, PadButton.RT]);

/** Standard mapping axis indices. */
export const PadAxes = {
  MOVE: { x: 0, y: 1 },
  AIM: { x: 2, y: 3 },
} as const;

export const GAMEPAD_BINDINGS: Record<Action, readonly PadButton[]> = {
  FIRE: [PadButton.RT],
  DASH: [PadButton.LT, PadButton.A],
  WEAPON_NEXT: [PadButton.RB],
  WEAPON_PREV: [PadButton.LB],
  PAUSE: [PadButton.START],
  MENU_UP: [PadButton.DPAD_UP],
  MENU_DOWN: [PadButton.DPAD_DOWN],
  MENU_LEFT: [PadButton.DPAD_LEFT],
  MENU_RIGHT: [PadButton.DPAD_RIGHT],
  CONFIRM: [PadButton.A],
  BACK: [PadButton.B],
  DEBUG: [PadButton.SELECT],
};

/** Keyboard bindings use `KeyboardEvent.code` (layout-independent physical keys). */
export const KEYBOARD_BINDINGS: Record<Action, readonly string[]> = {
  FIRE: [],
  DASH: ['Space', 'ShiftLeft'],
  WEAPON_NEXT: ['KeyE'],
  WEAPON_PREV: ['KeyQ'],
  PAUSE: ['Escape', 'KeyP'],
  MENU_UP: ['ArrowUp', 'KeyW'],
  MENU_DOWN: ['ArrowDown', 'KeyS'],
  MENU_LEFT: ['ArrowLeft', 'KeyA'],
  MENU_RIGHT: ['ArrowRight', 'KeyD'],
  CONFIRM: ['Enter', 'Space'],
  BACK: ['Escape', 'Backspace'],
  DEBUG: ['Backquote', 'F3'],
};

/** Mouse buttons by `MouseEvent.button` (0 = left, 1 = middle, 2 = right). */
export const MOUSE_BINDINGS: Partial<Record<Action, readonly number[]>> = {
  FIRE: [0],
  DASH: [2],
};

export const KEYBOARD_MOVE = {
  up: ['KeyW', 'ArrowUp'],
  down: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
} as const;

/** Keys whose default browser behaviour (scrolling, quick-find…) we suppress. */
export const PREVENT_DEFAULT_KEYS: ReadonlySet<string> = new Set([
  'Space',
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'Backspace',
  'Tab',
  'F3',
  'Quote',
  'Slash',
]);
