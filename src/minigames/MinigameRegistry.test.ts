/**
 * Tests for MinigameRegistry
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Container } from 'pixi.js';
import { MinigameRegistry } from './MinigameRegistry';
import type { MinigameDefinition, GameInstance, Scene } from '../core/types';

// Create a proper mock scene factory
function createMockSceneFactory(id: string): (game: GameInstance) => Scene {
  return vi.fn(() => ({
    id,
    onEnter: (): void => {},
    onExit: (): void => {},
    onDestroy: (): void => {},
    getContainer: (): Container => new Container(),
  }));
}

// Mock minigame definitions for testing
const mockDefinition1: MinigameDefinition = {
  id: 'test-game-1',
  name: 'Test Game 1',
  description: 'First test game',
  primaryResource: 'money',
  createScene: createMockSceneFactory('test-game-1'),
};

const mockDefinition2: MinigameDefinition = {
  id: 'test-game-2',
  name: 'Test Game 2',
  description: 'Second test game',
  primaryResource: 'technique',
  createScene: createMockSceneFactory('test-game-2'),
};

describe('MinigameRegistry', () => {
  let registry: MinigameRegistry;

  beforeEach(() => {
    registry = new MinigameRegistry();
  });

  describe('registration', () => {
    it('should register a minigame definition', () => {
      registry.register(mockDefinition1);

      expect(registry.has('test-game-1')).toBe(true);
      expect(registry.count).toBe(1);
    });

    it('should register multiple minigame definitions', () => {
      registry.register(mockDefinition1);
      registry.register(mockDefinition2);

      expect(registry.has('test-game-1')).toBe(true);
      expect(registry.has('test-game-2')).toBe(true);
      expect(registry.count).toBe(2);
    });

    it('should replace existing definition with warning', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      registry.register(mockDefinition1);
      const updatedDef = { ...mockDefinition1, name: 'Updated Name' };
      registry.register(updatedDef);

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining("Minigame 'test-game-1' already registered")
      );
      expect(registry.get('test-game-1')?.name).toBe('Updated Name');
      expect(registry.count).toBe(1);

      warnSpy.mockRestore();
    });

    it('should unregister a minigame definition', () => {
      registry.register(mockDefinition1);

      expect(registry.unregister('test-game-1')).toBe(true);
      expect(registry.has('test-game-1')).toBe(false);
      expect(registry.count).toBe(0);
    });

    it('should return false when unregistering non-existent minigame', () => {
      expect(registry.unregister('non-existent')).toBe(false);
    });
  });

  describe('access', () => {
    beforeEach(() => {
      registry.register(mockDefinition1);
      registry.register(mockDefinition2);
    });

    it('should get a minigame definition by ID', () => {
      const def = registry.get('test-game-1');

      expect(def).toBeDefined();
      expect(def?.id).toBe('test-game-1');
      expect(def?.name).toBe('Test Game 1');
    });

    it('should return undefined for non-existent minigame', () => {
      expect(registry.get('non-existent')).toBeUndefined();
    });

    it('should check if minigame exists', () => {
      expect(registry.has('test-game-1')).toBe(true);
      expect(registry.has('non-existent')).toBe(false);
    });

    it('should get all registered definitions', () => {
      const all = registry.getAll();

      expect(all).toHaveLength(2);
      expect(all.map((d) => d.id)).toContain('test-game-1');
      expect(all.map((d) => d.id)).toContain('test-game-2');
    });

    it('should get all registered IDs', () => {
      const ids = registry.getIds();

      expect(ids).toHaveLength(2);
      expect(ids).toContain('test-game-1');
      expect(ids).toContain('test-game-2');
    });

    it('should get summaries for all registered minigames', () => {
      const summaries = registry.getSummaries();

      expect(summaries).toHaveLength(2);
      expect(summaries[0]).toEqual({
        id: 'test-game-1',
        name: 'Test Game 1',
        description: 'First test game',
        primaryResource: 'money',
      });
    });

    it('should return correct count', () => {
      expect(registry.count).toBe(2);

      registry.register({ ...mockDefinition1, id: 'test-game-3' } as MinigameDefinition);
      expect(registry.count).toBe(3);
    });
  });

  describe('scene creation', () => {
    it('should create a scene for a registered minigame', () => {
      registry.register(mockDefinition1);

      const mockGame = {} as GameInstance;
      const scene = registry.createScene('test-game-1', mockGame);

      expect(scene).toBeDefined();
      expect(mockDefinition1.createScene).toHaveBeenCalledWith(mockGame);
    });

    it('should return undefined and warn for non-existent minigame', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const mockGame = {} as GameInstance;
      const scene = registry.createScene('non-existent', mockGame);

      expect(scene).toBeUndefined();
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining("Minigame 'non-existent' not found")
      );

      warnSpy.mockRestore();
    });
  });

  describe('cleanup', () => {
    it('should clear all registered minigames', () => {
      registry.register(mockDefinition1);
      registry.register(mockDefinition2);

      registry.clear();

      expect(registry.count).toBe(0);
      expect(registry.has('test-game-1')).toBe(false);
      expect(registry.has('test-game-2')).toBe(false);
    });
  });
});
