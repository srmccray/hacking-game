/**
 * Enemy Definitions and Spawn Schedule for Botnet Defense
 *
 * Defines stats for each enemy type as a lookup table and the time-based
 * spawn schedule that controls which enemy types appear and how frequently.
 *
 * Enemy types:
 * - Virus: Basic enemy, slow, low HP (already existed)
 * - Worm: Fast, 1 HP, spawns in groups of 3-5 from same edge point
 * - Trojan: Very slow, high HP, large radius
 * - Ransomware: Medium speed, medium HP, high XP reward
 *
 * Spawn schedule brackets are based on elapsed game time (3-minute session):
 * - 0:00-0:30: Virus only
 * - 0:30-1:00: Virus + Worm
 * - 1:00-1:30: Virus + Worm + Trojan
 * - 1:30-2:00: All types
 * - 2:00-3:00: All types with 1.5x HP scaling
 */

import type { EnemyType } from './types';

// ============================================================================
// Enemy Definition Type
// ============================================================================

/** Static stats for an enemy type (HP is randomized between min and max). */
export interface EnemyDefinition {
  /** Movement speed in pixels per second. */
  speed: number;
  /** Minimum hit points. */
  minHp: number;
  /** Maximum hit points. */
  maxHp: number;
  /** XP gem value dropped on death. */
  xpValue: number;
  /** Collision/display radius in pixels. */
  radius: number;
  /** Number of enemies to spawn per trigger (for group spawning like Worm). */
  groupSize: [number, number];
  /** Positional offset range for group members in pixels. */
  groupOffset: number;
}

// ============================================================================
// Enemy Definitions Lookup
// ============================================================================

/**
 * Lookup table of stats per enemy type.
 *
 * Usage:
 *   const def = ENEMY_DEFINITIONS['worm'];
 *   const hp = def.minHp + Math.floor(Math.random() * (def.maxHp - def.minHp + 1));
 */
export const ENEMY_DEFINITIONS: Record<EnemyType, EnemyDefinition> = {
  virus: {
    speed: 60,
    minHp: 1,
    maxHp: 2,
    xpValue: 1,
    radius: 10,
    groupSize: [1, 1],
    groupOffset: 0,
  },
  worm: {
    speed: 120,
    minHp: 1,
    maxHp: 1,
    xpValue: 1,
    radius: 8,
    groupSize: [3, 5],
    groupOffset: 20,
  },
  trojan: {
    speed: 30,
    minHp: 5,
    maxHp: 8,
    xpValue: 3,
    radius: 16,
    groupSize: [1, 1],
    groupOffset: 0,
  },
  ransomware: {
    speed: 80,
    minHp: 3,
    maxHp: 4,
    xpValue: 5,
    radius: 12,
    groupSize: [1, 1],
    groupOffset: 0,
  },
};

// ============================================================================
// Spawn Schedule
// ============================================================================

/** A single bracket in the spawn schedule. */
export interface SpawnBracket {
  /** Start time in milliseconds (inclusive). */
  startMs: number;
  /** End time in milliseconds (exclusive). */
  endMs: number;
  /** Enemy types available to spawn in this bracket. */
  availableTypes: EnemyType[];
  /** Interval between spawn attempts in milliseconds. */
  spawnIntervalMs: number;
  /** HP multiplier applied to all enemies in this bracket. */
  hpMultiplier: number;
}

/**
 * Time-based spawn schedule for a 3-minute (180,000ms) session.
 *
 * Each bracket defines which enemy types can appear, the spawn rate,
 * and any HP scaling. Brackets are checked in order; the first matching
 * bracket for the current elapsed time is used.
 */
export const SPAWN_SCHEDULE: SpawnBracket[] = [
  {
    startMs: 0,
    endMs: 30_000,
    availableTypes: ['virus'],
    spawnIntervalMs: 2000,
    hpMultiplier: 1.0,
  },
  {
    startMs: 30_000,
    endMs: 60_000,
    availableTypes: ['virus', 'worm'],
    spawnIntervalMs: 1500,
    hpMultiplier: 1.0,
  },
  {
    startMs: 60_000,
    endMs: 90_000,
    availableTypes: ['virus', 'worm', 'trojan'],
    spawnIntervalMs: 1000,
    hpMultiplier: 1.0,
  },
  {
    startMs: 90_000,
    endMs: 120_000,
    availableTypes: ['virus', 'worm', 'trojan', 'ransomware'],
    spawnIntervalMs: 800,
    hpMultiplier: 1.0,
  },
  {
    startMs: 120_000,
    endMs: 180_000,
    availableTypes: ['virus', 'worm', 'trojan', 'ransomware'],
    spawnIntervalMs: 500,
    hpMultiplier: 1.5,
  },
];

// ============================================================================
// Helpers
// ============================================================================

/**
 * Find the active spawn bracket for the given elapsed time.
 *
 * @param elapsedMs - Elapsed game time in milliseconds
 * @returns The matching SpawnBracket, or the last bracket if time exceeds all ranges
 */
export function getSpawnBracket(elapsedMs: number): SpawnBracket {
  for (const bracket of SPAWN_SCHEDULE) {
    if (elapsedMs >= bracket.startMs && elapsedMs < bracket.endMs) {
      return bracket;
    }
  }
  // Fallback to last bracket if somehow past all defined brackets
  return SPAWN_SCHEDULE[SPAWN_SCHEDULE.length - 1]!;
}

/**
 * Pick a random enemy type from the available types in a bracket.
 *
 * @param bracket - The current spawn bracket
 * @returns A randomly selected EnemyType
 */
export function pickRandomEnemyType(bracket: SpawnBracket): EnemyType {
  const index = Math.floor(Math.random() * bracket.availableTypes.length);
  return bracket.availableTypes[index]!;
}

/**
 * Roll a random HP value for an enemy type, applying the bracket HP multiplier.
 *
 * @param def - The enemy definition
 * @param hpMultiplier - HP scaling factor from the spawn bracket
 * @returns Integer HP value
 */
export function rollEnemyHp(def: EnemyDefinition, hpMultiplier: number): number {
  const baseHp = def.minHp + Math.floor(Math.random() * (def.maxHp - def.minHp + 1));
  return Math.max(1, Math.round(baseHp * hpMultiplier));
}

/**
 * Roll a random group size for an enemy type.
 *
 * @param def - The enemy definition
 * @returns Integer count of enemies to spawn
 */
export function rollGroupSize(def: EnemyDefinition): number {
  const [min, max] = def.groupSize;
  return min + Math.floor(Math.random() * (max - min + 1));
}
