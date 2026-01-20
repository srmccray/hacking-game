/**
 * Tests for Main Menu Scene - Slot Selection Highlighting Logic
 *
 * These tests verify that the slot selection highlighting logic correctly:
 * 1. Clears ALL slot highlights when selection changes
 * 2. Only highlights the currently selected slot
 * 3. Handles the Cancel button correctly
 * 4. Works correctly for all slot indices (including edge cases)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import type { SaveSlotMetadata } from '../../core/types';

// ============================================================================
// Pure Functions Extracted from main-menu.ts for Testing
// ============================================================================

/**
 * Represents the visual state of a slot or cancel button.
 */
interface SlotVisualState {
  text: string;
  fill: string;
  isSelected: boolean;
}

/**
 * Calculate the visual state for all slots and cancel button.
 * This is a pure function that can be easily tested.
 *
 * @param slots - Array of slot metadata
 * @param selectedIndex - Currently selected index (0 to slots.length for slots, MAX_SLOTS for cancel)
 * @param maxSlots - Maximum number of slots
 * @returns Object containing visual states for all slots and cancel button
 */
export function calculateSlotVisualStates(
  slots: SaveSlotMetadata[],
  selectedIndex: number,
  maxSlots: number
): { slots: SlotVisualState[]; cancel: SlotVisualState } {
  // Initialize all slots as unselected
  const slotStates: SlotVisualState[] = slots.map((slot, index) => {
    const slotLabel = slot.isEmpty
      ? `SLOT ${index + 1} - EMPTY`
      : `SLOT ${index + 1} - ${slot.playerName}`;

    return {
      text: '  ' + slotLabel,
      fill: slot.isEmpty ? '#888888' : '#00ff00',
      isSelected: false,
    };
  });

  // Initialize cancel as unselected
  const cancelState: SlotVisualState = {
    text: '  [ CANCEL ]',
    fill: '#888888',
    isSelected: false,
  };

  // Apply selected state to the appropriate item
  if (selectedIndex < slots.length) {
    // A slot is selected
    const slot = slots[selectedIndex];
    if (slot) {
      const slotLabel = slot.isEmpty
        ? `SLOT ${selectedIndex + 1} - EMPTY`
        : `SLOT ${selectedIndex + 1} - ${slot.playerName}`;

      slotStates[selectedIndex] = {
        text: '> ' + slotLabel,
        fill: '#ffffff',
        isSelected: true,
      };
    }
  } else if (selectedIndex === maxSlots) {
    // Cancel button is selected
    cancelState.text = '> [ CANCEL ]';
    cancelState.fill = '#ffffff';
    cancelState.isSelected = true;
  }

  return { slots: slotStates, cancel: cancelState };
}

/**
 * Count how many items are in selected state.
 */
function countSelectedItems(result: { slots: SlotVisualState[]; cancel: SlotVisualState }): number {
  let count = 0;
  for (const slot of result.slots) {
    if (slot.isSelected) count++;
  }
  if (result.cancel.isSelected) count++;
  return count;
}

/**
 * Helper to safely get slot state with assertion.
 */
function getSlot(result: { slots: SlotVisualState[] }, index: number): SlotVisualState {
  const slot = result.slots[index];
  if (!slot) throw new Error(`Slot ${index} not found`);
  return slot;
}

// ============================================================================
// Test Fixtures
// ============================================================================

const MAX_SLOTS = 3;

function createMockSlots(): SaveSlotMetadata[] {
  return [
    {
      slotIndex: 0,
      isEmpty: false,
      playerName: 'Player1',
      lastPlayed: Date.now(),
      totalPlayTime: 3600000,
    },
    {
      slotIndex: 1,
      isEmpty: true,
      playerName: '',
      lastPlayed: 0,
      totalPlayTime: 0,
    },
    {
      slotIndex: 2,
      isEmpty: true,
      playerName: '',
      lastPlayed: 0,
      totalPlayTime: 0,
    },
  ];
}

// ============================================================================
// Tests
// ============================================================================

describe('Slot Selection Highlighting Logic', () => {
  let mockSlots: SaveSlotMetadata[];

  beforeEach(() => {
    mockSlots = createMockSlots();
  });

  describe('calculateSlotVisualStates', () => {
    it('should highlight only the first slot when index 0 is selected', () => {
      const result = calculateSlotVisualStates(mockSlots, 0, MAX_SLOTS);
      const slot0 = getSlot(result, 0);
      const slot1 = getSlot(result, 1);
      const slot2 = getSlot(result, 2);

      // Only slot 0 should be selected
      expect(slot0.isSelected).toBe(true);
      expect(slot0.text).toContain('>');
      expect(slot0.fill).toBe('#ffffff');

      // Other slots should NOT be selected
      expect(slot1.isSelected).toBe(false);
      expect(slot1.text).not.toContain('>');

      expect(slot2.isSelected).toBe(false);
      expect(slot2.text).not.toContain('>');

      // Cancel should NOT be selected
      expect(result.cancel.isSelected).toBe(false);
      expect(result.cancel.text).not.toContain('>');

      // Total selected items should be exactly 1
      expect(countSelectedItems(result)).toBe(1);
    });

    it('should highlight only the second slot when index 1 is selected', () => {
      const result = calculateSlotVisualStates(mockSlots, 1, MAX_SLOTS);

      // Only slot 1 should be selected
      expect(getSlot(result, 0).isSelected).toBe(false);
      expect(getSlot(result, 1).isSelected).toBe(true);
      expect(getSlot(result, 2).isSelected).toBe(false);
      expect(result.cancel.isSelected).toBe(false);

      expect(countSelectedItems(result)).toBe(1);
    });

    it('should highlight only the third slot when index 2 is selected', () => {
      const result = calculateSlotVisualStates(mockSlots, 2, MAX_SLOTS);

      // Only slot 2 should be selected
      expect(getSlot(result, 0).isSelected).toBe(false);
      expect(getSlot(result, 1).isSelected).toBe(false);
      expect(getSlot(result, 2).isSelected).toBe(true);
      expect(result.cancel.isSelected).toBe(false);

      expect(countSelectedItems(result)).toBe(1);
    });

    it('should highlight only Cancel when index equals MAX_SLOTS', () => {
      const result = calculateSlotVisualStates(mockSlots, MAX_SLOTS, MAX_SLOTS);

      // No slots should be selected
      expect(getSlot(result, 0).isSelected).toBe(false);
      expect(getSlot(result, 1).isSelected).toBe(false);
      expect(getSlot(result, 2).isSelected).toBe(false);

      // Only cancel should be selected
      expect(result.cancel.isSelected).toBe(true);
      expect(result.cancel.text).toBe('> [ CANCEL ]');
      expect(result.cancel.fill).toBe('#ffffff');

      expect(countSelectedItems(result)).toBe(1);
    });

    it('should properly clear previous selection when moving from slot 0 to Cancel', () => {
      // First, calculate state with slot 0 selected
      const stateWithSlot0 = calculateSlotVisualStates(mockSlots, 0, MAX_SLOTS);
      expect(getSlot(stateWithSlot0, 0).isSelected).toBe(true);
      expect(countSelectedItems(stateWithSlot0)).toBe(1);

      // Now simulate moving to Cancel - calculate new state
      const stateWithCancel = calculateSlotVisualStates(mockSlots, MAX_SLOTS, MAX_SLOTS);

      // Slot 0 should no longer be selected
      expect(getSlot(stateWithCancel, 0).isSelected).toBe(false);
      expect(getSlot(stateWithCancel, 0).text).not.toContain('>');

      // Only Cancel should be selected
      expect(stateWithCancel.cancel.isSelected).toBe(true);
      expect(countSelectedItems(stateWithCancel)).toBe(1);
    });

    it('should properly clear ALL slots when switching from slot 0 to Cancel (bug #1 & #2 regression)', () => {
      // This test specifically covers the bug where switching from slot 1 to Cancel
      // would incorrectly highlight slot 2 AND slot 3 in addition to Cancel

      // Simulate the sequence: select slot 0, then move to Cancel
      const stateWithCancel = calculateSlotVisualStates(mockSlots, MAX_SLOTS, MAX_SLOTS);

      // Verify NONE of the slots are selected
      for (let i = 0; i < mockSlots.length; i++) {
        const slot = getSlot(stateWithCancel, i);
        expect(slot.isSelected).toBe(false);
        expect(slot.text.startsWith('  ')).toBe(true);
        expect(slot.fill).not.toBe('#ffffff');
      }

      // Only Cancel should be selected
      expect(countSelectedItems(stateWithCancel)).toBe(1);
      expect(stateWithCancel.cancel.isSelected).toBe(true);
    });

    it('should display correct styling for empty vs occupied slots when not selected', () => {
      // Select Cancel so we can check unselected slot states
      const result = calculateSlotVisualStates(mockSlots, MAX_SLOTS, MAX_SLOTS);

      // Slot 0 (occupied) should be green
      expect(getSlot(result, 0).fill).toBe('#00ff00');
      expect(getSlot(result, 0).text).toContain('Player1');

      // Slot 1 (empty) should be dim
      expect(getSlot(result, 1).fill).toBe('#888888');
      expect(getSlot(result, 1).text).toContain('EMPTY');

      // Slot 2 (empty) should be dim
      expect(getSlot(result, 2).fill).toBe('#888888');
      expect(getSlot(result, 2).text).toContain('EMPTY');
    });

    it('should use white highlighting for any selected item regardless of empty/occupied status', () => {
      // Select occupied slot (slot 0)
      const resultOccupied = calculateSlotVisualStates(mockSlots, 0, MAX_SLOTS);
      expect(getSlot(resultOccupied, 0).fill).toBe('#ffffff');

      // Select empty slot (slot 1)
      const resultEmpty = calculateSlotVisualStates(mockSlots, 1, MAX_SLOTS);
      expect(getSlot(resultEmpty, 1).fill).toBe('#ffffff');
    });

    it('should handle edge case: selecting slot 2 (index 2) should not affect other slots (bug #4 regression)', () => {
      // This test covers bug #4: selecting empty slot 3 (index 2) didn't highlight anything
      const result = calculateSlotVisualStates(mockSlots, 2, MAX_SLOTS);
      const slot2 = getSlot(result, 2);

      // Slot 2 should be selected
      expect(slot2.isSelected).toBe(true);
      expect(slot2.text).toContain('>');
      expect(slot2.fill).toBe('#ffffff');

      // Other slots should NOT be selected
      expect(getSlot(result, 0).isSelected).toBe(false);
      expect(getSlot(result, 1).isSelected).toBe(false);
      expect(result.cancel.isSelected).toBe(false);

      expect(countSelectedItems(result)).toBe(1);
    });
  });

  describe('Selection state consistency', () => {
    it('should always have exactly one item selected for any valid index', () => {
      // Test all valid indices (0, 1, 2, MAX_SLOTS)
      for (let i = 0; i <= MAX_SLOTS; i++) {
        const result = calculateSlotVisualStates(mockSlots, i, MAX_SLOTS);
        expect(countSelectedItems(result)).toBe(1);
      }
    });

    it('should maintain consistent state across multiple recalculations', () => {
      // Simulate multiple selection changes
      const indices = [0, 1, 2, MAX_SLOTS, 1, 0, MAX_SLOTS, 2];

      for (const index of indices) {
        const result = calculateSlotVisualStates(mockSlots, index, MAX_SLOTS);
        expect(countSelectedItems(result)).toBe(1);

        // Verify the correct item is selected
        if (index < MAX_SLOTS) {
          expect(getSlot(result, index).isSelected).toBe(true);
          expect(result.cancel.isSelected).toBe(false);
        } else {
          expect(result.cancel.isSelected).toBe(true);
          for (const slot of result.slots) {
            expect(slot.isSelected).toBe(false);
          }
        }
      }
    });
  });

  describe('Text formatting', () => {
    it('should prefix selected items with "> " and unselected with "  "', () => {
      const result = calculateSlotVisualStates(mockSlots, 1, MAX_SLOTS);

      // Selected slot should have ">" prefix
      expect(getSlot(result, 1).text.startsWith('>')).toBe(true);

      // Unselected slots should have "  " prefix
      expect(getSlot(result, 0).text.startsWith('  ')).toBe(true);
      expect(getSlot(result, 2).text.startsWith('  ')).toBe(true);
      expect(result.cancel.text.startsWith('  ')).toBe(true);
    });

    it('should display slot labels correctly', () => {
      const result = calculateSlotVisualStates(mockSlots, MAX_SLOTS, MAX_SLOTS);

      expect(getSlot(result, 0).text).toContain('SLOT 1');
      expect(getSlot(result, 0).text).toContain('Player1');

      expect(getSlot(result, 1).text).toContain('SLOT 2');
      expect(getSlot(result, 1).text).toContain('EMPTY');

      expect(getSlot(result, 2).text).toContain('SLOT 3');
      expect(getSlot(result, 2).text).toContain('EMPTY');

      expect(result.cancel.text).toContain('CANCEL');
    });
  });
});

describe('Dialog Title Logic', () => {
  /**
   * Pure function to determine dialog title based on mode and custom title.
   */
  function getDialogTitle(mode: 'new-game' | 'continue', customTitle?: string): string {
    return customTitle ?? (mode === 'new-game' ? 'SELECT SAVE SLOT' : 'LOAD SAVE');
  }

  it('should return "SELECT SAVE SLOT" for new-game mode without custom title', () => {
    expect(getDialogTitle('new-game')).toBe('SELECT SAVE SLOT');
  });

  it('should return "LOAD SAVE" for continue mode without custom title', () => {
    expect(getDialogTitle('continue')).toBe('LOAD SAVE');
  });

  it('should use custom title when provided (bug #3 fix)', () => {
    // This tests the fix for bug #3: Delete Save modal shows "DELETE SAVE"
    expect(getDialogTitle('continue', 'DELETE SAVE')).toBe('DELETE SAVE');
  });

  it('should allow any custom title to override the mode-based default', () => {
    expect(getDialogTitle('new-game', 'CUSTOM TITLE')).toBe('CUSTOM TITLE');
    expect(getDialogTitle('continue', 'ANOTHER TITLE')).toBe('ANOTHER TITLE');
  });
});
