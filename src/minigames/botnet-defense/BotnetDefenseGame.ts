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

  /** Player runtime state. */
  private _player: PlayerState = this.createDefaultPlayer();

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
    if (weapon.type === 'ping') {
      this.firePing(weapon);
    }
  }

  /**
   * Fire the Ping weapon: a single directional projectile.
   * Level 1: 1 projectile, 1 damage, 800ms cooldown.
   */
  private firePing(weapon: WeaponState): void {
    // Determine firing direction from player facing
    let dirX = this._player.facingX;
    let dirY = this._player.facingY;

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

  // ==========================================================================
  // Private Methods - Projectiles
  // ==========================================================================

  /**
   * Update projectile positions and lifetime.
   */
  private updateProjectiles(deltaMs: number, deltaSec: number): void {
    for (const proj of this._projectiles) {
      if (!proj.active) continue;

      // Move projectile
      proj.x += proj.velocityX * deltaSec;
      proj.y += proj.velocityY * deltaSec;

      // Decrement lifetime
      proj.lifetime -= deltaMs;

      // Deactivate if lifetime expired or out of arena bounds
      if (
        proj.lifetime <= 0 ||
        proj.x < -proj.radius ||
        proj.x > this.config.arenaWidth + proj.radius ||
        proj.y < -proj.radius ||
        proj.y > this.config.arenaHeight + proj.radius
      ) {
        proj.active = false;
      }
    }
  }

  // ==========================================================================
  // Private Methods - Enemies
  // ==========================================================================

  /**
   * Update enemy positions, moving them toward the player.
   */
  private updateEnemies(deltaSec: number): void {
    for (const enemy of this._enemies) {
      if (!enemy.active) continue;

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
   * On hit: reduce enemy HP, deactivate projectile, and handle enemy death.
   */
  private checkProjectileEnemyCollisions(): void {
    for (const proj of this._projectiles) {
      if (!proj.active) continue;

      for (const enemy of this._enemies) {
        if (!enemy.active) continue;

        if (this.circleCollision(proj.x, proj.y, proj.radius, enemy.x, enemy.y, enemy.radius)) {
          // Apply damage
          enemy.hp -= proj.damage;
          proj.active = false;

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

          // Projectile is consumed, move to next projectile
          break;
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
      if (!enemy.active) continue;

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
      if (!gem.active) continue;

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
      if (choices.length >= choiceCount) break;
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
    if (!this._isLevelingUp) return;
    if (choiceIndex < 0 || choiceIndex >= this._upgradeChoices.length) return;

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
