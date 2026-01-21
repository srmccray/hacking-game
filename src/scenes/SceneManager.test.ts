/**
 * Tests for SceneManager
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Container } from 'pixi.js';
import { SceneManager, BaseScene } from './SceneManager';
import type { Scene } from '../core/types';

// ==========================================================================
// Test Helpers
// ==========================================================================

/**
 * Create a mock scene for testing.
 */
function createMockScene(id: string): Scene & {
  onEnterMock: ReturnType<typeof vi.fn>;
  onExitMock: ReturnType<typeof vi.fn>;
  onUpdateMock: ReturnType<typeof vi.fn>;
  onDestroyMock: ReturnType<typeof vi.fn>;
} {
  const container = new Container();
  container.label = `scene-${id}`;

  const onEnterMock = vi.fn();
  const onExitMock = vi.fn();
  const onUpdateMock = vi.fn();
  const onDestroyMock = vi.fn();

  return {
    id,
    onEnter: onEnterMock,
    onExit: onExitMock,
    onUpdate: onUpdateMock,
    onDestroy: onDestroyMock,
    getContainer: () => container,
    onEnterMock,
    onExitMock,
    onUpdateMock,
    onDestroyMock,
  };
}

/**
 * Create an async mock scene for testing.
 */
function createAsyncMockScene(id: string, delayMs: number = 10): Scene & {
  onEnterMock: ReturnType<typeof vi.fn>;
} {
  const container = new Container();
  container.label = `scene-${id}`;

  const onEnterMock = vi.fn().mockImplementation(async () => {
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  });

  return {
    id,
    onEnter: onEnterMock,
    onExit: vi.fn(),
    onUpdate: vi.fn(),
    onDestroy: vi.fn(),
    getContainer: () => container,
    onEnterMock,
  };
}

// ==========================================================================
// Tests
// ==========================================================================

describe('SceneManager', () => {
  let root: Container;
  let sceneManager: SceneManager;

  beforeEach(() => {
    root = new Container();
    root.label = 'root';
    sceneManager = new SceneManager(root);
  });

  afterEach(() => {
    sceneManager.destroy();
    root.destroy();
  });

  // ==========================================================================
  // Registration Tests
  // ==========================================================================

  describe('registration', () => {
    it('should register a scene factory', () => {
      const factory = (): Scene => createMockScene('test');

      sceneManager.register('test', factory);

      expect(sceneManager.hasScene('test')).toBe(true);
      expect(sceneManager.getSceneIds()).toContain('test');
    });

    it('should replace existing scene factory with same ID', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const factory1 = (): Scene => createMockScene('test');
      const factory2 = (): Scene => createMockScene('test-v2');

      sceneManager.register('test', factory1);
      sceneManager.register('test', factory2);

      expect(sceneManager.hasScene('test')).toBe(true);
      expect(warnSpy).toHaveBeenCalled();

      warnSpy.mockRestore();
    });

    it('should unregister a scene factory', () => {
      sceneManager.register('test', () => createMockScene('test'));

      const result = sceneManager.unregister('test');

      expect(result).toBe(true);
      expect(sceneManager.hasScene('test')).toBe(false);
    });

    it('should return false when unregistering non-existent scene', () => {
      const result = sceneManager.unregister('nonexistent');
      expect(result).toBe(false);
    });

    it('should destroy current scene when unregistering it', async () => {
      const scene = createMockScene('test');
      sceneManager.register('test', () => scene);

      await sceneManager.switchTo('test');
      sceneManager.unregister('test');

      expect(scene.onExitMock).toHaveBeenCalled();
      expect(scene.onDestroyMock).toHaveBeenCalled();
      expect(sceneManager.getCurrentScene()).toBeNull();
    });

    it('should return all registered scene IDs', () => {
      sceneManager.register('scene1', () => createMockScene('scene1'));
      sceneManager.register('scene2', () => createMockScene('scene2'));
      sceneManager.register('scene3', () => createMockScene('scene3'));

      const ids = sceneManager.getSceneIds();

      expect(ids).toContain('scene1');
      expect(ids).toContain('scene2');
      expect(ids).toContain('scene3');
      expect(ids).toHaveLength(3);
    });
  });

  // ==========================================================================
  // Transition Tests
  // ==========================================================================

  describe('transitions', () => {
    it('should switch to a registered scene', async () => {
      const scene = createMockScene('test');
      sceneManager.register('test', () => scene);

      await sceneManager.switchTo('test');

      expect(sceneManager.getCurrentScene()).toBe(scene);
      expect(sceneManager.getCurrentSceneId()).toBe('test');
    });

    it('should call onEnter when switching to a scene', async () => {
      const scene = createMockScene('test');
      sceneManager.register('test', () => scene);

      await sceneManager.switchTo('test');

      expect(scene.onEnterMock).toHaveBeenCalledTimes(1);
    });

    it('should add scene container to display', async () => {
      const scene = createMockScene('test');
      sceneManager.register('test', () => scene);

      await sceneManager.switchTo('test');

      const sceneContainer = sceneManager.getSceneContainer();
      expect(sceneContainer.children).toContain(scene.getContainer());
    });

    it('should call lifecycle hooks in correct order when switching', async () => {
      const callOrder: string[] = [];

      const scene1 = createMockScene('scene1');
      scene1.onExitMock.mockImplementation(() => callOrder.push('scene1:onExit'));
      scene1.onDestroyMock.mockImplementation(() => callOrder.push('scene1:onDestroy'));

      const scene2 = createMockScene('scene2');
      scene2.onEnterMock.mockImplementation(() => callOrder.push('scene2:onEnter'));

      sceneManager.register('scene1', () => scene1);
      sceneManager.register('scene2', () => scene2);

      await sceneManager.switchTo('scene1');
      callOrder.length = 0; // Reset after initial switch

      await sceneManager.switchTo('scene2');

      expect(callOrder).toEqual(['scene1:onExit', 'scene1:onDestroy', 'scene2:onEnter']);
    });

    it('should remove old scene container from display', async () => {
      const scene1 = createMockScene('scene1');
      const scene2 = createMockScene('scene2');

      sceneManager.register('scene1', () => scene1);
      sceneManager.register('scene2', () => scene2);

      await sceneManager.switchTo('scene1');
      const sceneContainer = sceneManager.getSceneContainer();
      expect(sceneContainer.children).toContain(scene1.getContainer());

      await sceneManager.switchTo('scene2');
      expect(sceneContainer.children).not.toContain(scene1.getContainer());
      expect(sceneContainer.children).toContain(scene2.getContainer());
    });

    it('should throw when switching to non-existent scene', async () => {
      await expect(sceneManager.switchTo('nonexistent')).rejects.toThrow(
        "[SceneManager] Scene 'nonexistent' not registered"
      );
    });

    it('should do nothing when switching to current scene', async () => {
      const scene = createMockScene('test');
      let factoryCallCount = 0;
      sceneManager.register('test', () => {
        factoryCallCount++;
        return scene;
      });

      await sceneManager.switchTo('test');
      expect(factoryCallCount).toBe(1);

      await sceneManager.switchTo('test');
      expect(factoryCallCount).toBe(1); // Factory not called again
    });

    it('should handle async onEnter', async () => {
      const scene = createAsyncMockScene('test', 10);
      sceneManager.register('test', () => scene);

      await sceneManager.switchTo('test');

      expect(scene.onEnterMock).toHaveBeenCalled();
      expect(sceneManager.getCurrentScene()).toBe(scene);
    });

    it('should prevent concurrent transitions', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const scene1 = createAsyncMockScene('scene1', 50);
      const scene2 = createMockScene('scene2');

      sceneManager.register('scene1', () => scene1);
      sceneManager.register('scene2', () => scene2);

      // Start first transition (slow)
      const transition1 = sceneManager.switchTo('scene1');

      // Attempt second transition while first is in progress
      const transition2 = sceneManager.switchTo('scene2');

      await Promise.all([transition1, transition2]);

      // Should end up on scene1 (second was ignored)
      expect(sceneManager.getCurrentSceneId()).toBe('scene1');
      expect(warnSpy).toHaveBeenCalled();

      warnSpy.mockRestore();
    });

    it('should report transitioning state correctly', async () => {
      const scene = createAsyncMockScene('test', 20);
      sceneManager.register('test', () => scene);

      expect(sceneManager.isTransitioning()).toBe(false);

      const transition = sceneManager.switchTo('test');

      // During transition
      expect(sceneManager.isTransitioning()).toBe(true);

      await transition;

      // After transition
      expect(sceneManager.isTransitioning()).toBe(false);
    });
  });

  // ==========================================================================
  // Update Loop Tests
  // ==========================================================================

  describe('update loop', () => {
    it('should call onUpdate on current scene', async () => {
      const scene = createMockScene('test');
      sceneManager.register('test', () => scene);

      await sceneManager.switchTo('test');
      sceneManager.update(16);

      expect(scene.onUpdateMock).toHaveBeenCalledWith(16);
    });

    it('should not call onUpdate when no scene is active', () => {
      // Should not throw
      sceneManager.update(16);
    });

    it('should not call onUpdate during transition', async () => {
      const scene1 = createAsyncMockScene('scene1', 50);
      const scene2 = createMockScene('scene2');

      sceneManager.register('scene1', () => scene1);
      sceneManager.register('scene2', () => scene2);

      await sceneManager.switchTo('scene1');

      // Start transition
      const transition = sceneManager.switchTo('scene2');

      // Update during transition
      sceneManager.update(16);

      await transition;

      // onUpdate should not have been called during transition
      expect(scene2.onUpdateMock).not.toHaveBeenCalled();
    });

    it('should handle scene without onUpdate method', async () => {
      const container = new Container();
      const scene: Scene = {
        id: 'minimal',
        onEnter: () => {},
        onExit: () => {},
        onDestroy: () => container.destroy(),
        getContainer: () => container,
        // No onUpdate method
      };

      sceneManager.register('minimal', () => scene);
      await sceneManager.switchTo('minimal');

      // Should not throw
      sceneManager.update(16);
    });
  });

  // ==========================================================================
  // Cleanup Tests
  // ==========================================================================

  describe('cleanup', () => {
    it('should destroy current scene on manager destroy', async () => {
      const scene = createMockScene('test');
      sceneManager.register('test', () => scene);

      await sceneManager.switchTo('test');
      sceneManager.destroy();

      expect(scene.onExitMock).toHaveBeenCalled();
      expect(scene.onDestroyMock).toHaveBeenCalled();
    });

    it('should clear factories on destroy', async () => {
      sceneManager.register('test', () => createMockScene('test'));
      sceneManager.destroy();

      expect(sceneManager.getSceneIds()).toHaveLength(0);
    });

    it('should remove scene container from root on destroy', () => {
      const sceneContainer = sceneManager.getSceneContainer();
      expect(root.children).toContain(sceneContainer);

      sceneManager.destroy();

      expect(root.children).not.toContain(sceneContainer);
    });
  });

  // ==========================================================================
  // Scene Container Tests
  // ==========================================================================

  describe('scene container', () => {
    it('should provide access to scene container', () => {
      const container = sceneManager.getSceneContainer();

      expect(container).toBeInstanceOf(Container);
      expect(container.label).toBe('scene-container');
    });

    it('should add scene container to root', () => {
      const container = sceneManager.getSceneContainer();
      expect(root.children).toContain(container);
    });
  });
});

// ==========================================================================
// BaseScene Tests
// ==========================================================================

describe('BaseScene', () => {
  class TestScene extends BaseScene {
    readonly id = 'test-scene';
  }

  it('should create a container', () => {
    const scene = new TestScene();
    expect(scene.getContainer()).toBeInstanceOf(Container);
  });

  it('should have default lifecycle implementations', async () => {
    const scene = new TestScene();

    // These should not throw
    await scene.onEnter();
    scene.onExit();
    scene.onUpdate(16);
  });

  it('should destroy container on onDestroy', () => {
    const scene = new TestScene();
    const container = scene.getContainer();
    const destroySpy = vi.spyOn(container, 'destroy');

    scene.onDestroy();

    expect(destroySpy).toHaveBeenCalledWith({ children: true });
  });
});
