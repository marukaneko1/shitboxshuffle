import { Injectable } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import {
  TanksState,
  TankState,
  Projectile,
  PowerUp,
  PowerUpType,
  TankInput,
  Vector2D,
} from './tanks.types';

// ─── Constants ───────────────────────────────────────────────────────────────

const MAP_WIDTH = 2400;
const MAP_HEIGHT = 1600;

const TANK_RADIUS = 25;
const TANK_BASE_SPEED = 3;
const TANK_MAX_HEALTH = 100;
const BASE_FIRE_COOLDOWN_MS = 800;
const RAPID_FIRE_COOLDOWN_MS = 400;

const PROJECTILE_NORMAL_SPEED = 8;
const PROJECTILE_BIG_SPEED = 5;
const PROJECTILE_NORMAL_DAMAGE = 15;
const PROJECTILE_BIG_DAMAGE = 60;
const PROJECTILE_NORMAL_LIFETIME_MS = 2000;
const PROJECTILE_BIG_LIFETIME_MS = 2500;
const PROJECTILE_RADIUS = 6;
const PROJECTILE_BIG_RADIUS = 12;

const ZONE_START_RADIUS = 1100;
const ZONE_END_RADIUS = 80;
const ZONE_DAMAGE_PER_SECOND = 5;
const ZONE_PUSH_PER_SECOND = 60;

const GAME_DURATION_MS = 180_000; // 3 minutes

const POWERUP_COLLECT_RADIUS = 40;
const POWERUP_MAX_ON_MAP = 5;
const POWERUP_LIFETIME_MS = 30_000;
const POWERUP_SPAWN_CHANCE_PER_TICK = 0.05;

const EFFECT_DURATION: Record<PowerUpType, number> = {
  SPEED: 10_000,
  SHIELD: 15_000,
  RAPID_FIRE: 10_000,
  MULTI_SHOT: 10_000,
  HEALTH: 0,
  BIG_SHOT: 0,
};

const HEALTH_RESTORE_AMOUNT = 40;
const SPEED_MULTIPLIER = 1.5;
const MULTI_SHOT_SPREAD_RAD = (15 * Math.PI) / 180;

const TICK_MS = 50;

// ─── Service ─────────────────────────────────────────────────────────────────

@Injectable()
export class TanksService {
  private gameStates = new Map<string, TanksState>();
  private playerInputs = new Map<string, Map<string, TankInput>>();

  // ── Accessors ────────────────────────────────────────────────────────────

  getState(gameId: string): TanksState | undefined {
    return this.gameStates.get(gameId);
  }

  setState(gameId: string, state: TanksState): void {
    this.gameStates.set(gameId, state);
  }

  deleteState(gameId: string): void {
    this.gameStates.delete(gameId);
    this.playerInputs.delete(gameId);
  }

  // ── Initialisation ────────────────────────────────────────────────────────

  initializeState(gameId: string, playerIds: string[]): TanksState {
    const now = Date.now();

    const spawnPositions: Vector2D[] = [
      { x: 200, y: MAP_HEIGHT / 2 },
      { x: MAP_WIDTH - 200, y: MAP_HEIGHT / 2 },
    ];

    const spawnAngles = [0, Math.PI]; // facing right / left

    const tanks: Record<string, TankState> = {};
    playerIds.forEach((id, idx) => {
      tanks[id] = {
        id,
        position: { ...spawnPositions[idx] },
        bodyAngle: spawnAngles[idx],
        turretAngle: spawnAngles[idx],
        velocity: { x: 0, y: 0 },
        health: TANK_MAX_HEALTH,
        maxHealth: TANK_MAX_HEALTH,
        lastShotAt: 0,
        baseFireCooldown: BASE_FIRE_COOLDOWN_MS,
        activeEffects: [],
        isAlive: true,
        outsideZoneAccum: 0,
        shieldConsumed: false,
        bigShotReady: false,
      };
    });

    const state: TanksState = {
      phase: 'active',
      tanks,
      projectiles: [],
      powerUps: [],
      zone: {
        center: { x: MAP_WIDTH / 2, y: MAP_HEIGHT / 2 },
        currentRadius: ZONE_START_RADIUS,
        startRadius: ZONE_START_RADIUS,
        endRadius: ZONE_END_RADIUS,
        startTime: now,
        endTime: now + GAME_DURATION_MS,
        damagePerSecond: ZONE_DAMAGE_PER_SECOND,
        pushForcePerSecond: ZONE_PUSH_PER_SECOND,
      },
      startTime: now,
      endTime: now + GAME_DURATION_MS,
      winnerId: null,
      isDraw: false,
      gameStatus: 'active',
      tickCount: 0,
      mapWidth: MAP_WIDTH,
      mapHeight: MAP_HEIGHT,
    };

    this.gameStates.set(gameId, state);
    this.playerInputs.set(gameId, new Map());
    return state;
  }

  // ── Input ─────────────────────────────────────────────────────────────────

  applyInput(gameId: string, playerId: string, input: TankInput): void {
    const inputs = this.playerInputs.get(gameId);
    if (!inputs) return;
    inputs.set(playerId, input);
  }

  // ── Tick ──────────────────────────────────────────────────────────────────

  tick(gameId: string): { state: TanksState } {
    const state = this.gameStates.get(gameId);
    if (!state || state.phase === 'ended') {
      return { state: state! };
    }

    const now = Date.now();
    const dtSec = TICK_MS / 1000;
    const inputs = this.playerInputs.get(gameId) ?? new Map<string, TankInput>();

    // 1. Update zone radius
    this.updateZone(state, now);

    // 2. Process each tank
    for (const tank of Object.values(state.tanks)) {
      if (!tank.isAlive) continue;

      // Expire active effects
      tank.activeEffects = tank.activeEffects.filter(e => now < e.expiresAt);

      const input = inputs.get(tank.id);
      if (input) {
        tank.turretAngle = input.turretAngle;
        this.moveTank(tank, input, dtSec);

        if (input.shooting) {
          this.tryShoot(state, tank, now);
        }
      }

      // Zone check
      this.applyZoneEffect(state, tank, dtSec);
    }

    // 3. Move projectiles and check collisions
    this.updateProjectiles(state, now);

    // 4. Power-up collection
    this.checkPowerUpCollection(state, now);

    // 5. Expire old power-ups
    state.powerUps = state.powerUps.filter(p => now < p.expiresAt);

    // 6. Maybe spawn a new power-up
    if (
      state.powerUps.length < POWERUP_MAX_ON_MAP &&
      Math.random() < POWERUP_SPAWN_CHANCE_PER_TICK
    ) {
      state.powerUps.push(this.spawnPowerUp(now));
    }

    // 7. Check win conditions
    this.checkWin(state, now);

    state.tickCount++;
    this.gameStates.set(gameId, state);
    return { state };
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  private updateZone(state: TanksState, now: number): void {
    const { zone } = state;
    const elapsed = Math.min(now - zone.startTime, GAME_DURATION_MS);
    const progress = elapsed / GAME_DURATION_MS;
    zone.currentRadius =
      zone.startRadius + (zone.endRadius - zone.startRadius) * progress;
  }

  private moveTank(tank: TankState, input: TankInput, dtSec: number): void {
    const hasSpeed = tank.activeEffects.some(e => e.type === 'SPEED');
    const speed = TANK_BASE_SPEED * (hasSpeed ? SPEED_MULTIPLIER : 1);

    let dx = 0;
    let dy = 0;

    if (input.keys.w) dy -= 1;
    if (input.keys.s) dy += 1;
    if (input.keys.a) dx -= 1;
    if (input.keys.d) dx += 1;

    if (dx !== 0 || dy !== 0) {
      const len = Math.sqrt(dx * dx + dy * dy);
      dx = (dx / len) * speed;
      dy = (dy / len) * speed;

      if (dx !== 0 || dy !== 0) {
        tank.bodyAngle = Math.atan2(dy, dx);
      }
    }

    tank.position.x = clamp(
      tank.position.x + dx,
      TANK_RADIUS,
      MAP_WIDTH - TANK_RADIUS,
    );
    tank.position.y = clamp(
      tank.position.y + dy,
      TANK_RADIUS,
      MAP_HEIGHT - TANK_RADIUS,
    );

    tank.velocity = { x: dx, y: dy };
  }

  private tryShoot(state: TanksState, tank: TankState, now: number): void {
    const hasRapidFire = tank.activeEffects.some(e => e.type === 'RAPID_FIRE');
    const cooldown = hasRapidFire
      ? RAPID_FIRE_COOLDOWN_MS
      : tank.baseFireCooldown;

    if (now - tank.lastShotAt < cooldown) return;

    tank.lastShotAt = now;

    const hasMultiShot = tank.activeEffects.some(e => e.type === 'MULTI_SHOT');
    const isBig = tank.bigShotReady;

    if (isBig) {
      tank.bigShotReady = false;
    }

    const angles = hasMultiShot
      ? [
          tank.turretAngle - MULTI_SHOT_SPREAD_RAD,
          tank.turretAngle,
          tank.turretAngle + MULTI_SHOT_SPREAD_RAD,
        ]
      : [tank.turretAngle];

    for (const angle of angles) {
      const speed = isBig ? PROJECTILE_BIG_SPEED : PROJECTILE_NORMAL_SPEED;
      const damage = isBig ? PROJECTILE_BIG_DAMAGE : PROJECTILE_NORMAL_DAMAGE;
      const lifetime = isBig
        ? PROJECTILE_BIG_LIFETIME_MS
        : PROJECTILE_NORMAL_LIFETIME_MS;

      // Offset spawn slightly beyond tank edge so it doesn't self-collide
      const spawnOffset = TANK_RADIUS + (isBig ? PROJECTILE_BIG_RADIUS : PROJECTILE_RADIUS) + 2;

      state.projectiles.push({
        id: uuidv4(),
        ownerId: tank.id,
        position: {
          x: tank.position.x + Math.cos(angle) * spawnOffset,
          y: tank.position.y + Math.sin(angle) * spawnOffset,
        },
        velocity: {
          x: Math.cos(angle) * speed,
          y: Math.sin(angle) * speed,
        },
        damage,
        isBig,
        createdAt: now,
        lifetimeMs: lifetime,
      });
    }
  }

  private updateProjectiles(state: TanksState, now: number): void {
    const surviving: Projectile[] = [];

    for (const proj of state.projectiles) {
      // Expire check
      if (now - proj.createdAt >= proj.lifetimeMs) continue;

      // Move
      proj.position.x += proj.velocity.x;
      proj.position.y += proj.velocity.y;

      // Out-of-map check
      if (
        proj.position.x < 0 ||
        proj.position.x > MAP_WIDTH ||
        proj.position.y < 0 ||
        proj.position.y > MAP_HEIGHT
      ) {
        continue;
      }

      // Collision with tanks
      let hit = false;
      for (const tank of Object.values(state.tanks)) {
        if (!tank.isAlive) continue;
        if (tank.id === proj.ownerId) continue;

        const projRadius = proj.isBig ? PROJECTILE_BIG_RADIUS : PROJECTILE_RADIUS;
        const dist = distance(proj.position, tank.position);

        if (dist < TANK_RADIUS + projRadius) {
          // Shield absorbs the hit
          const shield = tank.activeEffects.find(e => e.type === 'SHIELD');
          if (shield && !tank.shieldConsumed) {
            tank.shieldConsumed = true;
            tank.activeEffects = tank.activeEffects.filter(e => e !== shield);
          } else {
            tank.health = Math.max(0, tank.health - proj.damage);
            if (tank.health <= 0) {
              tank.isAlive = false;
            }
          }
          hit = true;
          break;
        }
      }

      if (!hit) {
        surviving.push(proj);
      }
    }

    state.projectiles = surviving;
  }

  private applyZoneEffect(
    state: TanksState,
    tank: TankState,
    dtSec: number,
  ): void {
    const { zone } = state;
    const dx = tank.position.x - zone.center.x;
    const dy = tank.position.y - zone.center.y;
    const distFromCenter = Math.sqrt(dx * dx + dy * dy);

    if (distFromCenter > zone.currentRadius) {
      // Damage
      tank.health = Math.max(
        0,
        tank.health - zone.damagePerSecond * dtSec,
      );
      if (tank.health <= 0) {
        tank.isAlive = false;
        return;
      }

      // Push force toward center
      const pushMag = zone.pushForcePerSecond * dtSec;
      const norm = distFromCenter > 0 ? distFromCenter : 1;
      tank.position.x -= (dx / norm) * pushMag;
      tank.position.y -= (dy / norm) * pushMag;

      // Clamp to map
      tank.position.x = clamp(tank.position.x, TANK_RADIUS, MAP_WIDTH - TANK_RADIUS);
      tank.position.y = clamp(tank.position.y, TANK_RADIUS, MAP_HEIGHT - TANK_RADIUS);

      tank.outsideZoneAccum += dtSec;
    } else {
      tank.outsideZoneAccum = 0;
    }
  }

  private checkPowerUpCollection(state: TanksState, now: number): void {
    const remaining: PowerUp[] = [];

    for (const powerUp of state.powerUps) {
      let collected = false;
      for (const tank of Object.values(state.tanks)) {
        if (!tank.isAlive) continue;
        if (distance(tank.position, powerUp.position) < POWERUP_COLLECT_RADIUS) {
          this.applyPowerUp(tank, powerUp.type, now);
          collected = true;
          break;
        }
      }
      if (!collected) {
        remaining.push(powerUp);
      }
    }

    state.powerUps = remaining;
  }

  private applyPowerUp(tank: TankState, type: PowerUpType, now: number): void {
    switch (type) {
      case 'HEALTH':
        tank.health = Math.min(tank.maxHealth, tank.health + HEALTH_RESTORE_AMOUNT);
        break;
      case 'BIG_SHOT':
        tank.bigShotReady = true;
        break;
      case 'SHIELD':
        tank.shieldConsumed = false;
        tank.activeEffects = tank.activeEffects.filter(e => e.type !== 'SHIELD');
        tank.activeEffects.push({ type, expiresAt: now + EFFECT_DURATION[type] });
        break;
      default: {
        // Remove existing effect of same type (refresh)
        tank.activeEffects = tank.activeEffects.filter(e => e.type !== type);
        tank.activeEffects.push({ type, expiresAt: now + EFFECT_DURATION[type] });
      }
    }
  }

  private spawnPowerUp(now: number): PowerUp {
    const allTypes: PowerUpType[] = [
      'SPEED',
      'SHIELD',
      'RAPID_FIRE',
      'MULTI_SHOT',
      'HEALTH',
      'BIG_SHOT',
    ];
    const type = allTypes[Math.floor(Math.random() * allTypes.length)];

    // Keep power-ups away from the very edges (80px margin)
    const margin = 80;
    return {
      id: uuidv4(),
      type,
      position: {
        x: margin + Math.random() * (MAP_WIDTH - margin * 2),
        y: margin + Math.random() * (MAP_HEIGHT - margin * 2),
      },
      expiresAt: now + POWERUP_LIFETIME_MS,
    };
  }

  private checkWin(state: TanksState, now: number): void {
    const tanks = Object.values(state.tanks);
    const aliveTanks = tanks.filter(t => t.isAlive);
    const timerExpired = now >= state.endTime;

    if (aliveTanks.length === 0) {
      // Both destroyed simultaneously — draw
      state.phase = 'ended';
      state.gameStatus = 'ended';
      state.winnerId = null;
      state.isDraw = true;
    } else if (aliveTanks.length === 1) {
      state.phase = 'ended';
      state.gameStatus = 'ended';
      state.winnerId = aliveTanks[0].id;
      state.isDraw = false;
    } else if (timerExpired) {
      // Timer expired — highest HP wins; tie = draw
      const sorted = [...tanks].sort((a, b) => b.health - a.health);
      if (sorted[0].health === sorted[1].health) {
        state.isDraw = true;
        state.winnerId = null;
      } else {
        state.isDraw = false;
        state.winnerId = sorted[0].id;
      }
      state.phase = 'ended';
      state.gameStatus = 'ended';
    }
  }
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

function distance(a: Vector2D, b: Vector2D): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}
