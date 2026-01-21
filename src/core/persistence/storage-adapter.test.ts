/**
 * Tests for Storage Adapter Interface and StorageError
 */

import { describe, it, expect } from 'vitest';
import { StorageError } from './storage-adapter';

describe('StorageError', () => {
  it('should create an error with message and operation', () => {
    const error = new StorageError('Failed to read', 'get');

    expect(error.message).toBe('Failed to read');
    expect(error.name).toBe('StorageError');
    expect(error.operation).toBe('get');
    expect(error.key).toBeUndefined();
    expect(error.storageCause).toBeUndefined();
  });

  it('should create an error with key', () => {
    const error = new StorageError('Failed to write', 'set', 'test-key');

    expect(error.operation).toBe('set');
    expect(error.key).toBe('test-key');
  });

  it('should create an error with cause', () => {
    const cause = new Error('Original error');
    const error = new StorageError('Wrapped error', 'remove', 'test-key', cause);

    expect(error.storageCause).toBe(cause);
    expect(error.key).toBe('test-key');
  });

  it('should be an instance of Error', () => {
    const error = new StorageError('Test', 'keys');

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(StorageError);
  });

  it('should support all operation types', () => {
    const getError = new StorageError('msg', 'get');
    const setError = new StorageError('msg', 'set');
    const removeError = new StorageError('msg', 'remove');
    const keysError = new StorageError('msg', 'keys');

    expect(getError.operation).toBe('get');
    expect(setError.operation).toBe('set');
    expect(removeError.operation).toBe('remove');
    expect(keysError.operation).toBe('keys');
  });
});
