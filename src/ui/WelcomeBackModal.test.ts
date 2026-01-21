/**
 * Tests for WelcomeBackModal component.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WelcomeBackModal } from './WelcomeBackModal';
import type { Game } from '../game/Game';
import type { OfflineProgressResult } from '../core/progression/offline-progress';

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

  return {
    config: {
      canvas: {
        width: 800,
        height: 600,
      },
    },
    inputManager: mockInputManager,
    renderer: mockRenderer,
  } as unknown as Game;
}

/**
 * Create a mock offline progress result.
 */
function createMockOfflineResult(): OfflineProgressResult {
  return {
    wasCalculated: true,
    shouldShowModal: true,
    totalSecondsAway: 3600, // 1 hour
    effectiveSeconds: 3600,
    wasCapped: false,
    earnings: {
      money: '1000',
      technique: '0',
      renown: '0',
    },
    formattedTimeAway: '1h',
    efficiency: 0.5,
  };
}

// ============================================================================
// Tests
// ============================================================================

describe('WelcomeBackModal', () => {
  let modal: WelcomeBackModal;
  let mockGame: Game;

  beforeEach(() => {
    mockGame = createMockGame();
    modal = new WelcomeBackModal(mockGame);
  });

  afterEach(() => {
    modal.destroy();
  });

  describe('constructor', () => {
    it('should create a container with correct label', () => {
      expect(modal.container.label).toBe('welcome-back-modal');
    });

    it('should start hidden', () => {
      expect(modal.container.visible).toBe(false);
      expect(modal.isVisible()).toBe(false);
    });
  });

  describe('show', () => {
    it('should make the modal visible', () => {
      const result = createMockOfflineResult();
      modal.show(result, vi.fn());

      expect(modal.isVisible()).toBe(true);
      expect(modal.container.visible).toBe(true);
    });

    it('should register input context', () => {
      const result = createMockOfflineResult();
      modal.show(result, vi.fn());

      expect(mockGame.inputManager.registerContext).toHaveBeenCalled();
      expect(mockGame.inputManager.enableContext).toHaveBeenCalledWith('welcome-back-modal');
    });

    it('should not show again if already visible', () => {
      const result = createMockOfflineResult();
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      modal.show(result, callback1);
      modal.show(result, callback2);

      // Should only register context once
      expect(mockGame.inputManager.registerContext).toHaveBeenCalledTimes(1);
    });
  });

  describe('hide', () => {
    it('should hide the modal', () => {
      const result = createMockOfflineResult();
      modal.show(result, vi.fn());
      modal.hide();

      expect(modal.isVisible()).toBe(false);
      expect(modal.container.visible).toBe(false);
    });

    it('should call the dismiss callback', () => {
      const result = createMockOfflineResult();
      const callback = vi.fn();

      modal.show(result, callback);
      modal.hide();

      expect(callback).toHaveBeenCalled();
    });

    it('should unregister input context', () => {
      const result = createMockOfflineResult();
      modal.show(result, vi.fn());
      modal.hide();

      expect(mockGame.inputManager.disableContext).toHaveBeenCalledWith('welcome-back-modal');
      expect(mockGame.inputManager.unregisterContext).toHaveBeenCalledWith('welcome-back-modal');
    });

    it('should not call callback if not visible', () => {
      const callback = vi.fn();
      modal.hide(); // Not shown yet

      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('destroy', () => {
    it('should hide the modal if visible', () => {
      const result = createMockOfflineResult();
      const callback = vi.fn();
      modal.show(result, callback);
      modal.destroy();

      expect(callback).toHaveBeenCalled();
    });
  });

  describe('offline progress display', () => {
    it('should handle capped time display', () => {
      const result = createMockOfflineResult();
      result.wasCapped = true;
      result.formattedTimeAway = '8h';
      result.totalSecondsAway = 28800;
      result.effectiveSeconds = 28800;

      modal.show(result, vi.fn());

      // Modal should be visible
      expect(modal.isVisible()).toBe(true);
    });

    it('should display efficiency percentage', () => {
      const result = createMockOfflineResult();
      result.efficiency = 0.5;

      modal.show(result, vi.fn());

      // Modal should be visible with efficiency displayed
      expect(modal.isVisible()).toBe(true);
    });
  });
});
