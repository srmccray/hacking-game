/**
 * Tests for InputManager
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { InputManager, INPUT_PRIORITY, type InputContext, type GlobalBinding } from './InputManager';

describe('InputManager', () => {
  let inputManager: InputManager;

  beforeEach(() => {
    inputManager = new InputManager();
  });

  afterEach(() => {
    inputManager.destroy();
  });

  // ==========================================================================
  // Initialization Tests
  // ==========================================================================

  describe('initialization', () => {
    it('should initialize and add event listeners', () => {
      const addEventListenerSpy = vi.spyOn(window, 'addEventListener');

      inputManager.init();

      expect(addEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
      expect(addEventListenerSpy).toHaveBeenCalledWith('keyup', expect.any(Function));
      expect(addEventListenerSpy).toHaveBeenCalledWith('blur', expect.any(Function));
      expect(inputManager.isInitialized()).toBe(true);

      addEventListenerSpy.mockRestore();
    });

    it('should warn when initialized twice', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      inputManager.init();
      inputManager.init();

      expect(warnSpy).toHaveBeenCalledWith('[InputManager] Already initialized');

      warnSpy.mockRestore();
    });

    it('should destroy and remove event listeners', () => {
      const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

      inputManager.init();
      inputManager.destroy();

      expect(removeEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
      expect(removeEventListenerSpy).toHaveBeenCalledWith('keyup', expect.any(Function));
      expect(removeEventListenerSpy).toHaveBeenCalledWith('blur', expect.any(Function));
      expect(inputManager.isInitialized()).toBe(false);

      removeEventListenerSpy.mockRestore();
    });

    it('should do nothing when destroying without initialization', () => {
      const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

      inputManager.destroy();

      expect(removeEventListenerSpy).not.toHaveBeenCalled();

      removeEventListenerSpy.mockRestore();
    });
  });

  // ==========================================================================
  // Context Management Tests
  // ==========================================================================

  describe('context management', () => {
    it('should register a context', () => {
      const context: InputContext = {
        id: 'test',
        priority: INPUT_PRIORITY.SCENE,
        enabled: false,
        bindings: new Map(),
      };

      inputManager.registerContext(context);

      expect(inputManager.getContext('test')).toBe(context);
      expect(inputManager.getContextIds()).toContain('test');
    });

    it('should replace existing context with same ID', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const context1: InputContext = {
        id: 'test',
        priority: INPUT_PRIORITY.SCENE,
        enabled: false,
        bindings: new Map(),
      };

      const context2: InputContext = {
        id: 'test',
        priority: INPUT_PRIORITY.MENU,
        enabled: true,
        bindings: new Map(),
      };

      inputManager.registerContext(context1);
      inputManager.registerContext(context2);

      expect(inputManager.getContext('test')).toBe(context2);
      expect(warnSpy).toHaveBeenCalled();

      warnSpy.mockRestore();
    });

    it('should unregister a context', () => {
      const context: InputContext = {
        id: 'test',
        priority: INPUT_PRIORITY.SCENE,
        enabled: false,
        bindings: new Map(),
      };

      inputManager.registerContext(context);
      const result = inputManager.unregisterContext('test');

      expect(result).toBe(true);
      expect(inputManager.getContext('test')).toBeUndefined();
    });

    it('should return false when unregistering non-existent context', () => {
      const result = inputManager.unregisterContext('nonexistent');
      expect(result).toBe(false);
    });

    it('should enable a context', () => {
      const context: InputContext = {
        id: 'test',
        priority: INPUT_PRIORITY.SCENE,
        enabled: false,
        bindings: new Map(),
      };

      inputManager.registerContext(context);
      const result = inputManager.enableContext('test');

      expect(result).toBe(true);
      expect(inputManager.isContextEnabled('test')).toBe(true);
    });

    it('should return false when enabling non-existent context', () => {
      const result = inputManager.enableContext('nonexistent');
      expect(result).toBe(false);
    });

    it('should disable a context', () => {
      const context: InputContext = {
        id: 'test',
        priority: INPUT_PRIORITY.SCENE,
        enabled: true,
        bindings: new Map(),
      };

      inputManager.registerContext(context);
      const result = inputManager.disableContext('test');

      expect(result).toBe(true);
      expect(inputManager.isContextEnabled('test')).toBe(false);
    });

    it('should call onRelease for held keys when disabling context', () => {
      const releaseFn = vi.fn();

      const context: InputContext = {
        id: 'test',
        priority: INPUT_PRIORITY.SCENE,
        enabled: true,
        bindings: new Map([['KeyA', { onRelease: releaseFn }]]),
      };

      inputManager.init();
      inputManager.registerContext(context);

      // Simulate key press
      const keydownEvent = new KeyboardEvent('keydown', { code: 'KeyA' });
      window.dispatchEvent(keydownEvent);

      // Disable context
      inputManager.disableContext('test');

      expect(releaseFn).toHaveBeenCalled();
    });

    it('should update context bindings', () => {
      const context: InputContext = {
        id: 'test',
        priority: INPUT_PRIORITY.SCENE,
        enabled: false,
        bindings: new Map(),
      };

      inputManager.registerContext(context);

      const newBindings = new Map([['KeyB', { onPress: (): void => {} }]]);
      const result = inputManager.updateContextBindings('test', newBindings);

      expect(result).toBe(true);
      expect(inputManager.getContext('test')?.bindings).toBe(newBindings);
    });

    it('should return false when updating non-existent context bindings', () => {
      const result = inputManager.updateContextBindings('nonexistent', new Map());
      expect(result).toBe(false);
    });
  });

  // ==========================================================================
  // Global Binding Tests
  // ==========================================================================

  describe('global bindings', () => {
    it('should register a global binding', () => {
      const binding: GlobalBinding = {
        code: 'Escape',
        onPress: () => {},
      };

      inputManager.registerGlobalBinding(binding);

      expect(inputManager.getGlobalBindings()).toContain(binding);
    });

    it('should replace existing global binding with same code', () => {
      const binding1: GlobalBinding = {
        code: 'Escape',
        onPress: vi.fn(),
      };

      const binding2: GlobalBinding = {
        code: 'Escape',
        onPress: vi.fn(),
      };

      inputManager.registerGlobalBinding(binding1);
      inputManager.registerGlobalBinding(binding2);

      expect(inputManager.getGlobalBindings()).toHaveLength(1);
      expect(inputManager.getGlobalBindings()[0]).toBe(binding2);
    });

    it('should unregister a global binding', () => {
      const binding: GlobalBinding = {
        code: 'Escape',
        onPress: () => {},
      };

      inputManager.registerGlobalBinding(binding);
      const result = inputManager.unregisterGlobalBinding('Escape');

      expect(result).toBe(true);
      expect(inputManager.getGlobalBindings()).toHaveLength(0);
    });

    it('should return false when unregistering non-existent global binding', () => {
      const result = inputManager.unregisterGlobalBinding('nonexistent');
      expect(result).toBe(false);
    });
  });

  // ==========================================================================
  // Key State Tests
  // ==========================================================================

  describe('key state tracking', () => {
    beforeEach(() => {
      inputManager.init();
    });

    it('should track held keys', () => {
      const keydownEvent = new KeyboardEvent('keydown', { code: 'KeyA' });
      window.dispatchEvent(keydownEvent);

      expect(inputManager.isKeyHeld('KeyA')).toBe(true);
    });

    it('should update key state on keyup', () => {
      const keydownEvent = new KeyboardEvent('keydown', { code: 'KeyA' });
      const keyupEvent = new KeyboardEvent('keyup', { code: 'KeyA' });

      window.dispatchEvent(keydownEvent);
      expect(inputManager.isKeyHeld('KeyA')).toBe(true);

      window.dispatchEvent(keyupEvent);
      expect(inputManager.isKeyHeld('KeyA')).toBe(false);
    });

    it('should return false for unheld keys', () => {
      expect(inputManager.isKeyHeld('KeyA')).toBe(false);
    });

    it('should check if any keys are held', () => {
      const keydownEvent = new KeyboardEvent('keydown', { code: 'KeyA' });
      window.dispatchEvent(keydownEvent);

      expect(inputManager.isAnyKeyHeld(['KeyA', 'KeyB', 'KeyC'])).toBe(true);
      expect(inputManager.isAnyKeyHeld(['KeyX', 'KeyY', 'KeyZ'])).toBe(false);
    });

    it('should return all held keys', () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyA' }));
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyB' }));

      const heldKeys = inputManager.getHeldKeys();

      expect(heldKeys).toContain('KeyA');
      expect(heldKeys).toContain('KeyB');
      expect(heldKeys).toHaveLength(2);
    });

    it('should release all keys', () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyA' }));
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyB' }));

      inputManager.releaseAllKeys();

      expect(inputManager.getHeldKeys()).toHaveLength(0);
    });

    it('should call onRelease when releasing all keys', () => {
      const releaseFn = vi.fn();

      const context: InputContext = {
        id: 'test',
        priority: INPUT_PRIORITY.SCENE,
        enabled: true,
        bindings: new Map([['KeyA', { onRelease: releaseFn }]]),
      };

      inputManager.registerContext(context);
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyA' }));

      inputManager.releaseAllKeys();

      expect(releaseFn).toHaveBeenCalled();
    });

    it('should release all keys on window blur', () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyA' }));

      expect(inputManager.isKeyHeld('KeyA')).toBe(true);

      window.dispatchEvent(new Event('blur'));

      expect(inputManager.isKeyHeld('KeyA')).toBe(false);
    });
  });

  // ==========================================================================
  // Input Dispatching Tests
  // ==========================================================================

  describe('input dispatching', () => {
    beforeEach(() => {
      inputManager.init();
    });

    it('should call onPress handler for context binding', () => {
      const pressFn = vi.fn();

      const context: InputContext = {
        id: 'test',
        priority: INPUT_PRIORITY.SCENE,
        enabled: true,
        bindings: new Map([['KeyA', { onPress: pressFn }]]),
      };

      inputManager.registerContext(context);
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyA' }));

      expect(pressFn).toHaveBeenCalled();
    });

    it('should call onRelease handler for context binding', () => {
      const releaseFn = vi.fn();

      const context: InputContext = {
        id: 'test',
        priority: INPUT_PRIORITY.SCENE,
        enabled: true,
        bindings: new Map([['KeyA', { onRelease: releaseFn }]]),
      };

      inputManager.registerContext(context);
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyA' }));
      window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyA' }));

      expect(releaseFn).toHaveBeenCalled();
    });

    it('should not call handler for disabled context', () => {
      const pressFn = vi.fn();

      const context: InputContext = {
        id: 'test',
        priority: INPUT_PRIORITY.SCENE,
        enabled: false,
        bindings: new Map([['KeyA', { onPress: pressFn }]]),
      };

      inputManager.registerContext(context);
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyA' }));

      expect(pressFn).not.toHaveBeenCalled();
    });

    it('should respect priority ordering (higher priority first)', () => {
      const callOrder: string[] = [];

      const lowPriorityContext: InputContext = {
        id: 'low',
        priority: INPUT_PRIORITY.SCENE,
        enabled: true,
        bindings: new Map([['KeyA', { onPress: () => callOrder.push('low') }]]),
      };

      const highPriorityContext: InputContext = {
        id: 'high',
        priority: INPUT_PRIORITY.MENU,
        enabled: true,
        bindings: new Map([['KeyA', { onPress: () => callOrder.push('high') }]]),
      };

      // Register in reverse priority order
      inputManager.registerContext(lowPriorityContext);
      inputManager.registerContext(highPriorityContext);

      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyA' }));

      expect(callOrder).toEqual(['high', 'low']);
    });

    it('should block propagation when blocksPropagation is true', () => {
      const highPriorityFn = vi.fn();
      const lowPriorityFn = vi.fn();

      const lowPriorityContext: InputContext = {
        id: 'low',
        priority: INPUT_PRIORITY.SCENE,
        enabled: true,
        bindings: new Map([['KeyA', { onPress: lowPriorityFn }]]),
      };

      const highPriorityContext: InputContext = {
        id: 'high',
        priority: INPUT_PRIORITY.MENU,
        enabled: true,
        blocksPropagation: true,
        bindings: new Map([['KeyA', { onPress: highPriorityFn }]]),
      };

      inputManager.registerContext(lowPriorityContext);
      inputManager.registerContext(highPriorityContext);

      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyA' }));

      expect(highPriorityFn).toHaveBeenCalled();
      expect(lowPriorityFn).not.toHaveBeenCalled();
    });

    it('should block propagation even without matching binding', () => {
      const lowPriorityFn = vi.fn();

      const lowPriorityContext: InputContext = {
        id: 'low',
        priority: INPUT_PRIORITY.SCENE,
        enabled: true,
        bindings: new Map([['KeyA', { onPress: lowPriorityFn }]]),
      };

      const highPriorityContext: InputContext = {
        id: 'high',
        priority: INPUT_PRIORITY.MENU,
        enabled: true,
        blocksPropagation: true,
        bindings: new Map(), // No KeyA binding
      };

      inputManager.registerContext(lowPriorityContext);
      inputManager.registerContext(highPriorityContext);

      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyA' }));

      expect(lowPriorityFn).not.toHaveBeenCalled();
    });

    it('should ignore repeated keydown events', () => {
      const pressFn = vi.fn();

      const context: InputContext = {
        id: 'test',
        priority: INPUT_PRIORITY.SCENE,
        enabled: true,
        bindings: new Map([['KeyA', { onPress: pressFn }]]),
      };

      inputManager.registerContext(context);

      // First keydown
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyA' }));
      // Repeated keydown (held key)
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyA', repeat: true }));

      expect(pressFn).toHaveBeenCalledTimes(1);
    });
  });

  // ==========================================================================
  // Global Binding Dispatch Tests
  // ==========================================================================

  describe('global binding dispatch', () => {
    beforeEach(() => {
      inputManager.init();
    });

    it('should call global binding before context bindings', () => {
      const callOrder: string[] = [];

      const globalBinding: GlobalBinding = {
        code: 'KeyA',
        onPress: () => callOrder.push('global'),
      };

      const context: InputContext = {
        id: 'test',
        priority: INPUT_PRIORITY.SCENE,
        enabled: true,
        bindings: new Map([['KeyA', { onPress: () => callOrder.push('context') }]]),
      };

      inputManager.registerGlobalBinding(globalBinding);
      inputManager.registerContext(context);

      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyA' }));

      // Global binding should block context from receiving input
      expect(callOrder).toEqual(['global']);
    });

    it('should check condition before calling global binding', () => {
      const pressFn = vi.fn();
      let conditionValue = false;

      const globalBinding: GlobalBinding = {
        code: 'KeyA',
        onPress: pressFn,
        condition: () => conditionValue,
      };

      inputManager.registerGlobalBinding(globalBinding);

      // Condition is false
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyA' }));
      expect(pressFn).not.toHaveBeenCalled();

      // Release key first
      window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyA' }));

      // Condition is true
      conditionValue = true;
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyA' }));
      expect(pressFn).toHaveBeenCalled();
    });

    it('should call global binding onRelease', () => {
      const releaseFn = vi.fn();

      const globalBinding: GlobalBinding = {
        code: 'KeyA',
        onPress: () => {},
        onRelease: releaseFn,
      };

      inputManager.registerGlobalBinding(globalBinding);

      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyA' }));
      window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyA' }));

      expect(releaseFn).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // Priority Constants Tests
  // ==========================================================================

  describe('priority constants', () => {
    it('should have correct priority ordering', () => {
      expect(INPUT_PRIORITY.GLOBAL).toBeLessThan(INPUT_PRIORITY.SCENE);
      expect(INPUT_PRIORITY.SCENE).toBeLessThan(INPUT_PRIORITY.MENU);
      expect(INPUT_PRIORITY.MENU).toBeLessThan(INPUT_PRIORITY.DIALOG);
    });

    it('should have expected values', () => {
      expect(INPUT_PRIORITY.GLOBAL).toBe(0);
      expect(INPUT_PRIORITY.SCENE).toBe(50);
      expect(INPUT_PRIORITY.MENU).toBe(75);
      expect(INPUT_PRIORITY.DIALOG).toBe(100);
    });
  });
});
