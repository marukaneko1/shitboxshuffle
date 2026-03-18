export interface Vector2D {
  x: number;
  y: number;
}

export type PowerUpType =
  | 'SPEED'
  | 'SHIELD'
  | 'RAPID_FIRE'
  | 'MULTI_SHOT'
  | 'HEALTH'
  | 'BIG_SHOT';

export interface ActiveEffect {
  type: PowerUpType;
  /** ms timestamp when the effect expires (Date.now() + duration) */
  expiresAt: number;
}

export interface TankState {
  id: string;
  position: Vector2D;
  /** Radians — direction the tank body is facing */
  bodyAngle: number;
  /** Radians — direction the barrel points (controlled by mouse) */
  turretAngle: number;
  velocity: Vector2D;
  health: number;
  maxHealth: number;
  /** ms timestamp of when the tank last fired */
  lastShotAt: number;
  /** ms between shots at base rate */
  baseFireCooldown: number;
  activeEffects: ActiveEffect[];
  isAlive: boolean;
  /** Accumulated seconds outside zone (for damage ticks) */
  outsideZoneAccum: number;
  /** Whether shield has been consumed this activation */
  shieldConsumed: boolean;
  /** Whether BIG_SHOT will be used on next bullet */
  bigShotReady: boolean;
}

export interface Projectile {
  id: string;
  ownerId: string;
  position: Vector2D;
  velocity: Vector2D;
  damage: number;
  isBig: boolean;
  /** ms timestamp when this projectile was created */
  createdAt: number;
  /** ms until this projectile expires */
  lifetimeMs: number;
}

export interface PowerUp {
  id: string;
  type: PowerUpType;
  position: Vector2D;
  /** ms timestamp when this power-up expires if not collected */
  expiresAt: number;
}

export interface Zone {
  center: Vector2D;
  /** Current zone radius (updated each tick) */
  currentRadius: number;
  startRadius: number;
  endRadius: number;
  /** ms timestamp when zone started shrinking */
  startTime: number;
  /** ms timestamp when zone reaches minimum (startTime + gameDurationMs) */
  endTime: number;
  /** HP per second dealt to players outside the zone */
  damagePerSecond: number;
  /** Pixels/units of push force applied per second when outside zone */
  pushForcePerSecond: number;
}

export interface TankInput {
  keys: {
    w: boolean;
    a: boolean;
    s: boolean;
    d: boolean;
  };
  /** Radians — angle from tank to mouse cursor in game-world space */
  turretAngle: number;
  shooting: boolean;
}

export interface TanksState {
  phase: 'active' | 'ended';
  tanks: Record<string, TankState>;
  projectiles: Projectile[];
  powerUps: PowerUp[];
  zone: Zone;
  /** ms timestamp when the game started */
  startTime: number;
  /** ms timestamp when the game ends (startTime + 180_000) */
  endTime: number;
  winnerId: string | null;
  isDraw: boolean;
  gameStatus: 'active' | 'ended';
  tickCount: number;
  mapWidth: number;
  mapHeight: number;
}
