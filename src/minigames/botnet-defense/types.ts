/**
 * Shared type definitions for the Botnet Defense minigame.
 *
 * A Vampire Survivors-style arena shooter where the player defends against
 * waves of malware enemies, collecting XP gems to level up and choose
 * weapon/stat upgrades.
 */

// ============================================================================
// Enum Types
// ============================================================================

/** Enemy types with distinct behaviors and visual representations. */
export type EnemyType = 'virus' | 'worm' | 'trojan' | 'ransomware';

/** Weapon types the player can acquire and upgrade. */
export type WeaponType = 'ping' | 'firewall' | 'port-scanner' | 'exploit';

// ============================================================================
// Entity Types
// ============================================================================

/** Base entity with position, collision radius, and active flag. */
export interface Entity {
  id: number;
  x: number;
  y: number;
  radius: number;
  active: boolean;
}

/** An enemy entity that moves toward the player. */
export interface Enemy extends Entity {
  type: EnemyType;
  hp: number;
  maxHp: number;
  speed: number;
  xpValue: number;
  /** Remaining cooldown before this enemy can damage the player again (ms) */
  hitCooldown: number;
}

/** A projectile fired by a weapon. */
export interface Projectile extends Entity {
  weaponType: WeaponType;
  damage: number;
  velocityX: number;
  velocityY: number;
  /** Remaining lifetime in milliseconds before the projectile despawns */
  lifetime: number;
  /** Set of enemy IDs already hit by this piercing projectile */
  hitEnemyIds?: Set<number>;
}

/** An XP gem dropped by a defeated enemy. */
export interface XPGem extends Entity {
  value: number;
}

// ============================================================================
// Player and Weapon State
// ============================================================================

/** The player's runtime state during a Botnet Defense session. */
export interface PlayerState {
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  speed: number;
  /** Radius in pixels for magnetic XP gem pickup */
  pickupRadius: number;
  /** Global damage multiplier applied to all weapons */
  damageMult: number;
  /** Remaining invincibility time in milliseconds */
  iFramesRemaining: number;
  /** Horizontal facing direction (-1 left, 0 neutral, 1 right) */
  facingX: number;
  /** Vertical facing direction (-1 up, 0 neutral, 1 down) */
  facingY: number;
}

/** State of a single weapon the player has equipped. */
export interface WeaponState {
  type: WeaponType;
  level: number;
  /** Remaining cooldown before the weapon can fire again (ms) */
  cooldownRemaining: number;
}

// ============================================================================
// Upgrade System
// ============================================================================

/** A single upgrade choice presented to the player on level-up. */
export interface UpgradeChoice {
  type: 'new-weapon' | 'upgrade-weapon' | 'stat-boost';
  weaponType?: WeaponType;
  statType?: string;
  label: string;
  description: string;
}

// ============================================================================
// Session State
// ============================================================================

/**
 * Complete runtime state for a Botnet Defense session.
 *
 * Note: Game phase (playing, paused, game-over) is managed by BaseMinigame.
 * The `isLevelingUp` flag indicates whether the level-up overlay is shown,
 * which pauses gameplay via BaseMinigame's pause/resume mechanism.
 */
export interface BotnetDefenseState {
  player: PlayerState;
  enemies: Enemy[];
  projectiles: Projectile[];
  xpGems: XPGem[];
  weapons: WeaponState[];
  currentXP: number;
  xpToNextLevel: number;
  level: number;
  kills: number;
  /** Whether the level-up upgrade selection overlay is active */
  isLevelingUp: boolean;
  upgradeChoices: UpgradeChoice[];
  /** Accumulated money earned during this session */
  moneyEarned: number;
}
