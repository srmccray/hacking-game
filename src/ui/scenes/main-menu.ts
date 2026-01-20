/**
 * Main Menu Scene for the Hacker Incremental Game
 *
 * This scene is displayed when the game starts, providing options
 * to start a new game, continue from save, manage saves, and more.
 *
 * Features:
 * - ASCII-art title banner
 * - Keyboard navigation (arrow keys + Enter)
 * - Mouse click support
 * - Conditional menu items based on save data existence
 *
 * Usage:
 *   import { createMainMenuScene, destroyMainMenuScene } from '@ui/scenes/main-menu';
 *
 *   const scene = createMainMenuScene({ onStartGame, onContinue });
 *   sceneManager.register('main-menu', scene);
 */

import { Container, Graphics, Text } from 'pixi.js';
import { CANVAS_WIDTH, CANVAS_HEIGHT, TERMINAL_GREEN, TERMINAL_DIM } from '../renderer';
import {
  createTerminalText,
  headerStyle,
  primaryStyle,
  dimStyle,
  brightStyle,
  smallStyle,
  cloneStyle,
  MONOSPACE_FONT,
} from '../styles';
import {
  hasSaveData,
  hardReset,
  listSaveSlots,
  loadSlotMetadata,
  deleteSlot,
  setActiveSlot,
  loadGame,
  saveGame,
  MAX_SLOTS,
} from '../../core/save-system';
import { formatRelativeTime } from '../../core/offline-progress';
import { formatDuration } from '../../core/offline-progress';
import { useGameStore } from '../../core/game-state';
import type { SaveSlotMetadata } from '../../core/types';
import type { Scene } from './scene-manager';

// ============================================================================
// Types
// ============================================================================

/**
 * Configuration for the main menu scene.
 */
export interface MainMenuConfig {
  /** Called when user selects New Game (after hardReset) */
  onNewGame: () => void | Promise<void>;
  /** Called when user selects Continue/Load Game (save already loaded) */
  onContinue: () => void | Promise<void>;
}

/**
 * Menu item definition.
 */
interface MenuItem {
  id: string;
  label: string;
  enabled: boolean;
  action: () => void | Promise<void>;
}

// ============================================================================
// Module State
// ============================================================================

let menuContainer: Container | null = null;
let menuItems: MenuItem[] = [];
let selectedIndex = 0;
let menuTexts: Text[] = [];
let keydownHandler: ((event: KeyboardEvent) => void) | null = null;
let config: MainMenuConfig | null = null;

// ============================================================================
// Constants
// ============================================================================

const MENU_START_Y = 280;
const MENU_ITEM_HEIGHT = 36;
const TITLE_Y = 80;

// ASCII art title banner
const ASCII_TITLE = `
 ██╗  ██╗ █████╗  ██████╗██╗  ██╗███████╗██████╗
 ██║  ██║██╔══██╗██╔════╝██║ ██╔╝██╔════╝██╔══██╗
 ███████║███████║██║     █████╔╝ █████╗  ██████╔╝
 ██╔══██║██╔══██║██║     ██╔═██╗ ██╔══╝  ██╔══██╗
 ██║  ██║██║  ██║╚██████╗██║  ██╗███████╗██║  ██║
 ╚═╝  ╚═╝╚═╝  ╚═╝ ╚═════╝╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝
`.trim();

// ============================================================================
// Menu Item Creation
// ============================================================================

/**
 * Build the menu items based on current save state.
 */
function buildMenuItems(): MenuItem[] {
  const items: MenuItem[] = [];
  const saveExists = hasSaveData();

  items.push({
    id: 'new-game',
    label: 'New Game',
    enabled: true,
    action: handleNewGame,
  });

  if (saveExists) {
    items.push({
      id: 'continue',
      label: 'Continue',
      enabled: true,
      action: handleContinue,
    });

    items.push({
      id: 'delete-save',
      label: 'Delete Save',
      enabled: true,
      action: handleDeleteSave,
    });
  }

  items.push({
    id: 'options',
    label: 'Options',
    enabled: false, // Placeholder for future
    action: handleOptions,
  });

  items.push({
    id: 'exit',
    label: 'Exit',
    enabled: true,
    action: handleExit,
  });

  return items;
}

// ============================================================================
// Menu Actions
// ============================================================================

/**
 * Handle New Game selection.
 * Shows slot selection, then name input, then starts the game.
 */
async function handleNewGame(): Promise<void> {
  console.log('[MainMenu] New Game selected');

  showSlotSelectionDialog(
    'new-game',
    (slotIndex: number) => {
      const slot = loadSlotMetadata(slotIndex);

      // If slot is occupied, ask for confirmation to overwrite
      if (!slot.isEmpty) {
        showConfirmDialog(
          'OVERWRITE SAVE?',
          `This will delete "${slot.playerName}" and start a new game.`,
          () => {
            // Delete the old slot and start name input
            deleteSlot(slotIndex);
            promptForNameAndStartGame(slotIndex);
          }
        );
      } else {
        // Empty slot, go straight to name input
        promptForNameAndStartGame(slotIndex);
      }
    },
    () => {
      console.log('[MainMenu] New Game canceled');
    }
  );
}

/**
 * Prompt for player name and start a new game.
 */
function promptForNameAndStartGame(slotIndex: number): void {
  showNameInputDialog(
    async (playerName: string) => {
      console.log('[MainMenu] Starting new game with name:', playerName, 'in slot:', slotIndex);

      // Reset game state
      hardReset();

      // Set player name
      useGameStore.getState().setPlayerName(playerName);

      // Set active slot and save
      setActiveSlot(slotIndex);
      saveGame();

      // Start the game
      if (config?.onNewGame) {
        await config.onNewGame();
      }
    },
    () => {
      console.log('[MainMenu] Name input canceled');
    }
  );
}

/**
 * Handle Continue/Load Game selection.
 * Shows slot selection and loads the selected save.
 */
async function handleContinue(): Promise<void> {
  console.log('[MainMenu] Continue selected');

  showSlotSelectionDialog(
    'continue',
    async (slotIndex: number) => {
      console.log('[MainMenu] Loading save from slot:', slotIndex);

      // Load the game state from the selected slot
      const loadedState = loadGame(slotIndex);

      if (loadedState) {
        // Load the state into the store
        useGameStore.getState().loadState(loadedState);

        // Start the game
        if (config?.onContinue) {
          await config.onContinue();
        }
      } else {
        showMessageDialog('ERROR', 'Failed to load save data.');
      }
    },
    () => {
      console.log('[MainMenu] Continue canceled');
    }
  );
}

/**
 * Handle Delete Save selection.
 * Shows slot selection (for occupied slots), then confirms deletion.
 */
function handleDeleteSave(): void {
  console.log('[MainMenu] Delete Save selected');

  showSlotSelectionDialog(
    'continue', // Use 'continue' mode to only show occupied slots
    (slotIndex: number) => {
      const slot = loadSlotMetadata(slotIndex);

      showConfirmDialog(
        'DELETE SAVE DATA?',
        `This will permanently delete "${slot.playerName}".`,
        () => {
          deleteSlot(slotIndex);
          console.log('[MainMenu] Save deleted from slot:', slotIndex);
          // Rebuild menu to potentially remove Continue/Delete options if no saves left
          rebuildMenu();
        }
      );
    },
    () => {
      console.log('[MainMenu] Delete Save canceled');
    },
    'DELETE SAVE' // Custom title for delete dialog
  );
}

/**
 * Handle Options selection (placeholder).
 */
function handleOptions(): void {
  console.log('[MainMenu] Options selected (Coming Soon)');
  showMessageDialog('OPTIONS', 'Coming Soon...');
}

/**
 * Handle Exit selection.
 */
function handleExit(): void {
  console.log('[MainMenu] Exit selected');
  // Try to close the window (will only work if opened via script)
  window.close();
  // window.close() returns undefined, so we can't reliably check
  // Show a message in case closing didn't work
  setTimeout(() => {
    // If we're still here after 100ms, closing probably failed
    showMessageDialog('EXIT', 'Please close this tab manually.');
  }, 100);
}

// ============================================================================
// Dialog System
// ============================================================================

let dialogContainer: Container | null = null;
let dialogSelectedButton = 0; // 0 = yes, 1 = no
let dialogYesText: Text | null = null;
let dialogNoText: Text | null = null;

// Name input dialog state
let nameInputValue = '';
let nameInputText: Text | null = null;
let nameInputCursorVisible = true;
let nameInputCursorInterval: ReturnType<typeof setInterval> | null = null;
let nameInputCharCountText: Text | null = null;
let nameInputErrorText: Text | null = null;
let nameInputOnConfirm: ((name: string) => void) | null = null;
let nameInputOnCancel: (() => void) | null = null;

/** Maximum characters for player name */
const MAX_NAME_LENGTH = 16;

/** Minimum characters for player name */
const MIN_NAME_LENGTH = 1;

/** Regex for valid name characters */
const VALID_NAME_CHARS = /^[a-zA-Z0-9 _-]$/;

// Slot selection dialog state
let slotSelectionMode: 'new-game' | 'continue' | null = null;
let slotSelectionIndex = 0;
let slotSelectionTexts: Text[][] = []; // Array of text elements per slot
let slotSelectionOnSelect: ((slotIndex: number) => void) | null = null;
let slotSelectionOnCancel: (() => void) | null = null;
let slotSelectionSlots: SaveSlotMetadata[] = [];
let slotSelectionCancelText: Text | null = null;

// Name input dialog state for button selection
let nameInputSelectedButton = 0; // 0 = confirm, 1 = cancel
let nameInputConfirmText: Text | null = null;
let nameInputCancelText: Text | null = null;

/**
 * Update dialog button visuals based on selection.
 * Creates new style objects to avoid shared style mutation.
 */
function updateDialogButtonVisuals(): void {
  console.log('[MainMenu] updateDialogButtonVisuals, selected:', dialogSelectedButton, 'yesText:', !!dialogYesText, 'noText:', !!dialogNoText);

  if (dialogYesText) {
    if (dialogSelectedButton === 0) {
      // Yes is selected - white text
      dialogYesText.text = '> [ YES ]';
      const style = cloneStyle(brightStyle);
      style.fill = '#ffffff';
      dialogYesText.style = style;
    } else {
      // Yes is not selected - dim green
      dialogYesText.text = '  [ YES ]';
      dialogYesText.style = cloneStyle(dimStyle);
    }
  }
  if (dialogNoText) {
    if (dialogSelectedButton === 1) {
      // No is selected - white text
      dialogNoText.text = '> [ NO ]';
      const style = cloneStyle(brightStyle);
      style.fill = '#ffffff';
      dialogNoText.style = style;
    } else {
      // No is not selected - dim green
      dialogNoText.text = '  [ NO ]';
      dialogNoText.style = cloneStyle(dimStyle);
    }
  }
}

/**
 * Show a simple message dialog.
 */
function showMessageDialog(title: string, message: string): void {
  if (!menuContainer) return;

  closeDialog();

  dialogContainer = new Container();
  dialogContainer.label = 'message-dialog';
  dialogContainer.zIndex = 100;

  // Overlay background
  const overlay = new Graphics();
  overlay.fill({ color: 0x000000, alpha: 0.7 });
  overlay.rect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  overlay.fill();
  overlay.eventMode = 'static';
  overlay.on('pointerdown', closeDialog);
  dialogContainer.addChild(overlay);

  // Dialog box
  const boxWidth = 300;
  const boxHeight = 150;
  const boxX = (CANVAS_WIDTH - boxWidth) / 2;
  const boxY = (CANVAS_HEIGHT - boxHeight) / 2;

  const box = createDialogBox(boxX, boxY, boxWidth, boxHeight);
  box.eventMode = 'static'; // Prevent clicks passing through
  dialogContainer.addChild(box);

  // Title
  const titleText = createTerminalText(title, headerStyle);
  titleText.anchor.set(0.5, 0);
  titleText.x = boxX + boxWidth / 2;
  titleText.y = boxY + 20;
  dialogContainer.addChild(titleText);

  // Message
  const messageText = createTerminalText(message, primaryStyle);
  messageText.anchor.set(0.5, 0);
  messageText.x = boxX + boxWidth / 2;
  messageText.y = boxY + 60;
  dialogContainer.addChild(messageText);

  // Dismiss hint
  const hintText = createTerminalText('[ Press any key or click ]', smallStyle);
  hintText.anchor.set(0.5, 0);
  hintText.x = boxX + boxWidth / 2;
  hintText.y = boxY + boxHeight - 35;
  dialogContainer.addChild(hintText);

  menuContainer.addChild(dialogContainer);
  menuContainer.sortableChildren = true;
}

/**
 * Show a confirmation dialog with Yes/No options.
 */
function showConfirmDialog(
  title: string,
  message: string,
  onConfirm: () => void
): void {
  if (!menuContainer) return;

  closeDialog();

  dialogContainer = new Container();
  dialogContainer.label = 'confirm-dialog';
  dialogContainer.zIndex = 100;

  // Overlay background
  const overlay = new Graphics();
  overlay.fill({ color: 0x000000, alpha: 0.7 });
  overlay.rect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  overlay.fill();
  overlay.eventMode = 'static';
  dialogContainer.addChild(overlay);

  // Dialog box
  const boxWidth = 400;
  const boxHeight = 200;
  const boxX = (CANVAS_WIDTH - boxWidth) / 2;
  const boxY = (CANVAS_HEIGHT - boxHeight) / 2;

  const box = createDialogBox(boxX, boxY, boxWidth, boxHeight);
  box.eventMode = 'static';
  dialogContainer.addChild(box);

  // Title
  const titleText = createTerminalText(title, cloneStyle(headerStyle, { fill: '#ff4444' }));
  titleText.anchor.set(0.5, 0);
  titleText.x = boxX + boxWidth / 2;
  titleText.y = boxY + 20;
  dialogContainer.addChild(titleText);

  // Message with word wrap
  const messageText = new Text({
    text: message,
    style: {
      fontFamily: MONOSPACE_FONT,
      fontSize: 14,
      fill: '#00ff00',
      wordWrap: true,
      wordWrapWidth: boxWidth - 60,
      align: 'center',
    },
  });
  messageText.anchor.set(0.5, 0);
  messageText.x = boxX + boxWidth / 2;
  messageText.y = boxY + 65;
  dialogContainer.addChild(messageText);

  // Reset dialog selection state
  dialogSelectedButton = 0;

  // Yes button (selected by default)
  dialogYesText = createTerminalText('> [ YES ]', cloneStyle(brightStyle, { fill: '#ffffff' }));
  dialogYesText.anchor.set(0.5, 0);
  dialogYesText.x = boxX + boxWidth / 3;
  dialogYesText.y = boxY + boxHeight - 60;
  dialogYesText.eventMode = 'static';
  dialogYesText.cursor = 'pointer';
  dialogYesText.on('pointerdown', () => {
    closeDialog();
    onConfirm();
  });
  dialogYesText.on('pointerover', () => {
    dialogSelectedButton = 0;
    updateDialogButtonVisuals();
  });
  dialogContainer.addChild(dialogYesText);

  // No button (not selected initially)
  dialogNoText = createTerminalText('  [ NO ]', dimStyle);
  dialogNoText.anchor.set(0.5, 0);
  dialogNoText.x = boxX + (boxWidth * 2) / 3;
  dialogNoText.y = boxY + boxHeight - 60;
  dialogNoText.eventMode = 'static';
  dialogNoText.cursor = 'pointer';
  dialogNoText.on('pointerdown', closeDialog);
  dialogNoText.on('pointerover', () => {
    dialogSelectedButton = 1;
    updateDialogButtonVisuals();
  });
  dialogContainer.addChild(dialogNoText);

  // Keyboard hint
  const hintText = createTerminalText('Arrow keys or Y/N, Enter to confirm', smallStyle);
  hintText.anchor.set(0.5, 0);
  hintText.x = boxX + boxWidth / 2;
  hintText.y = boxY + boxHeight - 30;
  dialogContainer.addChild(hintText);

  menuContainer.addChild(dialogContainer);
  menuContainer.sortableChildren = true;

  // Store confirm callback for keyboard handling
  (dialogContainer as Container & { onConfirm?: () => void }).onConfirm = onConfirm;

  // Apply initial visual state (ensures white highlight on selected button)
  updateDialogButtonVisuals();
}

/**
 * Create a styled dialog box.
 */
function createDialogBox(x: number, y: number, width: number, height: number): Graphics {
  const box = new Graphics();

  // Background
  box.fill({ color: 0x0a0a0a, alpha: 0.95 });
  box.roundRect(x, y, width, height, 4);
  box.fill();

  // Border
  box.stroke({ color: TERMINAL_DIM, width: 1 });
  box.roundRect(x, y, width, height, 4);
  box.stroke();

  // Inner border
  box.stroke({ color: TERMINAL_GREEN, width: 1 });
  box.roundRect(x + 4, y + 4, width - 8, height - 8, 2);
  box.stroke();

  return box;
}

/**
 * Close any open dialog.
 */
function closeDialog(): void {
  if (dialogContainer && menuContainer) {
    menuContainer.removeChild(dialogContainer);
    dialogContainer.destroy({ children: true });
    dialogContainer = null;
  }
  dialogYesText = null;
  dialogNoText = null;
  dialogSelectedButton = 0;

  // Clean up name input dialog state
  if (nameInputCursorInterval) {
    clearInterval(nameInputCursorInterval);
    nameInputCursorInterval = null;
  }
  nameInputValue = '';
  nameInputText = null;
  nameInputCharCountText = null;
  nameInputErrorText = null;
  nameInputOnConfirm = null;
  nameInputOnCancel = null;
  nameInputCursorVisible = true;

  // Clean up slot selection dialog state
  slotSelectionMode = null;
  slotSelectionIndex = 0;
  slotSelectionTexts = [];
  slotSelectionOnSelect = null;
  slotSelectionOnCancel = null;
  slotSelectionSlots = [];
  slotSelectionCancelText = null;

  // Clean up name input button state
  nameInputSelectedButton = 0;
  nameInputConfirmText = null;
  nameInputCancelText = null;
}

/**
 * Validate a player name.
 *
 * @param name - The name to validate
 * @returns Error message if invalid, or null if valid
 */
function validatePlayerName(name: string): string | null {
  const trimmed = name.trim();

  if (trimmed.length < MIN_NAME_LENGTH) {
    return 'Name must be at least 1 character';
  }

  if (trimmed.length > MAX_NAME_LENGTH) {
    return 'Name must be 16 characters or less';
  }

  return null;
}

/**
 * Update the name input display with current value and cursor.
 */
function updateNameInputDisplay(): void {
  if (!nameInputText) return;

  const cursor = nameInputCursorVisible ? '_' : ' ';
  nameInputText.text = nameInputValue + cursor;

  // Update character count
  if (nameInputCharCountText) {
    nameInputCharCountText.text = `${nameInputValue.length}/${MAX_NAME_LENGTH}`;
  }
}

/**
 * Show the name input error message.
 */
function showNameInputError(message: string): void {
  if (nameInputErrorText) {
    nameInputErrorText.text = message;
    nameInputErrorText.visible = true;
  }
}

/**
 * Hide the name input error message.
 */
function hideNameInputError(): void {
  if (nameInputErrorText) {
    nameInputErrorText.text = '';
    nameInputErrorText.visible = false;
  }
}

/**
 * Update name input dialog button visuals based on selection.
 * Creates new style objects to avoid shared style mutation.
 */
function updateNameInputButtonVisuals(): void {
  if (nameInputConfirmText) {
    if (nameInputSelectedButton === 0) {
      // Confirm is selected - white text
      nameInputConfirmText.text = '> [ CONFIRM ]';
      const style = cloneStyle(brightStyle);
      style.fill = '#ffffff';
      nameInputConfirmText.style = style;
    } else {
      // Confirm is not selected - dim green
      nameInputConfirmText.text = '  [ CONFIRM ]';
      nameInputConfirmText.style = cloneStyle(dimStyle);
    }
  }
  if (nameInputCancelText) {
    if (nameInputSelectedButton === 1) {
      // Cancel is selected - white text
      nameInputCancelText.text = '> [ CANCEL ]';
      const style = cloneStyle(brightStyle);
      style.fill = '#ffffff';
      nameInputCancelText.style = style;
    } else {
      // Cancel is not selected - dim green
      nameInputCancelText.text = '  [ CANCEL ]';
      nameInputCancelText.style = cloneStyle(dimStyle);
    }
  }
}

/**
 * Show a name input dialog for entering the player's alias.
 *
 * @param onConfirm - Called with the trimmed name when confirmed
 * @param onCancel - Called when canceled
 */
export function showNameInputDialog(
  onConfirm: (name: string) => void,
  onCancel: () => void
): void {
  if (!menuContainer) return;

  closeDialog();

  // Store callbacks
  nameInputOnConfirm = onConfirm;
  nameInputOnCancel = onCancel;
  nameInputValue = '';

  dialogContainer = new Container();
  dialogContainer.label = 'name-input-dialog';
  dialogContainer.zIndex = 100;

  // Overlay background
  const overlay = new Graphics();
  overlay.fill({ color: 0x000000, alpha: 0.7 });
  overlay.rect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  overlay.fill();
  overlay.eventMode = 'static';
  dialogContainer.addChild(overlay);

  // Dialog box
  const boxWidth = 450;
  const boxHeight = 220;
  const boxX = (CANVAS_WIDTH - boxWidth) / 2;
  const boxY = (CANVAS_HEIGHT - boxHeight) / 2;

  const box = createDialogBox(boxX, boxY, boxWidth, boxHeight);
  box.eventMode = 'static';
  dialogContainer.addChild(box);

  // Title
  const titleText = createTerminalText('ENTER YOUR HACKER ALIAS', headerStyle);
  titleText.anchor.set(0.5, 0);
  titleText.x = boxX + boxWidth / 2;
  titleText.y = boxY + 20;
  dialogContainer.addChild(titleText);

  // Input field background
  const inputBg = new Graphics();
  inputBg.fill({ color: 0x001100, alpha: 0.8 });
  inputBg.roundRect(boxX + 40, boxY + 60, boxWidth - 80, 36, 2);
  inputBg.fill();
  inputBg.stroke({ color: TERMINAL_GREEN, width: 1 });
  inputBg.roundRect(boxX + 40, boxY + 60, boxWidth - 80, 36, 2);
  inputBg.stroke();
  dialogContainer.addChild(inputBg);

  // Input text with cursor
  nameInputText = new Text({
    text: '_',
    style: {
      fontFamily: MONOSPACE_FONT,
      fontSize: 18,
      fill: '#00ff00',
    },
  });
  nameInputText.x = boxX + 50;
  nameInputText.y = boxY + 68;
  dialogContainer.addChild(nameInputText);

  // Character count
  nameInputCharCountText = createTerminalText(`0/${MAX_NAME_LENGTH}`, dimStyle);
  nameInputCharCountText.anchor.set(1, 0);
  nameInputCharCountText.x = boxX + boxWidth - 50;
  nameInputCharCountText.y = boxY + 100;
  dialogContainer.addChild(nameInputCharCountText);

  // Error text (hidden by default)
  nameInputErrorText = new Text({
    text: '',
    style: {
      fontFamily: MONOSPACE_FONT,
      fontSize: 12,
      fill: '#ff4444',
    },
  });
  nameInputErrorText.anchor.set(0.5, 0);
  nameInputErrorText.x = boxX + boxWidth / 2;
  nameInputErrorText.y = boxY + 120;
  nameInputErrorText.visible = false;
  dialogContainer.addChild(nameInputErrorText);

  // Reset button selection state
  nameInputSelectedButton = 0;

  // Confirm button (store reference for visual updates)
  nameInputConfirmText = createTerminalText('> [ CONFIRM ]', cloneStyle(brightStyle, { fill: '#ffffff' }));
  nameInputConfirmText.anchor.set(0.5, 0);
  nameInputConfirmText.x = boxX + boxWidth / 3;
  nameInputConfirmText.y = boxY + boxHeight - 60;
  nameInputConfirmText.eventMode = 'static';
  nameInputConfirmText.cursor = 'pointer';
  nameInputConfirmText.on('pointerdown', handleNameInputConfirm);
  nameInputConfirmText.on('pointerover', () => {
    nameInputSelectedButton = 0;
    updateNameInputButtonVisuals();
  });
  dialogContainer.addChild(nameInputConfirmText);

  // Cancel button (store reference for visual updates)
  nameInputCancelText = createTerminalText('  [ CANCEL ]', dimStyle);
  nameInputCancelText.anchor.set(0.5, 0);
  nameInputCancelText.x = boxX + (boxWidth * 2) / 3;
  nameInputCancelText.y = boxY + boxHeight - 60;
  nameInputCancelText.eventMode = 'static';
  nameInputCancelText.cursor = 'pointer';
  nameInputCancelText.on('pointerdown', handleNameInputCancel);
  nameInputCancelText.on('pointerover', () => {
    nameInputSelectedButton = 1;
    updateNameInputButtonVisuals();
  });
  dialogContainer.addChild(nameInputCancelText);

  // Keyboard hint
  const hintText = createTerminalText('Type your name, Arrow keys to select, Enter to confirm', smallStyle);
  hintText.anchor.set(0.5, 0);
  hintText.x = boxX + boxWidth / 2;
  hintText.y = boxY + boxHeight - 30;
  dialogContainer.addChild(hintText);

  menuContainer.addChild(dialogContainer);
  menuContainer.sortableChildren = true;

  // Start cursor blinking
  nameInputCursorInterval = setInterval(() => {
    nameInputCursorVisible = !nameInputCursorVisible;
    updateNameInputDisplay();
  }, 500);

  // Mark dialog as name input dialog
  (dialogContainer as Container & { isNameInput?: boolean }).isNameInput = true;

  // Apply initial visual state (ensures white highlight on selected button)
  updateNameInputButtonVisuals();
}

/**
 * Handle confirm action for name input dialog.
 */
function handleNameInputConfirm(): void {
  const trimmedName = nameInputValue.trim();
  const error = validatePlayerName(trimmedName);

  if (error) {
    showNameInputError(error);
    return;
  }

  const callback = nameInputOnConfirm;
  closeDialog();

  if (callback) {
    callback(trimmedName);
  }
}

/**
 * Handle cancel action for name input dialog.
 */
function handleNameInputCancel(): void {
  const callback = nameInputOnCancel;
  closeDialog();

  if (callback) {
    callback();
  }
}

// ============================================================================
// Slot Selection Dialog
// ============================================================================

/**
 * Format play time in a human-readable format.
 */
function formatPlayTime(ms: number): string {
  if (ms === 0) return '0m';
  return formatDuration(ms / 1000);
}

/**
 * Update slot selection visuals based on current selection.
 *
 * This function explicitly resets ALL slot visuals first, then applies
 * the selected state only to the currently selected slot. This ensures
 * proper clearing of highlights when selection changes.
 *
 * IMPORTANT: We must assign NEW style objects, not modify existing ones,
 * because TextStyle objects may be shared between text elements.
 */
function updateSlotSelectionVisuals(): void {
  // First pass: Reset ALL slots to unselected state
  for (let index = 0; index < slotSelectionSlots.length; index++) {
    const slotTexts = slotSelectionTexts[index];
    const slot = slotSelectionSlots[index];
    if (!slot || !slotTexts) continue;

    // Reset to unselected state - create new style objects
    slotTexts.forEach((text, textIndex) => {
      if (textIndex === 0) {
        // First text is the slot label with indicator - set to unselected (dim)
        const slotLabel = slot.isEmpty ? `SLOT ${index + 1} - EMPTY` : `SLOT ${index + 1} - ${slot.playerName}`;
        text.text = '  ' + slotLabel;
        // Use dimStyle for empty slots, primaryStyle (bright green) for occupied
        text.style = cloneStyle(slot.isEmpty ? dimStyle : primaryStyle);
      }
    });
  }

  // Reset cancel button to unselected state (dim)
  if (slotSelectionCancelText) {
    slotSelectionCancelText.text = '  [ CANCEL ]';
    slotSelectionCancelText.style = cloneStyle(dimStyle);
  }

  // Second pass: Apply selected state to the currently selected item
  if (slotSelectionIndex < slotSelectionSlots.length) {
    // A slot is selected - white text
    const slotTexts = slotSelectionTexts[slotSelectionIndex];
    const slot = slotSelectionSlots[slotSelectionIndex];
    if (slot && slotTexts && slotTexts[0]) {
      const slotLabel = slot.isEmpty ? `SLOT ${slotSelectionIndex + 1} - EMPTY` : `SLOT ${slotSelectionIndex + 1} - ${slot.playerName}`;
      slotTexts[0].text = '> ' + slotLabel;
      // Create style with white fill for selected state
      const style = cloneStyle(brightStyle);
      style.fill = '#ffffff';
      slotTexts[0].style = style;
    }
  } else if (slotSelectionIndex === MAX_SLOTS) {
    // Cancel button is selected - white text
    if (slotSelectionCancelText) {
      slotSelectionCancelText.text = '> [ CANCEL ]';
      const style = cloneStyle(brightStyle);
      style.fill = '#ffffff';
      slotSelectionCancelText.style = style;
    }
  }
}

/**
 * Show the save slot selection dialog.
 *
 * @param mode - 'new-game' to show empty slots prominently, 'continue' to show occupied slots
 * @param onSelect - Called with the selected slot index
 * @param onCancel - Called when canceled
 * @param customTitle - Optional custom title for the dialog (overrides mode-based title)
 */
export function showSlotSelectionDialog(
  mode: 'new-game' | 'continue',
  onSelect: (slotIndex: number) => void,
  onCancel: () => void,
  customTitle?: string
): void {
  if (!menuContainer) return;

  closeDialog();

  // Store state
  slotSelectionMode = mode;
  slotSelectionOnSelect = onSelect;
  slotSelectionOnCancel = onCancel;
  slotSelectionSlots = listSaveSlots();
  slotSelectionTexts = [];

  // For new game, default to first empty slot; for continue, first occupied
  if (mode === 'new-game') {
    const firstEmpty = slotSelectionSlots.findIndex(s => s.isEmpty);
    slotSelectionIndex = firstEmpty >= 0 ? firstEmpty : 0;
  } else {
    const firstOccupied = slotSelectionSlots.findIndex(s => !s.isEmpty);
    slotSelectionIndex = firstOccupied >= 0 ? firstOccupied : 0;
  }

  dialogContainer = new Container();
  dialogContainer.label = 'slot-selection-dialog';
  dialogContainer.zIndex = 100;

  // Overlay background
  const overlay = new Graphics();
  overlay.fill({ color: 0x000000, alpha: 0.7 });
  overlay.rect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  overlay.fill();
  overlay.eventMode = 'static';
  dialogContainer.addChild(overlay);

  // Dialog box
  const boxWidth = 500;
  const boxHeight = 320;
  const boxX = (CANVAS_WIDTH - boxWidth) / 2;
  const boxY = (CANVAS_HEIGHT - boxHeight) / 2;

  const box = createDialogBox(boxX, boxY, boxWidth, boxHeight);
  box.eventMode = 'static';
  dialogContainer.addChild(box);

  // Title - use custom title if provided, otherwise use mode-based default
  const title = customTitle ?? (mode === 'new-game' ? 'SELECT SAVE SLOT' : 'LOAD SAVE');
  const titleText = createTerminalText(title, headerStyle);
  titleText.anchor.set(0.5, 0);
  titleText.x = boxX + boxWidth / 2;
  titleText.y = boxY + 20;
  dialogContainer.addChild(titleText);

  // Render each slot
  const slotStartY = boxY + 60;
  const slotHeight = 70;

  slotSelectionSlots.forEach((slot, index) => {
    const slotY = slotStartY + index * slotHeight;
    const slotTexts: Text[] = [];

    // Slot background
    const slotBg = new Graphics();
    const isSelectable = mode === 'new-game' ? true : !slot.isEmpty;
    slotBg.fill({ color: isSelectable ? 0x001100 : 0x0a0a0a, alpha: 0.6 });
    slotBg.roundRect(boxX + 30, slotY, boxWidth - 60, slotHeight - 10, 2);
    slotBg.fill();
    slotBg.stroke({ color: isSelectable ? TERMINAL_GREEN : TERMINAL_DIM, width: 1 });
    slotBg.roundRect(boxX + 30, slotY, boxWidth - 60, slotHeight - 10, 2);
    slotBg.stroke();
    slotBg.eventMode = 'static';
    slotBg.cursor = isSelectable ? 'pointer' : 'default';
    slotBg.on('pointerdown', () => {
      if (isSelectable) {
        slotSelectionIndex = index;
        updateSlotSelectionVisuals();
        handleSlotSelectionConfirm();
      }
    });
    slotBg.on('pointerover', () => {
      if (isSelectable) {
        slotSelectionIndex = index;
        updateSlotSelectionVisuals();
      }
    });
    dialogContainer!.addChild(slotBg);

    // Slot label (with selection indicator)
    const isSelected = index === slotSelectionIndex;
    const prefix = isSelected ? '> ' : '  ';
    const slotLabel = slot.isEmpty ? `SLOT ${index + 1} - EMPTY` : `SLOT ${index + 1} - ${slot.playerName}`;
    const labelText = createTerminalText(prefix + slotLabel, isSelected ? brightStyle : (slot.isEmpty ? dimStyle : primaryStyle));
    labelText.x = boxX + 45;
    labelText.y = slotY + 8;
    slotTexts.push(labelText);
    dialogContainer!.addChild(labelText);

    // Slot details (only for non-empty slots)
    if (!slot.isEmpty) {
      const lastPlayedStr = slot.lastPlayed > 0 ? formatRelativeTime(slot.lastPlayed) : 'Never';
      const playTimeStr = formatPlayTime(slot.totalPlayTime);

      const detailsText = createTerminalText(
        `Last played: ${lastPlayedStr}  |  Play time: ${playTimeStr}`,
        smallStyle
      );
      detailsText.x = boxX + 45;
      detailsText.y = slotY + 32;
      slotTexts.push(detailsText);
      dialogContainer!.addChild(detailsText);
    } else if (mode === 'new-game') {
      const hintText = createTerminalText('Click to start a new game', smallStyle);
      hintText.x = boxX + 45;
      hintText.y = slotY + 32;
      slotTexts.push(hintText);
      dialogContainer!.addChild(hintText);
    }

    slotSelectionTexts.push(slotTexts);
  });

  // Cancel button (store reference for visual updates)
  slotSelectionCancelText = createTerminalText('  [ CANCEL ]', dimStyle);
  slotSelectionCancelText.anchor.set(0.5, 0);
  slotSelectionCancelText.x = boxX + boxWidth / 2;
  slotSelectionCancelText.y = boxY + boxHeight - 50;
  slotSelectionCancelText.eventMode = 'static';
  slotSelectionCancelText.cursor = 'pointer';
  slotSelectionCancelText.on('pointerdown', handleSlotSelectionCancel);
  slotSelectionCancelText.on('pointerover', () => {
    slotSelectionIndex = MAX_SLOTS;
    updateSlotSelectionVisuals();
  });
  dialogContainer.addChild(slotSelectionCancelText);

  // Keyboard hint
  const hintText = createTerminalText('Arrow keys: Navigate | Enter: Select | Escape: Cancel', smallStyle);
  hintText.anchor.set(0.5, 0);
  hintText.x = boxX + boxWidth / 2;
  hintText.y = boxY + boxHeight - 25;
  dialogContainer.addChild(hintText);

  menuContainer.addChild(dialogContainer);
  menuContainer.sortableChildren = true;

  // Mark dialog as slot selection
  (dialogContainer as Container & { isSlotSelection?: boolean }).isSlotSelection = true;

  // Apply initial visual state (ensures white highlight on selected slot)
  updateSlotSelectionVisuals();
}

/**
 * Handle slot selection confirm.
 */
function handleSlotSelectionConfirm(): void {
  // If Cancel button is selected (index = MAX_SLOTS), trigger cancel
  if (slotSelectionIndex === MAX_SLOTS) {
    handleSlotSelectionCancel();
    return;
  }

  const slot = slotSelectionSlots[slotSelectionIndex];
  if (!slot) return;

  // For continue mode, only allow selecting occupied slots
  if (slotSelectionMode === 'continue' && slot.isEmpty) {
    return;
  }

  const callback = slotSelectionOnSelect;
  const selectedIndex = slotSelectionIndex;
  closeDialog();

  if (callback) {
    callback(selectedIndex);
  }
}

/**
 * Handle slot selection cancel.
 */
function handleSlotSelectionCancel(): void {
  const callback = slotSelectionOnCancel;
  closeDialog();

  if (callback) {
    callback();
  }
}

// ============================================================================
// UI Creation
// ============================================================================

/**
 * Create the ASCII title display.
 */
function createTitle(): Container {
  const titleContainer = new Container();
  titleContainer.label = 'title';

  // Split ASCII art into lines
  const lines = ASCII_TITLE.split('\n');
  const lineHeight = 14;
  const titleStyle = cloneStyle(primaryStyle, {
    fontSize: 10,
    fontFamily: MONOSPACE_FONT,
  });

  lines.forEach((line, index) => {
    const text = createTerminalText(line, titleStyle);
    text.anchor.set(0.5, 0);
    text.x = CANVAS_WIDTH / 2;
    text.y = TITLE_Y + index * lineHeight;
    titleContainer.addChild(text);
  });

  // Subtitle
  const subtitle = createTerminalText('INCREMENTAL', dimStyle);
  subtitle.anchor.set(0.5, 0);
  subtitle.x = CANVAS_WIDTH / 2;
  subtitle.y = TITLE_Y + lines.length * lineHeight + 10;
  titleContainer.addChild(subtitle);

  return titleContainer;
}

/**
 * Create a menu item text element.
 */
function createMenuItemText(item: MenuItem, index: number): Text {
  const isSelected = index === selectedIndex;
  const style = item.enabled
    ? isSelected
      ? brightStyle
      : primaryStyle
    : dimStyle;

  const prefix = isSelected ? '> ' : '  ';
  const suffix = !item.enabled ? ' (Coming Soon)' : '';
  const label = prefix + item.label + suffix;

  const text = createTerminalText(label, style);
  text.anchor.set(0.5, 0);
  text.x = CANVAS_WIDTH / 2;
  text.y = MENU_START_Y + index * MENU_ITEM_HEIGHT;

  // Enable interactivity for enabled items
  if (item.enabled) {
    text.eventMode = 'static';
    text.cursor = 'pointer';

    text.on('pointerdown', () => {
      selectedIndex = index;
      updateMenuVisuals();
      executeSelectedItem();
    });

    text.on('pointerover', () => {
      if (selectedIndex !== index) {
        selectedIndex = index;
        updateMenuVisuals();
      }
    });
  }

  return text;
}

/**
 * Update menu item visual styles based on selection.
 */
function updateMenuVisuals(): void {
  menuTexts.forEach((text, index) => {
    const item = menuItems[index];
    if (!item) return;

    const isSelected = index === selectedIndex;

    const style = item.enabled
      ? isSelected
        ? brightStyle
        : primaryStyle
      : dimStyle;

    const prefix = isSelected ? '> ' : '  ';
    const suffix = !item.enabled ? ' (Coming Soon)' : '';

    text.text = prefix + item.label + suffix;
    text.style = style;
  });
}

/**
 * Execute the currently selected menu item.
 */
async function executeSelectedItem(): Promise<void> {
  const item = menuItems[selectedIndex];
  if (item && item.enabled) {
    await item.action();
  }
}

/**
 * Create the menu items display.
 */
function createMenuDisplay(): Container {
  const menuDisplay = new Container();
  menuDisplay.label = 'menu-display';

  menuTexts = [];

  menuItems.forEach((item, index) => {
    const text = createMenuItemText(item, index);
    menuTexts.push(text);
    menuDisplay.addChild(text);
  });

  return menuDisplay;
}

/**
 * Create keyboard navigation hint.
 */
function createNavigationHint(): Text {
  const hint = createTerminalText(
    'Arrow Keys: Navigate | Enter: Select',
    smallStyle
  );
  hint.anchor.set(0.5, 0);
  hint.x = CANVAS_WIDTH / 2;
  hint.y = CANVAS_HEIGHT - 40;
  return hint;
}

/**
 * Rebuild the menu (e.g., after save deletion).
 */
function rebuildMenu(): void {
  if (!menuContainer) return;

  // Remove old menu display
  const oldMenu = menuContainer.getChildByLabel('menu-display');
  if (oldMenu) {
    menuContainer.removeChild(oldMenu);
    oldMenu.destroy({ children: true });
  }

  // Rebuild menu items
  menuItems = buildMenuItems();
  selectedIndex = 0;

  // Create new menu display
  const newMenuDisplay = createMenuDisplay();
  menuContainer.addChild(newMenuDisplay);
}

// ============================================================================
// Keyboard Handling
// ============================================================================

/**
 * Handle keyboard input for menu navigation.
 */
function handleKeydown(event: KeyboardEvent): void {
  console.log('[MainMenu] keydown:', event.key, 'dialogContainer:', !!dialogContainer);

  // Handle dialog keyboard shortcuts first
  if (dialogContainer) {
    const dialog = dialogContainer as Container & { onConfirm?: () => void; isNameInput?: boolean };

    // Handle name input dialog
    if (dialog.isNameInput) {
      event.preventDefault();

      // Escape to cancel
      if (event.key === 'Escape') {
        handleNameInputCancel();
        return;
      }

      // Arrow key navigation between Confirm and Cancel buttons
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        nameInputSelectedButton = nameInputSelectedButton === 0 ? 1 : 0;
        updateNameInputButtonVisuals();
        return;
      }

      // Enter to confirm selected button
      if (event.key === 'Enter') {
        if (nameInputSelectedButton === 0) {
          handleNameInputConfirm();
        } else {
          handleNameInputCancel();
        }
        return;
      }

      // Backspace to delete
      if (event.key === 'Backspace') {
        if (nameInputValue.length > 0) {
          nameInputValue = nameInputValue.slice(0, -1);
          updateNameInputDisplay();
          hideNameInputError();
        }
        return;
      }

      // Only accept single printable characters
      if (event.key.length === 1 && VALID_NAME_CHARS.test(event.key)) {
        if (nameInputValue.length < MAX_NAME_LENGTH) {
          nameInputValue += event.key;
          updateNameInputDisplay();
          hideNameInputError();
        }
        return;
      }

      return;
    }

    // Handle slot selection dialog
    if ((dialog as Container & { isSlotSelection?: boolean }).isSlotSelection) {
      event.preventDefault();

      // Escape to cancel
      if (event.key === 'Escape') {
        handleSlotSelectionCancel();
        return;
      }

      // Enter to confirm
      if (event.key === 'Enter') {
        handleSlotSelectionConfirm();
        return;
      }

      // Arrow key navigation (slots 0 to MAX_SLOTS-1, plus Cancel at MAX_SLOTS)
      if (event.key === 'ArrowUp' || event.key.toLowerCase() === 'w') {
        // Navigate up
        if (slotSelectionIndex === MAX_SLOTS) {
          // From Cancel, go to last valid slot
          if (slotSelectionMode === 'continue') {
            // Find last occupied slot
            for (let i = MAX_SLOTS - 1; i >= 0; i--) {
              if (!slotSelectionSlots[i]?.isEmpty) {
                slotSelectionIndex = i;
                updateSlotSelectionVisuals();
                break;
              }
            }
          } else {
            slotSelectionIndex = MAX_SLOTS - 1;
            updateSlotSelectionVisuals();
          }
        } else if (slotSelectionIndex > 0) {
          // In continue mode, skip empty slots
          if (slotSelectionMode === 'continue') {
            for (let i = slotSelectionIndex - 1; i >= 0; i--) {
              if (!slotSelectionSlots[i]?.isEmpty) {
                slotSelectionIndex = i;
                updateSlotSelectionVisuals();
                break;
              }
            }
          } else {
            slotSelectionIndex = slotSelectionIndex - 1;
            updateSlotSelectionVisuals();
          }
        }
        return;
      }

      if (event.key === 'ArrowDown' || event.key.toLowerCase() === 's') {
        // Navigate down (including Cancel button at MAX_SLOTS)
        if (slotSelectionIndex < MAX_SLOTS) {
          const newIndex = slotSelectionIndex + 1;
          // In continue mode, skip empty slots but always allow Cancel
          if (slotSelectionMode === 'continue') {
            let foundSlot = false;
            for (let i = newIndex; i < MAX_SLOTS; i++) {
              if (!slotSelectionSlots[i]?.isEmpty) {
                slotSelectionIndex = i;
                updateSlotSelectionVisuals();
                foundSlot = true;
                break;
              }
            }
            // If no more occupied slots, go to Cancel
            if (!foundSlot) {
              slotSelectionIndex = MAX_SLOTS;
              updateSlotSelectionVisuals();
            }
          } else {
            // Allow navigation to Cancel button (index = MAX_SLOTS)
            slotSelectionIndex = newIndex;
            updateSlotSelectionVisuals();
          }
        }
        return;
      }

      return;
    }

    console.log('[MainMenu] Dialog active, onConfirm:', !!dialog.onConfirm);

    // For message dialogs, any key closes
    if (!dialog.onConfirm) {
      closeDialog();
      return;
    }

    // Confirmation dialog handling
    if (event.key === 'Escape' || event.key.toLowerCase() === 'n') {
      event.preventDefault();
      closeDialog();
      return;
    }

    if (event.key.toLowerCase() === 'y') {
      event.preventDefault();
      const onConfirm = dialog.onConfirm;
      closeDialog();
      onConfirm();
      return;
    }

    // Arrow key navigation between Yes/No
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight' ||
        event.key.toLowerCase() === 'a' || event.key.toLowerCase() === 'd') {
      console.log('[MainMenu] Arrow key in dialog, switching selection');
      event.preventDefault();
      dialogSelectedButton = dialogSelectedButton === 0 ? 1 : 0;
      updateDialogButtonVisuals();
      return;
    }

    // Enter to confirm selected button
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (dialogSelectedButton === 0 && dialog.onConfirm) {
        const onConfirm = dialog.onConfirm;
        closeDialog();
        onConfirm();
      } else {
        closeDialog();
      }
      return;
    }

    return;
  }

  // Handle menu navigation
  switch (event.key) {
    case 'ArrowUp':
    case 'w':
    case 'W':
      event.preventDefault();
      navigateMenu(-1);
      break;

    case 'ArrowDown':
    case 's':
    case 'S':
      event.preventDefault();
      navigateMenu(1);
      break;

    case 'Enter':
    case ' ':
      event.preventDefault();
      executeSelectedItem();
      break;
  }
}

/**
 * Navigate the menu by a given direction.
 */
function navigateMenu(direction: number): void {
  const newIndex = selectedIndex + direction;

  if (newIndex >= 0 && newIndex < menuItems.length) {
    selectedIndex = newIndex;
    updateMenuVisuals();
  }
}

// ============================================================================
// Scene Implementation
// ============================================================================

/**
 * Create the main menu scene.
 *
 * @param menuConfig - Configuration with callbacks for menu actions
 * @returns A Scene object for the scene manager
 */
export function createMainMenuScene(menuConfig: MainMenuConfig): Scene {
  config = menuConfig;

  // Create main container
  menuContainer = new Container();
  menuContainer.label = 'main-menu';

  // Build menu items based on save state
  menuItems = buildMenuItems();
  selectedIndex = 0;

  // Add background
  const background = new Graphics();
  background.fill({ color: 0x0a0a0a });
  background.rect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  background.fill();
  menuContainer.addChild(background);

  // Add title
  const title = createTitle();
  menuContainer.addChild(title);

  // Add menu items
  const menuDisplay = createMenuDisplay();
  menuContainer.addChild(menuDisplay);

  // Add navigation hint
  const hint = createNavigationHint();
  menuContainer.addChild(hint);

  // Create the scene object
  const scene: Scene = {
    container: menuContainer,

    onEnter: () => {
      console.log('[MainMenu] Scene entered');

      // Rebuild menu items in case save state changed
      rebuildMenu();

      // Add keyboard listener
      keydownHandler = handleKeydown;
      window.addEventListener('keydown', keydownHandler);
    },

    onExit: () => {
      console.log('[MainMenu] Scene exiting');

      // Remove keyboard listener
      if (keydownHandler) {
        window.removeEventListener('keydown', keydownHandler);
        keydownHandler = null;
      }

      // Close any open dialogs
      closeDialog();
    },

    onDestroy: () => {
      console.log('[MainMenu] Scene destroyed');
      destroyMainMenuScene();
    },
  };

  return scene;
}

/**
 * Destroy the main menu scene and clean up resources.
 */
export function destroyMainMenuScene(): void {
  // Remove keyboard listener
  if (keydownHandler) {
    window.removeEventListener('keydown', keydownHandler);
    keydownHandler = null;
  }

  // Close any open dialogs
  closeDialog();

  // Clean up container
  if (menuContainer) {
    menuContainer.destroy({ children: true });
    menuContainer = null;
  }

  // Reset state
  menuItems = [];
  menuTexts = [];
  selectedIndex = 0;
  config = null;

  console.log('[MainMenu] Cleanup complete');
}
