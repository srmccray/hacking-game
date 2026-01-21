/**
 * EventBus unit tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventBus, type EventMap } from './EventBus';

// Test event map
interface TestEvents extends EventMap {
  'test:simple': { value: number };
  'test:string': string;
  'test:void': undefined;
}

describe('EventBus', () => {
  let eventBus: EventBus<TestEvents>;

  beforeEach(() => {
    eventBus = new EventBus<TestEvents>();
  });

  describe('on()', () => {
    it('should register a listener and call it when event is emitted', () => {
      const callback = vi.fn();
      eventBus.on('test:simple', callback);

      eventBus.emit('test:simple', { value: 42 });

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith({ value: 42 });
    });

    it('should return an unsubscribe function', () => {
      const callback = vi.fn();
      const unsubscribe = eventBus.on('test:simple', callback);

      // First emit should work
      eventBus.emit('test:simple', { value: 1 });
      expect(callback).toHaveBeenCalledTimes(1);

      // Unsubscribe
      unsubscribe();

      // Second emit should not call callback
      eventBus.emit('test:simple', { value: 2 });
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should support multiple listeners for the same event', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      eventBus.on('test:simple', callback1);
      eventBus.on('test:simple', callback2);

      eventBus.emit('test:simple', { value: 100 });

      expect(callback1).toHaveBeenCalledTimes(1);
      expect(callback2).toHaveBeenCalledTimes(1);
    });
  });

  describe('once()', () => {
    it('should only call the listener once', () => {
      const callback = vi.fn();
      eventBus.once('test:simple', callback);

      eventBus.emit('test:simple', { value: 1 });
      eventBus.emit('test:simple', { value: 2 });

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith({ value: 1 });
    });

    it('should allow unsubscribe before emission', () => {
      const callback = vi.fn();
      const unsubscribe = eventBus.once('test:simple', callback);

      unsubscribe();
      eventBus.emit('test:simple', { value: 1 });

      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('emit()', () => {
    it('should do nothing if no listeners are registered', () => {
      // Should not throw
      expect(() => {
        eventBus.emit('test:simple', { value: 1 });
      }).not.toThrow();
    });

    it('should catch and log errors from listeners', () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
      const errorCallback = vi.fn(() => {
        throw new Error('Test error');
      });
      const normalCallback = vi.fn();

      eventBus.on('test:simple', errorCallback);
      eventBus.on('test:simple', normalCallback);

      eventBus.emit('test:simple', { value: 1 });

      // Both callbacks should be attempted
      expect(errorCallback).toHaveBeenCalled();
      expect(normalCallback).toHaveBeenCalled();
      expect(consoleError).toHaveBeenCalled();

      consoleError.mockRestore();
    });

    it('should pass correct data to listeners', () => {
      const callback = vi.fn();
      eventBus.on('test:string', callback);

      eventBus.emit('test:string', 'hello world');

      expect(callback).toHaveBeenCalledWith('hello world');
    });
  });

  describe('off()', () => {
    it('should remove a specific listener', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      eventBus.on('test:simple', callback1);
      eventBus.on('test:simple', callback2);

      eventBus.off('test:simple', callback1);
      eventBus.emit('test:simple', { value: 1 });

      expect(callback1).not.toHaveBeenCalled();
      expect(callback2).toHaveBeenCalled();
    });

    it('should remove all listeners for an event when no callback specified', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      eventBus.on('test:simple', callback1);
      eventBus.on('test:simple', callback2);

      eventBus.off('test:simple');
      eventBus.emit('test:simple', { value: 1 });

      expect(callback1).not.toHaveBeenCalled();
      expect(callback2).not.toHaveBeenCalled();
    });
  });

  describe('clear()', () => {
    it('should remove all listeners for all events', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      eventBus.on('test:simple', callback1);
      eventBus.on('test:string', callback2);

      eventBus.clear();

      eventBus.emit('test:simple', { value: 1 });
      eventBus.emit('test:string', 'hello');

      expect(callback1).not.toHaveBeenCalled();
      expect(callback2).not.toHaveBeenCalled();
    });
  });

  describe('hasListeners()', () => {
    it('should return true when listeners exist', () => {
      eventBus.on('test:simple', () => {});

      expect(eventBus.hasListeners('test:simple')).toBe(true);
    });

    it('should return false when no listeners exist', () => {
      expect(eventBus.hasListeners('test:simple')).toBe(false);
    });

    it('should return false after all listeners are removed', () => {
      const unsubscribe = eventBus.on('test:simple', () => {});
      unsubscribe();

      expect(eventBus.hasListeners('test:simple')).toBe(false);
    });
  });

  describe('listenerCount()', () => {
    it('should return correct count', () => {
      expect(eventBus.listenerCount('test:simple')).toBe(0);

      eventBus.on('test:simple', () => {});
      expect(eventBus.listenerCount('test:simple')).toBe(1);

      eventBus.on('test:simple', () => {});
      expect(eventBus.listenerCount('test:simple')).toBe(2);
    });
  });

  describe('getEventNames()', () => {
    it('should return all event names with listeners', () => {
      eventBus.on('test:simple', () => {});
      eventBus.on('test:string', () => {});

      const names = eventBus.getEventNames();

      expect(names).toContain('test:simple');
      expect(names).toContain('test:string');
      expect(names).toHaveLength(2);
    });

    it('should return empty array when no listeners', () => {
      expect(eventBus.getEventNames()).toEqual([]);
    });
  });
});
