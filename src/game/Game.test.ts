/**
 * Game class unit tests
 *
 * These tests verify the Game class initialization, lifecycle, and system ownership.
 * Note: Full integration tests require a DOM environment, so we mock PixiJS
 * and test the non-rendering aspects.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock PixiJS before importing Game - use class-based mocks
vi.mock('pixi.js', () => {
  class MockContainer {
    addChild = vi.fn();
    removeChild = vi.fn();
    destroy = vi.fn();
    label = '';
    children: unknown[] = [];
  }

  class MockApplication {
    init = vi.fn().mockResolvedValue(undefined);
    stage = {
      addChild: vi.fn(),
      removeChild: vi.fn(),
    };
    canvas = {
      remove: vi.fn(),
    };
    screen = {
      width: 800,
      height: 600,
    };
    destroy = vi.fn();
    ticker = {
      add: vi.fn(),
      remove: vi.fn(),
    };
    start = vi.fn();
    stop = vi.fn();
    renderer = {
      resize: vi.fn(),
    };
  }

  class MockGraphics {
    fill = vi.fn().mockReturnThis();
    stroke = vi.fn().mockReturnThis();
    rect = vi.fn().mockReturnThis();
    roundRect = vi.fn().mockReturnThis();
    moveTo = vi.fn().mockReturnThis();
    lineTo = vi.fn().mockReturnThis();
    circle = vi.fn().mockReturnThis();
    ellipse = vi.fn().mockReturnThis();
    clear = vi.fn().mockReturnThis();
    eventMode = '';
    x = 0;
    y = 0;
    visible = true;
    destroy = vi.fn();
  }

  class MockText {
    anchor = { set: vi.fn() };
    x = 0;
    y = 0;
    text = '';
    style = {};
    width = 100;
    destroy = vi.fn();
  }

  class MockTextStyle {}

  return {
    Application: MockApplication,
    Container: MockContainer,
    Graphics: MockGraphics,
    Text: MockText,
    TextStyle: MockTextStyle,
  };
});

// Mock the DOM
const mockGetElementById = vi.fn((id: string) => {
  if (id === 'game-container') {
    return {
      appendChild: vi.fn(),
      querySelector: vi.fn().mockReturnValue(null),
    };
  }
  if (id === 'loading') {
    return {
      classList: {
        add: vi.fn(),
        remove: vi.fn(),
      },
    };
  }
  return null;
});

vi.stubGlobal('document', {
  getElementById: mockGetElementById,
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  visibilityState: 'visible',
});

vi.stubGlobal('window', {
  devicePixelRatio: 1,
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  requestAnimationFrame: vi.fn((cb) => setTimeout(cb, 16)),
  setInterval: vi.fn(() => 123),
  clearInterval: vi.fn(),
});

// Mock styles
vi.mock('../rendering/styles', () => ({
  titleStyle: {},
  terminalStyle: {},
  terminalBrightStyle: {},
  terminalDimStyle: {},
  terminalSmallStyle: {},
  promptStyle: {},
  FONT_SIZES: { SMALL: 12, NORMAL: 16, MEDIUM: 20, LARGE: 24, TITLE: 32 },
}));

// Mock Renderer colors
vi.mock('../rendering/Renderer', () => {
  class MockRenderer {
    app = {};
    root = {
      addChild: vi.fn(),
      removeChild: vi.fn(),
      destroy: vi.fn(),
      label: '',
      children: [],
    };
    config = {};
    width = 800;
    height = 600;
    center = { x: 400, y: 300 };
    stage = { addChild: vi.fn() };
    canvas = { remove: vi.fn() };
    ticker = { add: vi.fn(), remove: vi.fn() };

    static create = vi.fn().mockImplementation(async () => {
      return new MockRenderer();
    });

    resize = vi.fn();
    start = vi.fn();
    stop = vi.fn();
    destroy = vi.fn();
  }

  return {
    Renderer: MockRenderer,
    COLORS: {
      BACKGROUND: 0x0a0a0a,
      TERMINAL_GREEN: 0x00ff00,
      TERMINAL_DIM: 0x008800,
      TERMINAL_BRIGHT: 0x44ff44,
      TERMINAL_RED: 0xff4444,
      TERMINAL_YELLOW: 0xffff00,
      TERMINAL_CYAN: 0x00ffff,
      WHITE: 0xffffff,
    },
  };
});

// Now import Game
import { Game } from './Game';
import { DEFAULT_CONFIG } from './GameConfig';

describe('Game', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Game.create()', () => {
    it('should create a Game instance with default config', async () => {
      const game = await Game.create();

      expect(game).toBeInstanceOf(Game);
      expect(game.config).toBeDefined();
      expect(game.config.canvas.width).toBe(DEFAULT_CONFIG.canvas.width);

      game.destroy();
    });

    it('should create a Game instance with custom config', async () => {
      const game = await Game.create({
        config: {
          canvas: { width: 1024, height: 768 },
        },
      });

      expect(game.config.canvas.width).toBe(1024);
      expect(game.config.canvas.height).toBe(768);

      game.destroy();
    });

    it('should initialize all systems', async () => {
      const game = await Game.create();

      // Check all systems are initialized
      expect(game.renderer).toBeDefined();
      expect(game.inputManager).toBeDefined();
      expect(game.sceneManager).toBeDefined();
      expect(game.store).toBeDefined();
      expect(game.eventBus).toBeDefined();
      expect(game.saveManager).toBeDefined();

      game.destroy();
    });

    it('should initialize input manager', async () => {
      const game = await Game.create();

      expect(game.inputManager.isInitialized()).toBe(true);

      game.destroy();
    });
  });

  describe('game.start()', () => {
    it('should start the game and set running state', async () => {
      const game = await Game.create();

      expect(game.isRunning()).toBe(false);

      await game.start();

      expect(game.isRunning()).toBe(true);

      game.destroy();
    });

    it('should not start twice', async () => {
      const game = await Game.create();
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      await game.start();
      await game.start(); // Second call should warn

      expect(consoleSpy).toHaveBeenCalledWith('[Game] Already running');

      game.destroy();
      consoleSpy.mockRestore();
    });
  });

  describe('game.destroy()', () => {
    it('should clean up all systems', async () => {
      const game = await Game.create();
      await game.start();

      expect(game.isRunning()).toBe(true);

      game.destroy();

      expect(game.isRunning()).toBe(false);
    });

    it('should handle being called when not running', async () => {
      const game = await Game.create();
      // Don't start, just destroy
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      game.destroy();

      expect(consoleSpy).toHaveBeenCalledWith('[Game] Not running, nothing to destroy');
      consoleSpy.mockRestore();
    });

    it('should stop input manager', async () => {
      const game = await Game.create();
      await game.start();

      expect(game.inputManager.isInitialized()).toBe(true);

      game.destroy();

      expect(game.inputManager.isInitialized()).toBe(false);
    });
  });

  describe('game.getCanvasSize()', () => {
    it('should return canvas dimensions', async () => {
      const game = await Game.create();

      const size = game.getCanvasSize();

      expect(size.width).toBe(800);
      expect(size.height).toBe(600);

      game.destroy();
    });
  });

  describe('game.getCurrentSceneId()', () => {
    it('should return null before start', async () => {
      const game = await Game.create();

      expect(game.getCurrentSceneId()).toBeNull();

      game.destroy();
    });

    it('should return main-menu after start', async () => {
      const game = await Game.create();

      await game.start();

      expect(game.getCurrentSceneId()).toBe('main-menu');

      game.destroy();
    });
  });

  describe('store initialization', () => {
    it('should create store with initial state', async () => {
      const game = await Game.create();

      const state = game.store.getState();

      expect(state.resources).toBeDefined();
      expect(state.resources.money).toBe('0');
      expect(state.resources.technique).toBe('0');
      expect(state.resources.renown).toBe('0');

      game.destroy();
    });

    it('should allow resource mutations through store', async () => {
      const game = await Game.create();

      const state = game.store.getState();
      state.addResource('money', '100');

      expect(game.store.getState().resources.money).toBe('100');

      game.destroy();
    });
  });

  describe('event bus', () => {
    it('should have a functioning event bus', async () => {
      const game = await Game.create();
      const callback = vi.fn();

      const unsubscribe = game.eventBus.on('minigame:completed', callback);

      game.eventBus.emit('minigame:completed', {
        minigameId: 'test',
        score: 100,
        maxCombo: 5,
        durationMs: 1000,
        rewards: {},
        isNewTopScore: false,
      });

      expect(callback).toHaveBeenCalledOnce();

      unsubscribe();
      game.destroy();
    });
  });

  describe('scene registration', () => {
    it('should register main-menu scene', async () => {
      const game = await Game.create();

      expect(game.sceneManager.hasScene('main-menu')).toBe(true);

      game.destroy();
    });
  });
});
