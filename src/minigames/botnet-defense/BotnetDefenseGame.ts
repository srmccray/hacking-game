/**
 * Botnet Defense Game Logic
 *
 * A Vampire Survivors-style arena shooter where the player defends against
 * waves of malware enemies. The player auto-fires weapons on cooldown while
 * moving to avoid enemies. Killing enemies drops XP gems for leveling up.
 *
 * This task implements the core game loop with:
 * - 8-directional player movement with delta-time physics
 * - Ping weapon (auto-fires projectiles in facing direction)
 * - Virus enemy type (slow, moves toward player)
 * - Circle-circle collision detection
 * - HP/damage system with invincibility frames
 * - Time-based enemy spawning
 * - Score and money reward calculation
 *
 * Usage:
 *   const game = new BotnetDefenseGame(config.minigames.botnetDefense);
 *   game.start();
 *
 *   // Handle input (8-directional)
 *   game.setInput({ left: true, right: false, up: false, down: true });
 *
 *   // In game loop
 *   game.update(deltaMs);
 *
 *   // Get state for rendering
 *   const state = game.getState();
 */

import { BaseMinigame, type MinigameEventType } from '../BaseMinigame';
import type { BotnetDefenseConfig } from '../../game/GameConfig';
import { DEFAULT_CONFIG } from '../../game/GameConfig';
import type {
  Enemy,
  EnemyType,
  Projectile,
  PlayerState,
  WeaponState,
  WeaponType,
  BotnetDefenseState,
  XPGem,
  UpgradeChoice,
} from './types';
import {
  ENEMY_DEFINITIONS,
  getSpawnBracket,
  pickRandomEnemyType,
  rollEnemyHp,
  rollGroupSize,
} from './enemies';
import type { SpawnBracket } from './enemies';

// ============================================================================
// Constants
// ============================================================================

/** Player collision radius in pixels. */
const PLAYER_RADIUS = 12;


/** Projectile collision radius in pixels. */
const PROJECTILE_RADIUS = 4;

/** XP gem collision radius in pixels. */
const XP_GEM_RADIUS = 6;

/** Maximum number of active XP gems in the arena. */
const XP_GEM_CAP = 30;

/** Distance in pixels at which an XP gem is collected (not just attracted). */
const XP_GEM_COLLECT_RADIUS = 10;

/** Base magnetic pull speed for XP gems in pixels per second. */
const XP_GEM_PULL_SPEED = 300;

/** Maximum weapon level. */
const MAX_WEAPON_LEVEL = 5;

/** All available weapon types. */
const ALL_WEAPON_TYPES: readonly WeaponType[] = ['ping', 'firewall', 'port-scanner', 'exploit'] as const;

/** Ping weapon projectile speed in pixels per second. */
const PING_PROJECTILE_SPEED = 400;

/** Ping weapon projectile lifetime in milliseconds. */
const PING_PROJECTILE_LIFETIME = 2000;

/** Ping weapon cooldown in milliseconds (level 1). */
const PING_COOLDOWN_MS = 800;

/** Ping weapon damage (level 1). */
const PING_DAMAGE = 1;

/** Ping weapon projectile count (level 1). */
const PING_PROJECTILE_COUNT = 1;

// -- Firewall weapon constants --

/** Firewall orbital radius in pixels. */
const FIREWALL_ORBIT_RADIUS = 80;

/** Firewall rotation speed in radians per second. */
const FIREWALL_ROTATION_SPEED = 3.0;

/** Firewall "cooldown" - time between spawning a new set of orbitals (ms). */
const FIREWALL_COOLDOWN_MS = 100;

/** Firewall damage per hit. */
const FIREWALL_DAMAGE = 2;

/** Firewall projectile collision radius. */
const FIREWALL_RADIUS = 10;

/** Firewall projectile lifetime (effectively infinite, refreshed constantly). */
const FIREWALL_LIFETIME = 200;

/** Number of firewall barriers at level 1. */
const FIREWALL_COUNT = 1;

// -- Port Scanner weapon constants --

/** Port Scanner cooldown in milliseconds. */
const PORT_SCANNER_COOLDOWN_MS = 3000;

/** Port Scanner ring expansion speed in pixels per second. */
const PORT_SCANNER_EXPAND_SPEED = 200;

/** Port Scanner ring lifetime in milliseconds. */
const PORT_SCANNER_LIFETIME = 1500;

/** Port Scanner damage per hit. */
const PORT_SCANNER_DAMAGE = 1;

/** Port Scanner maximum ring radius. */
const PORT_SCANNER_MAX_RADIUS = 300;

// -- Exploit weapon constants --

/** Exploit projectile speed in pixels per second. */
const EXPLOIT_PROJECTILE_SPEED = 300;

/** Exploit cooldown in milliseconds. */
const EXPLOIT_COOLDOWN_MS = 1500;

/** Exploit damage per hit. */
const EXPLOIT_DAMAGE = 3;

/** Exploit projectile lifetime in milliseconds. */
const EXPLOIT_LIFETIME = 3000;

/** Exploit homing turn rate in radians per second. */
const EXPLOIT_HOMING_RATE = 4.0;

/** Default enemy collision radius (used for edge spawn margin calculation). */
const DEFAULT_ENEMY_RADIUS = 10;

// ============================================================================
// Input Types
// ============================================================================

/** Input state for 8-directional movement. */
export interface BotnetDefenseInput {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
}

// ============================================================================
// Botnet Defense Game Class
// ============================================================================

/**
 * Botnet Defense minigame logic.
 *
 * Extends BaseMinigame with arena-shooter mechanics: player movement,
 * auto-firing weapons, enemy spawning, collision detection, and HP/damage.
 */
export class BotnetDefenseGame extends BaseMinigame {
  readonly id = 'botnet-defense';

  // ==========================================================================
  // Configuration
  // ==========================================================================

  /** Minigame configuration. */
  private readonly config: BotnetDefenseConfig;

  // ==========================================================================
  // Entity ID Generation
  // ==========================================================================

  /** Counter for generating unique entity IDs. */
  private _nextEntityId: number = 0;

  // ==========================================================================
  // Player State
  // ==========================================================================

  /** Player runtime state (initialized in constructor after config is set). */
  private _player!: PlayerState;

  // ==========================================================================
  // Entity Arrays
  // ==========================================================================

  /** Active enemies in the arena. */
  private _enemies: Enemy[] = [];

  /** Active projectiles in the arena. */
  private _projectiles: Projectile[] = [];

  /** Active XP gems in the arena (placeholder for future task). */
  private _xpGems: XPGem[] = [];

  // ==========================================================================
  // Weapon State
  // ==========================================================================

  /** Player's equipped weapons. */
  private _weapons: WeaponState[] = [];

  // ==========================================================================
  // Progression State
  // ==========================================================================

  /** Current XP (placeholder for future task). */
  private _currentXP: number = 0;

  /** XP required for next level (placeholder for future task). */
  private _xpToNextLevel: number = 0;

  /** Current player level. */
  private _level: number = 1;

  /** Total enemies killed this session. */
  private _kills: number = 0;

  /** Whether the level-up overlay is active. */
  private _isLevelingUp: boolean = false;

  /** Current upgrade choices (placeholder for future task). */
  private _upgradeChoices: UpgradeChoice[] = [];

  /** Accumulated money earned. */
  private _moneyEarned: number = 0;

  // ==========================================================================
  // Input State
  // ==========================================================================

  /** Current directional input. */
  private _input: BotnetDefenseInput = { left: false, right: false, up: false, down: false };

  // ==========================================================================
  // Spawner State
  // ==========================================================================

  /** Time accumulator for enemy spawning. */
  private _spawnTimer: number = 0;

  // ==========================================================================
  // Constructor
  // ==========================================================================

  /**
   * Create a new Botnet Defense game.
   *
   * @param config - Configuration from GameConfig.minigames.botnetDefense
   */
  constructor(config?: BotnetDefenseConfig) {
    super();
    this.config = config ?? DEFAULT_CONFIG.minigames.botnetDefense;
    this._player = this.createDefaultPlayer();
  }

  // ==========================================================================
  // Lifecycle Implementation
  // ==========================================================================

  protected onStart(): void {
    // Set up the timer from config
    this.setTimeLimit(this.config.timeLimitMs);

    // Reset all game-specific state
    this._nextEntityId = 0;
    this._player = this.createDefaultPlayer();
    this._enemies = [];
    this._projectiles = [];
    this._xpGems = [];
    this._kills = 0;
    this._currentXP = 0;
    this._xpToNextLevel = this.config.baseXPToLevel;
    this._level = 1;
    this._isLevelingUp = false;
    this._upgradeChoices = [];
    this._moneyEarned = 0;
    this._spawnTimer = 0;
    this._input = { left: false, right: false, up: false, down: false };

    // Initialize with Ping weapon at level 1
    this._weapons = [
      {
        type: 'ping',
        level: 1,
        cooldownRemaining: 0,
      },
    ];
  }

  protected onEnd(): void {
    // Calculate final score: kills * killPoints + floor(survivalSeconds) * timePoints
    const survivalSeconds = Math.floor(this._playTimeMs / 1000);
    const finalScore = this._kills * this.config.killPoints + survivalSeconds * this.config.timePoints;
    this._score = finalScore;

    // Calculate money reward
    this._moneyEarned = Math.floor(finalScore * this.config.moneyPerScore);

    // Clear input
    this._input = { left: false, right: false, up: false, down: false };
  }

  protected onUpdate(deltaMs: number): void {
    const deltaSec = deltaMs / 1000;

    // Update player movement
    this.updatePlayerMovement(deltaSec);

    // Update i-frames
    this.updateIFrames(deltaMs);

    // Update weapons (cooldowns and auto-fire)
    this.updateWeapons(deltaMs);

    // Update projectiles (movement and lifetime)
    this.updateProjectiles(deltaMs, deltaSec);

    // Spawn enemies
    this.updateSpawner(deltaMs);

    // Update enemies (movement toward player)
    this.updateEnemies(deltaSec);

    // Check projectile-enemy collisions
    this.checkProjectileEnemyCollisions();

    // Check enemy-player collisions
    this.checkEnemyPlayerCollisions();

    // Update XP gems (magnetic pull and collection)
    this.updateXPGems(deltaSec);

    // Remove inactive entities
    this.cleanupEntities();

    // Update running score
    const survivalSeconds = Math.floor(this._playTimeMs / 1000);
    this._score = this._kills * this.config.killPoints + survivalSeconds * this.config.timePoints;

    // Check for player death
    if (this._player.hp <= 0) {
      this.end();
    }
  }

  // ==========================================================================
  // Input Handling
  // ==========================================================================

  /**
   * Set the current directional input state.
   *
   * @param input - Object with left, right, up, down booleans
   */
  setInput(input: BotnetDefenseInput): void {
    this._input = { ...input };

    // Update facing direction based on input (only when there is movement)
    const dx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    const dy = (input.down ? 1 : 0) - (input.up ? 1 : 0);

    if (dx !== 0 || dy !== 0) {
      this._player.facingX = dx;
      this._player.facingY = dy;
    }
  }

  // ==========================================================================
  // State Access
  // ==========================================================================

  /**
   * Get the current game state for rendering.
   * Returns a snapshot of all state needed to render the game.
   */
  getState(): BotnetDefenseState {
    return {
      player: { ...this._player },
      enemies: this._enemies.filter((e) => e.active).map((e) => ({ ...e })),
      projectiles: this._projectiles.filter((p) => p.active).map((p) => ({ ...p })),
      xpGems: this._xpGems.filter((g) => g.active).map((g) => ({ ...g })),
      weapons: this._weapons.map((w) => ({ ...w })),
      currentXP: this._currentXP,
      xpToNextLevel: this._xpToNextLevel,
      level: this._level,
      kills: this._kills,
      isLevelingUp: this._isLevelingUp,
      upgradeChoices: [...this._upgradeChoices],
      moneyEarned: this._moneyEarned,
    };
  }

  // ==========================================================================
  // Reward Calculation
  // ==========================================================================

  /**
   * Calculate the money reward based on the final score.
   * Formula: floor(score * moneyPerScore)
   *
   * @returns Money as a string (for Decimal compatibility)
   */
  calculateMoneyReward(): string {
    const money = Math.floor(this._score * this.config.moneyPerScore);
    return String(money);
  }

  // ==========================================================================
  // Public Getters
  // ==========================================================================

  /** Total enemies killed this session. */
  get kills(): number {
    return this._kills;
  }

  /** Current player state (read-only copy). */
  get player(): PlayerState {
    return { ...this._player };
  }

  // ==========================================================================
  // Private Methods - Player
  // ==========================================================================

  /**
   * Create the default player state, centered in the arena.
   */
  private createDefaultPlayer(): PlayerState {
    return {
      x: this.config.arenaWidth / 2,
      y: this.config.arenaHeight / 2,
      hp: this.config.playerMaxHP,
      maxHp: this.config.playerMaxHP,
      speed: this.config.playerSpeed,
      pickupRadius: this.config.pickupRadius,
      damageMult: 1.0,
      iFramesRemaining: 0,
      facingX: 1,  // Default facing right
      facingY: 0,
    };
  }

  /**
   * Update player position based on input with delta-time physics.
   * Applies 8-directional movement with diagonal normalization and arena bounds clamping.
   */
  private updatePlayerMovement(deltaSec: number): void {
    const dx = (this._input.right ? 1 : 0) - (this._input.left ? 1 : 0);
    const dy = (this._input.down ? 1 : 0) - (this._input.up ? 1 : 0);

    if (dx === 0 && dy === 0) {
      return;
    }

    // Normalize diagonal movement so speed is consistent
    const length = Math.sqrt(dx * dx + dy * dy);
    const normalizedDx = dx / length;
    const normalizedDy = dy / length;

    this._player.x += normalizedDx * this._player.speed * deltaSec;
    this._player.y += normalizedDy * this._player.speed * deltaSec;

    // Clamp to arena bounds
    this._player.x = Math.max(PLAYER_RADIUS, Math.min(this.config.arenaWidth - PLAYER_RADIUS, this._player.x));
    this._player.y = Math.max(PLAYER_RADIUS, Math.min(this.config.arenaHeight - PLAYER_RADIUS, this._player.y));
  }

  /**
   * Decrement i-frames timer.
   */
  private updateIFrames(deltaMs: number): void {
    if (this._player.iFramesRemaining > 0) {
      this._player.iFramesRemaining = Math.max(0, this._player.iFramesRemaining - deltaMs);
    }
  }

  // ==========================================================================
  // Private Methods - Weapons
  // ==========================================================================

  /**
   * Update weapon cooldowns and auto-fire when ready.
   */
  private updateWeapons(deltaMs: number): void {
    for (const weapon of this._weapons) {
      weapon.cooldownRemaining = Math.max(0, weapon.cooldownRemaining - deltaMs);

      if (weapon.cooldownRemaining <= 0) {
        this.fireWeapon(weapon);
      }
    }
  }

  /**
   * Fire a weapon, creating projectile(s) based on weapon type and level.
   */
  private fireWeapon(weapon: WeaponState): void {
    switch (weapon.type) {
      case 'ping':
        this.firePing(weapon);
        break;
      case 'firewall':
        this.fireFirewall(weapon);
        break;
      case 'port-scanner':
        this.firePortScanner(weapon);
        break;
      case 'exploit':
        this.fireExploit(weapon);
        break;
    }
  }

  /**
   * Fire the Ping weapon: a single directional projectile.
   * Level 1: 1 projectile, 1 damage, 800ms cooldown.
   */
  private firePing(weapon: WeaponState): void {
    // Determine firing direction from player facing
    let dirX = this._player.facingX;
    const dirY = this._player.facingY;

    // Fallback: if facing is somehow (0,0), fire right
    if (dirX === 0 && dirY === 0) {
      dirX = 1;
    }

    // Normalize direction
    const length = Math.sqrt(dirX * dirX + dirY * dirY);
    const normalizedDirX = dirX / length;
    const normalizedDirY = dirY / length;

    // Create projectile(s) based on level
    const count = PING_PROJECTILE_COUNT; // Future: scale with level
    for (let i = 0; i < count; i++) {
      const projectile: Projectile = {
        id: this._nextEntityId++,
        x: this._player.x,
        y: this._player.y,
        radius: PROJECTILE_RADIUS,
        active: true,
        weaponType: 'ping',
        damage: PING_DAMAGE,
        velocityX: normalizedDirX * PING_PROJECTILE_SPEED,
        velocityY: normalizedDirY * PING_PROJECTILE_SPEED,
        lifetime: PING_PROJECTILE_LIFETIME,
      };
      this._projectiles.push(projectile);
    }

    // Set weapon cooldown
    weapon.cooldownRemaining = PING_COOLDOWN_MS;

    // Emit weapon-fired event
    this.emit('weapon-fired' as MinigameEventType, {
      minigameId: this.id,
      data: {
        weaponType: 'ping',
        x: this._player.x,
        y: this._player.y,
        dirX: normalizedDirX,
        dirY: normalizedDirY,
      },
    });
  }

  /**
   * Fire the Firewall weapon: rotating orbital barrier(s) around the player.
   * Each orbital is a projectile that follows the player in a circle.
   * The firewall continuously refreshes its orbitals on a short cooldown.
   */
  private fireFirewall(weapon: WeaponState): void {
    // Remove existing firewall projectiles so we refresh them
    for (const proj of this._projectiles) {
      if (proj.active && proj.weaponType === 'firewall') {
        proj.active = false;
      }
    }

    const barrierCount = FIREWALL_COUNT + Math.floor((weapon.level - 1) * 0.5);
    const damage = Math.ceil(FIREWALL_DAMAGE * (1 + (weapon.level - 1) * 0.3));

    for (let i = 0; i < barrierCount; i++) {
      const angleOffset = (2 * Math.PI * i) / barrierCount;
      // Store the current angle in velocityX and angular speed in velocityY
      // The angle is based on game time so the rotation is continuous
      const currentAngle = angleOffset + (this._playTimeMs / 1000) * FIREWALL_ROTATION_SPEED;
      const projX = this._player.x + Math.cos(currentAngle) * FIREWALL_ORBIT_RADIUS;
      const projY = this._player.y + Math.sin(currentAngle) * FIREWALL_ORBIT_RADIUS;

      const projectile: Projectile = {
        id: this._nextEntityId++,
        x: projX,
        y: projY,
        radius: FIREWALL_RADIUS,
        active: true,
        weaponType: 'firewall',
        damage: damage * this._player.damageMult,
        // Store base angle offset in velocityX for use in updateProjectiles
        velocityX: angleOffset,
        // velocityY unused for firewall; store 0
        velocityY: 0,
        lifetime: FIREWALL_LIFETIME,
      };
      this._projectiles.push(projectile);
    }

    weapon.cooldownRemaining = FIREWALL_COOLDOWN_MS;
  }

  /**
   * Fire the Port Scanner weapon: an expanding ring from the player's position.
   * The ring damages all enemies it touches as it expands outward.
   * Uses radius field to represent the current ring size and velocityX to
   * store the expansion speed.
   */
  private firePortScanner(weapon: WeaponState): void {
    const damage = Math.ceil(PORT_SCANNER_DAMAGE * (1 + (weapon.level - 1) * 0.4));

    const projectile: Projectile = {
      id: this._nextEntityId++,
      x: this._player.x,
      y: this._player.y,
      radius: 5, // Starting radius, will expand
      active: true,
      weaponType: 'port-scanner',
      damage: damage * this._player.damageMult,
      velocityX: PORT_SCANNER_EXPAND_SPEED + weapon.level * 20, // expansion speed
      velocityY: 0, // unused
      lifetime: PORT_SCANNER_LIFETIME + weapon.level * 200,
    };
    this._projectiles.push(projectile);

    weapon.cooldownRemaining = Math.max(1500, PORT_SCANNER_COOLDOWN_MS - weapon.level * 200);

    this.emit('weapon-fired' as MinigameEventType, {
      minigameId: this.id,
      data: {
        weaponType: 'port-scanner',
        x: this._player.x,
        y: this._player.y,
      },
    });
  }

  /**
   * Fire the Exploit weapon: a homing projectile that seeks the nearest enemy.
   * If no enemies are present, fires in the player's facing direction.
   */
  private fireExploit(weapon: WeaponState): void {
    const damage = Math.ceil(EXPLOIT_DAMAGE * (1 + (weapon.level - 1) * 0.35));

    // Find the nearest active enemy
    let targetX = this._player.x + this._player.facingX * 100;
    let targetY = this._player.y + this._player.facingY * 100;
    let nearestDist = Infinity;

    for (const enemy of this._enemies) {
      if (!enemy.active) {continue;}
      const dx = enemy.x - this._player.x;
      const dy = enemy.y - this._player.y;
      const dist = dx * dx + dy * dy;
      if (dist < nearestDist) {
        nearestDist = dist;
        targetX = enemy.x;
        targetY = enemy.y;
      }
    }

    // Direction toward target
    let dirX = targetX - this._player.x;
    let dirY = targetY - this._player.y;
    const length = Math.sqrt(dirX * dirX + dirY * dirY);
    if (length > 0) {
      dirX /= length;
      dirY /= length;
    } else {
      dirX = this._player.facingX || 1;
      dirY = this._player.facingY;
    }

    const projectile: Projectile = {
      id: this._nextEntityId++,
      x: this._player.x,
      y: this._player.y,
      radius: PROJECTILE_RADIUS + 2,
      active: true,
      weaponType: 'exploit',
      damage: damage * this._player.damageMult,
      velocityX: dirX * EXPLOIT_PROJECTILE_SPEED,
      velocityY: dirY * EXPLOIT_PROJECTILE_SPEED,
      lifetime: EXPLOIT_LIFETIME,
    };
    this._projectiles.push(projectile);

    weapon.cooldownRemaining = Math.max(800, EXPLOIT_COOLDOWN_MS - weapon.level * 100);

    this.emit('weapon-fired' as MinigameEventType, {
      minigameId: this.id,
      data: {
        weaponType: 'exploit',
        x: this._player.x,
        y: this._player.y,
        dirX,
        dirY,
      },
    });
  }

  // ==========================================================================
  // Private Methods - Projectiles
  // ==========================================================================

  /**
   * Update projectile positions and lifetime.
   * Each weapon type has its own movement behavior.
   */
  private updateProjectiles(deltaMs: number, deltaSec: number): void {
    for (const proj of this._projectiles) {
      if (!proj.active) {continue;}

      switch (proj.weaponType) {
        case 'firewall':
          this.updateFirewallProjectile(proj);
          break;

        case 'port-scanner':
          this.updatePortScannerProjectile(proj, deltaMs, deltaSec);
          break;

        case 'exploit':
          this.updateExploitProjectile(proj, deltaMs, deltaSec);
          break;

        default:
          // Ping and any other linear projectiles
          proj.x += proj.velocityX * deltaSec;
          proj.y += proj.velocityY * deltaSec;
          break;
      }

      // Decrement lifetime
      proj.lifetime -= deltaMs;

      // Deactivate if lifetime expired
      if (proj.lifetime <= 0) {
        proj.active = false;
        continue;
      }

      // Out-of-bounds check (skip for firewall since it follows player,
      // and port-scanner since it expands from a fixed point)
      if (proj.weaponType !== 'firewall' && proj.weaponType !== 'port-scanner') {
        if (
          proj.x < -proj.radius ||
          proj.x > this.config.arenaWidth + proj.radius ||
          proj.y < -proj.radius ||
          proj.y > this.config.arenaHeight + proj.radius
        ) {
          proj.active = false;
        }
      }
    }
  }

  /**
   * Update a Firewall projectile: orbit around the player at a fixed radius.
   * The angle offset is stored in velocityX; the position is recalculated
   * from the player position and elapsed game time each frame.
   */
  private updateFirewallProjectile(proj: Projectile): void {
    const angleOffset = proj.velocityX;
    const currentAngle = angleOffset + (this._playTimeMs / 1000) * FIREWALL_ROTATION_SPEED;
    proj.x = this._player.x + Math.cos(currentAngle) * FIREWALL_ORBIT_RADIUS;
    proj.y = this._player.y + Math.sin(currentAngle) * FIREWALL_ORBIT_RADIUS;
  }

  /**
   * Update a Port Scanner projectile: expand the ring radius over time.
   * The expansion speed is stored in velocityX. The projectile stays at
   * its spawn position while the radius grows.
   */
  private updatePortScannerProjectile(proj: Projectile, _deltaMs: number, deltaSec: number): void {
    // Expand the ring radius
    proj.radius += proj.velocityX * deltaSec;

    // Cap the radius
    if (proj.radius > PORT_SCANNER_MAX_RADIUS) {
      proj.active = false;
    }
  }

  /**
   * Update an Exploit projectile: gently home toward the nearest enemy.
   * Adjusts heading each frame toward the closest active enemy.
   */
  private updateExploitProjectile(proj: Projectile, _deltaMs: number, deltaSec: number): void {
    // Find nearest active enemy
    let nearestDist = Infinity;
    let targetX = proj.x + proj.velocityX;
    let targetY = proj.y + proj.velocityY;

    for (const enemy of this._enemies) {
      if (!enemy.active) {continue;}
      const dx = enemy.x - proj.x;
      const dy = enemy.y - proj.y;
      const dist = dx * dx + dy * dy;
      if (dist < nearestDist) {
        nearestDist = dist;
        targetX = enemy.x;
        targetY = enemy.y;
      }
    }

    // Calculate desired direction
    const desiredDx = targetX - proj.x;
    const desiredDy = targetY - proj.y;
    const desiredLength = Math.sqrt(desiredDx * desiredDx + desiredDy * desiredDy);

    if (desiredLength > 1) {
      const desiredAngle = Math.atan2(desiredDy, desiredDx);
      const currentAngle = Math.atan2(proj.velocityY, proj.velocityX);

      // Calculate angle difference and clamp turn rate
      let angleDiff = desiredAngle - currentAngle;
      // Normalize to [-PI, PI]
      while (angleDiff > Math.PI) {angleDiff -= 2 * Math.PI;}
      while (angleDiff < -Math.PI) {angleDiff += 2 * Math.PI;}

      const maxTurn = EXPLOIT_HOMING_RATE * deltaSec;
      const turnAmount = Math.max(-maxTurn, Math.min(maxTurn, angleDiff));
      const newAngle = currentAngle + turnAmount;

      const speed = Math.sqrt(proj.velocityX * proj.velocityX + proj.velocityY * proj.velocityY);
      proj.velocityX = Math.cos(newAngle) * speed;
      proj.velocityY = Math.sin(newAngle) * speed;
    }

    // Move
    proj.x += proj.velocityX * deltaSec;
    proj.y += proj.velocityY * deltaSec;
  }

  // ==========================================================================
  // Private Methods - Enemies
  // ==========================================================================

  /**
   * Update enemy positions, moving them toward the player.
   */
  private updateEnemies(deltaSec: number): void {
    for (const enemy of this._enemies) {
      if (!enemy.active) {continue;}

      // Move toward player
      const dx = this._player.x - enemy.x;
      const dy = this._player.y - enemy.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist > 1) {
        // Avoid division by zero
        enemy.x += (dx / dist) * enemy.speed * deltaSec;
        enemy.y += (dy / dist) * enemy.speed * deltaSec;
      }

      // Decrement hit cooldown
      if (enemy.hitCooldown > 0) {
        enemy.hitCooldown = Math.max(0, enemy.hitCooldown - deltaSec * 1000);
      }
    }
  }

  // ==========================================================================
  // Private Methods - Spawner
  // ==========================================================================

  /**
   * Update the enemy spawner using the time-based spawn schedule.
   *
   * Determines the current spawn bracket from elapsed time, then spawns
   * enemies at the bracket's interval. The bracket controls which enemy
   * types are available, spawn rate, and HP scaling.
   */
  private updateSpawner(deltaMs: number): void {
    const bracket = getSpawnBracket(this._playTimeMs);
    this._spawnTimer += deltaMs;

    if (this._spawnTimer >= bracket.spawnIntervalMs) {
      this._spawnTimer -= bracket.spawnIntervalMs;
      const enemyType = pickRandomEnemyType(bracket);
      this.spawnEnemy(enemyType, bracket);
    }
  }

  /**
   * Spawn an enemy (or group of enemies) of the given type at the arena edge.
   *
   * For enemy types with groupSize > 1 (e.g., Worm), multiple enemies are
   * spawned at nearby positions around the same edge point.
   *
   * @param type - The enemy type to spawn
   * @param bracket - The current spawn bracket (for HP scaling)
   */
  private spawnEnemy(type: EnemyType, bracket: SpawnBracket): void {
    const def = ENEMY_DEFINITIONS[type];
    const { x: baseX, y: baseY } = this.getRandomEdgePosition(def.radius);
    const count = rollGroupSize(def);

    for (let i = 0; i < count; i++) {
      // Apply positional offset for group members (first member spawns at base)
      const offsetX = i === 0 ? 0 : (Math.random() * 2 - 1) * def.groupOffset;
      const offsetY = i === 0 ? 0 : (Math.random() * 2 - 1) * def.groupOffset;

      const hp = rollEnemyHp(def, bracket.hpMultiplier);

      const enemy: Enemy = {
        id: this._nextEntityId++,
        x: baseX + offsetX,
        y: baseY + offsetY,
        radius: def.radius,
        active: true,
        type,
        hp,
        maxHp: hp,
        speed: def.speed,
        xpValue: def.xpValue,
        hitCooldown: 0,
      };

      this._enemies.push(enemy);
    }
  }

  /**
   * Get a random position along the arena edges (outside bounds by one radius).
   *
   * @param radius - The enemy radius, used to calculate spawn margin
   */
  private getRandomEdgePosition(radius: number = DEFAULT_ENEMY_RADIUS): { x: number; y: number } {
    // Pick a random edge: 0=top, 1=right, 2=bottom, 3=left
    const edge = Math.floor(Math.random() * 4);
    const margin = radius + 5; // Spawn slightly outside

    switch (edge) {
      case 0: // Top
        return { x: Math.random() * this.config.arenaWidth, y: -margin };
      case 1: // Right
        return { x: this.config.arenaWidth + margin, y: Math.random() * this.config.arenaHeight };
      case 2: // Bottom
        return { x: Math.random() * this.config.arenaWidth, y: this.config.arenaHeight + margin };
      case 3: // Left
        return { x: -margin, y: Math.random() * this.config.arenaHeight };
      default:
        return { x: -margin, y: Math.random() * this.config.arenaHeight };
    }
  }

  // ==========================================================================
  // Private Methods - Collision Detection
  // ==========================================================================

  /**
   * Circle-circle collision using distance-squared comparison (avoids sqrt).
   *
   * @returns true if the two circles overlap
   */
  private circleCollision(
    x1: number,
    y1: number,
    r1: number,
    x2: number,
    y2: number,
    r2: number
  ): boolean {
    const dx = x1 - x2;
    const dy = y1 - y2;
    const distSq = dx * dx + dy * dy;
    const radiusSum = r1 + r2;
    return distSq < radiusSum * radiusSum;
  }

  /**
   * Check collisions between projectiles and enemies.
   * On hit: reduce enemy HP, deactivate projectile (unless piercing), and handle enemy death.
   *
   * Different weapon types have different collision behaviors:
   * - Ping/Exploit: standard circle-circle, consumed on hit
   * - Firewall: circle-circle, NOT consumed (pierces through enemies)
   * - Port Scanner: ring collision (enemy within ring radius), NOT consumed
   */
  private checkProjectileEnemyCollisions(): void {
    for (const proj of this._projectiles) {
      if (!proj.active) {continue;}

      for (const enemy of this._enemies) {
        if (!enemy.active) {continue;}

        let hit = false;

        if (proj.weaponType === 'port-scanner') {
          // Ring collision: enemy center within expanding ring radius
          const dx = proj.x - enemy.x;
          const dy = proj.y - enemy.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          // Hit if enemy is within the ring (with some tolerance for the ring width)
          const ringWidth = 15;
          hit = dist < proj.radius + enemy.radius && dist > proj.radius - ringWidth - enemy.radius;
        } else {
          hit = this.circleCollision(proj.x, proj.y, proj.radius, enemy.x, enemy.y, enemy.radius);
        }

        if (hit) {
          // Apply damage (with global damage multiplier for non-firewall/port-scanner;
          // those already have it baked in at fire time)
          const effectiveDamage = (proj.weaponType === 'ping' || proj.weaponType === 'exploit')
            ? proj.damage * this._player.damageMult
            : proj.damage;
          enemy.hp -= effectiveDamage;

          // Firewall and Port Scanner pierce through enemies; others are consumed
          const piercing = proj.weaponType === 'firewall' || proj.weaponType === 'port-scanner';
          if (!piercing) {
            proj.active = false;
          }

          // Check if enemy is dead
          if (enemy.hp <= 0) {
            enemy.active = false;
            this._kills++;
            this._successCount++;

            // Spawn XP gem at enemy position (capped)
            this.spawnXPGem(enemy.x, enemy.y, enemy.xpValue);

            // Emit enemy-killed event
            this.emit('enemy-killed' as MinigameEventType, {
              minigameId: this.id,
              data: {
                enemyType: enemy.type,
                x: enemy.x,
                y: enemy.y,
                xpValue: enemy.xpValue,
              },
            });
          }

          // Non-piercing projectiles are consumed, move to next projectile
          if (!piercing) {
            break;
          }
        }
      }
    }
  }

  /**
   * Check collisions between enemies and the player.
   * On hit: deal 1 damage and apply i-frames. No damage during i-frames.
   */
  private checkEnemyPlayerCollisions(): void {
    if (this._player.iFramesRemaining > 0) {
      return; // Player is invincible
    }

    for (const enemy of this._enemies) {
      if (!enemy.active) {continue;}

      if (
        this.circleCollision(
          this._player.x,
          this._player.y,
          PLAYER_RADIUS,
          enemy.x,
          enemy.y,
          enemy.radius
        )
      ) {
        // Deal damage to player
        this._player.hp -= 1;
        this._player.iFramesRemaining = this.config.iFramesMs;
        this._failCount++;

        // Emit player-hit event
        this.emit('player-hit' as MinigameEventType, {
          minigameId: this.id,
          data: {
            hp: this._player.hp,
            maxHp: this._player.maxHp,
            enemyType: enemy.type,
          },
        });

        // Only take one hit per frame
        break;
      }
    }
  }

  // ==========================================================================
  // Private Methods - XP Gems
  // ==========================================================================

  /**
   * Spawn an XP gem at the given position if below the gem cap.
   *
   * @param x - X position of the gem
   * @param y - Y position of the gem
   * @param value - XP value of the gem
   */
  private spawnXPGem(x: number, y: number, value: number): void {
    const activeGems = this._xpGems.filter((g) => g.active).length;
    if (activeGems >= XP_GEM_CAP) {
      return;
    }

    const gem: XPGem = {
      id: this._nextEntityId++,
      x,
      y,
      radius: XP_GEM_RADIUS,
      active: true,
      value,
    };
    this._xpGems.push(gem);
  }

  /**
   * Update XP gems: apply magnetic pull toward player and collect when close.
   * Gems within pickupRadius are lerped toward the player. Gems within
   * XP_GEM_COLLECT_RADIUS are collected, adding their value to currentXP.
   */
  private updateXPGems(deltaSec: number): void {
    for (const gem of this._xpGems) {
      if (!gem.active) {continue;}

      const dx = this._player.x - gem.x;
      const dy = this._player.y - gem.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Check collection (innermost radius)
      if (dist < XP_GEM_COLLECT_RADIUS) {
        gem.active = false;
        this.collectXP(gem.value);
        continue;
      }

      // Magnetic pull within pickup radius
      if (dist < this._player.pickupRadius) {
        // Speed is inversely proportional to distance: closer = faster
        const pullStrength = XP_GEM_PULL_SPEED * (1 - dist / this._player.pickupRadius);
        const moveAmount = pullStrength * deltaSec;

        // Normalize direction and move gem toward player
        const normDx = dx / dist;
        const normDy = dy / dist;
        gem.x += normDx * moveAmount;
        gem.y += normDy * moveAmount;
      }
    }
  }

  /**
   * Add XP and check for level-up. Handles excess XP carry-over.
   *
   * @param amount - Amount of XP to add
   */
  private collectXP(amount: number): void {
    this._currentXP += amount;

    // Check for level-up
    if (this._currentXP >= this._xpToNextLevel) {
      this._currentXP -= this._xpToNextLevel;
      this._level++;
      this._xpToNextLevel = Math.floor(
        this.config.baseXPToLevel * Math.pow(this.config.xpLevelScaling, this._level)
      );

      // Pause game and show level-up overlay
      this.pause();
      this._isLevelingUp = true;
      this._upgradeChoices = this.generateUpgradeChoices();
    }
  }

  // ==========================================================================
  // Private Methods - Upgrade System
  // ==========================================================================

  /**
   * Generate upgrade choices for the level-up overlay.
   * Returns upgradeChoiceCount (default 3) choices from: new-weapon, upgrade-weapon, stat-boost.
   * Invalid choices are filtered out; shortfalls are filled with stat boosts.
   */
  private generateUpgradeChoices(): UpgradeChoice[] {
    const choiceCount = this.config.upgradeChoiceCount;
    const candidates: UpgradeChoice[] = [];

    // Gather all valid new-weapon choices
    const ownedWeaponTypes = new Set(this._weapons.map((w) => w.type));
    for (const wt of ALL_WEAPON_TYPES) {
      if (!ownedWeaponTypes.has(wt)) {
        candidates.push({
          type: 'new-weapon',
          weaponType: wt,
          label: `New: ${this.formatWeaponName(wt)}`,
          description: `Unlock the ${this.formatWeaponName(wt)} weapon.`,
        });
      }
    }

    // Gather all valid upgrade-weapon choices
    for (const weapon of this._weapons) {
      if (weapon.level < MAX_WEAPON_LEVEL) {
        candidates.push({
          type: 'upgrade-weapon',
          weaponType: weapon.type,
          label: `${this.formatWeaponName(weapon.type)} Lv.${weapon.level + 1}`,
          description: `Upgrade ${this.formatWeaponName(weapon.type)} to level ${weapon.level + 1}.`,
        });
      }
    }

    // Gather stat-boost choices
    const statBoosts = this.getStatBoostChoices();
    candidates.push(...statBoosts);

    // Shuffle candidates
    this.shuffleArray(candidates);

    // Pick up to choiceCount
    const choices: UpgradeChoice[] = [];
    for (const candidate of candidates) {
      if (choices.length >= choiceCount) {break;}
      choices.push(candidate);
    }

    // Fill remaining slots with stat boosts if not enough candidates
    while (choices.length < choiceCount) {
      const available = statBoosts.filter(
        (sb) => !choices.some((c) => c.statType === sb.statType)
      );
      if (available.length > 0) {
        const pick = available[Math.floor(Math.random() * available.length)]!;
        choices.push(pick);
      } else {
        // Fallback: duplicate a random stat boost
        const pick = statBoosts[Math.floor(Math.random() * statBoosts.length)]!;
        choices.push(pick);
      }
    }

    return choices;
  }

  /**
   * Get all available stat-boost upgrade choices.
   */
  private getStatBoostChoices(): UpgradeChoice[] {
    return [
      {
        type: 'stat-boost',
        statType: 'speed',
        label: '+15% Speed',
        description: 'Increase movement speed by 15%.',
      },
      {
        type: 'stat-boost',
        statType: 'maxHP',
        label: '+1 Max HP',
        description: 'Increase max HP by 1 and heal 1 HP.',
      },
      {
        type: 'stat-boost',
        statType: 'pickupRadius',
        label: '+20px Pickup',
        description: 'Increase XP gem pickup radius by 20 pixels.',
      },
      {
        type: 'stat-boost',
        statType: 'damageMult',
        label: '+20% Damage',
        description: 'Increase all weapon damage by 20%.',
      },
    ];
  }

  /**
   * Apply the selected upgrade choice and resume gameplay.
   *
   * @param choiceIndex - Index into the current upgradeChoices array (0-based)
   */
  applyUpgrade(choiceIndex: number): void {
    if (!this._isLevelingUp) {return;}
    if (choiceIndex < 0 || choiceIndex >= this._upgradeChoices.length) {return;}

    const choice = this._upgradeChoices[choiceIndex]!;

    switch (choice.type) {
      case 'new-weapon': {
        if (choice.weaponType) {
          this._weapons.push({
            type: choice.weaponType,
            level: 1,
            cooldownRemaining: 0,
          });
        }
        break;
      }
      case 'upgrade-weapon': {
        if (choice.weaponType) {
          const weapon = this._weapons.find((w) => w.type === choice.weaponType);
          if (weapon && weapon.level < MAX_WEAPON_LEVEL) {
            weapon.level++;
          }
        }
        break;
      }
      case 'stat-boost': {
        switch (choice.statType) {
          case 'speed':
            this._player.speed *= 1.15;
            break;
          case 'maxHP':
            this._player.maxHp += 1;
            this._player.hp = Math.min(this._player.hp + 1, this._player.maxHp);
            break;
          case 'pickupRadius':
            this._player.pickupRadius += 20;
            break;
          case 'damageMult':
            this._player.damageMult *= 1.20;
            break;
        }
        break;
      }
    }

    // Clear level-up state and resume
    this._isLevelingUp = false;
    this._upgradeChoices = [];
    this.resume();
  }

  // ==========================================================================
  // Private Methods - Utility
  // ==========================================================================

  /**
   * Format a weapon type enum into a display name.
   * e.g., 'port-scanner' -> 'Port Scanner'
   */
  private formatWeaponName(type: WeaponType): string {
    return type
      .split('-')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  /**
   * Fisher-Yates shuffle (in-place).
   */
  private shuffleArray<T>(arr: T[]): void {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const temp = arr[i]!;
      arr[i] = arr[j]!;
      arr[j] = temp;
    }
  }

  // ==========================================================================
  // Private Methods - Entity Cleanup
  // ==========================================================================

  /**
   * Remove inactive entities from arrays to keep memory usage bounded.
   */
  private cleanupEntities(): void {
    this._enemies = this._enemies.filter((e) => e.active);
    this._projectiles = this._projectiles.filter((p) => p.active);
    this._xpGems = this._xpGems.filter((g) => g.active);
  }

  // ==========================================================================
  // State Management
  // ==========================================================================

  /**
   * Reset all state to initial values.
   */
  protected override resetState(): void {
    super.resetState();
    this._nextEntityId = 0;
    this._player = this.createDefaultPlayer();
    this._enemies = [];
    this._projectiles = [];
    this._xpGems = [];
    this._weapons = [];
    this._kills = 0;
    this._currentXP = 0;
    this._xpToNextLevel = this.config.baseXPToLevel;
    this._level = 1;
    this._isLevelingUp = false;
    this._upgradeChoices = [];
    this._moneyEarned = 0;
    this._spawnTimer = 0;
    this._input = { left: false, right: false, up: false, down: false };
  }

  // ==========================================================================
  // Static Helpers
  // ==========================================================================

  /**
   * Get the minigame ID constant.
   */
  static get MINIGAME_ID(): string {
    return 'botnet-defense';
  }

  /**
   * Calculate expected money for a given score.
   *
   * @param score - The score value
   * @param config - Optional config (uses default if not provided)
   * @returns Money as string
   */
  static calculateReward(score: number, config?: BotnetDefenseConfig): string {
    const moneyPerScore =
      config?.moneyPerScore ?? DEFAULT_CONFIG.minigames.botnetDefense.moneyPerScore;
    return String(Math.floor(score * moneyPerScore));
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a new Botnet Defense game instance.
 *
 * @param config - Optional configuration override
 * @returns A new BotnetDefenseGame instance
 */
export function createBotnetDefenseGame(
  config?: BotnetDefenseConfig
): BotnetDefenseGame {
  return new BotnetDefenseGame(config);
}
