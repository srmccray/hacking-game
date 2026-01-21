/**
 * Tests for the InputManager
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { InputManager, INPUT_PRIORITY, type InputContext } from './InputManager';

describe('InputManager', () => {
  let inputManager: InputManager;
  let addEventListenerSpy: ReturnType<typeof vi.spyOn>;
  let removeEventListenerSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    inputManager = new InputManager();
    addEventListenerSpy = vi.spyOn(window, 'addEventListener');
    removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');
  });

  afterEach(() => {
    inputManager.destroy();
    addEventListenerSpy.mockRestore();
    removeEventListenerSpy.mockRestore();
  });

  describe('initialization', () => {
    it('should add event listeners when initialized', () => {
      inputManager.init();

      expect(addEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
      expect(addEventListenerSpy).toHaveBeenCalledWith('keyup', expect.any(Function));
    });

    it('should not add duplicate listeners if initialized twice', () => {
      inputManager.init();
      inputManager.init();

      // Should only be called once for each event type
      const keydownCalls = addEventListenerSpy.mock.calls.filter(
        (call: unknown[]) => call[0] === 'keydown'
      );
      expect(keydownCalls.length).toBe(1);
    });
  });

  describe('destruction', () => {
    it('should remove event listeners when destroyed', () => {
      inputManager.init();
      inputManager.destroy();

      expect(removeEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
      expect(removeEventListenerSpy).toHaveBeenCalledWith('keyup', expect.any(Function));
    });

    it('should clear all contexts and bindings when destroyed', () => {
      inputManager.init();

      inputManager.registerContext({
        id: 'test',
        priority: 50,
        bindings: new Map(),
        enabled: true,
      });

      inputManager.registerGlobalBinding({
        code: 'Escape',
        onPress: vi.fn(),
      });

      inputManager.destroy();

      expect(inputManager.getContextIds()).toHaveLength(0);
    });
  });

  describe('context management', () => {
    beforeEach(() => {
      inputManager.init();
    });

    it('should register a context', () => {
      const context: InputContext = {
        id: 'test-context',
        priority: 50,
        bindings: new Map(),
        enabled: true,
      };

      inputManager.registerContext(context);

      expect(inputManager.getContextIds()).toContain('test-context');
    });

    it('should replace an existing context with the same id', () => {
      const context1: InputContext = {
        id: 'test',
        priority: 50,
        bindings: new Map(),
        enabled: true,
      };

      const context2: InputContext = {
        id: 'test',
        priority: 100,
        bindings: new Map(),
        enabled: true,
      };

      inputManager.registerContext(context1);
      inputManager.registerContext(context2);

      // Should only have one context
      expect(inputManager.getContextIds()).toHaveLength(1);
      expect(inputManager.isContextEnabled('test')).toBe(true);
    });

    it('should unregister a context', () => {
      inputManager.registerContext({
        id: 'test',
        priority: 50,
        bindings: new Map(),
        enabled: true,
      });

      inputManager.unregisterContext('test');

      expect(inputManager.getContextIds()).not.toContain('test');
    });

    it('should enable and disable contexts', () => {
      inputManager.registerContext({
        id: 'test',
        priority: 50,
        bindings: new Map(),
        enabled: false,
      });

      expect(inputManager.isContextEnabled('test')).toBe(false);

      inputManager.enableContext('test');
      expect(inputManager.isContextEnabled('test')).toBe(true);

      inputManager.disableContext('test');
      expect(inputManager.isContextEnabled('test')).toBe(false);
    });
  });

  describe('key state tracking', () => {
    beforeEach(() => {
      inputManager.init();
    });

    it('should track held keys', () => {
      inputManager.registerContext({
        id: 'test',
        priority: 50,
        bindings: new Map([
          ['KeyA', { onPress: vi.fn() }],
        ]),
        enabled: true,
      });

      // Simulate keydown
      const keydownEvent = new KeyboardEvent('keydown', { code: 'KeyA' });
      window.dispatchEvent(keydownEvent);

      expect(inputManager.isKeyHeld('KeyA')).toBe(true);
    });

    it('should stop tracking key when released', () => {
      inputManager.registerContext({
        id: 'test',
        priority: 50,
        bindings: new Map([
          ['KeyA', { onPress: vi.fn(), onRelease: vi.fn() }],
        ]),
        enabled: true,
      });

      // Simulate keydown then keyup
      const keydownEvent = new KeyboardEvent('keydown', { code: 'KeyA' });
      window.dispatchEvent(keydownEvent);

      const keyupEvent = new KeyboardEvent('keyup', { code: 'KeyA' });
      window.dispatchEvent(keyupEvent);

      expect(inputManager.isKeyHeld('KeyA')).toBe(false);
    });

    it('should check if any keys are held', () => {
      inputManager.registerContext({
        id: 'test',
        priority: 50,
        bindings: new Map([
          ['KeyA', { onPress: vi.fn() }],
          ['KeyD', { onPress: vi.fn() }],
        ]),
        enabled: true,
      });

      // Simulate keydown for KeyA
      const keydownEvent = new KeyboardEvent('keydown', { code: 'KeyA' });
      window.dispatchEvent(keydownEvent);

      expect(inputManager.isAnyKeyHeld(['KeyA', 'KeyD'])).toBe(true);
      expect(inputManager.isAnyKeyHeld(['KeyW', 'KeyS'])).toBe(false);
    });

    it('should get all held keys', () => {
      inputManager.registerContext({
        id: 'test',
        priority: 50,
        bindings: new Map([
          ['KeyA', { onPress: vi.fn() }],
          ['KeyD', { onPress: vi.fn() }],
        ]),
        enabled: true,
      });

      // Simulate keydown for both keys
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyA' }));
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyD' }));

      const heldKeys = inputManager.getHeldKeys();
      expect(heldKeys).toContain('KeyA');
      expect(heldKeys).toContain('KeyD');
    });

    it('should release all keys', () => {
      const onRelease = vi.fn();
      inputManager.registerContext({
        id: 'test',
        priority: 50,
        bindings: new Map([
          ['KeyA', { onPress: vi.fn(), onRelease }],
        ]),
        enabled: true,
      });

      // Simulate keydown
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyA' }));
      expect(inputManager.isKeyHeld('KeyA')).toBe(true);

      // Release all keys
      inputManager.releaseAllKeys();

      expect(inputManager.isKeyHeld('KeyA')).toBe(false);
      expect(onRelease).toHaveBeenCalled();
    });
  });

  describe('input handling', () => {
    beforeEach(() => {
      inputManager.init();
    });

    it('should call onPress handler when key is pressed', () => {
      const onPress = vi.fn();
      inputManager.registerContext({
        id: 'test',
        priority: 50,
        bindings: new Map([
          ['KeyA', { onPress }],
        ]),
        enabled: true,
      });

      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyA' }));

      expect(onPress).toHaveBeenCalled();
    });

    it('should call onRelease handler when key is released', () => {
      const onRelease = vi.fn();
      inputManager.registerContext({
        id: 'test',
        priority: 50,
        bindings: new Map([
          ['KeyA', { onRelease }],
        ]),
        enabled: true,
      });

      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyA' }));
      window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyA' }));

      expect(onRelease).toHaveBeenCalled();
    });

    it('should not call handler for disabled context', () => {
      const onPress = vi.fn();
      inputManager.registerContext({
        id: 'test',
        priority: 50,
        bindings: new Map([
          ['KeyA', { onPress }],
        ]),
        enabled: false,
      });

      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyA' }));

      expect(onPress).not.toHaveBeenCalled();
    });

    it('should handle higher priority contexts first', () => {
      const lowPriorityHandler = vi.fn();
      const highPriorityHandler = vi.fn();

      inputManager.registerContext({
        id: 'low',
        priority: 50,
        bindings: new Map([
          ['KeyA', { onPress: lowPriorityHandler }],
        ]),
        enabled: true,
      });

      inputManager.registerContext({
        id: 'high',
        priority: 100,
        bindings: new Map([
          ['KeyA', { onPress: highPriorityHandler }],
        ]),
        enabled: true,
        blocksPropagation: true,
      });

      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyA' }));

      expect(highPriorityHandler).toHaveBeenCalled();
      expect(lowPriorityHandler).not.toHaveBeenCalled();
    });

    it('should not block propagation if blocksPropagation is false', () => {
      const lowPriorityHandler = vi.fn();
      const highPriorityHandler = vi.fn();

      inputManager.registerContext({
        id: 'low',
        priority: 50,
        bindings: new Map([
          ['KeyA', { onPress: lowPriorityHandler }],
        ]),
        enabled: true,
      });

      inputManager.registerContext({
        id: 'high',
        priority: 100,
        bindings: new Map([
          ['KeyA', { onPress: highPriorityHandler }],
        ]),
        enabled: true,
        blocksPropagation: false,
      });

      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyA' }));

      expect(highPriorityHandler).toHaveBeenCalled();
      expect(lowPriorityHandler).toHaveBeenCalled();
    });

    it('should ignore repeated keydown events', () => {
      const onPress = vi.fn();
      inputManager.registerContext({
        id: 'test',
        priority: 50,
        bindings: new Map([
          ['KeyA', { onPress }],
        ]),
        enabled: true,
      });

      // First keydown
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyA', repeat: false }));
      // Repeated keydown
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyA', repeat: true }));

      expect(onPress).toHaveBeenCalledTimes(1);
    });
  });

  describe('global bindings', () => {
    beforeEach(() => {
      inputManager.init();
    });

    it('should handle global bindings', () => {
      const onPress = vi.fn();
      inputManager.registerGlobalBinding({
        code: 'Escape',
        onPress,
      });

      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape' }));

      expect(onPress).toHaveBeenCalled();
    });

    it('should check condition before calling global handler', () => {
      const onPress = vi.fn();
      inputManager.registerGlobalBinding({
        code: 'Escape',
        onPress,
        condition: () => false,
      });

      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape' }));

      expect(onPress).not.toHaveBeenCalled();
    });

    it('should unregister global bindings', () => {
      const onPress = vi.fn();
      inputManager.registerGlobalBinding({
        code: 'Escape',
        onPress,
      });

      inputManager.unregisterGlobalBinding('Escape');

      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape' }));

      expect(onPress).not.toHaveBeenCalled();
    });
  });

  describe('INPUT_PRIORITY constants', () => {
    it('should have correct priority values', () => {
      expect(INPUT_PRIORITY.GLOBAL).toBe(0);
      expect(INPUT_PRIORITY.SCENE).toBe(50);
      expect(INPUT_PRIORITY.MENU).toBe(75);
      expect(INPUT_PRIORITY.DIALOG).toBe(100);
    });

    it('should have priorities in ascending order', () => {
      expect(INPUT_PRIORITY.GLOBAL).toBeLessThan(INPUT_PRIORITY.SCENE);
      expect(INPUT_PRIORITY.SCENE).toBeLessThan(INPUT_PRIORITY.MENU);
      expect(INPUT_PRIORITY.MENU).toBeLessThan(INPUT_PRIORITY.DIALOG);
    });
  });
});
