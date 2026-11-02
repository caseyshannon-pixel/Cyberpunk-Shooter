# Rogue Run — Phase 1 (Run Skeleton) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A playable ROGUE RUN mode: 3 floors × (6 combat rooms + Warden boss), doors between rooms, weapon reward pedestals, carried HP and weapons, run-over and victory screens.

**Architecture:** A `Run` object holds everything that persists across rooms and builds a fresh `World` per room behind `game.transition`. `World` talks to a `Director` interface; `WaveDirector` (Arcade/Zen) and the new `RoomDirector` (Rogue Run) both implement it. Pure logic (RNG, layouts, floor plan, rewards, run progression, arsenal rules) is unit-tested with Vitest; gameplay is verified in the browser preview.

**Tech Stack:** TypeScript 5.9, Vite 8, HTML5 Canvas, Vitest 5 (new dev dependency).

**Spec:** `docs/superpowers/specs/2026-11-02-roguelike-mode-design.md` (this plan covers spec §8 phase 1 only; phases 2–5 get their own plans).

## Global Constraints

- Arcade and Zen must behave exactly as before (same arena layout, waves, drops, HUD).
- Every tunable number goes in `CONFIG.run` in `src/config.ts` (project rule: "Every tunable number … lives in `src/config.ts`").
- Works in all graphics modes (HD-2D, 2.5D, flat) and with controller, keyboard & mouse, and touch. No new buttons: interactions are walk-in / stand-on.
- Phase 1 reward pool: every weapon except the Pulse Pistol (nothing is locked yet).
- Run-mode weapons have no ammo limit; Pistol + up to 2 others.
- `npm run build` and `npm test` pass at the end of every task.
- Work on branch `roguelike`; never push.

## Review Focus

1. **Screen shape mid-run:** rotating a phone or resizing between rooms must not change arena width mid-run → every room in a run uses `run.viewWidth`. (Task 7 step: PlayState uses `run.viewWidth`; Task 9 manual check.)
2. **Door entered twice / during fade:** walking through a door must trigger exactly one transition → `RoomDirector` sets stage `'leaving'` and ignores further overlaps (Task 6 test `doorEnteredOnce`).
3. **Dying in the same frame as clearing the room, or after taking the last hit while a door opens:** death wins; no transition from a dead player (Task 6 test `noExitWhenDead`).
4. **Pause/focus loss during the fade or on the reward screen:** pausing works and the run resumes in the same state (Task 9 manual check).
5. **Holding fire through a door:** the next room starts without consuming inputs oddly; the player can't fire during the room intro until the first wave spawns — same as Arcade today (Task 9 manual check).

---

### Task 1: Vitest + seeded RNG

**Files:**
- Modify: `package.json` (add `"test": "vitest run"`; dev dependency `vitest@^5.1.0`)
- Create: `src/core/rng.ts`
- Test: `src/core/rng.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface Rng { next(): number; int(min: number, max: number): number; pick<T>(items: readonly T[]): T; chance(p: number): boolean; shuffle<T>(items: T[]): T[]; }
  export function createRng(seed: number): Rng;   // mulberry32; next() in [0,1); int inclusive
  export function randomSeed(): number;           // uses Math.random, uint32
  ```

- [ ] **Step 1:** `npm i -D vitest@^5.1.0`; add the `test` script. Test files live next to source as `*.test.ts` (tsc type-checks them; Vite never bundles them).
- [ ] **Step 2: Write failing tests** in `rng.test.ts`:
  - `same seed → same sequence`: two `createRng(42)` produce equal first 20 `next()` values.
  - `different seeds differ`: `createRng(1).next() !== createRng(2).next()`.
  - `int is inclusive and in range`: 2000 draws of `int(1, 3)` are all in {1,2,3} and each value appears.
  - `pick returns an element`; `chance(0)` always false, `chance(1)` always true; `shuffle` keeps the same multiset.
- [ ] **Step 3:** Run `npm test` → FAIL (module not found).
- [ ] **Step 4:** Implement `src/core/rng.ts` (mulberry32).
- [ ] **Step 5:** `npm test` → PASS; `npm run build` → PASS.
- [ ] **Step 6: Commit** `git add package.json package-lock.json src/core/rng.ts src/core/rng.test.ts && git commit -m "Add Vitest and a seeded RNG for run generation"`

---

### Task 2: Room layouts, `CONFIG.run`, and Arena accepting a layout

**Files:**
- Modify: `src/config.ts` (add `run` block), `src/world/arena.ts` (layout from table)
- Create: `src/run/rooms.ts`
- Test: `src/run/rooms.test.ts`

**Interfaces:**
- Produces in `src/config.ts`:
  ```ts
  run: {
    floors: 3, roomsPerFloor: 6,
    wavesPerRoom: [[1, 2], [2, 2], [2, 3]],        // [min, max] per floor
    budgetBase: 6, budgetPerFloor: 4, budgetPerRoom: 1.5,
    hpPerFloor: 0.35, hpPerRoom: 0.04, speedPerFloor: 0.05,
    floorPools: [['drone', 'gunner', 'splitter'], ['drone', 'gunner', 'splitter', 'bruiser'], ['drone', 'gunner', 'splitter', 'bruiser']],
    bossHp: [280, 280, 280],                         // phase 4 raises floors 2–3
    bossHeal: 2, waveBreather: 1.2, introTime: 1.6,
    extraDoorChance: 0.3, maxExtraWeapons: 2, rewardChoices: 3, takeTime: 0.5,
    buffDropScale: 0.5,
    door: { width: 120, depth: 18, clearDepth: 130 }, entryInset: 60,
  }
  ```
- Produces in `src/run/rooms.ts`:
  ```ts
  export type WallSide = 'top' | 'bottom' | 'left' | 'right';
  export type RoomType = 'combat' | 'boss';            // phase 3 adds elite | shop | rest
  export type RoomReward = 'weapon' | 'none';          // phase 2 adds mod; phase 3 credits | repair
  export type LayoutId = 'classic' | 'open' | 'cross' | 'ring' | 'lanes' | 'scatter' | 'bunkers' | 'diagonal' | 'gates';
  export interface LayoutBlock { dx: number; dy: number; w: number; h: number; kind: 'pillar' | 'crate'; }  // offsets from arena centre; dx scaled by width/CONFIG.arena.width
  export interface RoomSpec { floor: number; room: number; type: RoomType; reward: RoomReward; layout: LayoutId; entry: WallSide; }  // room 1..6, boss = roomsPerFloor + 1
  export interface DoorOption { type: RoomType; reward: RoomReward; label: string; }
  export const LAYOUTS: Record<LayoutId, readonly LayoutBlock[]>;
  export const COMBAT_LAYOUTS: readonly LayoutId[];    // all except 'open'
  export function opposite(side: WallSide): WallSide;
  export function wavesFor(floor: number, rng: Rng): number;
  export function budgetFor(floor: number, room: number): number;   // budgetBase + floor*budgetPerFloor + room*budgetPerRoom
  export function hpScaleFor(floor: number, room: number): number;  // 1 + (floor-1)*hpPerFloor + room*hpPerRoom
  export function speedScaleFor(floor: number): number;             // 1 + (floor-1)*speedPerFloor
  export function doorRect(side: WallSide, bounds: Rect): Rect;     // door.width along the wall, door.depth deep, centred, inside bounds
  export function entryPoint(side: WallSide, bounds: Rect): { x: number; y: number };  // wall centre, entryInset inside
  ```
- `Arena` constructor becomes `constructor(viewWidth = VIEW.width, layout: LayoutId = 'classic')`; `LAYOUTS.classic` holds exactly today's 8 blocks (4 pillars at ±260·sx, ±150; crates at ±470·sx, 0 (40×140) and 0, ±235 (150×36)).

- [ ] **Step 1: Write failing tests** in `rooms.test.ts`:
  - `classic layout matches the original arena`: `new Arena(1280).obstacles` equals the 8 rects the old `buildLayout` produced (hard-code them from the current code: e.g. first pillar `{x: 1280/2 - 260 - 28, y: 40 + 320 - 150 - 28, w: 56, h: 56}`).
  - `door zones are clear in every layout`: for each `LayoutId`, at widths 1280 and `CONFIG.view.maxWidth` (1584), for each `WallSide`, no obstacle intersects the zone `doorRect(side)` extended `door.clearDepth` into the arena.
  - `entry points are free`: `arena.isFree(entryPoint(side).x, entryPoint(side).y, CONFIG.player.radius + 4)` for every layout and side.
  - `scaling formulas`: `budgetFor(1, 1) === 11.5`, `hpScaleFor(1, 0) === 1`, `hpScaleFor(3, 6) ≈ 1.94`, `speedScaleFor(2) === 1.05`; `wavesFor(3, rng)` ∈ {2,3}.
  - `opposite` is its own inverse.
- [ ] **Step 2:** `npm test` → FAIL.
- [ ] **Step 3:** Implement `rooms.ts` and `CONFIG.run`; refactor `Arena.buildLayout` to read `LAYOUTS[layout]` (keep the `sx` scaling). Design the 7 new combat layouts freely within the door-clear rule; `open` = 4 small pillars near the corners.
- [ ] **Step 4:** `npm test` → PASS; `npm run build` → PASS; `npm run dev`, Arcade still shows the same arena.
- [ ] **Step 5: Commit** `"Add room layouts and run config; Arena takes a layout"`

---

### Task 3: Floor plan and weapon reward rolls

**Files:**
- Create: `src/run/floorPlan.ts`, `src/run/rewards.ts`
- Test: `src/run/floorPlan.test.ts`, `src/run/rewards.test.ts`

**Interfaces:**
- Consumes: `Rng`, `RoomSpec`, `DoorOption`, `WallSide` (Tasks 1–2); `WEAPON_IDS`, `WeaponId`.
- Produces:
  ```ts
  export const OFFERABLE: readonly DoorOption[];   // phase 1: [{ type: 'combat', reward: 'weapon', label: 'WEAPON' }]
  export function exitsFor(spec: RoomSpec, rng: Rng): DoorOption[];
  export function assignWalls(count: number, entry: WallSide, rng: Rng): WallSide[];  // distinct, never `entry`
  export function rollWeaponChoices(rng: Rng, held: readonly WeaponId[], n: number): WeaponId[];  // rewards.ts
  ```
  Rules for `exitsFor`: room < roomsPerFloor → `count = chance(extraDoorChance) ? 3 : 2`, choose distinct options from `OFFERABLE` (so phase 1 yields 1 door); room === roomsPerFloor → `[{ type: 'boss', reward: 'none', label: 'BOSS' }]`; boss room on floor < floors → `[{ type: 'combat', reward: 'weapon', label: 'NEXT FLOOR' }]`; boss room on the last floor → `[]`.
  `rollWeaponChoices`: pool = `WEAPON_IDS` minus `'pulse'` minus `held`; returns `min(n, pool.length)` distinct ids.

- [ ] **Step 1: Write failing tests:**
  - `room 6 exits only to the boss` and `final boss has no exits` and `boss room on floor 1 leads to NEXT FLOOR`.
  - `exits never repeat an option` across 500 seeds for rooms 1–5.
  - `assignWalls never uses the entry wall and never repeats` for count 1–3, all entries, 200 seeds.
  - `weapon choices exclude pulse and held weapons, are distinct, and have length 3` with `held = ['spread']`; `returns fewer when the pool is small` with 5 held → length 1.
- [ ] **Step 2:** `npm test` → FAIL. **Step 3:** Implement. **Step 4:** `npm test` + `npm run build` → PASS.
- [ ] **Step 5: Commit** `"Add floor plan exits and weapon reward rolls"`

---

### Task 4: Run-mode Arsenal

**Files:**
- Modify: `src/weapons/arsenal.ts`, `src/entities/player.ts` (constructor takes an `Arsenal`)
- Test: `src/weapons/arsenal.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface ArsenalOptions { infiniteAmmo?: boolean; maxExtra?: number; }  // defaults: false, Infinity
  class Arsenal { constructor(opts?: ArsenalOptions); ids(): WeaponId[]; restore(ids: readonly WeaponId[], index: number): void; /* add() follows the replacement rule */ }
  class Player { constructor(x: number, y: number, arsenal?: Arsenal) }
  ```
  Replacement rule when extras are full: replace the equipped slot if it isn't the Pistol, otherwise replace the most recently added slot; the new weapon is equipped. With `infiniteAmmo`, slots get `ammo = capacity = Infinity` and `consume()` never empties.

- [ ] **Step 1: Write failing tests:** default arsenal unchanged (`add('spread')` gives 60 ammo; consuming 60 shots drops back to the Pistol); `infiniteAmmo` slots never empty after 1000 `consume()`; with `maxExtra: 2`, adding a third extra while a non-Pistol weapon is equipped replaces it; while the Pistol is equipped, it replaces the most recently added; `ids()`/`restore()` round-trip including the equipped index.
- [ ] **Step 2:** FAIL. **Step 3:** Implement. **Step 4:** `npm test` + `npm run build` → PASS; Arcade weapon pickups behave as before.
- [ ] **Step 5: Commit** `"Arsenal: run-mode options (infinite ammo, slot cap, replacement)"`

---

### Task 5: The `Run` object

**Files:**
- Create: `src/run/run.ts`
- Test: `src/run/run.test.ts`

**Interfaces:**
- Consumes: Tasks 1–4.
- Produces:
  ```ts
  export interface Carry { health: number; maxHealth: number; weapons: WeaponId[]; equipped: number; }
  export type RunOutcome = 'active' | 'dead' | 'victory' | 'abandoned';
  export class Run {
    readonly seed: number; readonly rng: Rng; readonly viewWidth: number;
    room: RoomSpec; carry: Carry; score: number; kills: number; roomsCleared: number; outcome: RunOutcome;
    constructor(viewWidth: number, seed?: number);   // floor 1, room 1, combat, reward 'weapon', random combat layout, entry 'bottom', carry = full HP, ['pulse'], 0
    get isBossRoom(): boolean;
    get isFinalBoss(): boolean;
    exits(): DoorOption[];                           // exitsFor(this.room, this.rng)
    advance(option: DoorOption, exitWall: WallSide): void;
    captureFrom(player: Player, score: ScoreKeeper): void;   // writes carry, score, kills
    applyTo(player: Player, score: ScoreKeeper): void;       // restores them into a fresh room
    onRoomCleared(): void;                           // roomsCleared++
    finish(outcome: Exclude<RunOutcome, 'active'>): void;
  }
  ```
  `advance`: next `room` = current + 1 on the same floor (boss = `roomsPerFloor + 1`); from a boss room → floor + 1, room 1, and `carry.health = min(maxHealth, health + bossHeal)`. `entry = opposite(exitWall)`; layout = `rng.pick(COMBAT_LAYOUTS)`, or `'open'` for boss rooms.

- [ ] **Step 1: Write failing tests:** progression walks F1 R1→R6→boss(7)→F2 R1 … F3 boss, where `isFinalBoss` is true only at F3 boss; boss → next floor heals 2 capped at max (health 2 → 4; health 5 → 5); `entry` is the opposite of the exit wall; boss rooms use `'open'`; same seed → same sequence of layouts; `captureFrom`/`applyTo` round-trip HP, weapons, equipped index, score and kills (use real `Player` and `ScoreKeeper`).
- [ ] **Step 2:** FAIL. **Step 3:** Implement. **Step 4:** PASS + build.
- [ ] **Step 5: Commit** `"Add Run: room progression and carry-over between rooms"`

---

### Task 6: Director interface, RoomDirector, doors and pedestals

**Files:**
- Create: `src/world/director.ts`, `src/world/roomDirector.ts`, `src/entities/door.ts`, `src/entities/pedestal.ts`
- Modify: `src/world/waves.ts` (implements `Director`), `src/world/world.ts`, `src/ui/hud.ts`
- Test: `src/world/roomDirector.test.ts`, `src/entities/pedestal.test.ts`

**Interfaces:**
- Produces:
  ```ts
  // director.ts
  export interface Director {
    readonly wave: number; readonly phase: WavePhase; readonly phaseAge: number; readonly timer: number;
    readonly isBossWave: boolean; readonly hpScale: number; readonly speedScale: number; readonly remaining: number;
    readonly bossHpScale: number;   // WaveDirector: today's 1 + (bossNumber-1)*hpPerBoss; RoomDirector: bossHp[floor-1] / CONFIG.enemies.boss.hp
    readonly bossNumber: number;    // HUD boss bar label (WaveDirector: today's formula; RoomDirector: floor)
    readonly label: string;         // HUD top-left: 'WAVE 3' | 'F1 · R3' | 'F1 · BOSS'
    readonly bannerText: string;    // intro banner: 'WAVE 3' | 'FLOOR 1 · ROOM 3' (first wave) | 'WAVE 2/3' (later waves) | 'FLOOR 1 · WARDEN'
    readonly clearText: string;     // 'WAVE CLEAR' | 'ROOM CLEAR'
    update(dt: number, w: World): void;
    renderMarkers(ctx: CanvasRenderingContext2D, time: number): void;
  }
  // pedestal.ts
  export class Pedestal { readonly weapon: WeaponId; x: number; y: number; hold: number; constructor(weapon: WeaponId, x: number, y: number); update(dt: number, px: number, py: number, pr: number): boolean; /* true once held for CONFIG.run.takeTime; leaving resets hold to 0 */ }
  export function renderPedestal(ctx: CanvasRenderingContext2D, p: Pedestal, time: number, near: boolean): void;  // reuses the weapon diamond look; fill ring = hold/takeTime; name + blurb when near
  // door.ts
  export class Door { readonly option: DoorOption; readonly side: WallSide; readonly rect: Rect; open: number /*0..1 anim*/; constructor(option: DoorOption, side: WallSide, bounds: Rect); touches(x: number, y: number, r: number): boolean; }
  export function renderDoor(ctx: CanvasRenderingContext2D, d: Door, time: number): void;  // floor-level neon gate + icon + label, world space
  // roomDirector.ts
  export type RoomStage = 'fighting' | 'reward' | 'leaving';
  export class RoomDirector implements Director { constructor(run: Run); stage: RoomStage; readonly pedestals: Pedestal[]; readonly doors: Door[]; debugClear(w: World): void; /* empties queue + markers, kills all enemies (no drops), moves to the next wave or clears the room; used by tests and the K debug key */ }
  ```
- World changes: `waves: Director`; constructor `(hooks, mode, run?: Run)` — in `'run'` mode builds `Arena(run.viewWidth, run.room.layout)`, `Player(entryPoint(...), new Arsenal({ infiniteAmmo: true, maxExtra: CONFIG.run.maxExtraWeapons }))`, calls `run.applyTo(player, score)`, and uses `RoomDirector`. `spawnEnemy` uses `waves.bossHpScale`. `renderFloor` draws doors and pedestals (before pickups) so every camera shows them. `WorldHooks` gains optional `roomExited?(door: Door): void` and `runWon?(): void`. `GameMode` = `'arcade' | 'zen' | 'run'`.
- HUD: `renderHealth` shows `world.waves.label`; `renderBossBar` uses `world.waves.bossNumber`; `renderWaveBanner` uses `bannerText` / `clearText`.

RoomDirector flow: intro (`introTime`) → spend `budgetFor(floor, room)` per wave from the floor's `floorPools` (boss room: `'boss'` + escorts at `CONFIG.waves.bossEscortBudget`), with `waveBreather` between waves, `wavesFor(floor, rng)` waves → on clear: `run.onRoomCleared()`; final boss → `hooks.runWon()`; else stage `'reward'`: if reward is `'weapon'`, spawn `rollWeaponChoices(run.rng, player.arsenal.ids(), rewardChoices)` pedestals in a row at the arena centre, and open doors from `run.exits()` on `assignWalls(...)`. Taking a pedestal → `player.arsenal.add(id)`, popup + `pickupWeapon` sound, remove all pedestals. Touching a door while alive in stage `'reward'` → stage `'leaving'`, `hooks.roomExited(door)` once.

- [ ] **Step 1: Write failing tests:**
  - `pedestal.test.ts`: taken after 0.5 s standing on it (two updates of 0.3 s); stepping off resets progress; not taken at 0.49 s.
  - `roomDirector.test.ts` (build a real `World` in `'run'` mode with no-op hooks; clear rooms with `director.debugClear(world)` until stage is `'reward'`): `doorEnteredOnce` — after clearing, moving the player onto a door for 10 updates calls `roomExited` exactly once; `noExitWhenDead` — a dead player on a door never calls it; `rewardPedestals` — a cleared weapon room spawns 3 pedestals and none of them is a held weapon; `finalBossWins` — clearing F3 boss calls `runWon` and spawns no doors.
  - Existing behaviour: `WaveDirector` labels stay `'WAVE n'` / `'WAVE CLEAR'`.
- [ ] **Step 2:** FAIL. **Step 3:** Implement (if `World` can't be constructed under Node because of a DOM dependency, inject or lazily access that dependency; don't mock `World`).
- [ ] **Step 4:** `npm test` + `npm run build` → PASS. `npm run dev`: Arcade and Zen look and play the same (banner, HUD label, boss bar).
- [ ] **Step 5: Commit** `"Add RoomDirector, doors and reward pedestals behind a Director interface"`

---

### Task 7: Rogue Run in PlayState, pickups, pause

**Files:**
- Modify: `src/states/play.ts`, `src/world/pickups.ts`, `src/states/pause.ts`

**Interfaces:**
- Consumes: `Run` (Task 5), `World(hooks, 'run', run)` and hooks (Task 6).
- Produces: `new PlayState(game, 'run', run)`; `PlayState.run?: Run`.

- [ ] **Step 1:** `PlayState`: in `'run'` mode `reset()` uses `run.viewWidth` (never `preferredWidth()`), and the resize listener never resets a run. `roomExited(door)` → `run.captureFrom(player, score)`, `run.advance(door.option, door.side)`, `game.transition(() => new PlayState(game, 'run', run))`. Death → `run.captureFrom`, `run.finish('dead')`, push `RunOverState` (Task 8). `runWon` → after 2 s, `run.finish('victory')`, push `RunOverState`. Music intensity: boss room 2, else 1.
- [ ] **Step 2:** `PickupManager` in `'run'` mode: drop chance × `CONFIG.run.buffDropScale`; `roll()` excludes weapon kinds; boss kills drop only a health chip.
- [ ] **Step 3:** Pause in `'run'` mode: title `'RUN · PAUSED'`; replace RESTART with **ABANDON RUN** → `run.captureFrom`, `run.finish('abandoned')`, pop pause, push `RunOverState`.
- [ ] **Step 4:** `npm run build` → PASS. (Playable check happens in Task 9.)
- [ ] **Step 5: Commit** `"Wire Rogue Run into PlayState, pickups and pause"`

---

### Task 8: Run-over screen, title entry, debug keys

**Files:**
- Create: `src/states/runOver.ts`
- Modify: `src/states/title.ts`, `src/input/bindings.ts`, `src/states/play.ts`, `src/world/roomDirector.ts`

**Interfaces:**
- Consumes: `RoomDirector.debugClear(w)` (Task 6).
- Produces: `class RunOverState implements GameState { constructor(game: Game, play: PlayState) }` (overlay); `Action.DEBUG_CLEAR`, `Action.DEBUG_BOSS`.

- [ ] **Step 1:** `RunOverState` mirrors `GameOverState`'s look: title **FLATLINED** (dead, red glitch) / **RUN COMPLETE** (victory, cyan) / **RUN ABANDONED** (magenta); rows **REACHED** `FLOOR f · ROOM r` (or `FLOOR f · BOSS`), **SCORE**, **KILLS**, **ROOMS CLEARED**; menu **NEW RUN** (transition to a fresh `Run` at the current preferred width) and **MAIN MENU**. Same 0.8 s input delay.
- [ ] **Step 2:** Title menu: insert **ROGUE RUN** after START, hint `'Room by room, 3 floors. Build your loadout — one life.'`, runs `game.transition(() => new PlayState(game, 'run', new Run(game.display.preferredWidth())))`.
- [ ] **Step 3:** Add `Action.DEBUG_CLEAR` (keyboard `KeyK`) and `Action.DEBUG_BOSS` (keyboard `KeyB`) with empty gamepad/mouse bindings, not listed on the Controls screen. In `PlayState.update`, only when `game.debug` and mode `'run'`: DEBUG_CLEAR calls `debugClear(world)`; DEBUG_BOSS sets `run.room` to the current floor's boss room and transitions.
- [ ] **Step 4:** `npm test` + `npm run build` → PASS.
- [ ] **Step 5: Commit** `"Add run-over screen, ROGUE RUN title entry and debug keys"`

---

### Task 9: Playthrough verification and README

**Files:**
- Modify: `README.md` (add a "Rogue Run" section under How to play: flow, doors, pedestals, no ammo limit, debug keys K/B)

- [ ] **Step 1:** Browser preview (desktop): start ROGUE RUN; clear F1 R1 with real play; take a weapon pedestal (0.5 s ring); walk through the door; confirm HP and weapons carry over and the HUD shows `F1 · R2`. Use K/B to reach F1 boss, kill it, confirm +2 HP and `NEXT FLOOR`; reach F3 boss and confirm the victory screen. Die once to confirm FLATLINED; abandon once from pause.
- [ ] **Step 2:** Repeat a room transition in each graphics mode (HD-2D, 2.5D, flat): doors and pedestals are visible and enterable.
- [ ] **Step 3:** Mobile viewport (375×812 landscape via resize, touch): doors/pedestals usable with the virtual stick; rotating between rooms doesn't change the arena width (Review Focus 1); pausing on the reward stage and resuming works (Review Focus 4); holding fire through a door (Review Focus 5).
- [ ] **Step 4:** Arcade and Zen smoke test: one wave each, HUD and banner unchanged.
- [ ] **Step 5:** `npm test` + `npm run build` → PASS.
- [ ] **Step 6: Commit** `"Document Rogue Run (phase 1)"`
