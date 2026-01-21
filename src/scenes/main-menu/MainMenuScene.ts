/**
 * Main Menu Scene for the Hacker Incremental Game v2
 *
 * This scene is displayed when the game starts, providing options to:
 * - Start a new game (with player name input)
 * - Continue from an existing save
 * - Delete save slots
 *
 * Features:
 * - ASCII-art inspired title
 * - Keyboard navigation (arrow keys + Enter)
 * - Input context for scene-specific controls
 * - Integration with SaveManager for slot management
 *
 * Usage:
 *   import { createMainMenuScene } from './MainMenuScene';
 *
 *   const scene = createMainMenuScene(game);
 *   sceneManager.register('main-menu', () => scene);
 */

import { Container, Graphics, Text } from 'pixi.js';
import { BaseScene } from '../SceneManager';
import { INPUT_PRIORITY, type InputContext, type InputBinding } from '../../input/InputManager';
import {
  titleStyle,
  terminalStyle,
  terminalBrightStyle,
  terminalDimStyle,
  terminalSmallStyle,
  promptStyle,
} from '../../rendering/styles';
import { COLORS } from '../../rendering/Renderer';
import type { Game } from '../../game/Game';
import type { SaveSlotMetadata } from '../../core/types';

// ============================================================================
// Types
// ============================================================================

/**
 * Menu states for the main menu.
 */
type MenuState = 'slot-select' | 'name-input' | 'confirm-delete';

/**
 * Menu item representing a save slot or action.
 */
interface MenuItem {
  id: string;
  label: string;
  subLabel?: string;
  enabled: boolean;
  slotIndex?: number;
}

// ============================================================================
// Constants
// ============================================================================

const MENU_START_Y = 200;
const MENU_ITEM_HEIGHT = 40;
const INPUT_CONTEXT_ID = 'main-menu';

// ============================================================================
// Main Menu Scene Class
// ============================================================================

/**
 * Main menu scene implementation.
 */
export class MainMenuScene extends BaseScene {
  readonly id = 'main-menu';

  private readonly game: Game;

  // UI elements
  private titleText: Text | null = null;
  private versionText: Text | null = null;
  private menuItems: Text[] = [];
  private menuData: MenuItem[] = [];
  private cursorText: Text | null = null;
  private hintText: Text | null = null;

  // Name input UI
  private nameInputContainer: Container | null = null;
  private namePromptText: Text | null = null;
  private nameInputText: Text | null = null;
  private nameInputCursor: Graphics | null = null;
  private nameInputValue = '';
  private cursorBlinkTimer = 0;
  private cursorVisible = true;

  // Confirm delete UI
  private confirmContainer: Container | null = null;
  private confirmText: Text | null = null;
  private readonly confirmOptions: Text[] = [];
  private confirmIndex = 0;

  // State
  private selectedIndex = 0;
  private menuState: MenuState = 'slot-select';
  private slotMetadata: SaveSlotMetadata[] = [];
  private selectedSlotForNewGame = -1;
  private slotToDelete = -1;

  // Input context
  private inputContext: InputContext | null = null;

  constructor(game: Game) {
    super();
    this.game = game;
  }

  // ==========================================================================
  // Scene Lifecycle
  // ==========================================================================

  override async onEnter(): Promise<void> {
    // Load save slot metadata
    await this.loadSlotMetadata();

    // Build UI
    this.createUI();

    // Register and enable input context
    this.setupInputContext();
    this.game.inputManager.enableContext(INPUT_CONTEXT_ID);

    console.log('[MainMenuScene] Entered');
  }

  override onExit(): void {
    // Disable input context
    this.game.inputManager.disableContext(INPUT_CONTEXT_ID);
    console.log('[MainMenuScene] Exited');
  }

  override onUpdate(deltaMs: number): void {
    // Update cursor blink for name input
    if (this.menuState === 'name-input') {
      this.cursorBlinkTimer += deltaMs;
      if (this.cursorBlinkTimer >= 500) {
        this.cursorBlinkTimer = 0;
        this.cursorVisible = !this.cursorVisible;
        if (this.nameInputCursor) {
          this.nameInputCursor.visible = this.cursorVisible;
        }
      }
    }
  }

  override onDestroy(): void {
    // Unregister input context
    this.game.inputManager.unregisterContext(INPUT_CONTEXT_ID);
    super.onDestroy();
    console.log('[MainMenuScene] Destroyed');
  }

  // ==========================================================================
  // Data Loading
  // ==========================================================================

  /**
   * Load save slot metadata from the save manager.
   */
  private async loadSlotMetadata(): Promise<void> {
    this.slotMetadata = await this.game.saveManager.getAllSlotMetadata();
  }

  // ==========================================================================
  // UI Creation
  // ==========================================================================

  /**
   * Create the main menu UI.
   */
  private createUI(): void {
    const centerX = this.game.renderer.width / 2;

    // Title
    this.titleText = new Text({
      text: 'HACKER INCREMENTAL',
      style: titleStyle,
    });
    this.titleText.anchor.set(0.5, 0);
    this.titleText.x = centerX;
    this.titleText.y = 80;
    this.container.addChild(this.titleText);

    // Version
    this.versionText = new Text({
      text: 'v2.0.0',
      style: terminalSmallStyle,
    });
    this.versionText.anchor.set(0.5, 0);
    this.versionText.x = centerX;
    this.versionText.y = 130;
    this.container.addChild(this.versionText);

    // Build menu items from slot metadata
    this.buildMenuItems();

    // Cursor indicator
    this.cursorText = new Text({
      text: '>',
      style: terminalBrightStyle,
    });
    this.container.addChild(this.cursorText);

    // Hint text at bottom
    this.hintText = new Text({
      text: '[UP/DOWN] Navigate  [ENTER] Select  [DEL] Delete Save',
      style: terminalSmallStyle,
    });
    this.hintText.anchor.set(0.5, 0);
    this.hintText.x = centerX;
    this.hintText.y = this.game.renderer.height - 40;
    this.container.addChild(this.hintText);

    // Update display
    this.updateMenuDisplay();

    // Create hidden containers for other states
    this.createNameInputUI();
    this.createConfirmDeleteUI();
  }

  /**
   * Build menu items from slot metadata.
   */
  private buildMenuItems(): void {
    // Clear existing menu items
    for (const item of this.menuItems) {
      this.container.removeChild(item);
      item.destroy();
    }
    this.menuItems = [];
    this.menuData = [];

    const centerX = this.game.renderer.width / 2;

    // Create menu items for each slot
    for (let i = 0; i < this.game.config.storage.maxSlots; i++) {
      const metadata = this.slotMetadata[i];
      let label: string;
      let subLabel: string | undefined;
      const enabled = true;

      if (metadata && !metadata.isEmpty) {
        // Existing save
        label = `[Slot ${i + 1}] ${metadata.playerName || 'Unnamed'}`;
        subLabel = `Last played: ${this.formatTimestamp(metadata.lastPlayed)}`;
      } else {
        // Empty slot
        label = `[Slot ${i + 1}] Empty - New Game`;
        subLabel = undefined;
      }

      const menuItem: MenuItem = {
        id: `slot-${i}`,
        label,
        enabled,
        slotIndex: i,
      };
      if (subLabel !== undefined) {
        menuItem.subLabel = subLabel;
      }
      this.menuData.push(menuItem);
    }

    // Create text elements for menu items
    for (let i = 0; i < this.menuData.length; i++) {
      const item = this.menuData[i];
      if (!item) {continue;}

      // Main label
      const text = new Text({
        text: item.label,
        style: terminalStyle,
      });
      text.anchor.set(0.5, 0);
      text.x = centerX;
      text.y = MENU_START_Y + i * MENU_ITEM_HEIGHT;
      this.container.addChild(text);
      this.menuItems.push(text);

      // Sub label if present
      if (item.subLabel) {
        const subText = new Text({
          text: item.subLabel,
          style: terminalSmallStyle,
        });
        subText.anchor.set(0.5, 0);
        subText.x = centerX;
        subText.y = MENU_START_Y + i * MENU_ITEM_HEIGHT + 20;
        this.container.addChild(subText);
        // Store reference for potential cleanup (attached to main text as child data)
      }
    }
  }

  /**
   * Create the name input UI (hidden by default).
   */
  private createNameInputUI(): void {
    const centerX = this.game.renderer.width / 2;
    const centerY = this.game.renderer.height / 2;

    this.nameInputContainer = new Container();
    this.nameInputContainer.visible = false;
    this.container.addChild(this.nameInputContainer);

    // Background panel
    const bg = new Graphics();
    bg.fill({ color: COLORS.BACKGROUND, alpha: 0.95 });
    bg.rect(centerX - 200, centerY - 80, 400, 160);
    bg.fill();
    bg.stroke({ color: COLORS.TERMINAL_GREEN, width: 2 });
    bg.rect(centerX - 200, centerY - 80, 400, 160);
    bg.stroke();
    this.nameInputContainer.addChild(bg);

    // Prompt
    this.namePromptText = new Text({
      text: 'Enter your hacker alias:',
      style: promptStyle,
    });
    this.namePromptText.anchor.set(0.5, 0);
    this.namePromptText.x = centerX;
    this.namePromptText.y = centerY - 50;
    this.nameInputContainer.addChild(this.namePromptText);

    // Input field background
    const inputBg = new Graphics();
    inputBg.fill({ color: 0x111111 });
    inputBg.rect(centerX - 150, centerY - 10, 300, 40);
    inputBg.fill();
    inputBg.stroke({ color: COLORS.TERMINAL_DIM, width: 1 });
    inputBg.rect(centerX - 150, centerY - 10, 300, 40);
    inputBg.stroke();
    this.nameInputContainer.addChild(inputBg);

    // Input text
    this.nameInputText = new Text({
      text: '_',
      style: terminalBrightStyle,
    });
    this.nameInputText.x = centerX - 140;
    this.nameInputText.y = centerY;
    this.nameInputContainer.addChild(this.nameInputText);

    // Cursor
    this.nameInputCursor = new Graphics();
    this.nameInputCursor.fill({ color: COLORS.TERMINAL_BRIGHT });
    this.nameInputCursor.rect(0, 0, 2, 20);
    this.nameInputCursor.fill();
    this.nameInputCursor.x = centerX - 140;
    this.nameInputCursor.y = centerY;
    this.nameInputContainer.addChild(this.nameInputCursor);

    // Hint
    const hint = new Text({
      text: '[ENTER] Confirm  [ESC] Cancel',
      style: terminalSmallStyle,
    });
    hint.anchor.set(0.5, 0);
    hint.x = centerX;
    hint.y = centerY + 50;
    this.nameInputContainer.addChild(hint);
  }

  /**
   * Create the confirm delete UI (hidden by default).
   */
  private createConfirmDeleteUI(): void {
    const centerX = this.game.renderer.width / 2;
    const centerY = this.game.renderer.height / 2;

    this.confirmContainer = new Container();
    this.confirmContainer.visible = false;
    this.container.addChild(this.confirmContainer);

    // Background panel
    const bg = new Graphics();
    bg.fill({ color: COLORS.BACKGROUND, alpha: 0.95 });
    bg.rect(centerX - 200, centerY - 80, 400, 160);
    bg.fill();
    bg.stroke({ color: COLORS.TERMINAL_RED, width: 2 });
    bg.rect(centerX - 200, centerY - 80, 400, 160);
    bg.stroke();
    this.confirmContainer.addChild(bg);

    // Confirm text
    this.confirmText = new Text({
      text: 'Delete this save?',
      style: {
        ...terminalStyle,
        fill: COLORS.TERMINAL_RED,
      },
    });
    this.confirmText.anchor.set(0.5, 0);
    this.confirmText.x = centerX;
    this.confirmText.y = centerY - 40;
    this.confirmContainer.addChild(this.confirmText);

    // Options
    const yesText = new Text({
      text: '[ Yes, Delete ]',
      style: terminalStyle,
    });
    yesText.anchor.set(0.5, 0);
    yesText.x = centerX - 80;
    yesText.y = centerY + 10;
    this.confirmContainer.addChild(yesText);
    this.confirmOptions.push(yesText);

    const noText = new Text({
      text: '[ No, Cancel ]',
      style: terminalStyle,
    });
    noText.anchor.set(0.5, 0);
    noText.x = centerX + 80;
    noText.y = centerY + 10;
    this.confirmContainer.addChild(noText);
    this.confirmOptions.push(noText);
  }

  // ==========================================================================
  // UI Updates
  // ==========================================================================

  /**
   * Update the menu display based on current selection.
   */
  private updateMenuDisplay(): void {
    if (this.menuState !== 'slot-select') {return;}

    const centerX = this.game.renderer.width / 2;

    for (let i = 0; i < this.menuItems.length; i++) {
      const text = this.menuItems[i];
      const item = this.menuData[i];
      if (!text || !item) {continue;}

      if (i === this.selectedIndex) {
        text.style = terminalBrightStyle;
      } else if (!item.enabled) {
        text.style = terminalDimStyle;
      } else {
        text.style = terminalStyle;
      }
    }

    // Update cursor position
    if (this.cursorText) {
      const selectedItem = this.menuItems[this.selectedIndex];
      if (selectedItem) {
        this.cursorText.x = centerX - selectedItem.width / 2 - 30;
        this.cursorText.y = MENU_START_Y + this.selectedIndex * MENU_ITEM_HEIGHT;
      }
    }
  }

  /**
   * Update the name input display.
   */
  private updateNameInputDisplay(): void {
    if (!this.nameInputText || !this.nameInputCursor) {return;}

    this.nameInputText.text = this.nameInputValue || '_';

    // Update cursor position
    this.nameInputCursor.x = this.nameInputText.x + this.nameInputText.width + 2;
  }

  /**
   * Update the confirm delete display.
   */
  private updateConfirmDisplay(): void {
    for (let i = 0; i < this.confirmOptions.length; i++) {
      const text = this.confirmOptions[i];
      if (!text) {continue;}

      if (i === this.confirmIndex) {
        text.style = terminalBrightStyle;
      } else {
        text.style = terminalStyle;
      }
    }
  }

  // ==========================================================================
  // Input Handling
  // ==========================================================================

  /**
   * Set up the input context for this scene.
   */
  private setupInputContext(): void {
    const bindings = new Map<string, InputBinding>();

    // Navigation
    bindings.set('ArrowUp', { onPress: () => this.handleUp() });
    bindings.set('ArrowDown', { onPress: () => this.handleDown() });
    bindings.set('KeyW', { onPress: () => this.handleUp() });
    bindings.set('KeyS', { onPress: () => this.handleDown() });

    // Selection
    bindings.set('Enter', { onPress: () => this.handleSelect() });
    bindings.set('Space', { onPress: () => this.handleSelect() });

    // Cancel / Back
    bindings.set('Escape', { onPress: () => this.handleCancel() });

    // Delete
    bindings.set('Delete', { onPress: () => this.handleDelete() });
    bindings.set('Backspace', { onPress: () => this.handleBackspace() });

    // Left/Right for confirm dialog
    bindings.set('ArrowLeft', { onPress: () => this.handleLeft() });
    bindings.set('ArrowRight', { onPress: () => this.handleRight() });
    bindings.set('KeyA', { onPress: () => this.handleLeft() });
    bindings.set('KeyD', { onPress: () => this.handleRight() });

    this.inputContext = {
      id: INPUT_CONTEXT_ID,
      priority: INPUT_PRIORITY.SCENE,
      enabled: false,
      blocksPropagation: true,
      bindings,
    };

    this.game.inputManager.registerContext(this.inputContext);

    // Also listen for text input for name entry
    this.setupTextInputListener();
  }

  /**
   * Set up keyboard listener for text input during name entry.
   */
  private setupTextInputListener(): void {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (this.menuState !== 'name-input') {return;}

      // Handle printable characters
      if (event.key.length === 1 && !event.ctrlKey && !event.metaKey) {
        // Limit name length
        if (this.nameInputValue.length < 16) {
          this.nameInputValue += event.key;
          this.updateNameInputDisplay();
        }
        event.preventDefault();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    // Store cleanup function
    const originalDestroy = this.onDestroy.bind(this);
    this.onDestroy = (): void => {
      window.removeEventListener('keydown', handleKeyDown);
      originalDestroy();
    };
  }

  /**
   * Handle up navigation.
   */
  private handleUp(): void {
    if (this.menuState === 'slot-select') {
      this.selectedIndex =
        (this.selectedIndex - 1 + this.menuData.length) % this.menuData.length;
      this.updateMenuDisplay();
    }
  }

  /**
   * Handle down navigation.
   */
  private handleDown(): void {
    if (this.menuState === 'slot-select') {
      this.selectedIndex = (this.selectedIndex + 1) % this.menuData.length;
      this.updateMenuDisplay();
    }
  }

  /**
   * Handle left navigation (for confirm dialog).
   */
  private handleLeft(): void {
    if (this.menuState === 'confirm-delete') {
      this.confirmIndex = 0;
      this.updateConfirmDisplay();
    }
  }

  /**
   * Handle right navigation (for confirm dialog).
   */
  private handleRight(): void {
    if (this.menuState === 'confirm-delete') {
      this.confirmIndex = 1;
      this.updateConfirmDisplay();
    }
  }

  /**
   * Handle selection (Enter/Space).
   */
  private handleSelect(): void {
    switch (this.menuState) {
      case 'slot-select':
        this.selectSlot();
        break;
      case 'name-input':
        void this.confirmNameInput();
        break;
      case 'confirm-delete':
        void this.confirmDelete();
        break;
    }
  }

  /**
   * Handle cancel (Escape).
   */
  private handleCancel(): void {
    switch (this.menuState) {
      case 'name-input':
        this.cancelNameInput();
        break;
      case 'confirm-delete':
        this.cancelDelete();
        break;
    }
  }

  /**
   * Handle delete key.
   */
  private handleDelete(): void {
    if (this.menuState === 'slot-select') {
      const item = this.menuData[this.selectedIndex];
      if (!item) {return;}

      const metadata = this.slotMetadata[item.slotIndex ?? -1];
      if (metadata && !metadata.isEmpty) {
        this.showConfirmDelete(item.slotIndex ?? 0);
      }
    }
  }

  /**
   * Handle backspace key.
   */
  private handleBackspace(): void {
    if (this.menuState === 'name-input') {
      // Remove last character
      this.nameInputValue = this.nameInputValue.slice(0, -1);
      this.updateNameInputDisplay();
    } else if (this.menuState === 'slot-select') {
      // Same as delete
      this.handleDelete();
    }
  }

  // ==========================================================================
  // Actions
  // ==========================================================================

  /**
   * Select the current slot.
   */
  private selectSlot(): void {
    const item = this.menuData[this.selectedIndex];
    if (!item || item.slotIndex === undefined) {return;}

    const metadata = this.slotMetadata[item.slotIndex];

    if (metadata && !metadata.isEmpty) {
      // Load existing save
      void this.loadGame(item.slotIndex);
    } else {
      // Start new game - show name input
      this.showNameInput(item.slotIndex);
    }
  }

  /**
   * Show the name input dialog.
   */
  private showNameInput(slotIndex: number): void {
    this.selectedSlotForNewGame = slotIndex;
    this.nameInputValue = '';
    this.menuState = 'name-input';

    if (this.nameInputContainer) {
      this.nameInputContainer.visible = true;
    }
    if (this.cursorText) {
      this.cursorText.visible = false;
    }

    this.updateNameInputDisplay();
  }

  /**
   * Confirm name input and start new game.
   */
  private async confirmNameInput(): Promise<void> {
    const name = this.nameInputValue.trim() || 'Anonymous';

    console.log(`[MainMenuScene] Starting new game as '${name}' in slot ${this.selectedSlotForNewGame}`);

    // Start new game via save manager
    const result = await this.game.saveManager.startNewGame(
      this.selectedSlotForNewGame,
      name
    );

    if (result.success) {
      // Transition to apartment scene (or placeholder for now)
      await this.transitionToGame();
    } else {
      console.error('[MainMenuScene] Failed to start new game:', result.error);
    }
  }

  /**
   * Cancel name input and return to slot select.
   */
  private cancelNameInput(): void {
    this.menuState = 'slot-select';
    this.selectedSlotForNewGame = -1;

    if (this.nameInputContainer) {
      this.nameInputContainer.visible = false;
    }
    if (this.cursorText) {
      this.cursorText.visible = true;
    }
  }

  /**
   * Load an existing game.
   */
  private async loadGame(slotIndex: number): Promise<void> {
    console.log(`[MainMenuScene] Loading game from slot ${slotIndex}`);

    const result = await this.game.saveManager.load(slotIndex);

    if (result.success) {
      console.log(`[MainMenuScene] Loaded successfully (${result.secondsSinceLastPlay}s since last play)`);

      // Prepare offline progress (will show modal after scene transition if needed)
      this.game.prepareOfflineProgress();

      await this.transitionToGame();
    } else {
      console.error('[MainMenuScene] Failed to load game:', result.error);
    }
  }

  /**
   * Show the confirm delete dialog.
   */
  private showConfirmDelete(slotIndex: number): void {
    this.slotToDelete = slotIndex;
    this.confirmIndex = 1; // Default to "No"
    this.menuState = 'confirm-delete';

    const metadata = this.slotMetadata[slotIndex];
    if (this.confirmText && metadata) {
      this.confirmText.text = `Delete save "${metadata.playerName || 'Unnamed'}"?`;
    }

    if (this.confirmContainer) {
      this.confirmContainer.visible = true;
    }
    if (this.cursorText) {
      this.cursorText.visible = false;
    }

    this.updateConfirmDisplay();
  }

  /**
   * Confirm the delete action.
   */
  private async confirmDelete(): Promise<void> {
    if (this.confirmIndex === 0) {
      // Yes, delete
      console.log(`[MainMenuScene] Deleting slot ${this.slotToDelete}`);
      await this.game.saveManager.deleteSlot(this.slotToDelete);

      // Reload slot metadata and rebuild menu
      await this.loadSlotMetadata();
      this.buildMenuItems();
      this.updateMenuDisplay();
    }

    this.cancelDelete();
  }

  /**
   * Cancel the delete dialog.
   */
  private cancelDelete(): void {
    this.menuState = 'slot-select';
    this.slotToDelete = -1;

    if (this.confirmContainer) {
      this.confirmContainer.visible = false;
    }
    if (this.cursorText) {
      this.cursorText.visible = true;
    }
  }

  /**
   * Transition to the game (apartment scene).
   */
  private async transitionToGame(): Promise<void> {
    console.log('[MainMenuScene] Transitioning to apartment scene');
    console.log('[MainMenuScene] Game state:', {
      playerName: this.game.store.getState().playerName,
      money: this.game.store.getState().resources.money,
    });

    // Switch to the apartment scene
    await this.game.switchScene('apartment');
  }

  // ==========================================================================
  // Helpers
  // ==========================================================================

  /**
   * Format a timestamp for display.
   */
  private formatTimestamp(timestamp: number): string {
    if (timestamp === 0) {return 'Never';}

    const now = Date.now();
    const diff = now - timestamp;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {return `${days}d ago`;}
    if (hours > 0) {return `${hours}h ago`;}
    if (minutes > 0) {return `${minutes}m ago`;}
    return 'Just now';
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a new MainMenuScene instance.
 *
 * @param game - The game instance
 * @returns A new MainMenuScene
 */
export function createMainMenuScene(game: Game): MainMenuScene {
  return new MainMenuScene(game);
}
