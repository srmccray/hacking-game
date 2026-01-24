/**
 * Welcome Back Modal Component
 *
 * Displays when a player returns after being away, showing them
 * the resources earned through offline progression.
 *
 * Features:
 * - Terminal-styled modal overlay
 * - Shows time away (with capped indicator if exceeded 8 hours)
 * - Displays earnings with proper formatting
 * - Click or press any key to dismiss
 * - Uses InputManager with DIALOG priority
 *
 * Usage:
 *   import { WelcomeBackModal } from './WelcomeBackModal';
 *
 *   const modal = new WelcomeBackModal(game);
 *   modal.show(offlineProgressResult, () => {
 *     applyOfflineProgress(store, result);
 *   });
 */

import { Container, Graphics, Text } from 'pixi.js';
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
import { formatResource } from '../core/resources/resource-manager';
import type { OfflineProgressResult } from '../core/progression/offline-progress';

// ============================================================================
// Configuration
// ============================================================================

const LAYOUT = {
  /** Modal width */
  MODAL_WIDTH: 400,
  /** Modal height */
  MODAL_HEIGHT: 320,
  /** Padding inside modal */
  PADDING: 24,
  /** Line height for content */
  LINE_HEIGHT: 28,
  /** Z-index for modal (above everything) */
  Z_INDEX: 1000,
};

// ============================================================================
// WelcomeBackModal Class
// ============================================================================

/**
 * Modal component for displaying offline progress.
 */
export class WelcomeBackModal {
  /** Root container for the modal */
  readonly container: Container;

  /** Reference to the game instance */
  private readonly game: Game;

  /** Whether the modal is currently visible */
  private visible = false;

  /** Input context for capturing all input */
  private inputContext: InputContext | null = null;

  /** Callback to run when modal is dismissed */
  private onDismissCallback: (() => void) | null = null;

  /** Interval ID for pulsing animation */
  private pulseIntervalId: ReturnType<typeof setInterval> | null = null;

  /** Reference to the dismiss hint text for pulsing */
  private dismissHintText: Text | null = null;

  /**
   * Create a new WelcomeBackModal.
   *
   * @param game - The game instance
   */
  constructor(game: Game) {
    this.game = game;
    this.container = new Container();
    this.container.label = 'welcome-back-modal';
    this.container.visible = false;
    this.container.zIndex = LAYOUT.Z_INDEX;
  }

  // ==========================================================================
  // Public API
  // ==========================================================================

  /**
   * Show the welcome back modal with offline progress results.
   *
   * @param result - The offline progress calculation result
   * @param onDismiss - Callback to run when modal is dismissed
   */
  show(result: OfflineProgressResult, onDismiss: () => void): void {
    if (this.visible) {
      return;
    }

    this.onDismissCallback = onDismiss;
    this.visible = true;

    // Clear any existing content
    this.container.removeChildren();

    // Create modal content
    this.createModal(result);

    // Register input context
    this.registerInputContext();

    // Start pulse animation
    this.startPulseAnimation();

    // Make visible
    this.container.visible = true;

    // Enable sorting on parent for z-index
    if (this.container.parent) {
      this.container.parent.sortableChildren = true;
    }

    console.log('[WelcomeBackModal] Shown');
  }

  /**
   * Hide and reset the modal.
   */
  hide(): void {
    if (!this.visible) {
      return;
    }

    this.visible = false;
    this.container.visible = false;

    // Stop pulse animation
    this.stopPulseAnimation();

    // Disable and unregister input context
    if (this.inputContext) {
      this.game.inputManager.disableContext(this.inputContext.id);
      this.game.inputManager.unregisterContext(this.inputContext.id);
      this.inputContext = null;
    }

    // Run callback
    if (this.onDismissCallback) {
      const callback = this.onDismissCallback;
      this.onDismissCallback = null;
      callback();
    }

    // Clear content
    this.container.removeChildren();

    console.log('[WelcomeBackModal] Hidden');
  }

  /**
   * Check if the modal is currently visible.
   */
  isVisible(): boolean {
    return this.visible;
  }

  /**
   * Destroy the modal and clean up resources.
   */
  destroy(): void {
    this.hide();
    this.container.destroy({ children: true });
  }

  // ==========================================================================
  // Modal Creation
  // ==========================================================================

  /**
   * Create the modal UI.
   */
  private createModal(result: OfflineProgressResult): void {
    const width = this.game.config.canvas.width;
    const height = this.game.config.canvas.height;

    // Dark overlay
    const overlay = new Graphics();
    overlay.fill({ color: 0x000000, alpha: 0.85 });
    overlay.rect(0, 0, width, height);
    overlay.fill();
    overlay.eventMode = 'static';
    overlay.cursor = 'pointer';
    overlay.on('pointerdown', () => this.hide());
    this.container.addChild(overlay);

    // Modal box position
    const modalX = (width - LAYOUT.MODAL_WIDTH) / 2;
    const modalY = (height - LAYOUT.MODAL_HEIGHT) / 2;

    // Modal background
    const modalBg = new Graphics();
    modalBg.fill({ color: 0x0a0a0a, alpha: 0.95 });
    modalBg.roundRect(modalX, modalY, LAYOUT.MODAL_WIDTH, LAYOUT.MODAL_HEIGHT, 4);
    modalBg.fill();

    // Outer border
    modalBg.stroke({ color: COLORS.TERMINAL_DIM, width: 1 });
    modalBg.roundRect(modalX, modalY, LAYOUT.MODAL_WIDTH, LAYOUT.MODAL_HEIGHT, 4);
    modalBg.stroke();

    // Inner border
    modalBg.stroke({ color: COLORS.TERMINAL_GREEN, width: 1 });
    modalBg.roundRect(modalX + 4, modalY + 4, LAYOUT.MODAL_WIDTH - 8, LAYOUT.MODAL_HEIGHT - 8, 2);
    modalBg.stroke();

    // Corner accents
    const accentSize = 16;
    modalBg.stroke({ color: COLORS.TERMINAL_GREEN, width: 2 });

    // Top-left
    modalBg.moveTo(modalX, modalY + accentSize);
    modalBg.lineTo(modalX, modalY);
    modalBg.lineTo(modalX + accentSize, modalY);
    modalBg.stroke();

    // Top-right
    modalBg.moveTo(modalX + LAYOUT.MODAL_WIDTH - accentSize, modalY);
    modalBg.lineTo(modalX + LAYOUT.MODAL_WIDTH, modalY);
    modalBg.lineTo(modalX + LAYOUT.MODAL_WIDTH, modalY + accentSize);
    modalBg.stroke();

    // Bottom-left
    modalBg.moveTo(modalX, modalY + LAYOUT.MODAL_HEIGHT - accentSize);
    modalBg.lineTo(modalX, modalY + LAYOUT.MODAL_HEIGHT);
    modalBg.lineTo(modalX + accentSize, modalY + LAYOUT.MODAL_HEIGHT);
    modalBg.stroke();

    // Bottom-right
    modalBg.moveTo(modalX + LAYOUT.MODAL_WIDTH - accentSize, modalY + LAYOUT.MODAL_HEIGHT);
    modalBg.lineTo(modalX + LAYOUT.MODAL_WIDTH, modalY + LAYOUT.MODAL_HEIGHT);
    modalBg.lineTo(modalX + LAYOUT.MODAL_WIDTH, modalY + LAYOUT.MODAL_HEIGHT - accentSize);
    modalBg.stroke();

    modalBg.eventMode = 'static'; // Prevent clicks from passing through
    this.container.addChild(modalBg);

    // Content positioning
    const contentX = modalX + LAYOUT.PADDING;
    const contentY = modalY + LAYOUT.PADDING;
    const contentWidth = LAYOUT.MODAL_WIDTH - LAYOUT.PADDING * 2;

    let currentY = contentY;

    // Title
    const title = new Text({
      text: 'WELCOME BACK',
      style: titleStyle,
    });
    title.anchor.set(0.5, 0);
    title.x = modalX + LAYOUT.MODAL_WIDTH / 2;
    title.y = currentY;
    this.container.addChild(title);
    currentY += LAYOUT.LINE_HEIGHT + 8;

    // Divider
    const divider = new Graphics();
    divider.stroke({ color: COLORS.TERMINAL_DIM, width: 1, alpha: 0.6 });
    divider.moveTo(contentX, currentY);
    divider.lineTo(contentX + contentWidth, currentY);
    divider.stroke();
    this.container.addChild(divider);
    currentY += LAYOUT.LINE_HEIGHT - 4;

    // Time away label
    const timeLabel = new Text({
      text: 'Time away:',
      style: terminalDimStyle,
    });
    timeLabel.x = contentX;
    timeLabel.y = currentY;
    this.container.addChild(timeLabel);

    // Time away value (right-anchored to prevent overflow)
    let timeText = result.formattedTimeAway;
    if (result.wasCapped) {
      timeText += ' (max 8h)';
    }
    const timeValue = new Text({
      text: timeText,
      style: terminalStyle,
    });
    timeValue.anchor.set(1, 0);
    timeValue.x = contentX + contentWidth;
    timeValue.y = currentY;
    this.container.addChild(timeValue);
    currentY += LAYOUT.LINE_HEIGHT;

    // Efficiency label
    const effLabel = new Text({
      text: 'Efficiency:',
      style: terminalDimStyle,
    });
    effLabel.x = contentX;
    effLabel.y = currentY;
    this.container.addChild(effLabel);

    // Efficiency value (right-anchored to prevent overflow)
    const effValue = new Text({
      text: `${Math.round(result.efficiency * 100)}%`,
      style: terminalSmallStyle,
    });
    effValue.anchor.set(1, 0);
    effValue.x = contentX + contentWidth;
    effValue.y = currentY + 2;
    this.container.addChild(effValue);
    currentY += LAYOUT.LINE_HEIGHT + 8;

    // Earnings header
    const earningsHeader = new Text({
      text: 'RESOURCES EARNED',
      style: {
        fontFamily: FONT_FAMILY,
        fontSize: 12,
        fill: COLORS.TERMINAL_DIM,
      },
    });
    earningsHeader.x = contentX;
    earningsHeader.y = currentY;
    this.container.addChild(earningsHeader);
    currentY += LAYOUT.LINE_HEIGHT - 6;

    // Money earned
    const moneyLabel = new Text({
      text: 'Money:',
      style: terminalStyle,
    });
    moneyLabel.x = contentX;
    moneyLabel.y = currentY;
    this.container.addChild(moneyLabel);

    // Money value (right-anchored to prevent overflow with large numbers)
    const moneyValue = new Text({
      text: formatResource('money', result.earnings.money),
      style: terminalBrightStyle,
    });
    moneyValue.anchor.set(1, 0);
    moneyValue.x = contentX + contentWidth;
    moneyValue.y = currentY;
    this.container.addChild(moneyValue);
    currentY += LAYOUT.LINE_HEIGHT + 16;

    // Bottom divider
    const divider2 = new Graphics();
    divider2.stroke({ color: COLORS.TERMINAL_DIM, width: 1, alpha: 0.4 });
    divider2.moveTo(contentX, currentY);
    divider2.lineTo(contentX + contentWidth, currentY);
    divider2.stroke();
    this.container.addChild(divider2);
    currentY += LAYOUT.LINE_HEIGHT - 8;

    // Dismiss hint
    this.dismissHintText = new Text({
      text: '[ Press any key or click to continue ]',
      style: terminalSmallStyle,
    });
    this.dismissHintText.anchor.set(0.5, 0);
    this.dismissHintText.x = modalX + LAYOUT.MODAL_WIDTH / 2;
    this.dismissHintText.y = currentY;
    this.container.addChild(this.dismissHintText);
  }

  // ==========================================================================
  // Input Handling
  // ==========================================================================

  /**
   * Register the input context for this modal.
   * Uses DIALOG priority to block all other input.
   */
  private registerInputContext(): void {
    // Build bindings that dismiss on any key
    const bindings = new Map<string, { onPress?: () => void }>();

    // Common keys that might be pressed
    const keysToCapture = [
      'Enter', 'Space', 'Escape',
      'KeyA', 'KeyB', 'KeyC', 'KeyD', 'KeyE', 'KeyF', 'KeyG', 'KeyH', 'KeyI',
      'KeyJ', 'KeyK', 'KeyL', 'KeyM', 'KeyN', 'KeyO', 'KeyP', 'KeyQ', 'KeyR',
      'KeyS', 'KeyT', 'KeyU', 'KeyV', 'KeyW', 'KeyX', 'KeyY', 'KeyZ',
      'Digit0', 'Digit1', 'Digit2', 'Digit3', 'Digit4',
      'Digit5', 'Digit6', 'Digit7', 'Digit8', 'Digit9',
      'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
    ];

    for (const key of keysToCapture) {
      bindings.set(key, { onPress: () => this.hide() });
    }

    this.inputContext = {
      id: 'welcome-back-modal',
      priority: INPUT_PRIORITY.DIALOG,
      enabled: true,
      blocksPropagation: true,
      bindings,
    };

    this.game.inputManager.registerContext(this.inputContext);
    this.game.inputManager.enableContext('welcome-back-modal');
  }

  // ==========================================================================
  // Animations
  // ==========================================================================

  /**
   * Start the pulsing animation for the dismiss hint.
   */
  private startPulseAnimation(): void {
    let pulseDirection = 1;
    let pulseAlpha = 0.6;

    this.pulseIntervalId = setInterval(() => {
      if (!this.dismissHintText || !this.visible) {
        this.stopPulseAnimation();
        return;
      }

      pulseAlpha += pulseDirection * 0.02;
      if (pulseAlpha >= 1) {
        pulseDirection = -1;
      } else if (pulseAlpha <= 0.4) {
        pulseDirection = 1;
      }
      this.dismissHintText.alpha = pulseAlpha;
    }, 50);
  }

  /**
   * Stop the pulsing animation.
   */
  private stopPulseAnimation(): void {
    if (this.pulseIntervalId) {
      clearInterval(this.pulseIntervalId);
      this.pulseIntervalId = null;
    }
  }
}
