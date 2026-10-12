/**
 * Every tunable number in the game lives here so balancing never requires
 * hunting through gameplay code.
 */
export const CONFIG = {
  view: {
    /** Logical resolution. The canvas is scaled to fit the window at this aspect ratio. */
    width: 1280,
    height: 720,
    /**
     * Upper bound on devicePixelRatio for the backing canvas. iPhones report 3;
     * 2 is visually indistinguishable here and costs ~44% fewer pixels to fill.
     */
    maxDpr: 2,
  },

  loop: {
    /** Fixed simulation rate (updates per second). */
    hz: 60,
    /** Longest real frame time we simulate; avoids a "spiral of death" after a tab stall. */
    maxFrameTime: 0.25,
  },

  input: {
    /** Radial deadzone for both sticks (0..1). Output is rescaled so it starts at 0 at the deadzone edge. */
    stickDeadzone: 0.2,
    /** Right stick magnitude (after rescaling) above which twin-stick auto-fire kicks in. */
    aimFireThreshold: 0.0,
    /** Analog trigger value counted as "pressed". */
    triggerThreshold: 0.3,
    /** Left stick deflection that counts as a menu direction press. */
    menuStickThreshold: 0.5,
    /** Pixels the mouse must move (logical units) before we switch prompts back to keyboard/mouse. */
    mouseSwitchDistance: 6,
    /** Distance of the gamepad aim reticle from the player. */
    padReticleDistance: 110,
  },

  arena: {
    /** Playable rectangle inside the view (walls sit outside it). */
    x: 40,
    y: 40,
    width: 1200,
    height: 640,
    gridSize: 40,
    /** Grid scroll speed in px/s (purely cosmetic). */
    gridScroll: 14,
  },

  player: {
    radius: 14,
    maxHealth: 5,
    speed: 300,
    /** How quickly velocity reaches the target (px/s^2). Higher = snappier. */
    accel: 3200,
    dash: {
      speed: 980,
      duration: 0.16,
      cooldown: 0.85,
      /** Extra invulnerability after the dash ends. */
      iframeExtra: 0.12,
    },
    muzzleOffset: 20,
  },

  /** Virtual controls for phones/tablets (logical coordinates, 1280x720 space). */
  touch: {
    stickRadius: 64,
    stickDeadzone: 0.12,
    /** Where faint "MOVE"/"AIM" hints sit while no finger is on that side. */
    moveHint: { x: 170, y: 575 },
    aimHint: { x: 1050, y: 590 },
    buttons: {
      dash: { x: 1172, y: 455, r: 44, hit: 60 },
      weapon: { x: 1196, y: 335, r: 28, hit: 44 },
      pause: { x: 1254, y: 20, r: 14, hit: 40 },
      fullscreen: { x: 26, y: 20, r: 14, hit: 40 },
    },
  },

  projectiles: {
    poolSize: 512,
  },

  ui: {
    toastDuration: 2.6,
  },
} as const;

export const STEP = 1 / CONFIG.loop.hz;

/** Neon palette shared by every renderer. */
export const COLORS = {
  bg: '#05010d',
  bgDeep: '#020008',
  grid: '#2a0f5a',
  gridBright: '#5b1fb0',
  cyan: '#00f0ff',
  magenta: '#ff2bd6',
  purple: '#9d4dff',
  yellow: '#ffe14d',
  red: '#ff3355',
  white: '#f4f0ff',
  wall: '#ff2bd6',
  obstacleFill: '#12052a',
  obstacleEdge: '#00f0ff',
} as const;
