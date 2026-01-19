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
import { hasSaveData, hardReset, deleteSave } from '../../core/save-system';
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
 */
async function handleNewGame(): Promise<void> {
  console.log('[MainMenu] New Game selected');
  hardReset();
  if (config?.onNewGame) {
    await config.onNewGame();
  }
}

/**
 * Handle Continue/Load Game selection.
 */
async function handleContinue(): Promise<void> {
  console.log('[MainMenu] Continue selected');
  if (config?.onContinue) {
    await config.onContinue();
  }
}

/**
 * Handle Delete Save selection.
 */
function handleDeleteSave(): void {
  console.log('[MainMenu] Delete Save selected');
  showConfirmDialog(
    'DELETE SAVE DATA?',
    'This will permanently delete your progress.',
    () => {
      deleteSave();
      console.log('[MainMenu] Save deleted');
      // Rebuild menu to remove Continue/Delete options
      rebuildMenu();
    }
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

/**
 * Update dialog button visuals based on selection.
 */
function updateDialogButtonVisuals(): void {
  console.log('[MainMenu] updateDialogButtonVisuals, selected:', dialogSelectedButton, 'yesText:', !!dialogYesText, 'noText:', !!dialogNoText);

  if (dialogYesText) {
    if (dialogSelectedButton === 0) {
      dialogYesText.style.fill = '#ffffff';
      dialogYesText.text = '> [ YES ]';
    } else {
      dialogYesText.style.fill = '#44ff44';
      dialogYesText.text = '  [ YES ]';
    }
  }
  if (dialogNoText) {
    if (dialogSelectedButton === 1) {
      dialogNoText.style.fill = '#44ff44';
      dialogNoText.text = '> [ NO ]';
    } else {
      dialogNoText.style.fill = '#008800';
      dialogNoText.text = '  [ NO ]';
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
    const dialog = dialogContainer as Container & { onConfirm?: () => void };
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
