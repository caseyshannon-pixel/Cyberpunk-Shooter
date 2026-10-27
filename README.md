# NEON//GRID

A cyberpunk top-down **twin-stick shooter** for the browser. Built with **Vite + TypeScript + HTML5 Canvas** — no game engine, no image or audio files: every sprite, effect, sound and the synthwave soundtrack is generated in code.

Survive escalating waves of drones, gunners, splitters and bruisers, with a **Warden** boss mech every 5 waves. Grab weapon drops and power-ups, chain kills for a score multiplier, and chase your high score — or switch to **Zen mode** and just flow.

Plays with a **controller**, **keyboard & mouse**, or **touch** (iPhone / iPad / Android) — and switches between them on the fly.

---

## Running it

Requires Node.js 20.19+ (or 22.12+).

```bash
npm install
npm run dev        # → http://localhost:5173
```

| Command | What it does |
|---|---|
| `npm run dev` | Dev server with hot reload |
| `npm run dev:lan` | Dev server over **HTTPS on your local network** — open the printed `Network:` URL on a phone/tablet |
| `npm run build` | Type-check (`tsc`) + production build into `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run typecheck` | Type-check only |

### Hosting

`npm run build` produces a fully static site in `dist/` with **relative paths**, so it can be uploaded anywhere: Vercel, Netlify, GitHub Pages, itch.io, or any web server (including a sub-folder).
On Vercel: framework *Vite*, build command `npm run build`, output directory `dist`.

---

## Controls

All bindings live in one file — [`src/input/bindings.ts`](src/input/bindings.ts) — and the in-game **Controls** screen and button prompts are generated from it, so they always match. Prompts switch automatically between keyboard, controller and touch glyphs (Xbox or PlayStation labels) based on what you touched last.

### Controller (W3C “standard” mapping — Xbox, PlayStation, Switch Pro, MFi…)

| Action | Xbox | PlayStation |
|---|---|---|
| Move | Left stick | Left stick |
| Aim **+ auto-fire** | Right stick (past the deadzone) | Right stick |
| Fire (in the facing direction) | RT | R2 |
| Dash (with i-frames) | LT or A | L2 or ✕ |
| Previous / next weapon | LB / RB | L1 / R1 |
| Pause | Menu | Options |
| Menus | D-pad / left stick, A select, B back | D-pad / left stick, ✕ select, ○ back |
| Debug overlay | View | Share |

- Radial deadzone (0.2) with rescaling, so movement ramps smoothly from the edge of the deadzone.
- **Hot-plug:** a toast appears when a controller connects/disconnects; unplugging mid-game auto-pauses.
- **Rumble** on hits, explosions, pickups and big kills (where the browser supports it; can be turned off in Settings).
- Browsers only reveal a controller after you **press a button on it** with the page focused.

### Keyboard & mouse

| Action | Keys |
|---|---|
| Move | **WASD** or arrow keys |
| Aim | Mouse |
| Fire | Left mouse button |
| Dash | **Space**, Left Shift, or right mouse button |
| Previous / next weapon | **Q / E** or mouse wheel |
| Pause | **Esc** or P |
| Full screen | **F** |
| Menus | Arrows / WASD, Enter or Space to select, Esc / Backspace to go back; the mouse can hover and click too |
| Debug overlay | **`** (backtick) or F3 |

### Touch (phones & tablets)

| Action | How |
|---|---|
| Move | Put your **left thumb anywhere on the left half** — a stick appears under it |
| Aim + auto-fire | **Right thumb anywhere on the right half** |
| Dash | **DASH** button (shows its cooldown) |
| Next weapon | **SWAP** button |
| Pause | **⏸** (top-right) |
| Full screen | **⛶** (top-left) — on iPhone this explains *Add to Home Screen* (see below) |
| Menus | Tap an option; tap a slider bar to set a volume |

---

## Apple devices (iPhone, iPad, Mac)

Runs in **Safari 14+** on iOS, iPadOS and macOS (and any current Chrome / Edge / Firefox).

- **iPhone full screen:** iPhone Safari can't hide its toolbars, so use **Share → Add to Home Screen** and launch NEON//GRID from the icon: it opens full-screen in landscape like an app. (On iPad and Mac, ⛶ / **F** toggles real fullscreen.)
- **Wide screens:** the arena widens to match the screen's shape (from 16:9 up to ~2.2:1), so iPhones fill edge to edge instead of showing black bars. The width is locked when a run starts.
- **Portrait:** phones/tablets held upright see a *rotate to landscape* prompt and the game pauses.
- **Sound** starts after your first tap or key press (a browser rule). If you only use a controller, press any key or tap once. **Settings → Sound in silent mode** decides whether the game plays when the ring/silent switch is on silent (on by default; needs a recent iOS).
- **Controllers** (Xbox, DualShock/DualSense, MFi) pair in iOS Settings → Bluetooth and work in Safari.
- **iPad keyboard + trackpad** play like a desktop (mouse aims, WASD moves).

### Testing on a phone or tablet from your computer

1. Put the device on the same Wi-Fi as the computer.
2. Run `npm run dev:lan` and open the printed `Network: https://…` URL in Safari on the device.
3. Accept the self-signed certificate warning (*Show Details → visit this website*).
   HTTPS is required because browsers only expose gamepads to secure pages.

---

## How to play

- **Waves** get bigger and tougher; a **WAVE X** banner announces each one, with a short breather in between. Enemies are telegraphed by a pulsing marker before they spawn, away from you.
- **Every 5th wave** brings the **Warden** boss: ring bursts, aimed double-cannon volleys, a telegraphed charge that ends in a shockwave, and a bullet spiral. Below half health it **enrages** (faster, summons drones).
- You have **5 hits**. Dashing gives brief invulnerability — dash *through* bullets.
- **Combo:** every 5 kills in a chain raises the score multiplier (up to ×8). Stop killing for 2.6 s and it starts dropping a level at a time; getting hit resets it.
- Game over saves your **high score** (shown on the title screen).

### Zen mode

Pick **ZEN MODE** on the title screen for a relaxed, no-fail session:

- **You can't be hurt** — a hit just shoves you back and breaks your combo. No health bar; the HUD shows your session time instead.
- **No waves, banners or bosses** — enemies trickle in continuously. The arena's population slowly **breathes** (rises and falls over an ~80 s cycle, starting quiet) and creeps up gently over time, with a cap. New enemy types join every 45 s.
- Weapons, Overclock and EMP drop a little more often; Health Chips and Shields don't drop (you don't need them).
- Calm soundtrack (pads and bass, no drums), half-strength screen shake.
- End whenever you like: **Pause → End Session** shows your time, kills and score. Zen keeps its **own best score**.

All Zen tuning lives in `CONFIG.zen` in [`src/config.ts`](src/config.ts).

### Enemies

| Enemy | Behaviour |
|---|---|
| **Drone** | Weaves straight at you |
| **Gunner** | Keeps its distance, strafes, and fires slow bullets after a visible charge-up |
| **Splitter** | Bursts into two fast Splitlings when killed |
| **Bruiser** | Slow and tanky; shows a red aim lane, then charges — and stuns itself if it hits a wall |
| **Warden** (boss) | Multi-pattern mech with a health bar; every 5 waves |

### Weapons (dropped by enemies — limited ammo, revert to the Pulse Pistol when empty)

| Weapon | |
|---|---|
| **Pulse Pistol** | Default, infinite: steady single shots |
| **Spread Shot** | 5-way fan |
| **Plasma Rail** | Hold to charge; the beam pierces every enemy in line and erases enemy bullets |
| **Homing Swarm** | Twin missiles that curve toward the nearest enemy |
| **Ricochet Disc** | Bounces off walls 3 times and passes through 2 enemies |
| **Arc Lightning** | Chains between nearby enemies |
| **Nova Burst** | 18-shot ring in every direction |

You can carry several weapons at once and cycle them (LB/RB · Q/E · wheel · SWAP).

### Pickups

| Pickup | Effect |
|---|---|
| **Overclock** | Double fire rate for 8 s |
| **Shield Matrix** | Hex shield that absorbs 3 hits |
| **Health Chip** | +1 HP (bonus points if already full) |
| **EMP** | Clears all enemy bullets and stuns every enemy |

Pickups pulse on the ground, drift toward you when you're close, and **flash before vanishing** after 10 s. The HUD shows the current weapon, its ammo bar, the weapons you're carrying, and countdown rings for active buffs.

### Settings (Title or Pause → Settings)

Master / music / sound-effects volume · screen-shake strength · 2.5D graphics · CRT scanline overlay · controller rumble · (iPhone/iPad) sound in silent mode. Changes apply instantly and are saved.

### 2.5D graphics (on by default)

The camera stays straight top-down, so aiming and hit boxes are exactly as before, but the arena gets real depth:

- Pillars, crates and the outer walls are **extruded neon blocks**. They lean away from a virtual camera above the arena and show their lit side faces. The camera point drifts gently with you, so the blocks shift in **parallax** as you move.
- Blocks cast **soft shadows** on the floor. Ships, enemies and pickups **hover over their own shadows**.
- Everything that glows **lights the floor** beneath it: your ship, enemies, every bullet and muzzle flashes.
- A **bloom** pass makes the neon bleed light.
- Raised blocks can hide what's behind them, but your ship shows through as an outline, so you never lose it.

Turn it off in Settings for the original flat look. If a device can't hold about 40 fps, bloom switches itself off for that session; the debug overlay shows `bloom auto-off`. Tune heights, camera, parallax and bloom in `CONFIG.depth`.

---

## Tuning

Every gameplay number — speeds, damage, fire rates, ammo, drop chances and weights, wave budgets, combo timing, buff durations, touch-control layout — lives in **[`src/config.ts`](src/config.ts)**. Change a value, save, and the dev server reloads.

---

## Adding a new weapon

Weapons are **data**. A typical new weapon needs only config.

1. **Define it** in `WEAPON_DEFS` at the top of [`src/config.ts`](src/config.ts). Fields are documented in [`src/weapons/types.ts`](src/weapons/types.ts):

   ```ts
   scatter: {
     name: 'SCATTER LASER', short: 'SCAT', blurb: 'Wide, fast, short-range burst.',
     color: '#ff6b3d', mode: 'projectile', behavior: 'basic',
     fireRate: 5, damage: 1, ammo: 50,
     projectileSpeed: 1100, projectileRadius: 3, count: 7, arc: 0.9, spread: 0.08, lifetime: 0.35,
     pierce: 1,  // optional: pass through one enemy
   },
   ```

   - `mode: 'projectile'` spawns bullets; `behavior` can be `'basic'`, `'homing'` (uses `turnRate`) or `'bounce'` (uses `bounces`). `pierce` works with any behaviour. `arc: TAU` fires a full ring.
   - `mode: 'rail'` is a charged piercing beam (`chargeTime`, `beamWidth`); `mode: 'arc'` is chain lightning (`range`, `cone`, `chains`, `chainRange`, `falloff`).

2. **Make it drop:** add a weight for it in `CONFIG.pickups.weights` (TypeScript will error until you do).

That's it — the pickup icon, HUD, Controls legend and inventory all pick it up automatically.

**Optional extras**
- **Sound:** add `'shoot_scatter'` to the `SfxName` union and a recipe to `RECIPES` in [`src/audio/sfx.ts`](src/audio/sfx.ts). Without one it uses the Pulse Pistol sound.
- **A new projectile behaviour:** add it to `ProjectileBehavior` in `types.ts`, implement the movement in `Projectiles.update` and its look in `renderProjectiles` ([`src/entities/projectile.ts`](src/entities/projectile.ts)).
- **A new fire mode:** add it to `FireMode`, write a `fireXxx()` in [`src/weapons/fire.ts`](src/weapons/fire.ts), and call it from [`src/weapons/weaponSystem.ts`](src/weapons/weaponSystem.ts).

---

## Adding a new enemy

1. **Stats** — add an entry to `CONFIG.enemies` in [`src/config.ts`](src/config.ts). Every enemy needs the shared fields; add any custom ones you like:

   ```ts
   sniper: {
     radius: 14, hp: 3, speed: 90, accel: 400, score: 300, knockback: 0.8, color: '#4dffd2',
     cost: 3, minWave: 6, weight: 1.5, dropChance: 0.15,   // spawner: budget cost, first wave, odds
     aimTime: 1.2, bulletSpeed: 480, bulletRadius: 5,      // custom
   },
   ```

   `cost` / `minWave` / `weight` are all the wave spawner needs — the new enemy starts appearing automatically. (`weight: 0` = never spawned by waves, e.g. Splitlings.)

2. **Behaviour** — write an AI function in [`src/entities/enemyAI.ts`](src/entities/enemyAI.ts) and register it in `ENEMY_AI` (TypeScript requires an entry for every kind). Each tick it sets a desired velocity and can attack; movement, knockback, separation, wall collision, contact damage, hit flash, death burst, drops and score are handled for you:

   ```ts
   function sniper(e: Enemy, w: World, dt: number): void {
     const S = CONFIG.enemies.sniper;
     const p = w.player;
     face(e, p.x, p.y);
     e.steer(0, 0);                         // stand still (or seek(e, w, x, y) to chase)
     e.timer += dt;
     if (e.timer > S.aimTime && w.arena.lineOfSight(e.x, e.y, p.x, p.y)) {
       w.fireEnemyBullet(e.x, e.y, e.angle, S.bulletSpeed, S.bulletRadius);
       e.timer = 0;
     }
   }
   ```

   Handy scratch fields on every `Enemy`: `state`, `timer`, `cooldown`, `dirX/dirY`, `strafe`. Helpers in the same file: `seek()` (steers around obstacles) and `face()`.

3. **Look** — add a `case 'sniper':` to the `switch` in `renderEnemy` ([`src/entities/enemy.ts`](src/entities/enemy.ts)). Draw around (0, 0) and use `neonStroke()` for the glowing outline; use `color` (it turns white during the hit flash).

4. *(Optional)* For special death behaviour (like the Splitter splitting), see `killEnemy` in [`src/world/world.ts`](src/world/world.ts).

---

## Project structure

```
src/
  main.ts            boot: display, input, game, fixed-step loop
  config.ts          ALL tunable numbers + weapon definitions
  settings.ts        player settings (volume, shake, CRT…) saved to localStorage
  game.ts            state stack, transitions, toasts, CRT, debug overlay
  core/              loop (60 Hz fixed step), display (DPI/letterbox/wide), pool, math,
                     collision, spatial grid, view size, storage, fullscreen, polyfills
  input/             bindings (the only place that knows keys/buttons), action layer,
                     touch sticks/buttons, button-glyph labels
  entities/          player, enemies (+ AI, boss), projectiles (pooled), particles (pooled), pickups
  weapons/           weapon types, arsenal (inventory/ammo), firing, per-tick weapon system
  world/             World (the simulation), arena, waves/spawner, score/combo, pickups,
                     effects (beams/bolts), floating popups, obstacle steering
  render/            cached background/grid/walls, 2.5D depth (extruded walls, shadows,
                     floor lights), bloom, CRT overlay, sprite cache
  audio/             Web Audio engine, synthesized SFX, procedural synthwave music
  states/            title, play (Arcade or Zen), pause, settings, controls, game over / session summary
  ui/                HUD, touch HUD, menus, button prompts, text, toasts
```

**Architecture notes**
- **Fixed timestep:** the simulation always advances at 60 updates/s; rendering runs at the display's refresh rate and interpolates between updates.
- **Input abstraction:** game code asks about *actions* (`MOVE`, `AIM`, `FIRE`, `DASH`, …) — never raw keys or buttons.
- **Performance:** bullets and particles are pooled; collisions use circle tests on a spatial grid (with swept tests so fast bullets can't tunnel); static layers and glow sprites are cached offscreen; the backing canvas is capped at 2× DPI.
- **Dev tools:** press **`** / **F3** for the debug overlay (FPS, bloom state, device, raw stick values). In dev builds, `__game` is available in the browser console, e.g. `__game.stack[0].world.waves.wave = 4` jumps to the boss when the current wave ends.
