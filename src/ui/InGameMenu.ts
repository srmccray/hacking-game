/**
 * In-Game Menu (Pause Menu) Component
 *
 * Provides pause menu functionality during gameplay, allowing players to:
 * - Resume the game
 * - Save the game
 * - Access settings (placeholder)
 * - Return to main menu
 *
 * Features:
 * - Triggered by Escape key from apartment scene
 * - Keyboard navigation with arrow keys
 * - Uses InputManager context with MENU priority
 * - Auto-saves before exiting to main menu
 * - Confirm dialog for exit action
 *
 * Usage:
 *   import { InGameMenu } from './InGameMenu';
 *
 *   const menu = new InGameMenu(game);
 *   game.renderer.root.addChild(menu.container);
 *   menu.show();
 */

import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import type { Game } from '../game/Game';
import type { InputContext } from '../input/InputManager';
import { INPUT_PRIORITY } from '../input/InputManager';
import { COLORS } from '../rendering/Renderer';
import {
  titleStyle,
  terminalStyle,
  terminalDimStyle,
  terminalBrightStyle,
  terminalSmallStyle,
  FONT_FAMILY,
} from '../rendering/styles';

// ============================================================================
// Configuration
// ============================================================================

const LAYOUT = {
  /** Menu width */
  MENU_WIDTH: 360,
  /** Menu height */
  MENU_HEIGHT: 320,
  /** Padding inside menu */
  PADDING: 24,
  /** Height of each menu item */
  ITEM_HEIGHT: 40,
  /** Header height */
  HEADER_HEIGHT: 50,
  /** Z-index for menu (below modals, above scene) */
  Z_INDEX: 900,
};

// ============================================================================
// Types
// ============================================================================

/**
 * Menu item definition.
 */
interface MenuItem {
  id: string;
  label: string;
  enabled: boolean;
  action: () => void | Promise<void>;
}

/**
 * Menu state.
 */
type MenuState = 'main' | 'confirm-exit';

// ============================================================================
// InGameMenu Class
// ============================================================================

/**
 * In-game pause menu component.
 */
export class InGameMenu {
  /** Root container for the menu */
  readonly container: Container;

  /** Reference to the game instance */
  private readonly game: Game;

  /** Whether the menu is currently visible */
  private visible = false;

  /** Current menu state */
  private menuState: MenuState = 'main';

  /** Input context for keyboard handling */
  private inputContext: InputContext | null = null;

  /** Current selected menu item index */
  private selectedIndex = 0;

  /** Menu items */
  private readonly menuItems: MenuItem[];

  /** Text elements for menu items */
  private menuTexts: Text[] = [];

  /** Feedback text element */
  private feedbackText: Text | null = null;

  /** Feedback timeout ID */
  private feedbackTimeoutId: ReturnType<typeof setTimeout> | null = null;

  /** Confirm dialog container */
  private confirmContainer: Container | null = null;

  /** Confirm dialog selection (0 = yes, 1 = no) */
  private confirmSelectedIndex = 1;

  /** Confirm dialog text elements */
  private confirmTexts: Text[] = [];

  /**
   * Create a new InGameMenu.
   *
   * @param game - The game instance
   */
  constructor(game: Game) {
    this.game = game;
    this.container = new Container();
    this.container.label = 'in-game-menu';
    this.container.visible = false;
    this.container.zIndex = LAYOUT.Z_INDEX;

    // Initialize menu items
    this.menuItems = this.buildMenuItems();
  }

  // ==========================================================================
  // Menu Item Definitions
  // ==========================================================================

  /**
   * Build the menu items array.
   */
  private buildMenuItems(): MenuItem[] {
    return [
      {
        id: 'resume',
        label: 'Resume',
        enabled: true,
        action: () => this.handleResume(),
      },
      {
        id: 'save',
        label: 'Save Game',
        enabled: true,
        action: () => this.handleSaveGame(),
      },
      {
        id: 'settings',
        label: 'Settings',
        enabled: false, // Placeholder for future
        action: () => this.handleSettings(),
      },
      {
        id: 'exit',
        label: 'Exit to Main Menu',
        enabled: true,
        action: () => this.handleExitToMainMenu(),
      },
    ];
  }

  // ==========================================================================
  // Public API
  // ==========================================================================

  /**
   * Show the in-game menu.
   */
  show(): void {
    if (this.visible) {
      return;
    }

    this.visible = true;
    this.menuState = 'main';
    this.selectedIndex = 0;

    // Clear and rebuild content
    this.container.removeChildren();
    this.menuTexts = [];
    this.confirmTexts = [];
    this.confirmContainer = null;

    // Create menu UI
    this.createMenu();

    // Register input context
    this.registerInputContext();

    // Make visible
    this.container.visible = true;

    // Enable sorting on parent for z-index
    if (this.container.parent) {
      this.container.parent.sortableChildren = true;
    }

    console.log('[InGameMenu] Shown');
  }

  /**
   * Hide the in-game menu.
   */
  hide(): void {
    if (!this.visible) {
      return;
    }

    this.visible = false;
    this.container.visible = false;

    // Clear feedback timeout
    if (this.feedbackTimeoutId) {
      clearTimeout(this.feedbackTimeoutId);
      this.feedbackTimeoutId = null;
    }

    // Disable and unregister input context
    if (this.inputContext) {
      this.game.inputManager.disableContext(this.inputContext.id);
      this.game.inputManager.unregisterContext(this.inputContext.id);
      this.inputContext = null;
    }

    // Clear content
    this.container.removeChildren();
    this.menuTexts = [];
    this.confirmTexts = [];
    this.confirmContainer = null;

    console.log('[InGameMenu] Hidden');
  }

  /**
   * Toggle menu visibility.
   */
  toggle(): void {
    if (this.visible) {
      this.hide();
    } else {
      this.show();
    }
  }

  /**
   * Check if the menu is currently visible.
   */
  isVisible(): boolean {
    return this.visible;
  }

  /**
   * Destroy the menu and clean up resources.
   */
  destroy(): void {
    this.hide();
    this.container.destroy({ children: true });
  }

  // ==========================================================================
  // Menu Creation
  // ==========================================================================

  /**
   * Create the menu UI.
   */
  private createMenu(): void {
    const width = this.game.config.canvas.width;
    const height = this.game.config.canvas.height;

    // Dark overlay
    const overlay = new Graphics();
    overlay.fill({ color: 0x000000, alpha: 0.75 });
    overlay.rect(0, 0, width, height);
    overlay.fill();
    overlay.eventMode = 'static';
    overlay.cursor = 'default';
    // Clicking overlay does nothing (menu stays open)
    this.container.addChild(overlay);

    // Menu box position
    const menuX = (width - LAYOUT.MENU_WIDTH) / 2;
    const menuY = (height - LAYOUT.MENU_HEIGHT) / 2;

    // Menu background
    const menuBg = new Graphics();
    menuBg.fill({ color: 0x0a0a0a, alpha: 0.95 });
    menuBg.roundRect(menuX, menuY, LAYOUT.MENU_WIDTH, LAYOUT.MENU_HEIGHT, 4);
    menuBg.fill();

    // Outer border
    menuBg.stroke({ color: COLORS.TERMINAL_DIM, width: 1 });
    menuBg.roundRect(menuX, menuY, LAYOUT.MENU_WIDTH, LAYOUT.MENU_HEIGHT, 4);
    menuBg.stroke();

    // Inner border
    menuBg.stroke({ color: COLORS.TERMINAL_GREEN, width: 1 });
    menuBg.roundRect(menuX + 4, menuY + 4, LAYOUT.MENU_WIDTH - 8, LAYOUT.MENU_HEIGHT - 8, 2);
    menuBg.stroke();

    // Corner accents
    const accentSize = 12;
    menuBg.stroke({ color: COLORS.TERMINAL_GREEN, width: 2 });

    // Top-left
    menuBg.moveTo(menuX, menuY + accentSize);
    menuBg.lineTo(menuX, menuY);
    menuBg.lineTo(menuX + accentSize, menuY);
    menuBg.stroke();

    // Top-right
    menuBg.moveTo(menuX + LAYOUT.MENU_WIDTH - accentSize, menuY);
    menuBg.lineTo(menuX + LAYOUT.MENU_WIDTH, menuY);
    menuBg.lineTo(menuX + LAYOUT.MENU_WIDTH, menuY + accentSize);
    menuBg.stroke();

    // Bottom-left
    menuBg.moveTo(menuX, menuY + LAYOUT.MENU_HEIGHT - accentSize);
    menuBg.lineTo(menuX, menuY + LAYOUT.MENU_HEIGHT);
    menuBg.lineTo(menuX + accentSize, menuY + LAYOUT.MENU_HEIGHT);
    menuBg.stroke();

    // Bottom-right
    menuBg.moveTo(menuX + LAYOUT.MENU_WIDTH - accentSize, menuY + LAYOUT.MENU_HEIGHT);
    menuBg.lineTo(menuX + LAYOUT.MENU_WIDTH, menuY + LAYOUT.MENU_HEIGHT);
    menuBg.lineTo(menuX + LAYOUT.MENU_WIDTH, menuY + LAYOUT.MENU_HEIGHT - accentSize);
    menuBg.stroke();

    menuBg.eventMode = 'static'; // Prevent clicks from passing through
    this.container.addChild(menuBg);

    // Title
    const title = new Text({
      text: 'PAUSED',
      style: titleStyle,
    });
    title.anchor.set(0.5, 0);
    title.x = menuX + LAYOUT.MENU_WIDTH / 2;
    title.y = menuY + LAYOUT.PADDING;
    this.container.addChild(title);

    // Divider below title
    const divider = new Graphics();
    const dividerY = menuY + LAYOUT.HEADER_HEIGHT;
    divider.stroke({ color: COLORS.TERMINAL_DIM, width: 1, alpha: 0.6 });
    divider.moveTo(menuX + LAYOUT.PADDING, dividerY);
    divider.lineTo(menuX + LAYOUT.MENU_WIDTH - LAYOUT.PADDING, dividerY);
    divider.stroke();
    this.container.addChild(divider);

    // Menu items
    const menuStartY = menuY + LAYOUT.HEADER_HEIGHT + 20;

    for (let i = 0; i < this.menuItems.length; i++) {
      const item = this.menuItems[i];
      if (!item) {continue;}

      const itemText = this.createMenuItemText(item, i, menuX, menuStartY);
      this.menuTexts.push(itemText);
      this.container.addChild(itemText);
    }

    // Update selection visual
    this.updateMenuSelection();

    // Hint text (shortened to fit menu width)
    const hint = new Text({
      text: 'Esc: Close  |  Arrows / Enter',
      style: terminalSmallStyle,
    });
    hint.anchor.set(0.5, 0);
    hint.x = menuX + LAYOUT.MENU_WIDTH / 2;
    hint.y = menuY + LAYOUT.MENU_HEIGHT - 30;
    this.container.addChild(hint);

    // Feedback text (initially hidden)
    this.feedbackText = new Text({
      text: '',
      style: new TextStyle({
        fontFamily: FONT_FAMILY,
        fontSize: 14,
        fill: COLORS.TERMINAL_BRIGHT,
      }),
    });
    this.feedbackText.anchor.set(0.5, 0);
    this.feedbackText.x = width / 2;
    this.feedbackText.y = menuY + LAYOUT.MENU_HEIGHT + 20;
    this.feedbackText.visible = false;
    this.container.addChild(this.feedbackText);

    // Create confirm dialog (hidden by default)
    this.createConfirmDialog();
  }

  /**
   * Create a menu item text element.
   */
  private createMenuItemText(item: MenuItem, index: number, menuX: number, startY: number): Text {
    const isSelected = index === this.selectedIndex;

    let style: TextStyle;
    if (!item.enabled) {
      style = terminalDimStyle;
    } else if (isSelected) {
      style = terminalBrightStyle;
    } else {
      style = terminalStyle;
    }

    const prefix = isSelected ? '> ' : '  ';
    const suffix = !item.enabled ? ' (Coming Soon)' : '';
    const label = prefix + item.label + suffix;

    const text = new Text({
      text: label,
      style,
    });
    text.anchor.set(0.5, 0);
    text.x = menuX + LAYOUT.MENU_WIDTH / 2;
    text.y = startY + index * LAYOUT.ITEM_HEIGHT;

    // Make enabled items interactive
    if (item.enabled) {
      text.eventMode = 'static';
      text.cursor = 'pointer';

      text.on('pointerdown', () => {
        this.selectedIndex = index;
        this.updateMenuSelection();
        void this.executeSelectedItem();
      });

      text.on('pointerover', () => {
        if (this.selectedIndex !== index) {
          this.selectedIndex = index;
          this.updateMenuSelection();
        }
      });
    }

    return text;
  }

  /**
   * Create the confirm exit dialog (hidden by default).
   */
  private createConfirmDialog(): void {
    const width = this.game.config.canvas.width;
    const height = this.game.config.canvas.height;

    this.confirmContainer = new Container();
    this.confirmContainer.label = 'confirm-dialog';
    this.confirmContainer.visible = false;
    this.confirmContainer.zIndex = 150;
    this.container.addChild(this.confirmContainer);

    // Overlay to block main menu interaction
    const overlay = new Graphics();
    overlay.fill({ color: 0x000000, alpha: 0.5 });
    overlay.rect(0, 0, width, height);
    overlay.fill();
    overlay.eventMode = 'static';
    this.confirmContainer.addChild(overlay);

    // Dialog box
    const boxWidth = 320;
    const boxHeight = 150;
    const boxX = (width - boxWidth) / 2;
    const boxY = (height - boxHeight) / 2;

    const box = new Graphics();
    box.fill({ color: 0x0a0a0a, alpha: 0.98 });
    box.roundRect(boxX, boxY, boxWidth, boxHeight, 4);
    box.fill();
    box.stroke({ color: COLORS.TERMINAL_DIM, width: 1 });
    box.roundRect(boxX, boxY, boxWidth, boxHeight, 4);
    box.stroke();
    box.stroke({ color: COLORS.TERMINAL_GREEN, width: 1 });
    box.roundRect(boxX + 4, boxY + 4, boxWidth - 8, boxHeight - 8, 2);
    box.stroke();
    box.eventMode = 'static';
    this.confirmContainer.addChild(box);

    // Title - use smaller font to fit within dialog width (320px box - 40px padding = 280px max)
    const dialogTitleStyle = new TextStyle({
      fontFamily: FONT_FAMILY,
      fontSize: 20, // Smaller than titleStyle (32px) to fit within dialog
      fill: COLORS.TERMINAL_GREEN,
      fontWeight: 'bold',
      dropShadow: {
        alpha: 0.7,
        blur: 4,
        color: COLORS.TERMINAL_BRIGHT,
        distance: 0,
      },
    });
    const title = new Text({
      text: 'EXIT TO MAIN MENU?',
      style: dialogTitleStyle,
    });
    title.anchor.set(0.5, 0);
    title.x = width / 2;
    title.y = boxY + 20;
    this.confirmContainer.addChild(title);

    // Message
    const message = new Text({
      text: 'Your game will be saved.',
      style: terminalStyle,
    });
    message.anchor.set(0.5, 0);
    message.x = width / 2;
    message.y = boxY + 55;
    this.confirmContainer.addChild(message);

    // Yes option
    const yesText = new Text({
      text: '  [ YES ]',
      style: terminalStyle,
    });
    yesText.anchor.set(0.5, 0);
    yesText.x = boxX + boxWidth / 3;
    yesText.y = boxY + boxHeight - 55;
    yesText.eventMode = 'static';
    yesText.cursor = 'pointer';
    yesText.on('pointerdown', () => void this.confirmExit());
    yesText.on('pointerover', () => {
      this.confirmSelectedIndex = 0;
      this.updateConfirmSelection();
    });
    this.confirmContainer.addChild(yesText);
    this.confirmTexts.push(yesText);

    // No option
    const noText = new Text({
      text: '> [ NO ]',
      style: terminalBrightStyle,
    });
    noText.anchor.set(0.5, 0);
    noText.x = boxX + (boxWidth * 2) / 3;
    noText.y = boxY + boxHeight - 55;
    noText.eventMode = 'static';
    noText.cursor = 'pointer';
    noText.on('pointerdown', () => this.cancelConfirm());
    noText.on('pointerover', () => {
      this.confirmSelectedIndex = 1;
      this.updateConfirmSelection();
    });
    this.confirmContainer.addChild(noText);
    this.confirmTexts.push(noText);

    // Hint (shortened to fit dialog width)
    const hint = new Text({
      text: 'Y/N or Arrows + Enter',
      style: terminalSmallStyle,
    });
    hint.anchor.set(0.5, 0);
    hint.x = width / 2;
    hint.y = boxY + boxHeight - 25;
    this.confirmContainer.addChild(hint);
  }

  // ==========================================================================
  // UI Updates
  // ==========================================================================

  /**
   * Update menu item selection visuals.
   */
  private updateMenuSelection(): void {
    for (let i = 0; i < this.menuTexts.length; i++) {
      const text = this.menuTexts[i];
      const item = this.menuItems[i];
      if (!text || !item) {continue;}

      const isSelected = i === this.selectedIndex;
      const prefix = isSelected ? '> ' : '  ';
      const suffix = !item.enabled ? ' (Coming Soon)' : '';

      text.text = prefix + item.label + suffix;

      if (!item.enabled) {
        text.style = terminalDimStyle;
      } else if (isSelected) {
        text.style = terminalBrightStyle;
      } else {
        text.style = terminalStyle;
      }
    }
  }

  /**
   * Update confirm dialog selection visuals.
   */
  private updateConfirmSelection(): void {
    const yesText = this.confirmTexts[0];
    const noText = this.confirmTexts[1];

    if (yesText) {
      if (this.confirmSelectedIndex === 0) {
        yesText.text = '> [ YES ]';
        yesText.style = terminalBrightStyle;
      } else {
        yesText.text = '  [ YES ]';
        yesText.style = terminalStyle;
      }
    }

    if (noText) {
      if (this.confirmSelectedIndex === 1) {
        noText.text = '> [ NO ]';
        noText.style = terminalBrightStyle;
      } else {
        noText.text = '  [ NO ]';
        noText.style = terminalStyle;
      }
    }
  }

  /**
   * Show feedback message.
   */
  private showFeedback(message: string, isError = false): void {
    if (!this.feedbackText) {return;}

    // Clear existing timeout
    if (this.feedbackTimeoutId) {
      clearTimeout(this.feedbackTimeoutId);
    }

    this.feedbackText.text = message;
    this.feedbackText.style.fill = isError ? COLORS.TERMINAL_RED : COLORS.TERMINAL_BRIGHT;
    this.feedbackText.visible = true;

    // Auto-hide after 2 seconds
    this.feedbackTimeoutId = setTimeout(() => {
      if (this.feedbackText) {
        this.feedbackText.visible = false;
      }
      this.feedbackTimeoutId = null;
    }, 2000);
  }

  // ==========================================================================
  // Input Handling
  // ==========================================================================

  /**
   * Register the input context for this menu.
   */
  private registerInputContext(): void {
    const bindings = new Map<string, { onPress?: () => void }>();

    // Navigation
    bindings.set('ArrowUp', { onPress: () => this.handleUp() });
    bindings.set('ArrowDown', { onPress: () => this.handleDown() });
    bindings.set('KeyW', { onPress: () => this.handleUp() });
    bindings.set('KeyS', { onPress: () => this.handleDown() });

    // Left/Right for confirm dialog
    bindings.set('ArrowLeft', { onPress: () => this.handleLeft() });
    bindings.set('ArrowRight', { onPress: () => this.handleRight() });
    bindings.set('KeyA', { onPress: () => this.handleLeft() });
    bindings.set('KeyD', { onPress: () => this.handleRight() });

    // Selection
    bindings.set('Enter', { onPress: () => this.handleSelect() });
    bindings.set('Space', { onPress: () => this.handleSelect() });

    // Close / Cancel
    bindings.set('Escape', { onPress: () => this.handleEscape() });

    // Quick keys for confirm
    bindings.set('KeyY', { onPress: () => this.handleQuickYes() });
    bindings.set('KeyN', { onPress: () => this.handleQuickNo() });

    this.inputContext = {
      id: 'in-game-menu',
      priority: INPUT_PRIORITY.MENU,
      enabled: true,
      blocksPropagation: true,
      bindings,
    };

    this.game.inputManager.registerContext(this.inputContext);
    this.game.inputManager.enableContext('in-game-menu');
  }

  /**
   * Handle up navigation.
   */
  private handleUp(): void {
    if (this.menuState === 'main') {
      this.selectedIndex = (this.selectedIndex - 1 + this.menuItems.length) % this.menuItems.length;
      this.updateMenuSelection();
    }
  }

  /**
   * Handle down navigation.
   */
  private handleDown(): void {
    if (this.menuState === 'main') {
      this.selectedIndex = (this.selectedIndex + 1) % this.menuItems.length;
      this.updateMenuSelection();
    }
  }

  /**
   * Handle left navigation (confirm dialog).
   */
  private handleLeft(): void {
    if (this.menuState === 'confirm-exit') {
      this.confirmSelectedIndex = 0;
      this.updateConfirmSelection();
    }
  }

  /**
   * Handle right navigation (confirm dialog).
   */
  private handleRight(): void {
    if (this.menuState === 'confirm-exit') {
      this.confirmSelectedIndex = 1;
      this.updateConfirmSelection();
    }
  }

  /**
   * Handle selection (Enter/Space).
   */
  private handleSelect(): void {
    if (this.menuState === 'main') {
      void this.executeSelectedItem();
    } else if (this.menuState === 'confirm-exit') {
      if (this.confirmSelectedIndex === 0) {
        void this.confirmExit();
      } else {
        this.cancelConfirm();
      }
    }
  }

  /**
   * Handle escape key.
   */
  private handleEscape(): void {
    if (this.menuState === 'confirm-exit') {
      this.cancelConfirm();
    } else {
      this.hide();
    }
  }

  /**
   * Handle quick Y key for confirm.
   */
  private handleQuickYes(): void {
    if (this.menuState === 'confirm-exit') {
      void this.confirmExit();
    }
  }

  /**
   * Handle quick N key for confirm.
   */
  private handleQuickNo(): void {
    if (this.menuState === 'confirm-exit') {
      this.cancelConfirm();
    }
  }

  // ==========================================================================
  // Menu Actions
  // ==========================================================================

  /**
   * Execute the currently selected menu item.
   */
  private async executeSelectedItem(): Promise<void> {
    const item = this.menuItems[this.selectedIndex];
    if (item?.enabled) {
      await item.action();
    }
  }

  /**
   * Handle Resume action.
   */
  private handleResume(): void {
    console.log('[InGameMenu] Resume selected');
    this.hide();
  }

  /**
   * Handle Save Game action.
   */
  private async handleSaveGame(): Promise<void> {
    console.log('[InGameMenu] Save Game selected');

    const result = await this.game.saveManager.quickSave();

    if (result.success) {
      this.showFeedback('Game Saved!');
    } else {
      this.showFeedback('Save Failed!', true);
    }
  }

  /**
   * Handle Settings action (placeholder).
   */
  private handleSettings(): void {
    console.log('[InGameMenu] Settings selected (Coming Soon)');
    this.showFeedback('Coming Soon...');
  }

  /**
   * Handle Exit to Main Menu action.
   */
  private handleExitToMainMenu(): void {
    console.log('[InGameMenu] Exit to Main Menu selected');
    this.showConfirmDialog();
  }

  /**
   * Show the confirm exit dialog.
   */
  private showConfirmDialog(): void {
    this.menuState = 'confirm-exit';
    this.confirmSelectedIndex = 1; // Default to "No"

    if (this.confirmContainer) {
      this.confirmContainer.visible = true;
    }

    this.updateConfirmSelection();
  }

  /**
   * Cancel the confirm dialog.
   */
  private cancelConfirm(): void {
    this.menuState = 'main';

    if (this.confirmContainer) {
      this.confirmContainer.visible = false;
    }
  }

  /**
   * Confirm exit to main menu.
   */
  private async confirmExit(): Promise<void> {
    console.log('[InGameMenu] Exit confirmed');

    // Save the game before exiting
    await this.game.saveManager.quickSave();

    // Close the menu
    this.hide();

    // Transition to main menu
    await this.game.switchScene('main-menu');
  }
}
