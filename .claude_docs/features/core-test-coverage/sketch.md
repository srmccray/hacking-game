# Quick Sketch: Core Module Test Coverage

**Created:** 2026-01-19
**Tier:** SMALL
**Triage Scores:** Complexity 3/10, Risk 2/10

## What

Add comprehensive Vitest unit tests for pure functions across 6 core modules to establish regression prevention coverage for future enhancements.

## Why

The codebase has minimal test coverage (only `src/ui/scenes/main-menu.test.ts` exists). As the game grows, untested pure functions in core modules are vulnerable to regressions. Testing these now prevents bugs from sneaking in during future development.

## Approach

1. **Create test files** co-located with source files following the existing pattern:
   - `src/core/resource-manager.test.ts`
   - `src/core/game-state.test.ts`
   - `src/core/upgrades.test.ts`
   - `src/core/auto-generation.test.ts`
   - `src/core/offline-progress.test.ts`
   - `src/core/save-system.test.ts`

2. **Create Vitest config** (`vitest.config.ts`) with jsdom environment for browser API compatibility

3. **Test pure functions first** (no store mocking needed):
   - `resource-manager.ts`: All math/formatting functions are pure
   - `offline-progress.ts`: `formatDuration`, `formatRelativeTime` are pure
   - `game-state.ts`: `insertScore` helper is pure (needs export or extraction)
   - `save-system.ts`: `isValidGameState` needs extraction for testability

4. **Mock Zustand store** for functions that depend on state:
   - Use `vi.mock()` to mock `useGameStore.getState()`
   - Provide controlled state fixtures for predictable tests

5. **Test categories per module:**

   | Module | Pure Functions (No Mock) | Store-Dependent (Mock Needed) |
   |--------|--------------------------|-------------------------------|
   | resource-manager | `add`, `subtract`, `multiply`, `divide`, `formatNumber`, `formatScientific`, `formatPercent`, `calculateCost`, `calculateBulkCost`, `calculateAffordableLevels`, `calculateMultiplier`, `safeSubtract`, `canAfford` | None |
   | game-state | `insertScore` (needs export) | Selectors: `selectTopScores`, `selectResource`, `selectCanAfford` |
   | upgrades | `calculateUpgradeCost` (with level param) | `getUpgradeEffect`, `isUpgradeMaxed`, `canAffordUpgrade`, `purchaseUpgrade` |
   | auto-generation | None | `calculateBaseRateFromScores`, `getMoneyGenerationRate`, `calculateGenerationOverTime` |
   | offline-progress | `formatDuration`, `formatRelativeTime` | `calculateOfflineProgress`, `previewOfflineEarnings` |
   | save-system | `isValidGameState` (needs extraction) | `loadSlotMetadata`, `listSaveSlots` |

## Files Likely Affected

- `vitest.config.ts` (new) - Vitest configuration with jsdom environment
- `src/core/resource-manager.test.ts` (new) - 13+ test cases for math/formatting
- `src/core/game-state.test.ts` (new) - Tests for `insertScore` and selectors
- `src/core/upgrades.test.ts` (new) - Tests for cost calculations and effects
- `src/core/auto-generation.test.ts` (new) - Tests for rate calculations
- `src/core/offline-progress.test.ts` (new) - Tests for duration formatting and offline calc
- `src/core/save-system.test.ts` (new) - Tests for validation and slot metadata
- `src/core/game-state.ts` (modify) - Export `insertScore` for testing
- `src/core/save-system.ts` (modify) - Extract/export `isValidGameState` for testing

## Considerations

- **Decimal comparison**: Use `.eq()` or `.toString()` for Decimal assertions, not direct equality
- **Store mocking**: Create a `test-utils.ts` with reusable mock store factory
- **localStorage mocking**: Use Vitest's built-in `vi.stubGlobal()` for localStorage in save-system tests
- **Time-dependent tests**: Mock `Date.now()` for `formatRelativeTime` and `calculateOfflineProgress`
- **Test isolation**: Each test should reset any mocked state to prevent cross-test pollution
- **Existing pattern**: Follow `main-menu.test.ts` structure - extract pure functions, test with clear describe blocks

## Acceptance Criteria

- [ ] Vitest config file created with jsdom environment
- [ ] All 6 test files created with passing tests
- [ ] Pure functions in `resource-manager.ts` have 100% coverage
- [ ] `formatDuration` and `formatRelativeTime` have edge case coverage
- [ ] Store-dependent functions tested with mocked Zustand store
- [ ] `npm run test` passes with no failures
- [ ] `npm run test:coverage` shows meaningful coverage for core modules
