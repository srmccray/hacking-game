/**
 * Tests for SaveManager
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SaveManager } from './save-manager';
import { createGameStore, type GameStore } from '../state/game-store';
import { createGameEventBus, type GameEventBus, GameEvents } from '../../events/game-events';
import type { StorageAdapter } from './storage-adapter';
import type { StorageConfig } from '../../game/GameConfig';
import { SAVE_VERSION, createInitialGameState, type GameState } from '../types';

// ============================================================================
// Mock Storage Adapter
// ============================================================================

/**
 * In-memory storage adapter for testing.
 */
class MockStorageAdapter implements StorageAdapter {
  private readonly storage: Map<string, string> = new Map();

  async getItem(key: string): Promise<string | null> {
    return this.storage.get(key) ?? null;
  }

  async setItem(key: string, value: string): Promise<void> {
    this.storage.set(key, value);
  }

  async removeItem(key: string): Promise<void> {
    this.storage.delete(key);
  }

  async keys(): Promise<string[]> {
    return Array.from(this.storage.keys());
  }

  clear(): void {
    this.storage.clear();
  }

  // Test helpers
  getStorageContents(): Map<string, string> {
    return new Map(this.storage);
  }

  setStorageContents(data: Record<string, string>): void {
    this.storage.clear();
    for (const [key, value] of Object.entries(data)) {
      this.storage.set(key, value);
    }
  }
}

// ============================================================================
// Test Setup
// ============================================================================

describe('SaveManager', () => {
  let store: GameStore;
  let eventBus: GameEventBus;
  let adapter: MockStorageAdapter;
  let saveManager: SaveManager;

  const testConfig: StorageConfig = {
    type: 'localStorage',
    keyPrefix: 'test-game',
    maxSlots: 3,
  };

  beforeEach(() => {
    store = createGameStore();
    eventBus = createGameEventBus();
    adapter = new MockStorageAdapter();
    saveManager = new SaveManager(store, eventBus, testConfig, adapter);
  });

  afterEach(() => {
    saveManager.destroy();
    adapter.clear();
  });

  // ==========================================================================
  // Initialization
  // ==========================================================================

  describe('initialization', () => {
    it('should create a SaveManager instance', () => {
      expect(saveManager).toBeInstanceOf(SaveManager);
    });

    it('should initialize without errors', async () => {
      await expect(saveManager.init()).resolves.toBeUndefined();
    });

    it('should warn when initialized twice', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      await saveManager.init();
      await saveManager.init();

      expect(warnSpy).toHaveBeenCalledWith('[SaveManager] Already initialized');
      warnSpy.mockRestore();
    });
  });

  // ==========================================================================
  // Active Slot
  // ==========================================================================

  describe('active slot management', () => {
    it('should have no active slot initially', () => {
      expect(saveManager.getActiveSlot()).toBe(-1);
    });

    it('should set active slot', () => {
      const result = saveManager.setActiveSlot(1);

      expect(result).toBe(true);
      expect(saveManager.getActiveSlot()).toBe(1);
    });

    it('should reject invalid slot index (negative)', () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const result = saveManager.setActiveSlot(-1);

      expect(result).toBe(false);
      expect(saveManager.getActiveSlot()).toBe(-1);
      errorSpy.mockRestore();
    });

    it('should reject invalid slot index (too high)', () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const result = saveManager.setActiveSlot(3); // maxSlots is 3, so 0-2 are valid

      expect(result).toBe(false);
      expect(saveManager.getActiveSlot()).toBe(-1);
      errorSpy.mockRestore();
    });
  });

  // ==========================================================================
  // Save Operations
  // ==========================================================================

  describe('save operations', () => {
    it('should save to specified slot', async () => {
      store.getState().setPlayerName('TestPlayer');
      store.getState().addResource('money', '1000');

      const result = await saveManager.save(0);

      expect(result.success).toBe(true);
      expect(result.slotIndex).toBe(0);

      const savedData = await adapter.getItem('test-game-slot-0');
      expect(savedData).not.toBeNull();

      const parsed = JSON.parse(savedData!);
      expect(parsed.playerName).toBe('TestPlayer');
      expect(parsed.resources.money).toBe('1000');
    });

    it('should update timestamps on save', async () => {
      const beforeSave = Date.now();

      await saveManager.save(0);

      const savedData = await adapter.getItem('test-game-slot-0');
      const parsed = JSON.parse(savedData!);

      expect(parsed.lastSaved).toBeGreaterThanOrEqual(beforeSave);
      expect(parsed.lastPlayed).toBeGreaterThanOrEqual(beforeSave);
    });

    it('should fail to save with invalid slot', async () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const result = await saveManager.save(-1);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid slot index');
      errorSpy.mockRestore();
    });

    it('should use active slot for save() when slot not specified', async () => {
      saveManager.setActiveSlot(2);

      await saveManager.save();

      const savedData = await adapter.getItem('test-game-slot-2');
      expect(savedData).not.toBeNull();
    });

    it('should fail quickSave without active slot', async () => {
      const result = await saveManager.quickSave();

      expect(result.success).toBe(false);
      expect(result.error).toBe('No active slot set');
    });

    it('should quickSave to active slot', async () => {
      saveManager.setActiveSlot(1);
      store.getState().setPlayerName('QuickSaveTest');

      const result = await saveManager.quickSave();

      expect(result.success).toBe(true);
      expect(result.slotIndex).toBe(1);
    });
  });

  // ==========================================================================
  // Load Operations
  // ==========================================================================

  describe('load operations', () => {
    const createSaveData = (overrides: Partial<GameState> = {}): GameState => {
      return {
        ...createInitialGameState(),
        playerName: 'LoadTest',
        ...overrides,
      };
    };

    it('should load from a slot', async () => {
      const saveData = createSaveData({ playerName: 'LoadedPlayer' });
      saveData.resources.money = '5000';
      adapter.setStorageContents({
        'test-game-slot-0': JSON.stringify(saveData),
      });

      const result = await saveManager.load(0);

      expect(result.success).toBe(true);
      expect(result.slotIndex).toBe(0);
      expect(result.state?.playerName).toBe('LoadedPlayer');

      // Verify store was updated
      expect(store.getState().playerName).toBe('LoadedPlayer');
      expect(store.getState().resources.money).toBe('5000');
    });

    it('should set active slot on load', async () => {
      const saveData = createSaveData();
      adapter.setStorageContents({
        'test-game-slot-1': JSON.stringify(saveData),
      });

      await saveManager.load(1);

      expect(saveManager.getActiveSlot()).toBe(1);
    });

    it('should calculate seconds since last play', async () => {
      const lastPlayed = Date.now() - 60000; // 60 seconds ago
      const saveData = createSaveData({ lastPlayed });
      adapter.setStorageContents({
        'test-game-slot-0': JSON.stringify(saveData),
      });

      const result = await saveManager.load(0);

      expect(result.secondsSinceLastPlay).toBeGreaterThanOrEqual(59);
      expect(result.secondsSinceLastPlay).toBeLessThan(70);
    });

    it('should emit SAVE_LOADED event', async () => {
      const saveData = createSaveData({ playerName: 'EventTest' });
      adapter.setStorageContents({
        'test-game-slot-0': JSON.stringify(saveData),
      });

      const eventHandler = vi.fn();
      eventBus.on(GameEvents.SAVE_LOADED, eventHandler);

      await saveManager.load(0);

      expect(eventHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          slotIndex: 0,
          playerName: 'EventTest',
        })
      );
    });

    it('should fail to load from empty slot', async () => {
      const result = await saveManager.load(0);

      expect(result.success).toBe(false);
      expect(result.error).toBe('No save data found');
    });

    it('should fail to load invalid data', async () => {
      adapter.setStorageContents({
        'test-game-slot-0': 'invalid json',
      });

      const result = await saveManager.load(0);

      expect(result.success).toBe(false);
    });

    it('should fail validation on invalid structure', async () => {
      adapter.setStorageContents({
        'test-game-slot-0': JSON.stringify({ invalid: 'data' }),
      });

      const result = await saveManager.load(0);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Save data failed validation');
    });

    it('should fail with invalid slot index', async () => {
      const result = await saveManager.load(-1);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid slot index');
    });
  });

  // ==========================================================================
  // State Validation
  // ==========================================================================

  describe('isValidGameState', () => {
    const validState = createInitialGameState();

    it('should validate correct state', () => {
      expect(saveManager.isValidGameState(validState)).toBe(true);
    });

    it('should reject null', () => {
      expect(saveManager.isValidGameState(null)).toBe(false);
    });

    it('should reject non-objects', () => {
      expect(saveManager.isValidGameState('string')).toBe(false);
      expect(saveManager.isValidGameState(123)).toBe(false);
      expect(saveManager.isValidGameState(undefined)).toBe(false);
    });

    it('should reject missing version', () => {
      const state = { ...validState, version: undefined };
      expect(saveManager.isValidGameState(state)).toBe(false);
    });

    it('should reject missing resources', () => {
      const state = { ...validState, resources: undefined };
      expect(saveManager.isValidGameState(state)).toBe(false);
    });

    it('should reject missing resource fields', () => {
      const state = {
        ...validState,
        resources: { money: '0' }, // missing technique and renown
      };
      expect(saveManager.isValidGameState(state)).toBe(false);
    });

    it('should reject missing upgrades', () => {
      const state = { ...validState, upgrades: undefined };
      expect(saveManager.isValidGameState(state)).toBe(false);
    });

    it('should reject missing settings', () => {
      const state = { ...validState, settings: undefined };
      expect(saveManager.isValidGameState(state)).toBe(false);
    });

    it('should reject missing stats', () => {
      const state = { ...validState, stats: undefined };
      expect(saveManager.isValidGameState(state)).toBe(false);
    });
  });

  // ==========================================================================
  // Slot Metadata
  // ==========================================================================

  describe('slot metadata', () => {
    it('should return empty metadata for empty slot', async () => {
      const metadata = await saveManager.getSlotMetadata(0);

      expect(metadata.isEmpty).toBe(true);
      expect(metadata.slotIndex).toBe(0);
      expect(metadata.playerName).toBe('');
      expect(metadata.lastPlayed).toBe(0);
    });

    it('should return metadata for occupied slot', async () => {
      const saveData = createInitialGameState();
      saveData.playerName = 'MetadataTest';
      saveData.lastPlayed = 1000000;
      saveData.stats.totalPlayTime = 3600000;

      adapter.setStorageContents({
        'test-game-slot-0': JSON.stringify(saveData),
      });

      const metadata = await saveManager.getSlotMetadata(0);

      expect(metadata.isEmpty).toBe(false);
      expect(metadata.playerName).toBe('MetadataTest');
      expect(metadata.lastPlayed).toBe(1000000);
      expect(metadata.totalPlayTime).toBe(3600000);
    });

    it('should return all slot metadata', async () => {
      const saveData = createInitialGameState();
      adapter.setStorageContents({
        'test-game-slot-1': JSON.stringify(saveData),
      });

      const allMetadata = await saveManager.getAllSlotMetadata();

      expect(allMetadata).toHaveLength(3);
      expect(allMetadata[0]?.isEmpty).toBe(true);
      expect(allMetadata[1]?.isEmpty).toBe(false);
      expect(allMetadata[2]?.isEmpty).toBe(true);
    });

    it('should check if slot has data', async () => {
      const saveData = createInitialGameState();
      adapter.setStorageContents({
        'test-game-slot-1': JSON.stringify(saveData),
      });

      expect(await saveManager.hasSlotData(0)).toBe(false);
      expect(await saveManager.hasSlotData(1)).toBe(true);
      expect(await saveManager.hasSlotData(2)).toBe(false);
    });
  });

  // ==========================================================================
  // Delete Slot
  // ==========================================================================

  describe('delete slot', () => {
    it('should delete a slot', async () => {
      adapter.setStorageContents({
        'test-game-slot-0': JSON.stringify(createInitialGameState()),
      });

      await saveManager.deleteSlot(0);

      expect(await adapter.getItem('test-game-slot-0')).toBeNull();
    });

    it('should clear active slot if deleting active slot', async () => {
      adapter.setStorageContents({
        'test-game-slot-1': JSON.stringify(createInitialGameState()),
      });
      saveManager.setActiveSlot(1);

      await saveManager.deleteSlot(1);

      expect(saveManager.getActiveSlot()).toBe(-1);
    });

    it('should not affect active slot if deleting different slot', async () => {
      adapter.setStorageContents({
        'test-game-slot-0': JSON.stringify(createInitialGameState()),
        'test-game-slot-1': JSON.stringify(createInitialGameState()),
      });
      saveManager.setActiveSlot(1);

      await saveManager.deleteSlot(0);

      expect(saveManager.getActiveSlot()).toBe(1);
    });
  });

  // ==========================================================================
  // Start New Game
  // ==========================================================================

  describe('start new game', () => {
    it('should start a new game in a slot', async () => {
      const result = await saveManager.startNewGame(0, 'NewPlayer');

      expect(result.success).toBe(true);
      expect(result.slotIndex).toBe(0);
      expect(saveManager.getActiveSlot()).toBe(0);
      expect(store.getState().playerName).toBe('NewPlayer');
    });

    it('should reset store to initial state', async () => {
      store.getState().addResource('money', '99999');

      await saveManager.startNewGame(0, 'FreshStart');

      expect(store.getState().resources.money).toBe('0');
    });

    it('should save the initial state', async () => {
      await saveManager.startNewGame(0, 'SavedNewGame');

      const savedData = await adapter.getItem('test-game-slot-0');
      expect(savedData).not.toBeNull();

      const parsed = JSON.parse(savedData!);
      expect(parsed.playerName).toBe('SavedNewGame');
    });
  });

  // ==========================================================================
  // Auto-Save
  // ==========================================================================

  describe('auto-save', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should start auto-save timer', async () => {
      saveManager.setActiveSlot(0);
      store.getState().setPlayerName('AutoSaveTest');

      saveManager.startAutoSave(1000);

      // Fast-forward 1 second
      await vi.advanceTimersByTimeAsync(1000);

      const savedData = await adapter.getItem('test-game-slot-0');
      expect(savedData).not.toBeNull();
    });

    it('should auto-save periodically', async () => {
      saveManager.setActiveSlot(0);

      saveManager.startAutoSave(1000);

      // Fast-forward 3 seconds
      await vi.advanceTimersByTimeAsync(3000);

      // Should have saved 3 times
      const savedData = await adapter.getItem('test-game-slot-0');
      expect(savedData).not.toBeNull();
    });

    it('should stop auto-save', async () => {
      saveManager.setActiveSlot(0);
      adapter.clear();

      saveManager.startAutoSave(1000);
      saveManager.stopAutoSave();

      // Fast-forward 2 seconds
      await vi.advanceTimersByTimeAsync(2000);

      // Should not have saved
      const savedData = await adapter.getItem('test-game-slot-0');
      expect(savedData).toBeNull();
    });

    it('should not auto-save without active slot', async () => {
      // No active slot set
      adapter.clear();

      saveManager.startAutoSave(1000);

      // Fast-forward 2 seconds
      await vi.advanceTimersByTimeAsync(2000);

      // Should not have saved anything
      const keys = await adapter.keys();
      expect(keys).toHaveLength(0);
    });

    it('should warn when starting auto-save twice', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      saveManager.startAutoSave(1000);
      saveManager.startAutoSave(1000);

      expect(warnSpy).toHaveBeenCalledWith('[SaveManager] Auto-save already running');
      warnSpy.mockRestore();
    });
  });

  // ==========================================================================
  // Export/Import
  // ==========================================================================

  describe('export/import', () => {
    it('should export save as base64', async () => {
      saveManager.setActiveSlot(0);
      store.getState().setPlayerName('ExportTest');
      await saveManager.save(0);

      const exported = await saveManager.exportSave();

      expect(exported).not.toBe('');

      // Verify it's valid base64 that decodes to JSON
      const decoded = atob(exported);
      const parsed = JSON.parse(decoded);
      expect(parsed.playerName).toBe('ExportTest');
    });

    it('should return empty string without active slot', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const exported = await saveManager.exportSave();

      expect(exported).toBe('');
      warnSpy.mockRestore();
    });

    it('should import save from base64', async () => {
      const saveData = createInitialGameState();
      saveData.playerName = 'ImportTest';
      saveData.resources.money = '12345';

      const base64 = btoa(JSON.stringify(saveData));

      const result = await saveManager.importSave(base64, 0);

      expect(result.success).toBe(true);
      expect(store.getState().playerName).toBe('ImportTest');
      expect(store.getState().resources.money).toBe('12345');
    });

    it('should emit event on import', async () => {
      const saveData = createInitialGameState();
      saveData.playerName = 'ImportEventTest';

      const base64 = btoa(JSON.stringify(saveData));

      const eventHandler = vi.fn();
      eventBus.on(GameEvents.SAVE_LOADED, eventHandler);

      await saveManager.importSave(base64, 0);

      expect(eventHandler).toHaveBeenCalled();
    });

    it('should find first empty slot if no target specified', async () => {
      // Fill slot 0
      adapter.setStorageContents({
        'test-game-slot-0': JSON.stringify(createInitialGameState()),
      });

      const saveData = createInitialGameState();
      saveData.playerName = 'FindEmptySlot';
      const base64 = btoa(JSON.stringify(saveData));

      const result = await saveManager.importSave(base64);

      expect(result.success).toBe(true);
      expect(result.slotIndex).toBe(1); // Should use slot 1 since 0 is occupied
    });

    it('should fail import with invalid base64', async () => {
      const result = await saveManager.importSave('not-valid-base64!!!');

      expect(result.success).toBe(false);
    });

    it('should fail import with invalid JSON', async () => {
      const base64 = btoa('not json');

      const result = await saveManager.importSave(base64, 0);

      expect(result.success).toBe(false);
    });
  });

  // ==========================================================================
  // State Migration
  // ==========================================================================

  describe('state migration', () => {
    it('should migrate v1.0.0 saves', async () => {
      const oldSave = {
        version: '1.0.0',
        lastSaved: Date.now(),
        lastPlayed: Date.now(),
        // No playerName field
        resources: { money: '100', technique: '0', renown: '0' },
        minigames: {},
        upgrades: { equipment: {}, apartment: {} },
        settings: { offlineProgressEnabled: true },
        stats: {
          totalPlayTime: 1000,
          // No totalOfflineTime field
          totalResourcesEarned: { money: '100', technique: '0', renown: '0' },
        },
      };

      adapter.setStorageContents({
        'test-game-slot-0': JSON.stringify(oldSave),
      });

      const result = await saveManager.load(0);

      expect(result.success).toBe(true);
      expect(result.state?.version).toBe(SAVE_VERSION);
      expect(result.state?.playerName).toBe(''); // Migrated to empty string
    });

    it('should preserve data during migration', async () => {
      const oldSave = {
        version: '1.0.0',
        lastSaved: 12345,
        lastPlayed: 12346,
        resources: { money: '999', technique: '50', renown: '25' },
        minigames: { 'code-breaker': { unlocked: true, topScores: ['100', '50'], playCount: 5, upgrades: {} } },
        upgrades: { equipment: { 'test-upgrade': 2 }, apartment: { 'test-apt': true } },
        settings: { offlineProgressEnabled: false },
        stats: {
          totalPlayTime: 7200000,
          totalResourcesEarned: { money: '999', technique: '50', renown: '25' },
        },
      };

      adapter.setStorageContents({
        'test-game-slot-0': JSON.stringify(oldSave),
      });

      const result = await saveManager.load(0);

      expect(result.success).toBe(true);
      expect(result.state?.resources.money).toBe('999');
      // Code Breaker scores are cleared during 2.0.0 -> 2.1.0 migration
      // (score semantics changed from point totals to codes-cracked counts)
      expect(result.state?.minigames['code-breaker']?.topScores).toEqual([]);
      expect(result.state?.upgrades.equipment['test-upgrade']).toBe(2);
    });
  });

  // ==========================================================================
  // Cleanup
  // ==========================================================================

  describe('cleanup', () => {
    it('should stop auto-save on destroy', async () => {
      vi.useFakeTimers();
      saveManager.setActiveSlot(0);
      saveManager.startAutoSave(1000);

      saveManager.destroy();
      adapter.clear();

      await vi.advanceTimersByTimeAsync(2000);

      // Should not have saved after destroy
      const keys = await adapter.keys();
      expect(keys).toHaveLength(0);

      vi.useRealTimers();
    });

    it('should handle multiple destroy calls', () => {
      expect(() => {
        saveManager.destroy();
        saveManager.destroy();
      }).not.toThrow();
    });
  });
});
