# Quick Sketch: Storage Abstraction Layer

**Created:** 2026-01-20
**Tier:** SMALL
**Triage Scores:** Complexity 3/10, Risk 2/10

## What

Add a storage abstraction layer to decouple the save system from direct `localStorage` calls, enabling cross-platform game saves for future mobile packaging.

## Why

The current save system uses `localStorage` directly in 12 call sites across 4 functions. This works for web but prevents packaging for mobile (Capacitor) or desktop (Electron) without code changes. A storage adapter pattern allows swapping storage backends without modifying the save system logic.

## Approach

1. **Create `StorageAdapter` interface** in `/Users/stephen/Projects/hacking-game/src/core/storage/storage-adapter.ts`
   - Define async methods: `getItem(key): Promise<string | null>`, `setItem(key, value): Promise<void>`, `removeItem(key): Promise<void>`
   - Export interface for type safety

2. **Create `LocalStorageAdapter`** in `/Users/stephen/Projects/hacking-game/src/core/storage/local-storage-adapter.ts`
   - Implement `StorageAdapter` interface wrapping `localStorage`
   - Handle async wrapping of synchronous `localStorage` API

3. **Create `StorageFactory`** in `/Users/stephen/Projects/hacking-game/src/core/storage/storage-factory.ts`
   - Export `createStorageAdapter()` function
   - For now, always returns `LocalStorageAdapter`
   - Add TODO comment for future platform detection (Capacitor, Electron)

4. **Update `save-system.ts`** to use adapter
   - Add module-level `storageAdapter` variable
   - Add `initializeStorage(adapter: StorageAdapter)` function
   - Convert 4 functions to use async adapter calls:
     - `loadSlotMetadata()` - line 108
     - `deleteSlot()` - line 186
     - `saveGame()` - line 254
     - `loadGame()` - line 356
   - Functions become async (already called in async contexts)

5. **Update `main.ts`** initialization
   - Import `createStorageAdapter` from factory
   - Call `initializeStorage(createStorageAdapter())` before `initializeSaveSystem()`

## Files Likely Affected

- `/Users/stephen/Projects/hacking-game/src/core/storage/storage-adapter.ts` (NEW) - Interface definition
- `/Users/stephen/Projects/hacking-game/src/core/storage/local-storage-adapter.ts` (NEW) - Web adapter implementation
- `/Users/stephen/Projects/hacking-game/src/core/storage/storage-factory.ts` (NEW) - Factory for platform detection
- `/Users/stephen/Projects/hacking-game/src/core/storage/index.ts` (NEW) - Barrel exports
- `/Users/stephen/Projects/hacking-game/src/core/save-system.ts` - Replace 12 localStorage calls with adapter
- `/Users/stephen/Projects/hacking-game/src/main.ts` - Initialize storage adapter before save system

## Considerations

- Making functions async may require updating callers (e.g., `loadSlotMetadata` in list operations)
- Error handling should remain consistent with current behavior (console.error + graceful fallback)
- IndexedDB adapter and Capacitor Preferences adapter are deferred to separate features
- Cloud sync is explicitly out of scope for this feature
- Unit tests for save-system.ts may need mock adapter injection

## Acceptance Criteria

- [ ] `StorageAdapter` interface is defined with `getItem`, `setItem`, `removeItem` async methods
- [ ] `LocalStorageAdapter` implements the interface and wraps browser localStorage
- [ ] `StorageFactory` returns appropriate adapter (LocalStorageAdapter for web)
- [ ] `save-system.ts` uses injected adapter instead of direct localStorage calls
- [ ] Storage adapter is initialized in `main.ts` before save system
- [ ] Existing save/load functionality works identically after refactor
- [ ] No direct `localStorage` references remain in save-system.ts
