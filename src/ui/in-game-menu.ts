/**
 * In-Game Menu Overlay for the Hacker Incremental Game
 *
 * This overlay provides pause menu functionality during gameplay,
 * allowing players to save, access options, or return to main menu.
 *
 * Features:
 * - Toggle with Escape key
 * - Semi-transparent overlay with centered menu box
 * - Keyboard and mouse navigation
 * - Auto-save before exiting to main menu
 *
 * Usage:
 *   import {
 *     initInGameMenu,
 *     showInGameMenu,
 *     hideInGameMenu,
 *     isInGameMenuVisible,
 *   } from '@ui/in-game-menu';
 *
 *   initInGameMenu({ onExitToMainMenu });
 *
 *   // Toggle with Escape key is handled automatically
 */

import { Container, Graphics, Text } from 'pixi.js';
import {
  getRootContainer,
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  TERMINAL_GREEN,
  TERMINAL_DIM,
} from './renderer';
import {
  createTerminalText,
  headerStyle,
  primaryStyle,
  dimStyle,
  brightStyle,
  smallStyle,
  cloneStyle,
} from './styles';
import { saveGame } from '../core/save-system';
import { isWelcomeBackModalVisible } from './welcome-back-modal';
import { getSceneManager } from './scenes/scene-manager';

// ============================================================================
// Types
// ============================================================================

/**
 * Configuration for the in-game menu.
 */
export interface InGameMenuConfig {
  /** Called when user confirms exit to main menu (after saving) */
  onExitToMainMenu: () => void | Promise<void>;
  /** Optional: Check if menu should be blocked (e.g., during minigames) */
  canOpenMenu?: () => boolean;
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
let config: InGameMenuConfig | null = null;
let isVisible = false;
let selectedIndex = 0;
let menuTexts: Text[] = [];
let keydownHandler: ((event: KeyboardEvent) => void) | null = null;
let isInitialized = false;

// ============================================================================
// Constants
// ============================================================================

const MENU_WIDTH = 300;
const MENU_HEIGHT = 280;
const MENU_PADDING = 24;
const MENU_ITEM_HEIGHT = 40;

// ============================================================================
// Menu Items
// ============================================================================

/**
 * Build the menu items.
 */
function buildMenuItems(): MenuItem[] {
  return [
    {
      id: 'resume',
      label: 'Resume',
      enabled: true,
      action: handleResume,
    },
    {
      id: 'save',
      label: 'Save Game',
      enabled: true,
      action: handleSaveGame,
    },
    {
      id: 'options',
      label: 'Options',
      enabled: false, // Placeholder
      action: handleOptions,
    },
    {
      id: 'exit',
      label: 'Exit to Main Menu',
      enabled: true,
      action: handleExitToMainMenu,
    },
  ];
}

// ============================================================================
// Menu Actions
// ============================================================================

/**
 * Handle Resume selection.
 */
function handleResume(): void {
  console.log('[InGameMenu] Resume selected');
  hideInGameMenu();
}

/**
 * Handle Save Game selection.
 */
function handleSaveGame(): void {
  console.log('[InGameMenu] Save Game selected');
  const success = saveGame();

  if (success) {
    showFeedback('Game Saved!');
  } else {
    showFeedback('Save Failed!', true);
  }
}

/**
 * Handle Options selection (placeholder).
 */
function handleOptions(): void {
  console.log('[InGameMenu] Options selected (Coming Soon)');
  showFeedback('Coming Soon...');
}

/**
 * Handle Exit to Main Menu selection.
 */
function handleExitToMainMenu(): void {
  console.log('[InGameMenu] Exit to Main Menu selected');
  showConfirmExit();
}

// ============================================================================
// Dialog/Feedback System
// ============================================================================

let feedbackContainer: Container | null = null;
let feedbackTimeout: ReturnType<typeof setTimeout> | null = null;
let confirmContainer: Container | null = null;
let confirmSelectedButton = 0; // 0 = yes, 1 = no
let confirmYesText: Text | null = null;
let confirmNoText: Text | null = null;

/**
 * Update confirm dialog button visuals based on selection.
 */
function updateConfirmButtonVisuals(): void {
  if (confirmYesText) {
    if (confirmSelectedButton === 0) {
      confirmYesText.style.fill = '#ffffff';
      confirmYesText.text = '> [ YES ]';
    } else {
      confirmYesText.style.fill = '#44ff44';
      confirmYesText.text = '  [ YES ]';
    }
  }
  if (confirmNoText) {
    if (confirmSelectedButton === 1) {
      confirmNoText.style.fill = '#44ff44';
      confirmNoText.text = '> [ NO ]';
    } else {
      confirmNoText.style.fill = '#008800';
      confirmNoText.text = '  [ NO ]';
    }
  }
}

/**
 * Show a brief feedback message.
 */
function showFeedback(message: string, isError = false): void {
  if (!menuContainer) return;

  // Clear any existing feedback
  clearFeedback();

  feedbackContainer = new Container();
  feedbackContainer.label = 'feedback';
  feedbackContainer.zIndex = 200;

  const style = isError
    ? cloneStyle(primaryStyle, { fill: '#ff4444' })
    : cloneStyle(primaryStyle, { fill: '#44ff44' });

  const text = createTerminalText(message, style);
  text.anchor.set(0.5, 0.5);
  text.x = CANVAS_WIDTH / 2;
  text.y = CANVAS_HEIGHT / 2 + MENU_HEIGHT / 2 + 30;

  feedbackContainer.addChild(text);
  menuContainer.addChild(feedbackContainer);
  menuContainer.sortableChildren = true;

  // Auto-hide after 2 seconds
  feedbackTimeout = setTimeout(() => {
    clearFeedback();
  }, 2000);
}

/**
 * Clear feedback message.
 */
function clearFeedback(): void {
  if (feedbackTimeout) {
    clearTimeout(feedbackTimeout);
    feedbackTimeout = null;
  }

  if (feedbackContainer && menuContainer) {
    menuContainer.removeChild(feedbackContainer);
    feedbackContainer.destroy({ children: true });
    feedbackContainer = null;
  }
}

/**
 * Show exit confirmation dialog.
 */
function showConfirmExit(): void {
  if (!menuContainer) return;

  closeConfirm();

  confirmContainer = new Container();
  confirmContainer.label = 'confirm-exit';
  confirmContainer.zIndex = 150;

  // Overlay to block interactions with main menu
  const overlay = new Graphics();
  overlay.fill({ color: 0x000000, alpha: 0.5 });
  overlay.rect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  overlay.fill();
  overlay.eventMode = 'static';
  confirmContainer.addChild(overlay);

  // Confirmation box
  const boxWidth = 320;
  const boxHeight = 150;
  const boxX = (CANVAS_WIDTH - boxWidth) / 2;
  const boxY = (CANVAS_HEIGHT - boxHeight) / 2;

  const box = new Graphics();
  box.fill({ color: 0x0a0a0a, alpha: 0.98 });
  box.roundRect(boxX, boxY, boxWidth, boxHeight, 4);
  box.fill();
  box.stroke({ color: TERMINAL_DIM, width: 1 });
  box.roundRect(boxX, boxY, boxWidth, boxHeight, 4);
  box.stroke();
  box.stroke({ color: TERMINAL_GREEN, width: 1 });
  box.roundRect(boxX + 4, boxY + 4, boxWidth - 8, boxHeight - 8, 2);
  box.stroke();
  box.eventMode = 'static';
  confirmContainer.addChild(box);

  // Title
  const title = createTerminalText('EXIT TO MAIN MENU?', headerStyle);
  title.anchor.set(0.5, 0);
  title.x = CANVAS_WIDTH / 2;
  title.y = boxY + 20;
  confirmContainer.addChild(title);

  // Message
  const message = createTerminalText('Your game will be saved.', primaryStyle);
  message.anchor.set(0.5, 0);
  message.x = CANVAS_WIDTH / 2;
  message.y = boxY + 55;
  confirmContainer.addChild(message);

  // Reset selection state
  confirmSelectedButton = 0;

  // Yes button (selected by default)
  confirmYesText = createTerminalText('> [ YES ]', cloneStyle(brightStyle, { fill: '#ffffff' }));
  confirmYesText.anchor.set(0.5, 0);
  confirmYesText.x = boxX + boxWidth / 3;
  confirmYesText.y = boxY + boxHeight - 55;
  confirmYesText.eventMode = 'static';
  confirmYesText.cursor = 'pointer';
  confirmYesText.on('pointerdown', confirmExit);
  confirmYesText.on('pointerover', () => {
    confirmSelectedButton = 0;
    updateConfirmButtonVisuals();
  });
  confirmContainer.addChild(confirmYesText);

  // No button (not selected initially)
  confirmNoText = createTerminalText('  [ NO ]', dimStyle);
  confirmNoText.anchor.set(0.5, 0);
  confirmNoText.x = boxX + (boxWidth * 2) / 3;
  confirmNoText.y = boxY + boxHeight - 55;
  confirmNoText.eventMode = 'static';
  confirmNoText.cursor = 'pointer';
  confirmNoText.on('pointerdown', closeConfirm);
  confirmNoText.on('pointerover', () => {
    confirmSelectedButton = 1;
    updateConfirmButtonVisuals();
  });
  confirmContainer.addChild(confirmNoText);

  // Hint
  const hint = createTerminalText('Arrow keys or Y/N, Enter to confirm', smallStyle);
  hint.anchor.set(0.5, 0);
  hint.x = CANVAS_WIDTH / 2;
  hint.y = boxY + boxHeight - 25;
  confirmContainer.addChild(hint);

  menuContainer.addChild(confirmContainer);
  menuContainer.sortableChildren = true;
}

/**
 * Close confirmation dialog.
 */
function closeConfirm(): void {
  if (confirmContainer && menuContainer) {
    menuContainer.removeChild(confirmContainer);
    confirmContainer.destroy({ children: true });
    confirmContainer = null;
  }
  confirmYesText = null;
  confirmNoText = null;
  confirmSelectedButton = 0;
}

/**
 * Confirm exit to main menu.
 */
async function confirmExit(): Promise<void> {
  console.log('[InGameMenu] Exit confirmed');

  // Save the game before exiting
  saveGame();

  // Close dialogs and menu
  closeConfirm();
  hideInGameMenu();

  // Trigger the callback
  if (config?.onExitToMainMenu) {
    await config.onExitToMainMenu();
  }
}

// ============================================================================
// UI Creation
// ============================================================================

/**
 * Create the menu overlay.
 */
function createOverlay(): Graphics {
  const overlay = new Graphics();
  overlay.fill({ color: 0x000000, alpha: 0.75 });
  overlay.rect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  overlay.fill();
  overlay.eventMode = 'static';
  overlay.cursor = 'default';
  // Click on overlay does nothing (menu stays open)
  return overlay;
}

/**
 * Create the menu box.
 */
function createMenuBox(): Graphics {
  const box = new Graphics();
  const boxX = (CANVAS_WIDTH - MENU_WIDTH) / 2;
  const boxY = (CANVAS_HEIGHT - MENU_HEIGHT) / 2;

  // Background
  box.fill({ color: 0x0a0a0a, alpha: 0.95 });
  box.roundRect(boxX, boxY, MENU_WIDTH, MENU_HEIGHT, 4);
  box.fill();

  // Outer border
  box.stroke({ color: TERMINAL_DIM, width: 1 });
  box.roundRect(boxX, boxY, MENU_WIDTH, MENU_HEIGHT, 4);
  box.stroke();

  // Inner border
  box.stroke({ color: TERMINAL_GREEN, width: 1 });
  box.roundRect(boxX + 4, boxY + 4, MENU_WIDTH - 8, MENU_HEIGHT - 8, 2);
  box.stroke();

  // Corner accents
  const accentSize = 12;
  box.stroke({ color: TERMINAL_GREEN, width: 2 });

  // Top-left
  box.moveTo(boxX, boxY + accentSize);
  box.lineTo(boxX, boxY);
  box.lineTo(boxX + accentSize, boxY);
  box.stroke();

  // Top-right
  box.moveTo(boxX + MENU_WIDTH - accentSize, boxY);
  box.lineTo(boxX + MENU_WIDTH, boxY);
  box.lineTo(boxX + MENU_WIDTH, boxY + accentSize);
  box.stroke();

  // Bottom-left
  box.moveTo(boxX, boxY + MENU_HEIGHT - accentSize);
  box.lineTo(boxX, boxY + MENU_HEIGHT);
  box.lineTo(boxX + accentSize, boxY + MENU_HEIGHT);
  box.stroke();

  // Bottom-right
  box.moveTo(boxX + MENU_WIDTH - accentSize, boxY + MENU_HEIGHT);
  box.lineTo(boxX + MENU_WIDTH, boxY + MENU_HEIGHT);
  box.lineTo(boxX + MENU_WIDTH, boxY + MENU_HEIGHT - accentSize);
  box.stroke();

  box.eventMode = 'static'; // Block clicks from passing through

  return box;
}

/**
 * Create menu item text.
 */
function createMenuItemText(item: MenuItem, index: number, startY: number): Text {
  const isSelected = index === selectedIndex;
  const style = item.enabled
    ? isSelected
      ? brightStyle
      : primaryStyle
    : dimStyle;

  const prefix = isSelected ? '> ' : '  ';
  const suffix = !item.enabled ? ' (Soon)' : '';
  const label = prefix + item.label + suffix;

  const text = createTerminalText(label, style);
  text.anchor.set(0.5, 0);
  text.x = CANVAS_WIDTH / 2;
  text.y = startY + index * MENU_ITEM_HEIGHT;

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
 * Update menu visuals based on selection.
 */
function updateMenuVisuals(): void {
  const items = buildMenuItems();

  menuTexts.forEach((text, index) => {
    const item = items[index];
    if (!item) return;

    const isSelected = index === selectedIndex;
    const style = item.enabled
      ? isSelected
        ? brightStyle
        : primaryStyle
      : dimStyle;

    const prefix = isSelected ? '> ' : '  ';
    const suffix = !item.enabled ? ' (Soon)' : '';

    text.text = prefix + item.label + suffix;
    text.style = style;
  });
}

/**
 * Execute the currently selected menu item.
 */
async function executeSelectedItem(): Promise<void> {
  const items = buildMenuItems();
  const item = items[selectedIndex];
  if (item && item.enabled) {
    await item.action();
  }
}

// ============================================================================
// Keyboard Handling
// ============================================================================

/**
 * Handle keyboard input.
 */
function handleKeydown(event: KeyboardEvent): void {
  // If not visible, check for Escape to open
  if (!isVisible) {
    if (event.key === 'Escape') {
      // Check if we can open the menu
      if (canOpen()) {
        event.preventDefault();
        showInGameMenu();
      }
    }
    return;
  }

  // Handle confirmation dialog
  if (confirmContainer) {
    console.log('[InGameMenu] Confirm dialog key:', event.key);
    if (event.key === 'Escape' || event.key.toLowerCase() === 'n') {
      event.preventDefault();
      closeConfirm();
      return;
    }
    if (event.key.toLowerCase() === 'y') {
      event.preventDefault();
      confirmExit();
      return;
    }
    // Arrow key navigation between Yes/No
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight' ||
        event.key.toLowerCase() === 'a' || event.key.toLowerCase() === 'd') {
      console.log('[InGameMenu] Arrow key, switching selection');
      event.preventDefault();
      confirmSelectedButton = confirmSelectedButton === 0 ? 1 : 0;
      updateConfirmButtonVisuals();
      return;
    }
    // Enter to confirm selected button
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (confirmSelectedButton === 0) {
        confirmExit();
      } else {
        closeConfirm();
      }
      return;
    }
    return;
  }

  // Handle menu navigation
  switch (event.key) {
    case 'Escape':
      event.preventDefault();
      hideInGameMenu();
      break;

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
 * Navigate menu by direction.
 */
function navigateMenu(direction: number): void {
  const items = buildMenuItems();
  const newIndex = selectedIndex + direction;

  if (newIndex >= 0 && newIndex < items.length) {
    selectedIndex = newIndex;
    updateMenuVisuals();
  }
}

/**
 * Check if menu can be opened.
 */
function canOpen(): boolean {
  // Don't open if welcome back modal is visible
  if (isWelcomeBackModalVisible()) {
    return false;
  }

  // Don't open if on main menu
  const sceneManager = getSceneManager();
  if (sceneManager.getCurrentSceneId() === 'main-menu') {
    return false;
  }

  // Check custom condition if provided
  if (config?.canOpenMenu && !config.canOpenMenu()) {
    return false;
  }

  return true;
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Initialize the in-game menu system.
 *
 * @param menuConfig - Configuration with callbacks
 */
export function initInGameMenu(menuConfig: InGameMenuConfig): void {
  if (isInitialized) {
    console.warn('[InGameMenu] Already initialized');
    return;
  }

  config = menuConfig;

  // Add global keyboard listener for Escape key
  keydownHandler = handleKeydown;
  window.addEventListener('keydown', keydownHandler);

  isInitialized = true;
  console.log('[InGameMenu] Initialized');
}

/**
 * Show the in-game menu overlay.
 */
export function showInGameMenu(): void {
  if (isVisible || !isInitialized) return;

  if (!canOpen()) {
    console.log('[InGameMenu] Cannot open menu right now');
    return;
  }

  // Create menu container
  menuContainer = new Container();
  menuContainer.label = 'in-game-menu';
  menuContainer.zIndex = 900; // Below welcome-back modal (1000)

  // Add overlay
  const overlay = createOverlay();
  menuContainer.addChild(overlay);

  // Add menu box
  const menuBox = createMenuBox();
  menuContainer.addChild(menuBox);

  // Add title
  const boxY = (CANVAS_HEIGHT - MENU_HEIGHT) / 2;
  const title = createTerminalText('PAUSED', headerStyle);
  title.anchor.set(0.5, 0);
  title.x = CANVAS_WIDTH / 2;
  title.y = boxY + MENU_PADDING;
  menuContainer.addChild(title);

  // Add divider
  const divider = new Graphics();
  divider.stroke({ color: TERMINAL_DIM, width: 1, alpha: 0.6 });
  const dividerY = boxY + MENU_PADDING + 35;
  divider.moveTo((CANVAS_WIDTH - MENU_WIDTH) / 2 + MENU_PADDING, dividerY);
  divider.lineTo((CANVAS_WIDTH + MENU_WIDTH) / 2 - MENU_PADDING, dividerY);
  divider.stroke();
  menuContainer.addChild(divider);

  // Add menu items
  const items = buildMenuItems();
  menuTexts = [];
  selectedIndex = 0;

  const menuStartY = boxY + MENU_PADDING + 55;

  items.forEach((item, index) => {
    const text = createMenuItemText(item, index, menuStartY);
    menuTexts.push(text);
    menuContainer!.addChild(text);
  });

  // Add navigation hint
  const hint = createTerminalText('Esc: Close | Arrows: Navigate', smallStyle);
  hint.anchor.set(0.5, 0);
  hint.x = CANVAS_WIDTH / 2;
  hint.y = boxY + MENU_HEIGHT - 30;
  menuContainer.addChild(hint);

  // Add to root container
  const rootContainer = getRootContainer();
  rootContainer.addChild(menuContainer);
  rootContainer.sortableChildren = true;

  isVisible = true;
  console.log('[InGameMenu] Menu shown');
}

/**
 * Hide the in-game menu overlay.
 */
export function hideInGameMenu(): void {
  if (!isVisible || !menuContainer) return;

  // Clear any dialogs/feedback
  closeConfirm();
  clearFeedback();

  // Remove menu container
  menuContainer.destroy({ children: true });
  menuContainer = null;

  // Reset state
  menuTexts = [];
  selectedIndex = 0;

  isVisible = false;
  console.log('[InGameMenu] Menu hidden');
}

/**
 * Check if the in-game menu is currently visible.
 *
 * @returns true if visible
 */
export function isInGameMenuVisible(): boolean {
  return isVisible;
}

/**
 * Toggle the in-game menu visibility.
 */
export function toggleInGameMenu(): void {
  if (isVisible) {
    hideInGameMenu();
  } else {
    showInGameMenu();
  }
}

/**
 * Destroy the in-game menu system.
 * Call during cleanup (e.g., HMR).
 */
export function destroyInGameMenu(): void {
  // Hide menu if visible
  hideInGameMenu();

  // Remove keyboard listener
  if (keydownHandler) {
    window.removeEventListener('keydown', keydownHandler);
    keydownHandler = null;
  }

  // Reset state
  config = null;
  isInitialized = false;

  console.log('[InGameMenu] Destroyed');
}
