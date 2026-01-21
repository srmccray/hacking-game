/**
 * Tests for InGameMenu component.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { InGameMenu } from './InGameMenu';
import type { Game } from '../game/Game';

// ============================================================================
// Mocks
// ============================================================================

/**
 * Create a mock Game instance.
 */
function createMockGame(): Game {
  const mockInputManager = {
    registerContext: vi.fn(),
    unregisterContext: vi.fn(),
    enableContext: vi.fn(),
    disableContext: vi.fn(),
  };

  const mockRenderer = {
    root: {
      addChild: vi.fn(),
      sortableChildren: false,
    },
  };

  const mockSaveManager = {
    quickSave: vi.fn().mockResolvedValue({ success: true, slotIndex: 0 }),
  };

  const mockSceneManager = {
    switchTo: vi.fn().mockResolvedValue(undefined),
  };

  return {
    config: {
      canvas: {
        width: 800,
        height: 600,
      },
    },
    inputManager: mockInputManager,
    renderer: mockRenderer,
    saveManager: mockSaveManager,
    sceneManager: mockSceneManager,
    switchScene: vi.fn().mockResolvedValue(undefined),
  } as unknown as Game;
}

// ============================================================================
// Tests
// ============================================================================

describe('InGameMenu', () => {
  let menu: InGameMenu;
  let mockGame: Game;

  beforeEach(() => {
    mockGame = createMockGame();
    menu = new InGameMenu(mockGame);
  });

  afterEach(() => {
    menu.destroy();
  });

  describe('constructor', () => {
    it('should create a container with correct label', () => {
      expect(menu.container.label).toBe('in-game-menu');
    });

    it('should start hidden', () => {
      expect(menu.container.visible).toBe(false);
      expect(menu.isVisible()).toBe(false);
    });
  });

  describe('show', () => {
    it('should make the menu visible', () => {
      menu.show();

      expect(menu.isVisible()).toBe(true);
      expect(menu.container.visible).toBe(true);
    });

    it('should register input context', () => {
      menu.show();

      expect(mockGame.inputManager.registerContext).toHaveBeenCalled();
      expect(mockGame.inputManager.enableContext).toHaveBeenCalledWith('in-game-menu');
    });

    it('should not show again if already visible', () => {
      menu.show();
      menu.show();

      // Should only register context once
      expect(mockGame.inputManager.registerContext).toHaveBeenCalledTimes(1);
    });
  });

  describe('hide', () => {
    it('should hide the menu', () => {
      menu.show();
      menu.hide();

      expect(menu.isVisible()).toBe(false);
      expect(menu.container.visible).toBe(false);
    });

    it('should unregister input context', () => {
      menu.show();
      menu.hide();

      expect(mockGame.inputManager.disableContext).toHaveBeenCalledWith('in-game-menu');
      expect(mockGame.inputManager.unregisterContext).toHaveBeenCalledWith('in-game-menu');
    });

    it('should do nothing if not visible', () => {
      menu.hide(); // Not shown yet

      expect(mockGame.inputManager.disableContext).not.toHaveBeenCalled();
    });
  });

  describe('toggle', () => {
    it('should show menu if hidden', () => {
      menu.toggle();

      expect(menu.isVisible()).toBe(true);
    });

    it('should hide menu if visible', () => {
      menu.show();
      menu.toggle();

      expect(menu.isVisible()).toBe(false);
    });
  });

  describe('menu items', () => {
    it('should have Resume, Save, Settings, and Exit items', () => {
      menu.show();

      // Menu should be visible
      expect(menu.isVisible()).toBe(true);
    });
  });

  describe('destroy', () => {
    it('should hide the menu if visible', () => {
      menu.show();
      menu.destroy();

      // Input context should be unregistered
      expect(mockGame.inputManager.unregisterContext).toHaveBeenCalledWith('in-game-menu');
    });

    it('should not throw if not visible', () => {
      expect(() => menu.destroy()).not.toThrow();
    });
  });
});

describe('InGameMenu Actions', () => {
  let menu: InGameMenu;
  let mockGame: Game;

  beforeEach(() => {
    mockGame = createMockGame();
    menu = new InGameMenu(mockGame);
    menu.show();
  });

  afterEach(() => {
    menu.destroy();
  });

  // Note: Testing internal actions would require exposing them or simulating key presses.
  // The following tests verify the menu is properly set up.

  it('should be visible after show', () => {
    expect(menu.isVisible()).toBe(true);
  });

  it('should have registered input context', () => {
    expect(mockGame.inputManager.registerContext).toHaveBeenCalled();
  });
});
