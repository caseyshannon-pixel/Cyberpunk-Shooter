# Rogue Run — Phase 2 (Mods) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stacking mods in Rogue Run: 9 starting mods offered as MOD rewards (from MOD doors and the first room of floors 2–3), applied to every weapon / the dash / the hull, carried between rooms, and shown in the HUD.

**Architecture:** Mods are data (`MOD_DEFS` in `config.ts`). A run's mod stacks live in `Run.carry.mods`; `computeStats(stacks)` folds them into one `RunStats` object that `World` holds (neutral outside runs). Weapon firing goes through a pure `applyStats(def, stats) → WeaponDef`, so the existing fire code is untouched. Rewards become a `Reward` union (weapon | mod) so pedestals, rolls and the HUD handle both.

**Tech Stack:** TypeScript 5.9, Vite 8, Canvas, Vitest 5.

**Spec:** `docs/superpowers/specs/2026-11-02-roguelike-mode-design.md` §3 "Mods" and §8 phase 2. Builds on phase 1 (`docs/superpowers/plans/2026-11-02-rogue-run-phase-1.md`, merged).

## Global Constraints

- Arcade and Zen must behave exactly as before: `World.stats` is `NEUTRAL_STATS` there and `applyStats(def, NEUTRAL_STATS)` returns an equal def.
- Every tunable number lives in `src/config.ts` (`MOD_DEFS`, `CONFIG.run`).
- "Projectile weapons" = `mode: 'projectile'` (Pulse, Spread, Homing, Ricochet, Nova). Rail and Arc get damage and fire-rate mods; Rail also gets size (beam width). (Spec §3.)
- Mods that can't affect any held weapon are still offered (spec §3).
- **SCAVENGER moves to phase 3** (it multiplies credits, which arrive in phase 3). Phase 2 ships the other 9 starting mods.
- `npm test` and `npm run build` pass at the end of every task. Work on a new branch `rogue-run-phase-2` from `phase-1-scaffold`; never push.

## Review Focus

1. **Arcade/Zen untouched by mods:** neutral stats must produce an identical weapon def and dash cooldown → Task 2 test `neutral stats change nothing`.
2. **REINFORCED HULL at full and partial health:** +1 max HP and +1 HP (never above the new max); HUD pips, the room label and mod chips must not overlap at 8 max HP → Task 4 test `hull raises max HP and heals`; Task 6 visual check.
3. **Reward pool exhausted:** every mod maxed → MOD room offers weapons; weapons and mods both exhausted → no pedestals, doors still open → Task 4 test `rollRewards falls back`.
4. **SPLIT SHOT on unusual weapons:** Nova (full ring) stays a ring with one more shot; Spread's fan keeps its width; single-shot weapons fan out by `splitSpacing` → Task 2 tests.
5. **Mods survive every way of changing rooms:** doors, floor change, debug skip-to-boss (B), and a mod taken in a room is active immediately → Task 3 / Task 4 tests.

---

### Task 1: Mod definitions and `computeStats`

**Files:**
- Modify: `src/config.ts` (add `MOD_DEFS`, expose as `CONFIG.mods`; add `CONFIG.run.splitSpacing: 0.14`)
- Create: `src/run/mods.ts`
- Test: `src/run/mods.test.ts`

**Interfaces:**
- Produces:
  ```ts
  // config.ts — each entry: { name, short (≤4 chars, HUD chip), blurb, color, max, effect }
  // effect fields (per stack): damage?, fireRate?, projectiles?, pierce?, bounces?, size?, dashCooldown? (multiplier per stack), maxHealth?, shieldPerRoom?
  overvolt:  { name: 'OVERVOLT', short: 'VOLT', blurb: '+25% damage', color: '#ff3355', max: 4, effect: { damage: 0.25 } }
  rapid:     { name: 'RAPID CYCLE', short: 'RPD', blurb: '+20% fire rate', color: '#ffe14d', max: 4, effect: { fireRate: 0.2 } }
  split:     { name: 'SPLIT SHOT', short: 'SPLT', blurb: '+1 projectile per shot', color: '#7dff4d', max: 3, effect: { projectiles: 1 } }
  phase:     { name: 'PHASE ROUNDS', short: 'PHS', blurb: 'Shots pierce +1 enemy', color: '#b18cff', max: 3, effect: { pierce: 1 } }
  bounce:    { name: 'BOUNCE CORE', short: 'BNC', blurb: 'Shots bounce off walls +1', color: '#ff9a1f', max: 3, effect: { bounces: 1 } }
  heavy:     { name: 'HEAVY CALIBER', short: 'HVY', blurb: '+30% shot size, +15% damage', color: '#ff2bd6', max: 2, effect: { size: 0.3, damage: 0.15 } }
  blink:     { name: 'BLINK DRIVE', short: 'BLNK', blurb: '−20% dash cooldown', color: '#00f0ff', max: 3, effect: { dashCooldown: 0.8 } }
  hull:      { name: 'REINFORCED HULL', short: 'HULL', blurb: '+1 max HP and heal 1', color: '#ff4d6d', max: 3, effect: { maxHealth: 1 } }
  aegis:     { name: 'AEGIS', short: 'AEG', blurb: 'Start each room with +1 shield hit', color: '#4d9dff', max: 2, effect: { shieldPerRoom: 1 } }
  ```
  ```ts
  // src/run/mods.ts
  export type ModId = keyof typeof CONFIG.mods;
  export const MOD_IDS: readonly ModId[];
  export type ModStacks = Partial<Record<ModId, number>>;
  export interface RunStats { damageMult: number; fireRateMult: number; extraProjectiles: number; pierce: number; bounces: number; sizeMult: number; dashCooldownMult: number; shieldPerRoom: number; }
  export const NEUTRAL_STATS: Readonly<RunStats>;          // 1,1,0,0,0,1,1,0
  export function computeStats(stacks: ModStacks): RunStats; // additive: 1 + Σ(damage), 1 + Σ(fireRate), 1 + Σ(size); counts summed; dashCooldownMult = Π(dashCooldown^n); stacks clamped to each mod's max
  export function canStack(stacks: ModStacks, id: ModId): boolean;  // (stacks[id] ?? 0) < max
  ```
  `maxHealth` is not a `RunStats` field: it's applied once, when the mod is taken (Task 4).

- [ ] **Step 1: Write failing tests** (`mods.test.ts`): `no mods → NEUTRAL_STATS`; `overvolt ×2 + heavy ×1 → damageMult 1.65, sizeMult 1.3`; `blink ×2 → dashCooldownMult 0.64`; `split ×3 → extraProjectiles 3`; `stacks above max are clamped` (overvolt 9 → damageMult 2); `canStack false at max`; `every MOD_DEFS entry has a short of ≤ 4 chars and max ≥ 1`.
- [ ] **Step 2:** `npm test` → FAIL (module missing). **Step 3:** Implement. **Step 4:** `npm test` + `npm run build` → PASS.
- [ ] **Step 5: Commit** `"Add mod definitions and RunStats"`

---

### Task 2: Stats applied to weapons and the dash

**Files:**
- Create: `src/weapons/stats.ts`
- Modify: `src/weapons/weaponSystem.ts`, `src/entities/player.ts`, `src/world/world.ts` (field `stats: RunStats = NEUTRAL_STATS`)
- Test: `src/weapons/stats.test.ts`, `src/entities/player.test.ts`

**Interfaces:**
- Consumes: `RunStats`, `NEUTRAL_STATS` (Task 1).
- Produces:
  ```ts
  export function applyStats(def: WeaponDef, s: RunStats): WeaponDef;
  // all modes: damage × damageMult, fireRate × fireRateMult
  // rail: beamWidth × sizeMult
  // projectile: projectileRadius × sizeMult, pierce + s.pierce, bounces + s.bounces,
  //   count + extraProjectiles; full ring (arc ≥ 2π) keeps its arc; otherwise arc = max(arc, splitSpacing × (count − 1))
  // returns `def` itself when s is NEUTRAL_STATS (identity)
  class Player { dashCooldownMult = 1; /* dash start uses P.dash.cooldown × dashCooldownMult; dashReady divides by the same */ }
  class World { stats: RunStats }  // NEUTRAL_STATS unless a run sets it (Task 3)
  ```
  `updateWeapons` reads `const def = applyStats(ars.def, w.stats)` once per tick and uses it for fire rate, charge, `fireProjectiles`, `fireRail`, `fireArc`.

- [ ] **Step 1: Write failing tests:**
  - `stats.test.ts`: `neutral stats change nothing` (every `WEAPON_IDS` def `toBe` the same object); `damage and fire rate scale every weapon` (rail and arc included); `pulse with +1 projectile fans out by splitSpacing` (count 2, arc 0.14); `spread keeps its fan width` (count 6, arc 0.62); `nova stays a ring` (count 19, arc 2π); `pierce and bounces add only to projectile weapons` (rail def has no pierce); `size scales projectile radius and rail beam width`.
  - `player.test.ts` (minimal fake `Input` cast: `move {0,0}`, `getAimDirection → false`, `pressed(a) → a === 'DASH'`, `isDown → false`, `rumble() {}`): `dash cooldown is scaled by dashCooldownMult` (mult 0.5 → `dashCooldown === 0.425` after one update) and `dashReady uses the scaled cooldown`.
- [ ] **Step 2:** FAIL. **Step 3:** Implement. **Step 4:** `npm test` + build → PASS.
- [ ] **Step 5: Commit** `"Apply run stats to weapons and the dash"`

---

### Task 3: Mods carried by the run

**Files:**
- Modify: `src/run/run.ts`, `src/world/world.ts`
- Test: `src/run/run.test.ts`, `src/world/roomDirector.test.ts`

**Interfaces:**
- Consumes: `ModStacks`, `computeStats`, `canStack` (Task 1); `World.stats`, `Player.dashCooldownMult` (Task 2).
- Produces:
  ```ts
  interface Carry { …; mods: ModStacks }          // starts {}
  class Run { addMod(id: ModId): boolean }        // false (no change) when maxed
  ```
  `captureFrom` keeps `carry.mods` (it rebuilds the other fields). In run mode the `World` constructor sets `stats = computeStats(run.carry.mods)`, `player.dashCooldownMult = stats.dashCooldownMult`, and `player.shield = stats.shieldPerRoom` (with `shieldHitAge = 1`) when > 0.

- [ ] **Step 1: Write failing tests:** `run.test.ts` — `mods survive captureFrom/applyTo and advance` (addMod overvolt twice, capture, advance through a boss, still `{ overvolt: 2 }`); `addMod refuses past max`; `debugSkipToBoss keeps mods`. `roomDirector.test.ts` — `a run room starts with the run's stats` (carry `{ blink: 1, aegis: 2 }` → `w.stats.dashCooldownMult 0.8`, `w.player.dashCooldownMult 0.8`, `w.player.shield 2`).
- [ ] **Step 2:** FAIL. **Step 3:** Implement. **Step 4:** PASS + build.
- [ ] **Step 5: Commit** `"Carry mod stacks through a run"`

---

### Task 4: MOD rewards — rolls, pedestals, doors, taking a mod

**Files:**
- Modify: `src/run/rooms.ts` (`RoomReward` adds `'mod'`), `src/run/floorPlan.ts`, `src/run/rewards.ts`, `src/entities/pedestal.ts`, `src/world/roomDirector.ts`, `src/entities/door.ts` (MOD door colour `COLORS.lime`), `src/ui/hud.ts` (`renderPedestalInfo` switches to `rewardInfo` so the build stays green)
- Test: `src/run/floorPlan.test.ts`, `src/run/rewards.test.ts`, `src/run/run.test.ts`, `src/entities/pedestal.test.ts`, `src/world/roomDirector.test.ts`

**Interfaces:**
- Consumes: Tasks 1–3.
- Produces:
  ```ts
  // rewards.ts
  export type Reward = { kind: 'weapon'; id: WeaponId } | { kind: 'mod'; id: ModId };
  export function rollModChoices(rng: Rng, stacks: ModStacks, n: number): ModId[];   // distinct, excludes maxed
  export function rollRewards(rng: Rng, reward: RoomReward, held: readonly WeaponId[], stacks: ModStacks, n: number): Reward[];
  //   'weapon' → weapons, falling back to mods if none; 'mod' → mods, falling back to weapons; 'none' → []
  // floorPlan.ts
  OFFERABLE = [WEAPON door, { type: 'combat', reward: 'mod', label: 'MOD' }]
  NEXT FLOOR door reward = 'mod'   // so room 1 of floors 2–3 is a MOD room (spec §2)
  // pedestal.ts
  class Pedestal { constructor(reward: Reward, x: number, y: number); readonly reward: Reward }   // replaces `weapon`
  export function rewardInfo(r: Reward, stacks: ModStacks): { name: string; blurb: string; color: string; short: string };
  //   mod name gets its next stack, e.g. 'OVERVOLT 2/4'
  ```
  `renderPedestal` draws a weapon as today's diamond and a mod as a rounded square chip with its `short`, both in `rewardInfo` colour. `RoomDirector.roomCleared` uses `rollRewards(run.rng, run.room.reward, …)`. Taking a mod: `run.addMod(id)`, `w.stats = computeStats(run.carry.mods)`, `player.dashCooldownMult` refreshed; `hull` also does `maxHealth += 1; health = min(maxHealth, health + 1)`. Popup shows the mod name.

- [ ] **Step 1: Write failing tests:**
  - `floorPlan.test.ts`: `rooms 1–5 offer both WEAPON and MOD doors` (over 200 seeds, every exit set has both); `NEXT FLOOR leads to a MOD room`. `run.test.ts`: `room 1 of floor 2 is a MOD room`.
  - `rewards.test.ts`: `mod choices exclude maxed mods and are distinct`; `rollRewards falls back` (all mods maxed + 'mod' → 3 weapons; all mods maxed and all weapons held → []).
  - `pedestal.test.ts`: existing tests switch to `new Pedestal({ kind: 'weapon', id: 'spread' }, …)`; `rewardInfo names the next stack` (`overvolt` at 1 stack → `'OVERVOLT 2/4'`).
  - `roomDirector.test.ts`: `a MOD room offers mods`; `taking a mod applies it immediately` (take overvolt → `w.stats.damageMult 1.25`, `run.carry.mods.overvolt 1`); `hull raises max HP and heals` (health 3/5 → 4/6; health 5/5 → 6/6).
- [ ] **Step 2:** FAIL. **Step 3:** Implement. **Step 4:** PASS + build.
- [ ] **Step 5: Commit** `"Offer MOD rewards: doors, pedestals and taking mods"`

---

### Task 5: HUD — mod chips and mod info

**Files:**
- Modify: `src/ui/hud.ts`

**Interfaces:**
- Consumes: `rewardInfo` (Task 4), `World.run`.
- Produces: `renderModChips(ctx, world)` (run mode only): a row under the health pips at y = 44, x from 48, one chip per held mod in `MOD_IDS` order — mod colour outline, `short`, and `×n` when n > 1; 6 px gap.

- [ ] **Step 1:** Implement (canvas drawing; verified visually in Task 6 — no unit test).
- [ ] **Step 2:** `npm run build` → PASS.
- [ ] **Step 3: Commit** `"HUD: mod chips and mod pedestal info"`

---

### Task 6: Playthrough verification and README

**Files:**
- Modify: `README.md` (Rogue Run section: MOD doors, the 9 mods table, stacking; SCAVENGER noted as coming with credits)

- [ ] **Step 1:** Browser preview (`neon-grid` config; the pane may be hidden, so drive with JS key events + debug F3/K/B): start a run; clear F1 R1 (WEAPON) and confirm both WEAPON and MOD doors; take the MOD door; clear; confirm 3 mod pedestals with names `… 1/n`; take OVERVOLT and see the chip; take SPLIT SHOT in a later room and see the Pulse Pistol fire 2 shots; take REINFORCED HULL and see 6 pips without overlapping the room label or chips; skip to boss (B) and confirm chips persist; next floor's room 1 offers mods.
- [ ] **Step 2:** Arcade and Zen smoke test (fire rate and shot count unchanged, no chips).
- [ ] **Step 3:** `npm test` + `npm run build` → PASS.
- [ ] **Step 4: Commit** `"Document Rogue Run mods (phase 2)"`
