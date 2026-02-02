/**
 * Botnet Defense Auto-Play Controller
 *
 * AI controller that drives Botnet Defense movement and level-up decisions
 * automatically. Each frame, the AI computes a movement vector from three
 * forces: enemy threat repulsion, XP gem attraction, and arena centering.
 * On level-up, the AI selects an upgrade card based on its strategy tier.
 *
 * AI Level Parameters:
 * | Level | Dodge Radius | XP Collection Priority | Upgrade Strategy      |
 * |-------|-------------|------------------------|-----------------------|
 * | 1     | 40px        | Ignores gems           | Random choice         |
 * | 2     | 60px        | Nearby gems only       | Avoids duplicates     |
 * | 3     | 80px        | Actively seeks gems    | Prefers weapon upgrades|
 * | 4     | 100px       | Optimal pathing        | Tier-aware choices    |
 * | 5     | 120px       | Perfect collection     | Optimal build order   |
 *
 * Usage:
 *   const controller = createBotnetDefenseAutoPlay(game, 3);
 *   // In game loop:
 *   controller.update(deltaMs);
 *   // On cleanup:
 *   controller.destroy();
 */

import type { AutoPlayController } from '../code-breaker/auto-play';
import type { BotnetDefenseGame } from './BotnetDefenseGame';
import type { UpgradeChoice } from './types';

// ============================================================================
// Level Configuration
// ============================================================================

/**
 * Parameters for a single AI level in Botnet Defense.
 */
interface AILevelParams {
  /** Radius in pixels within which enemies trigger avoidance */
  dodgeRadius: number;
  /** Weight of XP gem attraction (0 = ignore, higher = stronger pull) */
  gemAttractionWeight: number;
  /** Maximum distance at which gems are considered (0 = ignore gems) */
  gemDetectionRadius: number;
  /** Weight of arena centering force */
  centerWeight: number;
  /** Weight of enemy repulsion force */
  threatWeight: number;
  /** Upgrade selection strategy */
  upgradeStrategy: UpgradeStrategy;
}

type UpgradeStrategy = 'random' | 'avoid-duplicates' | 'prefer-weapons' | 'tier-aware' | 'optimal';

/**
 * AI level configurations indexed by level (1-5).
 * Index 0 is unused; levels start at 1.
 */
const AI_LEVEL_PARAMS: readonly AILevelParams[] = [
  // Index 0: placeholder (unused)
  {
    dodgeRadius: 0,
    gemAttractionWeight: 0,
    gemDetectionRadius: 0,
    centerWeight: 0,
    threatWeight: 0,
    upgradeStrategy: 'random',
  },
  // Level 1: Small dodge radius, ignores gems, random upgrades
  {
    dodgeRadius: 40,
    gemAttractionWeight: 0,
    gemDetectionRadius: 0,
    centerWeight: 0.3,
    threatWeight: 1.0,
    upgradeStrategy: 'random',
  },
  // Level 2: Medium dodge radius, picks up nearby gems, avoids duplicate upgrades
  {
    dodgeRadius: 60,
    gemAttractionWeight: 0.4,
    gemDetectionRadius: 80,
    centerWeight: 0.4,
    threatWeight: 1.2,
    upgradeStrategy: 'avoid-duplicates',
  },
  // Level 3: Good dodge radius, actively seeks gems, prefers weapons
  {
    dodgeRadius: 80,
    gemAttractionWeight: 0.7,
    gemDetectionRadius: 150,
    centerWeight: 0.5,
    threatWeight: 1.5,
    upgradeStrategy: 'prefer-weapons',
  },
  // Level 4: Large dodge radius, optimal gem pathing, tier-aware upgrades
  {
    dodgeRadius: 100,
    gemAttractionWeight: 1.0,
    gemDetectionRadius: 250,
    centerWeight: 0.6,
    threatWeight: 2.0,
    upgradeStrategy: 'tier-aware',
  },
  // Level 5: Maximum dodge radius, perfect gem collection, optimal build order
  {
    dodgeRadius: 120,
    gemAttractionWeight: 1.5,
    gemDetectionRadius: 400,
    centerWeight: 0.7,
    threatWeight: 2.5,
    upgradeStrategy: 'optimal',
  },
];

/**
 * Preferred weapon upgrade order for tier-aware and optimal strategies.
 * New weapons are prioritized over stat boosts, and specific weapons are
 * preferred based on overall effectiveness in the survival meta.
 */
const WEAPON_PRIORITY: readonly string[] = [
  'firewall',      // Best passive DPS, always active
  'exploit',       // Homing = reliable damage
  'port-scanner',  // AoE clear for dense spawns
  'ping',          // Already owned at start, upgrades are less impactful
];

/**
 * Preferred stat boost priority for optimal strategy.
 */
const STAT_PRIORITY: readonly string[] = [
  'damageMult',    // Global damage scaling
  'speed',         // Survivability
  'maxHP',         // Buffer against mistakes
  'pickupRadius',  // Quality of life
];

// ============================================================================
// Implementation
// ============================================================================

/**
 * Botnet Defense auto-play controller implementation.
 *
 * Each frame, the controller reads the game state and computes a composite
 * movement vector from three forces:
 * 1. Threat avoidance: repulsion from nearby enemies, inversely weighted by distance
 * 2. Gem attraction: pull toward XP gems within detection radius
 * 3. Arena centering: gentle pull toward arena center to avoid getting cornered
 *
 * The composite vector is converted to directional boolean input
 * ({ left, right, up, down }) and injected via game.setInput().
 *
 * When the game enters the level-up state, the AI selects an upgrade
 * card automatically based on its strategy tier.
 */
class BotnetDefenseAutoPlayController implements AutoPlayController {
  readonly level: number;

  private readonly game: BotnetDefenseGame;
  private readonly params: AILevelParams;

  /** Whether the controller has been destroyed */
  private destroyed: boolean = false;

  /** Track the last leveling-up state to detect transitions */
  private wasLevelingUp: boolean = false;

  /** Small delay before selecting an upgrade (feels more natural) */
  private levelUpDelayMs: number = 0;
  private readonly levelUpDelayTarget: number = 300;

  constructor(game: BotnetDefenseGame, level: number) {
    this.game = game;
    this.level = level;

    // Clamp level to valid range
    const clampedLevel = Math.max(1, Math.min(5, level));
    this.params = AI_LEVEL_PARAMS[clampedLevel]!;
  }

  update(deltaMs: number): void {
    if (this.destroyed) return;

    const state = this.game.getState();

    // Handle level-up selection
    if (state.isLevelingUp) {
      this.handleLevelUp(deltaMs, state.upgradeChoices);
      return;
    }

    // Reset level-up tracking when not leveling up
    if (this.wasLevelingUp) {
      this.wasLevelingUp = false;
      this.levelUpDelayMs = 0;
    }

    // Only move while the game is actively playing
    if (!this.game.isPlaying) return;

    // Compute movement vector
    const { player, enemies, xpGems } = state;
    let moveX = 0;
    let moveY = 0;

    // 1. Threat avoidance: repulsion from nearby enemies
    const dodgeRadiusSq = this.params.dodgeRadius * this.params.dodgeRadius;
    for (const enemy of enemies) {
      const dx = player.x - enemy.x;
      const dy = player.y - enemy.y;
      const distSq = dx * dx + dy * dy;

      if (distSq < dodgeRadiusSq && distSq > 0.01) {
        // Repulsion strength inversely proportional to distance squared
        // Closer enemies push harder
        const dist = Math.sqrt(distSq);
        const strength = (this.params.dodgeRadius - dist) / this.params.dodgeRadius;
        const normX = dx / dist;
        const normY = dy / dist;

        moveX += normX * strength * this.params.threatWeight;
        moveY += normY * strength * this.params.threatWeight;
      }
    }

    // 2. Gem attraction: pull toward nearby XP gems
    if (this.params.gemDetectionRadius > 0 && this.params.gemAttractionWeight > 0) {
      const gemRadiusSq = this.params.gemDetectionRadius * this.params.gemDetectionRadius;
      let closestGemDist = Infinity;
      let closestGemX = 0;
      let closestGemY = 0;
      let hasGemTarget = false;

      for (const gem of xpGems) {
        const dx = gem.x - player.x;
        const dy = gem.y - player.y;
        const distSq = dx * dx + dy * dy;

        if (distSq < gemRadiusSq && distSq < closestGemDist) {
          closestGemDist = distSq;
          closestGemX = dx;
          closestGemY = dy;
          hasGemTarget = true;
        }
      }

      if (hasGemTarget) {
        const dist = Math.sqrt(closestGemDist);
        if (dist > 0.01) {
          const normX = closestGemX / dist;
          const normY = closestGemY / dist;
          moveX += normX * this.params.gemAttractionWeight;
          moveY += normY * this.params.gemAttractionWeight;
        }
      }
    }

    // 3. Arena centering: pull toward center to avoid corners
    // Use the game config for arena dimensions via the state snapshot
    // We approximate from the state - the arena center is roughly half the arena size
    // The game config provides arenaWidth/arenaHeight but we access via getState()
    // which doesn't expose config. We use a reasonable estimate from the player bounds.
    const arenaWidth = this.getArenaWidth();
    const arenaHeight = this.getArenaHeight();
    const centerX = arenaWidth / 2;
    const centerY = arenaHeight / 2;

    const toCenterX = centerX - player.x;
    const toCenterY = centerY - player.y;
    const distToCenter = Math.sqrt(toCenterX * toCenterX + toCenterY * toCenterY);

    if (distToCenter > 0.01) {
      // Centering force increases with distance from center
      const maxDist = Math.sqrt(centerX * centerX + centerY * centerY);
      const centerStrength = (distToCenter / maxDist) * this.params.centerWeight;
      moveX += (toCenterX / distToCenter) * centerStrength;
      moveY += (toCenterY / distToCenter) * centerStrength;
    }

    // Convert composite vector to directional input
    // Use a dead zone to avoid jitter
    const deadZone = 0.05;
    this.game.setInput({
      left: moveX < -deadZone,
      right: moveX > deadZone,
      up: moveY < -deadZone,
      down: moveY > deadZone,
    });
  }

  destroy(): void {
    this.destroyed = true;
    // Clear input on destroy
    this.game.setInput({ left: false, right: false, up: false, down: false });
  }

  // ==========================================================================
  // Private Methods - Level-Up Handling
  // ==========================================================================

  /**
   * Handle the level-up overlay: wait a short delay then select an upgrade.
   */
  private handleLevelUp(deltaMs: number, choices: UpgradeChoice[]): void {
    if (!this.wasLevelingUp) {
      // Just entered level-up state
      this.wasLevelingUp = true;
      this.levelUpDelayMs = 0;
    }

    this.levelUpDelayMs += deltaMs;

    if (this.levelUpDelayMs >= this.levelUpDelayTarget && choices.length > 0) {
      const index = this.selectUpgrade(choices);
      this.game.applyUpgrade(index);
    }
  }

  /**
   * Select an upgrade card index based on the AI's strategy tier.
   */
  private selectUpgrade(choices: UpgradeChoice[]): number {
    switch (this.params.upgradeStrategy) {
      case 'random':
        return this.selectRandom(choices);
      case 'avoid-duplicates':
        return this.selectAvoidDuplicates(choices);
      case 'prefer-weapons':
        return this.selectPreferWeapons(choices);
      case 'tier-aware':
        return this.selectTierAware(choices);
      case 'optimal':
        return this.selectOptimal(choices);
      default:
        return 0;
    }
  }

  /**
   * Level 1 strategy: pick a random choice.
   */
  private selectRandom(choices: UpgradeChoice[]): number {
    return Math.floor(Math.random() * choices.length);
  }

  /**
   * Level 2 strategy: avoid picking duplicate weapon upgrades.
   * Prefers new weapons or stat boosts over upgrading an already-upgraded weapon.
   */
  private selectAvoidDuplicates(choices: UpgradeChoice[]): number {
    const state = this.game.getState();
    const currentWeapons = new Set(state.weapons.map((w) => w.type));

    // Prefer new weapons first, then stat boosts, then upgrades
    for (let i = 0; i < choices.length; i++) {
      const choice = choices[i]!;
      if (choice.type === 'new-weapon' && choice.weaponType && !currentWeapons.has(choice.weaponType)) {
        return i;
      }
    }

    for (let i = 0; i < choices.length; i++) {
      if (choices[i]!.type === 'stat-boost') {
        return i;
      }
    }

    return 0;
  }

  /**
   * Level 3 strategy: prefer weapon upgrades and new weapons over stat boosts.
   */
  private selectPreferWeapons(choices: UpgradeChoice[]): number {
    // New weapons first
    for (let i = 0; i < choices.length; i++) {
      if (choices[i]!.type === 'new-weapon') return i;
    }
    // Then weapon upgrades
    for (let i = 0; i < choices.length; i++) {
      if (choices[i]!.type === 'upgrade-weapon') return i;
    }
    // Fallback: first available
    return 0;
  }

  /**
   * Level 4 strategy: tier-aware weapon selection using priority list.
   * Picks the highest-priority weapon action available.
   */
  private selectTierAware(choices: UpgradeChoice[]): number {
    // Score each choice by weapon priority
    let bestIndex = 0;
    let bestScore = -1;

    for (let i = 0; i < choices.length; i++) {
      const choice = choices[i]!;
      let score = 0;

      if (choice.type === 'new-weapon' && choice.weaponType) {
        const priorityIndex = WEAPON_PRIORITY.indexOf(choice.weaponType);
        // New weapons are highly valued; higher priority weapons get higher scores
        score = 100 + (priorityIndex >= 0 ? (WEAPON_PRIORITY.length - priorityIndex) * 10 : 0);
      } else if (choice.type === 'upgrade-weapon' && choice.weaponType) {
        const priorityIndex = WEAPON_PRIORITY.indexOf(choice.weaponType);
        score = 50 + (priorityIndex >= 0 ? (WEAPON_PRIORITY.length - priorityIndex) * 10 : 0);
      } else if (choice.type === 'stat-boost' && choice.statType) {
        const statIndex = STAT_PRIORITY.indexOf(choice.statType);
        score = 10 + (statIndex >= 0 ? (STAT_PRIORITY.length - statIndex) * 5 : 0);
      }

      if (score > bestScore) {
        bestScore = score;
        bestIndex = i;
      }
    }

    return bestIndex;
  }

  /**
   * Level 5 strategy: optimal build order.
   * Prioritizes getting all weapons first (by priority), then upgrades
   * the highest-priority weapons to max, then picks optimal stats.
   */
  private selectOptimal(choices: UpgradeChoice[]): number {
    const state = this.game.getState();
    const ownedWeapons = new Map(state.weapons.map((w) => [w.type, w.level]));

    let bestIndex = 0;
    let bestScore = -1;

    for (let i = 0; i < choices.length; i++) {
      const choice = choices[i]!;
      let score = 0;

      if (choice.type === 'new-weapon' && choice.weaponType) {
        // Getting a new weapon is top priority, especially high-priority ones
        const priorityIndex = WEAPON_PRIORITY.indexOf(choice.weaponType);
        const priorityBonus = priorityIndex >= 0 ? (WEAPON_PRIORITY.length - priorityIndex) * 20 : 0;
        score = 200 + priorityBonus;
      } else if (choice.type === 'upgrade-weapon' && choice.weaponType) {
        const priorityIndex = WEAPON_PRIORITY.indexOf(choice.weaponType);
        const currentLevel = ownedWeapons.get(choice.weaponType) ?? 1;
        const priorityBonus = priorityIndex >= 0 ? (WEAPON_PRIORITY.length - priorityIndex) * 15 : 0;
        // Higher priority for lower-level weapons (they benefit more from upgrades)
        const levelBonus = (5 - currentLevel) * 5;
        score = 100 + priorityBonus + levelBonus;
      } else if (choice.type === 'stat-boost' && choice.statType) {
        const statIndex = STAT_PRIORITY.indexOf(choice.statType);
        score = 20 + (statIndex >= 0 ? (STAT_PRIORITY.length - statIndex) * 8 : 0);
      }

      if (score > bestScore) {
        bestScore = score;
        bestIndex = i;
      }
    }

    return bestIndex;
  }

  // ==========================================================================
  // Private Methods - Arena Dimensions
  // ==========================================================================

  /**
   * Estimate arena width from game state.
   * We use a default matching the standard config since the state snapshot
   * does not expose the raw configuration.
   */
  private getArenaWidth(): number {
    // Default arena width from GameConfig
    return 800;
  }

  /**
   * Estimate arena height from game state.
   */
  private getArenaHeight(): number {
    // Default arena height from GameConfig (canvas height minus HUD space)
    return 500;
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a Botnet Defense auto-play controller.
 *
 * @param game - The BotnetDefenseGame instance to control
 * @param level - AI level (1-5). Values outside range are clamped.
 * @returns An AutoPlayController that drives Botnet Defense inputs
 */
export function createBotnetDefenseAutoPlay(
  game: BotnetDefenseGame,
  level: number,
): AutoPlayController {
  return new BotnetDefenseAutoPlayController(game, level);
}
