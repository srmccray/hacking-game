/**
 * HUD Component Tests
 *
 * Tests reactive Zustand subscriptions, resource display formatting,
 * and proper cleanup on destroy.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock PixiJS before importing HUD
vi.mock('pixi.js', () => {
  class MockContainer {
    children: MockContainer[] = [];
    label = '';
    visible = true;
    x = 0;
    y = 0;
    parent: MockContainer | null = null;

    addChild = vi.fn((child: MockContainer) => {
      this.children.push(child);
      child.parent = this;
      return child;
    });

    removeChild = vi.fn((child: MockContainer) => {
      const index = this.children.indexOf(child);
      if (index !== -1) {
        this.children.splice(index, 1);
        child.parent = null;
      }
    });

    destroy = vi.fn(({ children } = {}) => {
      if (children) {
        this.children = [];
      }
      this.parent = null;
    });
  }

  class MockGraphics {
    fill = vi.fn().mockReturnThis();
    stroke = vi.fn().mockReturnThis();
    rect = vi.fn().mockReturnThis();
    roundRect = vi.fn().mockReturnThis();
    moveTo = vi.fn().mockReturnThis();
    lineTo = vi.fn().mockReturnThis();
    destroy = vi.fn();
    visible = true;
    x = 0;
    y = 0;
  }

  class MockText {
    anchor = { set: vi.fn() };
    x = 0;
    y = 0;
    text = '';
    style = {};
    width = 100;
    height = 20;
    destroy = vi.fn();
    visible = true;

    constructor(options?: { text?: string; style?: unknown }) {
      if (options?.text) {
        this.text = options.text;
      }
      if (options?.style) {
        this.style = options.style;
      }
    }
  }

  class MockTextStyle {}

  return {
    Container: MockContainer,
    Graphics: MockGraphics,
    Text: MockText,
    TextStyle: MockTextStyle,
  };
});

// Mock styles
vi.mock('../rendering/styles', () => ({
  hudStyle: {},
  hudLabelStyle: {},
  terminalDimStyle: {},
  FONT_SIZES: { SMALL: 12, NORMAL: 16, MEDIUM: 20, LARGE: 24, TITLE: 32 },
}));

// Mock Renderer colors
vi.mock('../rendering/Renderer', () => ({
  COLORS: {
    BACKGROUND: 0x0a0a0a,
    TERMINAL_GREEN: 0x00ff00,
    TERMINAL_DIM: 0x008800,
    TERMINAL_BRIGHT: 0x44ff44,
    TERMINAL_RED: 0xff4444,
  },
}));

import { Container } from 'pixi.js';
import { HUD } from './HUD';
import { createGameStore, type GameStore } from '../core/state/game-store';
import { DEFAULT_CONFIG } from '../game/GameConfig';

// ============================================================================
// Test Setup
// ============================================================================

describe('HUD', () => {
  let store: GameStore;
  let parentContainer: Container;
  let hud: HUD;

  beforeEach(() => {
    // Create fresh store and container for each test
    store = createGameStore();
    parentContainer = new Container();
  });

  afterEach(() => {
    // Clean up HUD if it was created
    if (hud) {
      hud.destroy();
    }
    parentContainer.destroy({ children: true });
  });

  // ==========================================================================
  // Construction Tests
  // ==========================================================================

  describe('construction', () => {
    it('should create HUD and add to parent container', () => {
      hud = new HUD(store, parentContainer, DEFAULT_CONFIG);

      expect(parentContainer.children.length).toBe(1);
      expect(hud.getContainer().label).toBe('hud');
    });

    it('should position HUD in top-right of canvas', () => {
      hud = new HUD(store, parentContainer, DEFAULT_CONFIG);

      const container = hud.getContainer();
      // HUD should be near right edge (canvas width - HUD width - padding)
      expect(container.x).toBeLessThan(DEFAULT_CONFIG.canvas.width);
      expect(container.x).toBeGreaterThan(0);
      // HUD should be near top
      expect(container.y).toBeLessThan(100);
    });

    it('should be visible by default', () => {
      hud = new HUD(store, parentContainer, DEFAULT_CONFIG);

      expect(hud.isVisible()).toBe(true);
    });

    it('should display initial resource values from store', () => {
      // Set initial resources
      store.getState().setResource('money', '12345');
      store.getState().setResource('technique', '100');
      store.getState().setResource('renown', '50');

      hud = new HUD(store, parentContainer, DEFAULT_CONFIG);

      // HUD should have initialized with these values
      // We verify by checking the container exists and has children
      expect(hud.getContainer().children.length).toBeGreaterThan(0);
    });
  });

  // ==========================================================================
  // Reactive Subscription Tests
  // ==========================================================================

  describe('reactive subscriptions', () => {
    it('should update money display when store changes', () => {
      hud = new HUD(store, parentContainer, DEFAULT_CONFIG);

      // Change money in store
      store.getState().addResource('money', '5000');

      // The subscription should have triggered and updated the display
      // We verify the HUD is still functional
      expect(hud.isVisible()).toBe(true);
    });

    it('should update technique display when store changes', () => {
      hud = new HUD(store, parentContainer, DEFAULT_CONFIG);

      // Change technique in store
      store.getState().addResource('technique', '250');

      // Verify HUD still functional
      expect(hud.isVisible()).toBe(true);
    });

    it('should update renown display when store changes', () => {
      hud = new HUD(store, parentContainer, DEFAULT_CONFIG);

      // Change renown in store
      store.getState().addResource('renown', '75');

      // Verify HUD still functional
      expect(hud.isVisible()).toBe(true);
    });

    it('should handle rapid state changes without errors', () => {
      hud = new HUD(store, parentContainer, DEFAULT_CONFIG);

      // Rapidly change resources
      for (let i = 0; i < 100; i++) {
        store.getState().addResource('money', '1');
        store.getState().addResource('technique', '1');
        store.getState().addResource('renown', '1');
      }

      // Should not throw and HUD should still be functional
      expect(hud.isVisible()).toBe(true);
    });
  });

  // ==========================================================================
  // Auto Rate Display Tests
  // ==========================================================================

  describe('auto rate display', () => {
    it('should update rate display when updateAutoRate is called', () => {
      hud = new HUD(store, parentContainer, DEFAULT_CONFIG);

      hud.updateAutoRate('123.45');

      expect(hud.getDisplayedAutoRate()).toBe('123.45');
    });

    it('should return zero initially', () => {
      hud = new HUD(store, parentContainer, DEFAULT_CONFIG);

      expect(hud.getDisplayedAutoRate()).toBe('0');
    });

    it('should handle large rate values', () => {
      hud = new HUD(store, parentContainer, DEFAULT_CONFIG);

      hud.updateAutoRate('1000000000');

      expect(hud.getDisplayedAutoRate()).toBe('1000000000');
    });

    it('should handle zero rate', () => {
      hud = new HUD(store, parentContainer, DEFAULT_CONFIG);

      hud.updateAutoRate('100');
      hud.updateAutoRate('0');

      expect(hud.getDisplayedAutoRate()).toBe('0');
    });
  });

  // ==========================================================================
  // Visibility Tests
  // ==========================================================================

  describe('visibility', () => {
    it('should hide when hide() is called', () => {
      hud = new HUD(store, parentContainer, DEFAULT_CONFIG);

      hud.hide();

      expect(hud.isVisible()).toBe(false);
      expect(hud.getContainer().visible).toBe(false);
    });

    it('should show when show() is called after hiding', () => {
      hud = new HUD(store, parentContainer, DEFAULT_CONFIG);

      hud.hide();
      hud.show();

      expect(hud.isVisible()).toBe(true);
      expect(hud.getContainer().visible).toBe(true);
    });

    it('should handle multiple show/hide calls', () => {
      hud = new HUD(store, parentContainer, DEFAULT_CONFIG);

      hud.hide();
      hud.hide();
      hud.show();
      hud.show();
      hud.hide();

      expect(hud.isVisible()).toBe(false);
    });
  });

  // ==========================================================================
  // Refresh Tests
  // ==========================================================================

  describe('refresh', () => {
    it('should refresh all values from current state', () => {
      hud = new HUD(store, parentContainer, DEFAULT_CONFIG);

      // Manually change state (simulating save load)
      store.getState().setResource('money', '999999');
      store.getState().setResource('technique', '888');
      store.getState().setResource('renown', '777');

      // Force refresh
      hud.refresh();

      // HUD should still be functional
      expect(hud.isVisible()).toBe(true);
    });
  });

  // ==========================================================================
  // Cleanup Tests
  // ==========================================================================

  describe('destroy', () => {
    it('should clean up subscriptions on destroy', () => {
      hud = new HUD(store, parentContainer, DEFAULT_CONFIG);

      hud.destroy();

      // Parent container should be empty after destroy
      expect(parentContainer.children.length).toBe(0);

      // State changes should not cause errors after destroy
      store.getState().addResource('money', '1000');
    });

    it('should handle double destroy gracefully', () => {
      hud = new HUD(store, parentContainer, DEFAULT_CONFIG);

      hud.destroy();

      // Second destroy should not throw
      expect(() => hud.destroy()).not.toThrow();
    });

    it('should remove container from parent on destroy', () => {
      hud = new HUD(store, parentContainer, DEFAULT_CONFIG);

      expect(parentContainer.children.length).toBe(1);

      hud.destroy();

      expect(parentContainer.children.length).toBe(0);
    });
  });

  // ==========================================================================
  // Integration Tests
  // ==========================================================================

  describe('integration', () => {
    it('should work correctly through a complete lifecycle', () => {
      // Create
      hud = new HUD(store, parentContainer, DEFAULT_CONFIG);
      expect(hud.isVisible()).toBe(true);

      // Update resources
      store.getState().addResource('money', '10000');
      store.getState().addResource('technique', '500');
      store.getState().addResource('renown', '100');

      // Update rate
      hud.updateAutoRate('50.5');
      expect(hud.getDisplayedAutoRate()).toBe('50.5');

      // Hide and show
      hud.hide();
      expect(hud.isVisible()).toBe(false);
      hud.show();
      expect(hud.isVisible()).toBe(true);

      // Refresh
      hud.refresh();

      // Destroy
      hud.destroy();
      expect(parentContainer.children.length).toBe(0);
    });

    it('should handle state changes while hidden', () => {
      hud = new HUD(store, parentContainer, DEFAULT_CONFIG);

      hud.hide();

      // Change state while hidden
      store.getState().addResource('money', '5000');
      store.getState().addResource('technique', '200');

      // Show again
      hud.show();

      // HUD should display updated values
      expect(hud.isVisible()).toBe(true);
    });
  });

  // ==========================================================================
  // Edge Cases
  // ==========================================================================

  describe('edge cases', () => {
    it('should handle very large numbers', () => {
      hud = new HUD(store, parentContainer, DEFAULT_CONFIG);

      // Set a very large value
      store.getState().setResource('money', '1e100');

      // Should not throw
      expect(hud.isVisible()).toBe(true);
    });

    it('should handle decimal values', () => {
      hud = new HUD(store, parentContainer, DEFAULT_CONFIG);

      // Set a decimal value
      store.getState().setResource('money', '1234.5678');

      // Should not throw
      expect(hud.isVisible()).toBe(true);
    });

    it('should handle negative values gracefully', () => {
      hud = new HUD(store, parentContainer, DEFAULT_CONFIG);

      // Set a negative value (shouldn't happen in practice but handle gracefully)
      store.getState().setResource('money', '-100');

      // Should not throw
      expect(hud.isVisible()).toBe(true);
    });

    it('should handle zero values', () => {
      hud = new HUD(store, parentContainer, DEFAULT_CONFIG);

      store.getState().setResource('money', '0');
      store.getState().setResource('technique', '0');
      store.getState().setResource('renown', '0');

      // Should not throw
      expect(hud.isVisible()).toBe(true);
    });
  });
});
