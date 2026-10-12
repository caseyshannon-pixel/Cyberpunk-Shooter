import { CONFIG } from '../config';
import { len, vec } from '../core/math';
import { avoidObstacles } from '../world/steering';
import type { World } from '../world/world';
import { updateBoss } from './boss';
import type { Enemy, EnemyKind } from './enemy';

const tmp = vec();

/** Steer toward (tx, ty), bending around obstacles. Optional sideways weave for organic motion. */
function seek(e: Enemy, w: World, tx: number, ty: number, speedFactor = 1, weave = 0): void {
  let dx = tx - e.x;
  let dy = ty - e.y;
  const d = len(dx, dy);
  if (d < 1) {
    e.steer(0, 0);
    return;
  }
  dx /= d;
  dy /= d;
  if (weave) {
    const s = Math.sin(e.age * 3 + e.seed) * weave;
    const c = Math.cos(s);
    const sn = Math.sin(s);
    [dx, dy] = [dx * c - dy * sn, dx * sn + dy * c];
  }
  avoidObstacles(w.arena, e.x, e.y, e.radius, dx, dy, tmp);
  e.steer(tmp.x, tmp.y, speedFactor);
}

function face(e: Enemy, tx: number, ty: number): void {
  e.angle = Math.atan2(ty - e.y, tx - e.x);
}

function drone(e: Enemy, w: World): void {
  const p = w.player;
  seek(e, w, p.x, p.y, 1, 0.35);
  face(e, p.x, p.y);
}

function splitter(e: Enemy, w: World): void {
  const p = w.player;
  seek(e, w, p.x, p.y, 1, 0.2);
  face(e, p.x, p.y);
}

function splitling(e: Enemy, w: World): void {
  const p = w.player;
  seek(e, w, p.x, p.y, 1, 0.5);
  e.angle = Math.atan2(e.vy, e.vx);
}

function gunner(e: Enemy, w: World, dt: number): void {
  const G = CONFIG.enemies.gunner;
  const p = w.player;
  const dx = p.x - e.x;
  const dy = p.y - e.y;
  const d = len(dx, dy) || 1;
  const nx = dx / d;
  const ny = dy / d;
  face(e, p.x, p.y);

  // Keep a comfortable distance and strafe around the player.
  if (d > G.rangeMax) {
    seek(e, w, p.x, p.y);
  } else if (d < G.rangeMin) {
    e.steer(-nx, -ny);
  } else {
    if (e.blocked || Math.random() < dt * 0.4) e.strafe = -e.strafe;
    e.steer(-ny * e.strafe, nx * e.strafe, 0.7);
  }

  e.cooldown -= dt;
  if (e.state === 'telegraph') {
    e.desiredX *= 0.25;
    e.desiredY *= 0.25;
    e.timer -= dt;
    if (e.timer <= 0) {
      const mx = e.x + nx * e.radius * 1.4;
      const my = e.y + ny * e.radius * 1.4;
      w.fireEnemyBullet(mx, my, e.angle, G.bulletSpeed, G.bulletRadius);
      e.state = 'idle';
      e.cooldown = G.fireInterval * (0.8 + Math.random() * 0.4);
    }
  } else if (e.cooldown <= 0 && d < G.rangeMax + 160 && w.arena.lineOfSight(e.x, e.y, p.x, p.y)) {
    e.state = 'telegraph';
    e.timer = G.telegraph;
  }
}

function bruiser(e: Enemy, w: World, dt: number): void {
  const B = CONFIG.enemies.bruiser;
  const p = w.player;
  e.cooldown -= dt;

  switch (e.state) {
    case 'idle': {
      e.accel = B.accel;
      seek(e, w, p.x, p.y);
      face(e, p.x, p.y);
      const d = len(p.x - e.x, p.y - e.y);
      if (e.cooldown <= 0 && d < B.chargeRange && w.arena.lineOfSight(e.x, e.y, p.x, p.y)) {
        e.state = 'telegraph';
        e.timer = B.chargeTelegraph;
      }
      break;
    }
    case 'telegraph': {
      // Track the player for most of the wind-up, then lock in (the dodge window).
      e.steer(0, 0);
      e.timer -= dt;
      if (e.timer > B.chargeTelegraph * 0.3) {
        face(e, p.x, p.y);
        e.dirX = Math.cos(e.angle);
        e.dirY = Math.sin(e.angle);
      }
      if (e.timer <= 0) {
        e.state = 'charge';
        e.timer = B.chargeDuration;
        w.particles.ring(e.x, e.y, B.color, e.radius * 2.2, 0.3);
      }
      break;
    }
    case 'charge': {
      e.accel = 6000;
      e.desiredX = e.dirX * B.chargeSpeed;
      e.desiredY = e.dirY * B.chargeSpeed;
      e.timer -= dt;
      if (Math.random() < 0.6) w.particles.burst(e.x - e.dirX * e.radius, e.y - e.dirY * e.radius, B.color, 1, 40, 120, 0.2, 0.35, 2);
      if (e.blocked && e.age > 0) {
        // Slammed into a wall: stunned, with a crunch.
        e.stun = B.wallStun;
        e.vx = e.vy = 0;
        w.particles.burst(e.x + e.dirX * e.radius, e.y + e.dirY * e.radius, '#ffffff', 14, 100, 320, 0.2, 0.45, 2);
        w.shake(6);
        e.state = 'idle';
        e.cooldown = B.chargeCooldown;
      } else if (e.timer <= 0) {
        e.state = 'recover';
        e.timer = 0.45;
      }
      break;
    }
    case 'recover':
      e.accel = 1800;
      e.steer(0, 0);
      e.timer -= dt;
      if (e.timer <= 0) {
        e.state = 'idle';
        e.cooldown = B.chargeCooldown;
      }
      break;
  }
}

/** One AI function per enemy kind. Add a kind here when you add it to CONFIG.enemies. */
export const ENEMY_AI: Record<EnemyKind, (e: Enemy, w: World, dt: number) => void> = {
  drone,
  gunner,
  splitter,
  splitling,
  bruiser,
  boss: updateBoss,
};
