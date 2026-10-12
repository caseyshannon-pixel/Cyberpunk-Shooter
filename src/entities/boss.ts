import { COLORS, CONFIG } from '../config';
import { len, lerp, lerpAngle, TAU } from '../core/math';
import type { World } from '../world/world';
import { neonStroke, type BossPattern, type BossState, type Enemy } from './enemy';

const B = CONFIG.enemies.boss;
const PATTERNS: BossPattern[] = ['ring', 'volley', 'charge', 'spiral'];

export const BOSS_NAME = 'WARDEN // MK-';

export function createBossState(): BossState {
  return {
    pattern: 'ring',
    lastPattern: null,
    phase: 'move',
    timer: 1.6,
    shotsLeft: 0,
    shotTimer: 0,
    spiralAngle: 0,
    summonTimer: B.summonInterval,
    enraged: false,
    displayHp: 0,
  };
}

/**
 * Boss loop: move → windup (telegraph) → attack pattern → recover → move …
 * Below `enragedAt` health it attacks faster and periodically summons drones.
 */
export function updateBoss(e: Enemy, w: World, dt: number): void {
  const s = e.boss;
  if (!s) return;
  const p = w.player;
  const dx = p.x - e.x;
  const dy = p.y - e.y;
  const d = len(dx, dy) || 1;
  const nx = dx / d;
  const ny = dy / d;
  const pace = s.enraged ? 0.7 : 1;

  if (!s.enraged && e.hp <= e.maxHp * B.enragedAt) {
    s.enraged = true;
    w.particles.ring(e.x, e.y, COLORS.red, 160, 0.6, 5);
    w.shake(10);
    w.toast('WARDEN ENRAGED', COLORS.red);
    w.sound('enrage');
  }
  if (s.enraged) {
    s.summonTimer -= dt;
    if (s.summonTimer <= 0) {
      s.summonTimer = B.summonInterval;
      for (let i = 0; i < B.summonCount; i++) {
        const a = (i / B.summonCount) * TAU + Math.random();
        w.spawnEnemy('drone', e.x + Math.cos(a) * (e.radius + 24), e.y + Math.sin(a) * (e.radius + 24), true);
      }
    }
  }

  e.accel = B.accel;
  if (s.phase !== 'attack' || s.pattern !== 'charge') e.angle = Math.atan2(dy, dx);

  switch (s.phase) {
    case 'move': {
      // Hold a mid-range distance, circling slowly.
      if (d > 330) e.steer(nx, ny);
      else if (d < 200) e.steer(-nx, -ny);
      else e.steer(-ny * e.strafe, nx * e.strafe, 0.6);
      if (e.blocked) e.strafe = -e.strafe;
      s.timer -= dt;
      if (s.timer <= 0) {
        const options = PATTERNS.filter((x) => x !== s.lastPattern);
        s.pattern = options[Math.floor(Math.random() * options.length)];
        s.lastPattern = s.pattern;
        s.phase = 'windup';
        s.timer = (s.pattern === 'charge' ? B.chargeTelegraph : B.windup) * pace;
        if (s.pattern === 'charge') w.sound('charge', e.x);
      }
      break;
    }
    case 'windup': {
      e.steer(0, 0);
      if (s.pattern === 'charge') {
        e.dirX = nx;
        e.dirY = ny;
      }
      s.timer -= dt;
      if (s.timer <= 0) beginAttack(e, s);
      break;
    }
    case 'attack':
      attack(e, s, w, dt, nx, ny);
      break;
    case 'recover':
      e.accel = 1500;
      e.steer(0, 0);
      s.timer -= dt;
      if (s.timer <= 0) {
        s.phase = 'move';
        s.timer = (1.2 + Math.random() * 1.2) * pace;
      }
      break;
  }
}

function beginAttack(e: Enemy, s: BossState): void {
  s.phase = 'attack';
  s.shotTimer = 0;
  switch (s.pattern) {
    case 'ring':
      s.shotsLeft = B.ringBursts + (s.enraged ? 1 : 0);
      break;
    case 'volley':
      s.shotsLeft = B.volleys + (s.enraged ? 2 : 0);
      break;
    case 'charge':
      s.timer = B.chargeDuration;
      e.angle = Math.atan2(e.dirY, e.dirX);
      break;
    case 'spiral':
      s.timer = B.spiralDuration;
      s.spiralAngle = e.angle;
      break;
  }
}

function attack(e: Enemy, s: BossState, w: World, dt: number, nx: number, ny: number): void {
  const pace = s.enraged ? 0.7 : 1;
  const speed = B.bulletSpeed * (s.enraged ? 1.15 : 1);
  s.shotTimer -= dt;

  switch (s.pattern) {
    case 'ring': {
      e.steer(0, 0);
      if (s.shotTimer <= 0) {
        const n = B.ringCount + (s.enraged ? 6 : 0);
        const offset = (s.shotsLeft % 2) * (Math.PI / n);
        for (let i = 0; i < n; i++) w.fireEnemyBullet(e.x, e.y, offset + (i / n) * TAU, speed, B.bulletRadius);
        w.particles.ring(e.x, e.y, B.color, e.radius * 1.8, 0.3);
        s.shotsLeft--;
        s.shotTimer = B.ringGap * pace;
      }
      if (s.shotsLeft <= 0) finish(s);
      break;
    }
    case 'volley': {
      e.steer(-ny * e.strafe, nx * e.strafe, 0.35);
      if (s.shotTimer <= 0) {
        const base = Math.atan2(ny, nx);
        const n = B.volleyShots;
        for (let i = 0; i < n; i++) {
          const a = base + (i / (n - 1) - 0.5) * B.volleyArc;
          // Two shoulder cannons.
          for (const side of [-1, 1]) {
            const ox = e.x + Math.cos(base + side * 1.2) * e.radius * 0.9;
            const oy = e.y + Math.sin(base + side * 1.2) * e.radius * 0.9;
            w.fireEnemyBullet(ox, oy, a, speed * 1.25, B.bulletRadius * 0.8);
          }
        }
        s.shotsLeft--;
        s.shotTimer = B.volleyGap * pace;
      }
      if (s.shotsLeft <= 0) finish(s);
      break;
    }
    case 'charge': {
      e.accel = 5000;
      e.desiredX = e.dirX * B.chargeSpeed;
      e.desiredY = e.dirY * B.chargeSpeed;
      s.timer -= dt;
      w.particles.burst(e.x - e.dirX * e.radius, e.y - e.dirY * e.radius, B.color, 2, 60, 160, 0.2, 0.4, 3);
      if (e.blocked || s.timer <= 0) {
        // Stomp: shockwave ring of bullets.
        const n = B.stompBullets;
        for (let i = 0; i < n; i++) w.fireEnemyBullet(e.x, e.y, (i / n) * TAU, speed * 0.9, B.bulletRadius);
        w.particles.ring(e.x, e.y, '#ffffff', 140, 0.45, 5);
        w.shake(12);
        w.sound('stomp');
        e.vx = e.vy = 0;
        finish(s);
      }
      break;
    }
    case 'spiral': {
      e.steer(0, 0);
      s.timer -= dt;
      while (s.shotTimer <= 0) {
        for (const off of [0, Math.PI]) w.fireEnemyBullet(e.x, e.y, s.spiralAngle + off, speed * 0.85, B.bulletRadius * 0.85);
        s.spiralAngle += B.spiralSpin * B.spiralRate * (s.enraged ? 1.25 : 1);
        s.shotTimer += B.spiralRate * pace;
      }
      if (s.timer <= 0) finish(s);
      break;
    }
  }
}

function finish(s: BossState): void {
  s.phase = 'recover';
  s.timer = B.recovery * (s.enraged ? 0.7 : 1);
}

// ------------------------------------------------------------------ render

export function renderBoss(ctx: CanvasRenderingContext2D, e: Enemy, alpha: number): void {
  const s = e.boss;
  if (!s) return;
  const x = lerp(e.prevX, e.x, alpha);
  const y = lerp(e.prevY, e.y, alpha);
  const angle = lerpAngle(e.prevAngle, e.angle, alpha);
  const r = e.radius;
  const t = e.age;
  const base = s.enraged ? COLORS.red : B.color;
  const color = e.flash > 0 ? '#ffffff' : base;
  const winding = s.phase === 'windup';

  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  // Charge telegraph: a lane toward the player.
  if (winding && s.pattern === 'charge') {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = COLORS.red;
    ctx.globalAlpha = 0.18 + 0.2 * (0.5 + 0.5 * Math.sin(t * 30));
    ctx.lineWidth = r * 2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + e.dirX * 900, y + e.dirY * 900);
    ctx.stroke();
    ctx.restore();
  }

  ctx.translate(x, y);

  // Outer rotating ring of segments.
  ctx.save();
  ctx.rotate(t * (s.enraged ? 1.6 : 0.8));
  for (let i = 0; i < 6; i++) {
    const a0 = (i / 6) * TAU + 0.12;
    const a1 = ((i + 1) / 6) * TAU - 0.12;
    ctx.beginPath();
    ctx.arc(0, 0, r + 10, a0, a1);
    neonStroke(ctx, base, 2);
  }
  ctx.restore();

  ctx.rotate(angle);
  // Hull.
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU + Math.PI / 8;
    const rr = i === 0 || i === 7 ? r * 1.05 : r;
    if (i === 0) ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
    else ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fillStyle = 'rgba(40, 8, 70, 0.85)';
  ctx.fill();
  neonStroke(ctx, color, 3);

  // Shoulder cannons.
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.rotate(side * 1.2);
    ctx.translate(r * 0.9, 0);
    ctx.rotate(-side * 1.2);
    ctx.beginPath();
    ctx.rect(-8, -7, 26, 14);
    ctx.fillStyle = 'rgba(40, 8, 70, 0.9)';
    ctx.fill();
    neonStroke(ctx, color, 2);
    ctx.restore();
  }

  // Visor.
  ctx.beginPath();
  ctx.moveTo(r * 0.35, -r * 0.4);
  ctx.lineTo(r * 0.75, 0);
  ctx.lineTo(r * 0.35, r * 0.4);
  neonStroke(ctx, COLORS.magenta, 3);

  // Core: pulses hard while winding up an attack.
  const pulse = winding ? 0.6 + 0.4 * Math.sin(t * 40) : 0.5 + 0.15 * Math.sin(t * 4);
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = s.enraged ? COLORS.red : COLORS.magenta;
  ctx.globalAlpha = pulse;
  ctx.beginPath();
  ctx.arc(-r * 0.15, 0, r * (winding ? 0.42 : 0.3), 0, TAU);
  ctx.fill();
  ctx.restore();
}
