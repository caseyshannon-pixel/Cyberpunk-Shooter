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
    /** Invulnerability after taking a hit. */
    hitInvuln: 1.1,
    /** Knockback speed applied to the player when hit. */
    hitKnockback: 520,
    /** Fraction of the radius used for bullet hits (smaller = more forgiving). */
    hitboxScale: 0.7,
    /** Seconds between dying and the game-over screen. */
    deathDelay: 1.6,
  },

  /**
   * Enemy archetypes. Shared fields: radius, hp, speed, accel, score,
   * knockback (multiplier, 0 = immovable), color, and wave-spawner fields
   * cost / minWave / weight (weight 0 = never picked by the spawner).
   */
  enemies: {
    drone: {
      radius: 12, hp: 2, speed: 155, accel: 700, score: 100, knockback: 1, color: '#ff2bd6',
      cost: 1, minWave: 1, weight: 6,
    },
    gunner: {
      radius: 15, hp: 4, speed: 115, accel: 450, score: 200, knockback: 0.8, color: '#ff9a1f',
      cost: 2, minWave: 2, weight: 3,
      /** Tries to stay between these distances from the player. */
      rangeMin: 240, rangeMax: 380,
      fireInterval: 2.0, telegraph: 0.45, bulletSpeed: 250, bulletRadius: 6,
    },
    splitter: {
      radius: 18, hp: 5, speed: 105, accel: 380, score: 250, knockback: 0.7, color: '#7dff4d',
      cost: 2, minWave: 3, weight: 2,
      splitCount: 2, splitSpeed: 320,
    },
    splitling: {
      radius: 10, hp: 1, speed: 235, accel: 900, score: 75, knockback: 1.2, color: '#b8ff4d',
      cost: 0, minWave: 999, weight: 0,
    },
    bruiser: {
      radius: 26, hp: 16, speed: 70, accel: 220, score: 500, knockback: 0.2, color: '#ff3355',
      cost: 4, minWave: 4, weight: 1.5,
      chargeRange: 430, chargeTelegraph: 0.8, chargeSpeed: 640, chargeDuration: 0.9,
      chargeCooldown: 2.6, wallStun: 0.8,
    },
    boss: {
      radius: 48, hp: 280, speed: 60, accel: 200, score: 5000, knockback: 0, color: '#9d4dff',
      cost: 0, minWave: 999, weight: 0,
      /** Extra HP fraction per previous boss defeated. */
      hpPerBoss: 0.5,
      windup: 0.6, recovery: 1.0, enragedAt: 0.5,
      bulletSpeed: 230, bulletRadius: 7,
      ringCount: 20, ringBursts: 3, ringGap: 0.35,
      volleyShots: 5, volleyArc: 0.6, volleys: 4, volleyGap: 0.3,
      chargeTelegraph: 0.9, chargeSpeed: 540, chargeDuration: 1.1, stompBullets: 14,
      spiralDuration: 2.6, spiralRate: 0.075, spiralSpin: 2.6,
      summonInterval: 8, summonCount: 3,
    },
  },

  waves: {
    firstWaveDelay: 0.8,
    /** "WAVE X" banner duration before spawning starts. */
    bannerTime: 2.0,
    /** Breather after a wave is cleared. */
    breather: 2.5,
    budgetBase: 6,
    budgetPerWave: 4,
    spawnIntervalStart: 0.85,
    spawnIntervalMin: 0.3,
    spawnIntervalPerWave: 0.06,
    maxAlive: 30,
    /** Enemy stat scaling per wave after the first. */
    hpScalePerWave: 0.08,
    speedScalePerWave: 0.012,
    bossEvery: 5,
    /** Fraction of the normal budget spent on escorts during a boss wave. */
    bossEscortBudget: 0.35,
    spawnTelegraph: 0.9,
    bossTelegraph: 1.8,
    minSpawnDistance: 280,
    clearBonusPerWave: 250,
  },

  score: {
    /** Kills needed to raise the multiplier by one. */
    killsPerLevel: 5,
    maxMultiplier: 8,
    /** Seconds without a kill before the multiplier drops a level. */
    comboWindow: 2.6,
    /** Each further drop happens this fast. */
    decayStepTime: 0.9,
    hitResetsCombo: true,
    storageKey: 'neongrid.highscore',
  },

  combat: {
    /** Enemy knockback velocity per point of damage (scaled by enemy.knockback). */
    knockbackPerDamage: 160,
    knockbackDrag: 9,
    hitFlash: 0.08,
    /** How strongly overlapping enemies push apart. */
    separation: 0.5,
    enemyBulletColor: '#ff4dd2',
    spatialCell: 64,
  },

  particles: {
    poolSize: 1600,
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
    /** Y of the first toast (below the boss bar). */
    toastY: 112,
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
  orange: '#ff9a1f',
  lime: '#7dff4d',
  white: '#f4f0ff',
  wall: '#ff2bd6',
  obstacleFill: '#12052a',
  obstacleEdge: '#00f0ff',
} as const;
