# Balance Reference

All tunable numbers extracted from the source code. Use this file to scan and adjust game balance without reading implementation files.

**Source files:** `src/upgrades/upgrade-definitions.ts`, `src/game/GameConfig.ts`, `src/core/progression/auto-generation.ts`, `src/core/progression/tick-engine.ts`, `src/core/progression/offline-progress.ts`, `src/core/progression/automations.ts`, `src/minigames/code-breaker/CodeBreakerGame.ts`, `src/minigames/code-runner/CodeRunnerGame.ts`, `src/minigames/botnet-defense/BotnetDefenseGame.ts`, `src/minigames/botnet-defense/enemies.ts`, `src/minigames/code-breaker/auto-play.ts`, `src/minigames/code-runner/auto-play.ts`, `src/minigames/botnet-defense/auto-play.ts`

---

## 1. Minigame Upgrades

Cost formula: `baseCost + costIncrement * currentLevel` (linear scaling).

Effect formula: `baseEffect + effectPerLevel * level` (level 0 = no bonus).

| ID | Name | Cost Resource | Base Cost | Cost Increment | Max Level | Effect Type | Base Effect | Effect/Level | Minigame |
|----|------|--------------|-----------|----------------|-----------|-------------|-------------|--------------|----------|
| `gap-expander` | Gap Expander | technique | 10 | +5 | Unlimited | gap_width_bonus | 0 px | +10 px | Code Runner |
| `buffer-overflow` | Buffer Overflow | technique | 10 | +10 | Unlimited | wall_spacing_bonus | 0 px | +15 px | Code Runner |
| `overclock` | Overclock | technique | 10 | +5 | Unlimited | move_speed_bonus | 0 px/s | +25 px/s | Code Runner |
| `central-router` | Central Router | technique | 100 | +50 | 3 | center_bias | 0.3 | +0.3 | Code Runner |
| `timing-exploit` | Timing Exploit | technique | 10 | +10 | 10 | time_bonus | 500 ms | +500 ms | Code Breaker |
| `entropy-reducer` | Entropy Reducer | technique | 100 | +100 | 4 | code_length_reduction | 1 char | +1 char | Code Breaker |
| `error-correction` | Error Correction | technique | 100 | +100 | 5 | typo_allowance | 1 typo | +1 typo | Code Breaker |
| `payload-amplifier` | Payload Amplifier | technique | 10 | +10 | 10 | damage_multiplier_bonus | +10% | +10% | Botnet Defense |
| `redundant-systems` | Redundant Systems | technique | 100 | +100 | 10 | health_bonus | +1 HP | +1 HP | Botnet Defense |
| `auto-play-code-breaker` | AI Auto-Play | technique | 500 | +750 | 5 | auto_play_level | 1 | +1 | Code Breaker |
| `auto-play-code-runner` | AI Auto-Play | technique | 500 | +750 | 5 | auto_play_level | 1 | +1 | Code Runner |
| `auto-play-botnet-defense` | AI Auto-Play | technique | 500 | +750 | 5 | auto_play_level | 1 | +1 | Botnet Defense |

### Auto-Play TP Cost Progression

All three auto-play upgrades share the same cost curve:

| Level | Cost (TP) |
|-------|-----------|
| 1 | 500 |
| 2 | 1,250 |
| 3 | 2,000 |
| 4 | 2,750 |
| 5 | 3,500 |

---

## 2. Equipment Upgrades

Cost formula: `baseCost * (costGrowthRate ^ currentLevel)` (exponential scaling).

Effect formula: `baseEffect + effectPerLevel * level`.

| ID | Name | Cost Resource | Base Cost | Growth Rate | Max Level | Effect Type | Base Effect | Effect/Level |
|----|------|--------------|-----------|-------------|-----------|-------------|-------------|--------------|
| `auto-typer` | Auto-Typer | money | $100 | 1.15x | Unlimited | auto_generation_multiplier | 1.0 (100%) | +0.05 (+5%) |
| `better-keyboard` | Better Keyboard | money | $250 | 1.15x | Unlimited | per_code_time_bonus | 0 s | +0.3 s |

### Auto-Typer Cost Progression (first 10 levels)

| Level | Cost ($) |
|-------|----------|
| 0 | 100 |
| 1 | 115 |
| 2 | 132 |
| 3 | 152 |
| 4 | 175 |
| 5 | 201 |
| 6 | 231 |
| 7 | 266 |
| 8 | 306 |
| 9 | 352 |

---

## 3. Consumable Upgrades

| ID | Name | Cost Resource | Base Cost | Growth Rate | Max Level | Effect | Grants |
|----|------|--------------|-----------|-------------|-----------|--------|--------|
| `training-manual` | Training Manual | money | $10 | 1.0x (flat) | Unlimited | grant_resource | +1 TP |

---

## 4. Hardware Upgrades (Dual Currency)

Cost formula:
- Primary: `baseCost * (costGrowthRate ^ level)`
- Secondary: `secondaryCost * (secondaryCostGrowthRate ^ level)`

| ID | Name | Primary Cost | Growth | Secondary Cost | Growth | Max Level | Effect |
|----|------|-------------|--------|---------------|--------|-----------|--------|
| `book-summarizer` | Book Summarizer | $100 money | 1.5x | 10 TP | 1.5x | 10 | enable_automation: book-summarizer |

### Book Summarizer Cost Progression

| Level | Money Cost | TP Cost |
|-------|-----------|---------|
| 0 | $100 | 10 TP |
| 1 | $150 | 15 TP |
| 2 | $225 | 22 TP |
| 3 | $338 | 34 TP |
| 4 | $506 | 51 TP |
| 5 | $759 | 76 TP |

---

## 5. Resource Generation

### Auto-Generation Formula

```
baseRate = SUM(top 5 scores for each contributing minigame) / scoreToRateDivisor
finalRate = baseRate * autoTyperMultiplier
```

| Parameter | Value | Source |
|-----------|-------|--------|
| Score-to-Rate Divisor | 100 | `GameConfig.autoGeneration.scoreToRateDivisor` |
| Contributing Minigames | code-breaker, botnet-defense | `GameConfig.autoGeneration.moneyGeneratingMinigames` |
| Max Top Scores Tracked | 5 per minigame | `types.ts MAX_TOP_SCORES` |
| Auto-Typer Base Multiplier | 1.0 (100%) | `upgrade-definitions.ts` |
| Auto-Typer Per Level | +0.05 (+5%) | `upgrade-definitions.ts` |

**Example:** If Code Breaker top 5 scores sum to 50 and Botnet Defense top 5 sum to 200, with Auto-Typer level 5:
- baseRate = (50 + 200) / 100 = 2.5 $/sec
- multiplier = 1.0 + (0.05 * 5) = 1.25
- finalRate = 2.5 * 1.25 = 3.125 $/sec

### Automation: Book Summarizer

| Parameter | Value |
|-----------|-------|
| Interval | 60 seconds |
| Money Cost Per Trigger | $10 |
| TP Granted Per Trigger | 1 * upgrade level |
| Effective TP/sec (at level 1) | 0.0167 |
| Effective TP/sec (at level 10) | 0.167 |

### Passive Renown Generation

Survival milestones grant permanent renown income:

| Parameter | Value |
|-----------|-------|
| Renown Bonus Per Milestone | +10 RP/minute |
| Max milestones (Botnet Defense) | 3 (5min, 10min, 15min) |
| Max milestones (Code Runner) | 3 (15, 30, 45 walls) |
| Max milestones (Code Breaker) | 3 (code length 10, 15, 20) |
| Max Passive Renown (all milestones) | 90 RP/minute = 1.5 RP/sec |

---

## 6. Minigame Configs

### Code Breaker

| Parameter | Value | Notes |
|-----------|-------|-------|
| Starting Code Length | 5 characters | Reduced by Entropy Reducer |
| Length Increment | +1 per code cracked | |
| Per-Code Time Limit | 3,000 ms (3 s) | Base timer per code |
| Time Per Extra Char | +300 ms | Beyond startingCodeLength |
| Preview Duration | 750 ms | Input accepted during preview |
| Base Money Per Code | $5 * codeLength | Scales with code length |
| Character Set | A-Z (26 letters) | |
| Max Top Scores | 5 | |

**Effective timer formula:** `perCodeTimeLimitMs + (currentCodeLength - startingCodeLength) * 300 + upgradeBonusMs`

### Code Runner

| Parameter | Value | Notes |
|-----------|-------|-------|
| Scroll Speed | 150 px/sec | Obstacles move down |
| Player Speed | 250 px/sec | Horizontal movement |
| Obstacle Spawn Rate | 1,500 ms | Base interval between walls |
| Gap Width | 80 px | Minimum passage width |
| Player Hitbox | 24 x 32 px | |
| Money Per Wall | $10 | |
| Initial Obstacle Delay | 1,000 ms | Grace period before first wall |
| Obstacle Height | 20 px | |

**Difficulty scaling (per wall passed, one random penalty each):**

| Penalty Type | Amount Per Application | Minimum Floor |
|-------------|----------------------|---------------|
| Spawn Rate | -50 ms from interval | 400 ms minimum |
| Gap Width | -3 px from gap | 30 px minimum |
| Player Speed | -5 px/s from speed | 80 px/s minimum |

### Botnet Defense

| Parameter | Value | Notes |
|-----------|-------|-------|
| Arena Size | 800 x 500 px | |
| Player Speed | 180 px/sec | 8-directional |
| Player Max HP | 5 | +upgradeHealthBonus |
| Time Limit | None (survival) | Ends on death |
| Base XP to Level | 10 | |
| XP Level Scaling | 1.3x per level | `floor(10 * 1.3^level)` |
| Pickup Radius | 50 px | Magnetic gem pull |
| Money Per Score | 0.1 | Score = survival seconds |
| i-Frames Duration | 1,000 ms | After taking a hit |
| Upgrade Choices | 3 per level-up | |

**Score formula:** Score = floor(survival time in seconds). Money = floor(score * 0.1).

---

## 7. Minigame Scoring and Rewards

### Code Breaker

| Metric | Formula |
|--------|---------|
| Score | Number of codes cracked |
| Money | SUM(baseMoneyPerCode * codeLengthAtTimeOfCrack) |
| Money Per Code | $5 * codeLength (e.g., length 5 = $25, length 10 = $50) |

### Code Runner

| Metric | Formula |
|--------|---------|
| Score | Number of walls passed |
| Money | wallsPassed * moneyPerWall ($10) |

### Botnet Defense

| Metric | Formula |
|--------|---------|
| Score | floor(survival time in seconds) |
| Money | floor(score * 0.1) |

**Botnet Defense Weapon Stats:**

| Weapon | Damage | Cooldown (Lv1) | Cooldown Reduction/Level | Min Cooldown | Special |
|--------|--------|----------------|------------------------|-------------|---------|
| Ping | 2 | 800 ms | -100 ms/level | 300 ms | Directional projectile, speed 400px/s, lifetime 2000ms |
| Firewall | 2 (at Lv1) | 100 ms (refresh) | +1 barrier/level, +30% damage/level | -- | Orbiting barrier, radius 80px, rotation 3 rad/s, piercing |
| Port Scanner | 1 (at Lv1) | 3,000 ms | -200 ms/level, +200ms lifetime/level, +20 expand speed/level | 1,500 ms | Expanding ring, speed 200px/s, max radius 300px, piercing |
| Exploit | 3 (at Lv1) | 1,500 ms | -100 ms/level | 800 ms | Homing projectile, speed 300px/s, lifetime 3000ms, turn rate 4 rad/s |

**Botnet Defense Level-Up Stat Boosts:**

| Stat Boost | Effect |
|-----------|--------|
| Speed | +15% movement speed (multiplicative) |
| Max HP | +1 max HP, heal 1 HP |
| Pickup Radius | +20 px |
| Damage Mult | +20% all weapon damage (multiplicative) |

**Botnet Defense Enemy Stats:**

| Enemy | Speed (px/s) | Min HP | Max HP | XP Value | Radius (px) | Group Size | Group Offset (px) |
|-------|-------------|--------|--------|----------|-------------|------------|-------------------|
| Virus | 60 | 1 | 2 | 1 | 10 | 1 | 0 |
| Worm | 120 | 1 | 1 | 1 | 8 | 3-5 | 20 |
| Trojan | 30 | 5 | 8 | 3 | 16 | 1 | 0 |
| Ransomware | 80 | 3 | 4 | 5 | 12 | 1 | 0 |

**Botnet Defense Spawn Schedule:**

| Time Range | Available Enemies | Spawn Interval | HP Multiplier |
|-----------|-------------------|---------------|---------------|
| 0:00 - 0:30 | Virus | 2,000 ms | 1.0x |
| 0:30 - 1:00 | Virus, Worm | 1,500 ms | 1.0x |
| 1:00 - 1:30 | Virus, Worm, Trojan | 1,000 ms | 1.0x |
| 1:30 - 2:00 | All types | 800 ms | 1.0x |
| 2:00 - 3:00 | All types | 500 ms | 1.5x |

---

## 8. Milestones

### Botnet Defense -- Survival Milestones

| Threshold | Time | Reward |
|-----------|------|--------|
| 300,000 ms | 5 minutes | +10 RP/min passive renown |
| 600,000 ms | 10 minutes | +10 RP/min passive renown |
| 900,000 ms | 15 minutes | +10 RP/min passive renown |

### Code Runner -- Wall Milestones

| Threshold | Walls Passed | Reward |
|-----------|-------------|--------|
| 15 | 15 walls | +10 RP/min passive renown |
| 30 | 30 walls | +10 RP/min passive renown |
| 45 | 45 walls | +10 RP/min passive renown |

### Code Breaker -- Code Length Milestones

Stored with namespace offset 10000 to avoid collision with Code Runner milestones.

| Threshold | Code Length Reached | Reward |
|-----------|-------------------|--------|
| 10 | 10 characters | +10 RP/min passive renown |
| 15 | 15 characters | +10 RP/min passive renown |
| 20 | 20 characters | +10 RP/min passive renown |

---

## 9. Offline Progress

| Parameter | Value | Source |
|-----------|-------|--------|
| Max Offline Time | 28,800 s (8 hours) | `GameConfig.gameplay.offlineMaxSeconds` |
| Efficiency Multiplier | 50% | `GameConfig.gameplay.offlineEfficiency` |
| Min Time for Modal | 60 s (1 minute) | `GameConfig.gameplay.offlineMinSecondsForModal` |
| Resources Awarded | Money only | technique and renown = 0 offline |
| Formula | `moneyRate * min(timeAway, 28800) * 0.5` | |

**Example:** If online rate is $3/sec and player is away for 2 hours (7,200s):
- Offline earnings = 3 * 7,200 * 0.5 = $10,800

---

## 10. Auto-Play AI Parameters

### Code Breaker AI

| Level | Delay (ms) | Error Rate | Description |
|-------|-----------|------------|-------------|
| 1 | 600-900 | 15% | Slow, frequent mistakes |
| 2 | 400-700 | 10% | Faster, fewer errors |
| 3 | 250-500 | 5% | Quick typist |
| 4 | 150-350 | 2% | Near-expert |
| 5 | 80-200 | 0.5% | Master hacker |

Behavior: Waits during preview phase. Between keypresses, accumulates time until a random delay in the range is reached, then inputs the correct character (or a random wrong character based on error rate).

### Code Runner AI

| Level | Reaction Distance (px) | Targeting Accuracy | Jitter Amplitude (px) | Jitter Interval (ms) |
|-------|----------------------|-------------------|----------------------|---------------------|
| 1 | 80 | 60% | 40 | 150 |
| 2 | 120 | 70% | 25 | 200 |
| 3 | 160 | 80% | 12 | 300 |
| 4 | 200 | 90% | 4 | 500 |
| 5 | 250 | 95% | 0 | 0 |

Movement dead zone: 4 px. Behavior: Scans for the nearest obstacle within reaction distance above the player, aims for gap center with accuracy offset, and applies random jitter. When no obstacle is in range, drifts toward canvas center.

### Botnet Defense AI

| Level | Dodge Radius (px) | Gem Attraction | Gem Detection (px) | Center Weight | Threat Weight | Upgrade Strategy |
|-------|------------------|---------------|-------------------|---------------|---------------|-----------------|
| 1 | 40 | 0 (ignores) | 0 | 0.3 | 1.0 | Random |
| 2 | 60 | 0.4 | 80 | 0.4 | 1.2 | Avoid duplicates |
| 3 | 80 | 0.7 | 150 | 0.5 | 1.5 | Prefer weapons |
| 4 | 100 | 1.0 | 250 | 0.6 | 2.0 | Tier-aware |
| 5 | 120 | 1.5 | 400 | 0.7 | 2.5 | Optimal build |

Behavior: Each frame computes a composite movement vector from three forces -- enemy threat repulsion, XP gem attraction, and arena centering. On level-up, selects upgrades per strategy tier. Level-up selection has a 300ms delay before choosing.

**Weapon Priority (Tier-Aware and Optimal strategies):** Firewall > Exploit > Port Scanner > Ping

**Stat Priority (Optimal strategy):** Damage Mult > Speed > Max HP > Pickup Radius

---

## 11. Miscellaneous Constants

| Constant | Value | Location |
|----------|-------|----------|
| Save Version | 2.2.0 | `types.ts` |
| Auto-Save Interval | 30,000 ms (30s) | `GameConfig.gameplay` |
| Max Delta Per Frame | 1,000 ms | `GameConfig.gameplay.maxDeltaMs` |
| HUD Update Interval | 1,000 ms | `GameConfig.gameplay.hudUpdateIntervalMs` |
| Default Upgrade Growth Rate | 1.15 (15%) | `GameConfig.upgrades.defaultGrowthRate` |
| Canvas Size | 800 x 600 px | `GameConfig.canvas` |
| Player Collision Radius (Botnet) | 12 px | `BotnetDefenseGame.ts` |
| Projectile Radius (Botnet) | 4 px | `BotnetDefenseGame.ts` |
| XP Gem Radius | 6 px | `BotnetDefenseGame.ts` |
| XP Gem Cap | 30 | `BotnetDefenseGame.ts` |
| XP Gem Collect Radius | 10 px | `BotnetDefenseGame.ts` |
| XP Gem Pull Speed | 300 px/s | `BotnetDefenseGame.ts` |
| Max Weapon Level (Botnet) | 5 | `BotnetDefenseGame.ts` |
| Max Save Slots | 3 | `GameConfig.storage.maxSlots` |
| Apartment Player Speed | 200 px/s | `GameConfig.movement.speed` |
| Apartment Player Size | 32 x 64 px | `GameConfig.movement` |
| Flash Duration | 200 ms | `GameConfig.animation.flashDurationMs` |
| Fade Duration | 300 ms | `GameConfig.animation.fadeDurationMs` |
