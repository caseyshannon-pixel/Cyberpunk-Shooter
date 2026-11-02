# NEON//GRID — Rogue Run mode (design)

Date: 2026-11-02 · Status: approved in chat, awaiting spec review

## Goal

Add a third game mode, **ROGUE RUN**, next to Arcade and Zen: a room-to-room
roguelike in the style of Hades / Enter the Gungeon. A run is three floors of
arena rooms; after each room you choose a door by what's behind it, build up
weapons and stacking mods, fight a boss at the end of each floor, and start
over when you die. Data shards earned in each run unlock new weapons and mods
for future runs.

**Success:** a full winning run takes ~15–20 minutes, plays well on
controller, keyboard & mouse and iPhone touch, works in every graphics mode
(HD-2D, 2.5D, flat), and runs feel different because of door choices and
builds. Arcade and Zen behave exactly as before.

## Non-goals

- Scrolling or connected levels, minimaps, backtracking.
- Brand-new boss designs (floor bosses are Warden variants; new bosses can
  follow later).
- Saving a run in progress (closing the tab ends the run).
- Permanent stat upgrades between runs (unlocks only widen the reward pool).
- Online leaderboards or shared seeds.

## 1. Run flow

- Title screen gains **ROGUE RUN** (starts a run) and **UNLOCKS** entries,
  plus a line showing shards, deepest floor reached and wins.
- A run is **3 floors**. Each floor is **rooms 1–6, then the boss room (7)**.
- The player starts with the Pulse Pistol, **5 max HP**, 0 credits.
- **HP carries over between rooms.** Beating a floor boss heals 2 HP, then a
  "FLOOR 2 · DATA CORE" banner introduces the next floor.
- **Death ends the run** → run-over screen: floor/room reached, kills, score,
  shards earned (shards are banked immediately).
- Beating the floor-3 boss → victory screen (same stats + victory shard bonus).
- Pause menu in a run: Resume · Settings · **Abandon Run** (ends the run like a
  death; shards earned so far are kept).

## 2. Rooms and doors

### Room types

| Type | Contents | On clear |
|---|---|---|
| **Combat** | 1–3 waves from the floor's enemy pool | The reward shown on the door you took, +10 credits |
| **Elite** | 1–2 waves including 1–2 **elite** enemies | Choice of 3 mods, +30 credits, +3 shards |
| **Shop** | No enemies | Buy items with credits (see below); doors open immediately |
| **Rest** | No enemies | Choose: heal 2 HP **or** +1 max HP (two pedestals) |
| **Boss** | The floor's boss + escorts | Heal 2 HP, +10 shards, single exit to the next floor |

**Elite enemies:** an existing enemy kind with 2.5× HP, 1.2× radius, a gold
outline, and a guaranteed credits drop.

### Waves and scaling (starting values, all in `CONFIG.run`)

- Waves per combat room: floor 1 → 1–2, floor 2 → 2, floor 3 → 2–3.
- Wave budget: `6 + floor × 4 + room × 1.5` (spent like today's wave budget).
- Enemy HP scale: `1 + (floor − 1) × 0.35 + room × 0.04`; speed scales gently.
- Enemy pool: floor 1 drone/gunner/splitter; floor 2 adds bruiser;
  floor 3 same pool, elites appear in normal combat rooms (~1 per room).
- Enemies are telegraphed exactly as today (spawn markers away from the player).

### Doors

- When a room is cleared (and its reward taken or left), **2 doors** open in
  the walls (**3 doors** with 30% chance). Doors are never on the wall the
  player entered from.
- Each door shows an icon and label for what it leads to: **WEAPON**, **MOD**,
  **CREDITS**, **REPAIR** (combat rooms with that reward), **ELITE**, **SHOP**,
  **REST**, **BOSS**.
- Walking into a door fades to the next room; the player enters from the
  opposite wall.

### Floor plan rules (generated per room from the run's seeded RNG)

- Room 1 of each floor is Combat. Its reward is **WEAPON** on floor 1, **MOD**
  on floors 2–3.
- **SHOP** is offered as one door in exactly one of rooms 3–5 (exits of rooms
  2–4). If the player skips it, there's no other shop that floor.
- **REST** is offered at most once per floor, only as an exit of rooms 4–5.
- **ELITE** is offered at most twice per floor, never as an exit of room 1.
- Room 6's only exit is **BOSS**.
- No two doors in the same set lead to the same type + reward.

### Layouts

- ~8 hand-made obstacle layouts in `src/run/rooms.ts`, defined relative to the
  arena centre with horizontal offsets scaled by width (as `Arena.buildLayout`
  does today), so wide screens get wider layouts. Shop, rest and boss rooms use
  open layouts.
- Doors need clear space in front of them; layouts keep wall centres free.

## 3. Rewards, weapons, mods, credits

### Taking a reward

When the last enemy dies, **reward pedestals** rise near the room centre
(3 for WEAPON/MOD/elite; 1 for CREDITS/REPAIR). Standing near a pedestal shows
its name and one-line description. **Standing on a pedestal for 0.5 s** (a ring
fills) takes it; the other pedestals vanish. This avoids accidental picks and
works the same for controller, keyboard and touch, with no menu.

### Weapons in a run

- **No ammo limit** in Rogue Run (weapons are kept for the whole run).
- Carry the Pulse Pistol plus **up to 2** other weapons. Taking a weapon with
  both slots full **replaces the equipped one** (or the most recently taken one,
  if the Pistol is equipped).
- Weapons already held are never offered.
- Normal enemy drops in a run: **credits** plus the existing buffs (Overclock,
  Shield, EMP, Health) at **half** their normal chance. No weapon drops.

### Mods

Mods stack up to a per-mod maximum. Each is data (`MOD_DEFS` in `config.ts`):
stat mods fold into a single `RunStats` object read by the weapon/player code;
event mods hook into kill / dash / room-start events.

**Unlocked from the start (10):**

| Mod | Effect per stack | Max |
|---|---|---|
| OVERVOLT | +25% damage | 4 |
| RAPID CYCLE | +20% fire rate | 4 |
| SPLIT SHOT | +1 projectile per shot (projectile weapons) | 3 |
| PHASE ROUNDS | +1 pierce (projectile weapons) | 3 |
| BOUNCE CORE | +1 wall bounce (projectile weapons) | 3 |
| HEAVY CALIBER | +30% projectile size, +15% damage | 2 |
| BLINK DRIVE | −20% dash cooldown | 3 |
| REINFORCED HULL | +1 max HP and heal 1 | 3 |
| AEGIS | Start each room with +1 shield hit | 2 |
| SCAVENGER | +50% credits gained | 2 |

**Unlockable (8):**

| Mod | Effect per stack | Max |
|---|---|---|
| NANO LEECH | Heal 1 HP every 25 kills (20 / 15 at 2 / 3 stacks) | 3 |
| VOLATILE | Killed enemies explode (60 px radius, 1 dmg per stack) | 3 |
| CHAIN REACTION | Each kill arcs lightning to 1 more nearby enemy per stack | 3 |
| AFTERBURN | Dash leaves a fire trail (1 dmg per stack every 0.25 s, 1.5 s) | 2 |
| EMP DASH | Dash ends with a small pulse: clears enemy bullets within 90 px, stuns 0.6 s | 1 |
| OVERCLOCK LOOP | Each room starts with 3 s Overclock per stack; Overclock pickups last 2× | 2 |
| VELOCITY | +25% projectile speed and range | 2 |
| COMBO DRIVER | +5% damage per combo level per stack | 2 |

"Projectile weapons" means `mode: 'projectile'` (Pulse, Spread, Homing,
Ricochet, Nova). Rail and Arc get damage, fire-rate and size mods only. Mods
that can't affect any weapon you hold are still offered (builds can change).

### Credits and shop

- Credits drop from enemies (small chips, magnetised like pickups) and +10 per
  combat room cleared (+30 elite). SCAVENGER multiplies all credit gains.
- Shop: 3 item pedestals (1 weapon, 2 mods) with price tags plus a repair
  pedestal. Starting prices: weapon 60, mod 50, repair (+1 HP) 30, each in
  `CONFIG.run`. Buying uses the same 0.5 s stand-to-take; a pedestal you can't
  afford shows its price in red and can't be taken. Several items can be bought.

## 4. Floors and bosses

| Floor | Theme | Boss |
|---|---|---|
| 1 | **Neon District** (current magenta/cyan look) | **Warden Mk I** — today's Warden, 280 HP |
| 2 | **Data Core** (green/teal tint) | **Warden Mk II** — 420 HP, starts enraged, summons gunners |
| 3 | **Black ICE** (red/white tint) | **Overseer** — 600 HP, three phases (at 66% / 33%): adds the spiral, then bruiser summons |

- Themes change the floor-grid and skyline tint colours and the room banner;
  geometry and readability stay the same. Boss tiers are config on the existing
  boss behaviour (`CONFIG.run.bosses`), not new boss code paths where avoidable.
- Music: combat rooms intensity 1, boss rooms 2, shop/rest 0 (calm).

## 5. Unlocks between runs (meta-progression)

- **Data shards** are earned per run: +1 per room cleared, +3 per elite room,
  +10 per boss, +15 for winning. Banked when the run ends.
- **UNLOCKS** screen (title menu): a list of locked items with costs; buying
  one adds it to the reward pool for all future runs.
  - Weapons: Spread, Homing, Ricochet available from the start; **Rail (40),
    Arc (50), Nova (60)** locked.
  - Mods: the 8 unlockable mods, 25–60 shards each (costs in `CONFIG.run`).
- Saved via the existing `storage` wrapper (never throws) under
  `neon-grid.run.shards`, `neon-grid.run.unlocks` (JSON list of ids),
  `neon-grid.run.deepest` and `neon-grid.run.wins`. Corrupt or missing data
  falls back to a fresh profile.

## 6. Architecture

`World` stays "everything in one fight"; in Rogue Run it represents **one
room**. A new `Run` object owns everything that persists across rooms and
builds a fresh `World` per room behind the existing `game.transition` fade.

### New modules

| File | Responsibility |
|---|---|
| `src/core/rng.ts` | Small seeded RNG (mulberry32) for run generation |
| `src/run/run.ts` | `Run`: seed/RNG, floor, room, current room spec, player carry-over (HP, max HP, held weapons, mod stacks), credits, run score/kills, shards earned |
| `src/run/floorPlan.ts` | Pure: given run state + RNG → the door options leaving the current room (enforces the floor rules above) |
| `src/run/rooms.ts` | Room types, obstacle layouts, per-floor themes and wave settings |
| `src/run/mods.ts` | `MOD_DEFS` lookup, `computeStats(stacks) → RunStats`, event-mod helpers |
| `src/run/rewards.ts` | Pure: roll reward / shop choices from the unlocked pool, excluding held weapons and maxed mods |
| `src/run/meta.ts` | Load/save shards, unlocks, deepest floor, wins |
| `src/world/roomDirector.ts` | Per-room flow: waves → clear → pedestals → doors; same role as `WaveDirector` |
| `src/entities/door.ts` | Door gate: position on a wall, label/icon, open animation, enter detection, rendering in all graphics modes |
| `src/entities/pedestal.ts` | Reward/shop pedestal: item, price, stand-to-take ring |
| `src/states/runOver.ts` | Run-over / victory summary |
| `src/states/unlocks.ts` | Unlocks screen |

### Changes to existing code

- `GameMode` gains `'run'`. `PlayState` takes an optional `Run`; in run mode it
  builds `World` with the run and room spec, and on door entry calls
  `game.transition(() => new PlayState(game, 'run', run))`.
- `World` takes an optional run + room spec; uses `RoomDirector` instead of
  `WaveDirector` in run mode. Code that reads `world.waves` goes through a small
  shared director interface (wave number / banner / remaining / markers).
- `Arena` accepts a layout (default = today's layout, so Arcade/Zen are unchanged).
- `Arsenal` gets an "infinite ammo, max 2 extra slots" run configuration.
- Weapon firing (`fire.ts`, `weaponSystem.ts`) and `Player` read `RunStats`
  multipliers (all 1/0 outside run mode).
- `PickupManager` adds a credits pickup and the run-mode drop rules.
- HUD: floor/room indicator ("F2 · R4"), credits, and a row of mod chips with
  stack counts; boss bar reused.
- Title and pause menus get the new entries.
- Debug overlay (backtick/F3) in run mode adds two keys: **clear room** and
  **skip to boss**, for testing.

### Data flow per room

1. `Run` holds the next `RoomSpec` (type, reward, floor, index, layout id).
2. `PlayState` builds `World(run, spec)`: arena from the layout, player at the
   entry wall with carried HP/weapons/mods; `RoomDirector` starts waves.
3. Kills feed score, credits, shards and event mods; on clear, `RoomDirector`
   spawns pedestals (via `rewards.ts`), then doors (via `floorPlan.ts`).
4. Taking a pedestal mutates `Run` (weapon/mod/HP/credits). Entering a door
   writes the player's state back to `Run`, sets the next `RoomSpec`, and
   transitions.
5. Death / abandon / victory → `meta.ts` banks shards and records stats →
   `RunOverState`.

### Error handling

- Storage failures: run state is in memory; meta saves are best-effort (the
  existing wrapper never throws); corrupt saved JSON → fresh profile.
- Reward pool exhausted (everything held/maxed): fall back to CREDITS/REPAIR
  pedestals so a room never has an empty reward.
- Screen resize mid-run: the view width is locked at run start (as today) and
  reused for every room in the run.

## 7. Testing

- Add **Vitest** (dev dependency, `npm test`) for the pure logic:
  - floor plan rules (shop exactly once in rooms 3–5, rest ≤ 1, elite ≤ 2,
    room 6 → boss only, no duplicate doors) over many seeds;
  - reward rolls respect unlocks, never offer held weapons or maxed mods,
    and fall back when the pool is empty;
  - `computeStats` stacking and caps;
  - meta save/load round-trip and corrupt-data fallback;
  - run-mode arsenal (infinite ammo, slot cap, replacement rule).
- Each phase is also played in the browser preview (desktop + mobile
  viewport): rooms, doors, rewards, death, victory, in all three graphics modes.
- `npm run build` (type-check + build) must pass after every phase.

## 8. Build phases (each ends playable)

1. **Run skeleton** — `Run`, rooms + layouts, `RoomDirector`, doors, floor
   plan, combat rooms with WEAPON rewards (pedestals), run-mode arsenal, three
   floors with Warden Mk I as every boss, run-over/victory screens, title entry,
   debug keys, Vitest set up.
2. **Mods** — `MOD_DEFS`, `RunStats`, the 10 starting mods, MOD rewards and
   doors, HUD mod chips.
3. **Room variety** — elites, shop + credits, rest, CREDITS/REPAIR rewards,
   full floor plan rules.
4. **Floors and bosses** — floor themes, Warden Mk II and Overseer, per-floor
   enemy pools and scaling, music intensity per room type.
5. **Meta-unlocks** — shards, unlocks screen, locked weapons/mods (the 8
   unlockable mods are implemented here), title stats line.

Until phase 5 lands, every weapon is in the reward pool (nothing is locked yet).

All work happens on the `roguelike` branch; nothing is pushed without asking.
