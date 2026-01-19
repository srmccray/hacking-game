/**
 * Welcome-Back Modal for the Hacker Incremental Game
 *
 * This modal displays when a player returns after being away for more than
 * 1 minute, showing them what resources they earned while offline.
 *
 * Features:
 * - Terminal-styled modal overlay
 * - Shows time away (with capped indicator if exceeded 8 hours)
 * - Displays earnings with proper formatting
 * - Click or press any key to dismiss
 * - Awards resources on dismiss
 *
 * Usage:
 *   import { showWelcomeBackModal, hideWelcomeBackModal } from '@ui/welcome-back-modal';
 *
 *   const result = calculateOfflineProgress(lastPlayed);
 *   if (result.shouldShowModal) {
 *     showWelcomeBackModal(result, () => {
 *       applyOfflineProgress(result);
 *       // Continue with game initialization
 *     });
 *   }
 */

import { Container, Graphics } from 'pixi.js';
import { getRootContainer, CANVAS_WIDTH, CANVAS_HEIGHT, TERMINAL_GREEN, TERMINAL_DIM } from './renderer';
import {
  createTerminalText,
  headerStyle,
  primaryStyle,
  dimStyle,
  valueStyle,
  smallStyle,
  cloneStyle,
} from './styles';
import { formatResource } from '../core/resource-manager';
import type { OfflineProgressResult } from '../core/offline-progress';

// ============================================================================
// Module State
// ============================================================================

let modalContainer: Container | null = null;
let onDismissCallback: (() => void) | null = null;
let keydownHandler: ((event: KeyboardEvent) => void) | null = null;

// ============================================================================
// Modal Configuration
// ============================================================================

const MODAL_WIDTH = 400;
const MODAL_HEIGHT = 300;
const MODAL_PADDING = 24;
const LINE_HEIGHT = 28;

// ============================================================================
// Modal Creation
// ============================================================================

/**
 * Create the modal background overlay (semi-transparent dark layer).
 */
function createOverlay(): Graphics {
  const overlay = new Graphics();
  overlay.fill({ color: 0x000000, alpha: 0.85 });
  overlay.rect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  overlay.fill();
  overlay.eventMode = 'static';
  overlay.cursor = 'pointer';
  return overlay;
}

/**
 * Create the modal box with terminal styling.
 */
function createModalBox(x: number, y: number): Graphics {
  const box = new Graphics();

  // Background
  box.fill({ color: 0x0a0a0a, alpha: 0.95 });
  box.roundRect(0, 0, MODAL_WIDTH, MODAL_HEIGHT, 4);
  box.fill();

  // Border
  box.stroke({ color: TERMINAL_DIM, width: 1 });
  box.roundRect(0, 0, MODAL_WIDTH, MODAL_HEIGHT, 4);
  box.stroke();

  // Double border inner line
  box.stroke({ color: TERMINAL_GREEN, width: 1 });
  box.roundRect(4, 4, MODAL_WIDTH - 8, MODAL_HEIGHT - 8, 2);
  box.stroke();

  // Corner accents (outer)
  const accentSize = 16;
  box.stroke({ color: TERMINAL_GREEN, width: 2 });

  // Top-left
  box.moveTo(0, accentSize);
  box.lineTo(0, 0);
  box.lineTo(accentSize, 0);
  box.stroke();

  // Top-right
  box.moveTo(MODAL_WIDTH - accentSize, 0);
  box.lineTo(MODAL_WIDTH, 0);
  box.lineTo(MODAL_WIDTH, accentSize);
  box.stroke();

  // Bottom-left
  box.moveTo(0, MODAL_HEIGHT - accentSize);
  box.lineTo(0, MODAL_HEIGHT);
  box.lineTo(accentSize, MODAL_HEIGHT);
  box.stroke();

  // Bottom-right
  box.moveTo(MODAL_WIDTH - accentSize, MODAL_HEIGHT);
  box.lineTo(MODAL_WIDTH, MODAL_HEIGHT);
  box.lineTo(MODAL_WIDTH, MODAL_HEIGHT - accentSize);
  box.stroke();

  box.x = x;
  box.y = y;

  return box;
}

/**
 * Create the modal content (text and earnings display).
 */
function createModalContent(
  result: OfflineProgressResult,
  contentX: number,
  contentY: number
): Container {
  const content = new Container();
  content.x = contentX;
  content.y = contentY;

  let currentY = 0;

  // Title
  const title = createTerminalText('WELCOME BACK', headerStyle);
  title.anchor.set(0.5, 0);
  title.x = (MODAL_WIDTH - MODAL_PADDING * 2) / 2;
  title.y = currentY;
  content.addChild(title);
  currentY += LINE_HEIGHT + 8;

  // Divider line
  const divider = new Graphics();
  divider.stroke({ color: TERMINAL_DIM, width: 1, alpha: 0.6 });
  divider.moveTo(0, currentY);
  divider.lineTo(MODAL_WIDTH - MODAL_PADDING * 2, currentY);
  divider.stroke();
  content.addChild(divider);
  currentY += LINE_HEIGHT - 4;

  // Time away label
  const timeLabel = createTerminalText('Time away:', dimStyle);
  timeLabel.y = currentY;
  content.addChild(timeLabel);

  // Time away value (with capped indicator if needed)
  let timeText = result.formattedTimeAway;
  if (result.wasCapped) {
    timeText += ' (max 8h)';
  }
  const timeValue = createTerminalText(timeText, primaryStyle);
  timeValue.x = 120;
  timeValue.y = currentY;
  content.addChild(timeValue);
  currentY += LINE_HEIGHT;

  // Efficiency label
  const effLabel = createTerminalText('Efficiency:', dimStyle);
  effLabel.y = currentY;
  content.addChild(effLabel);

  const effValue = createTerminalText('50%', smallStyle);
  effValue.x = 120;
  effValue.y = currentY + 2;
  content.addChild(effValue);
  currentY += LINE_HEIGHT + 8;

  // Earnings header
  const earningsHeader = createTerminalText('RESOURCES EARNED', cloneStyle(dimStyle, { fontSize: 12 }));
  earningsHeader.y = currentY;
  content.addChild(earningsHeader);
  currentY += LINE_HEIGHT - 6;

  // Money earned
  const moneyLabel = createTerminalText('Money:', primaryStyle);
  moneyLabel.y = currentY;
  content.addChild(moneyLabel);

  const moneyValue = createTerminalText(
    formatResource('money', result.earnings.money),
    valueStyle
  );
  moneyValue.x = 120;
  moneyValue.y = currentY - 2;
  content.addChild(moneyValue);
  currentY += LINE_HEIGHT + 16;

  // Divider before dismiss hint
  const divider2 = new Graphics();
  divider2.stroke({ color: TERMINAL_DIM, width: 1, alpha: 0.4 });
  divider2.moveTo(0, currentY);
  divider2.lineTo(MODAL_WIDTH - MODAL_PADDING * 2, currentY);
  divider2.stroke();
  content.addChild(divider2);
  currentY += LINE_HEIGHT - 8;

  // Dismiss hint
  const dismissHint = createTerminalText('[ Press any key or click to continue ]', smallStyle);
  dismissHint.anchor.set(0.5, 0);
  dismissHint.x = (MODAL_WIDTH - MODAL_PADDING * 2) / 2;
  dismissHint.y = currentY;
  content.addChild(dismissHint);

  // Add a subtle pulsing effect to the dismiss hint
  let pulseDirection = 1;
  let pulseAlpha = 0.6;
  const pulseInterval = setInterval(() => {
    if (!modalContainer) {
      clearInterval(pulseInterval);
      return;
    }
    pulseAlpha += pulseDirection * 0.02;
    if (pulseAlpha >= 1) {
      pulseDirection = -1;
    } else if (pulseAlpha <= 0.4) {
      pulseDirection = 1;
    }
    dismissHint.alpha = pulseAlpha;
  }, 50);

  return content;
}

// ============================================================================
// Event Handlers
// ============================================================================

/**
 * Handle click/tap to dismiss the modal.
 */
function handleDismiss(): void {
  hideWelcomeBackModal();
  if (onDismissCallback) {
    onDismissCallback();
    onDismissCallback = null;
  }
}

/**
 * Create keydown handler for dismissing the modal.
 */
function createKeydownHandler(): (event: KeyboardEvent) => void {
  return (_event: KeyboardEvent) => {
    handleDismiss();
  };
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Show the welcome-back modal with offline progress results.
 *
 * @param result - The offline progress calculation result
 * @param onDismiss - Callback to run when modal is dismissed
 */
export function showWelcomeBackModal(
  result: OfflineProgressResult,
  onDismiss: () => void
): void {
  // Clean up any existing modal
  if (modalContainer) {
    hideWelcomeBackModal();
  }

  onDismissCallback = onDismiss;

  // Create modal container
  modalContainer = new Container();
  modalContainer.label = 'welcome-back-modal';
  modalContainer.zIndex = 1000; // Ensure modal is on top

  // Create overlay
  const overlay = createOverlay();
  overlay.on('pointerdown', handleDismiss);
  modalContainer.addChild(overlay);

  // Calculate modal position (centered)
  const modalX = (CANVAS_WIDTH - MODAL_WIDTH) / 2;
  const modalY = (CANVAS_HEIGHT - MODAL_HEIGHT) / 2;

  // Create modal box
  const modalBox = createModalBox(modalX, modalY);
  modalBox.eventMode = 'static'; // Prevent clicks from passing through
  modalContainer.addChild(modalBox);

  // Create modal content
  const content = createModalContent(
    result,
    modalX + MODAL_PADDING,
    modalY + MODAL_PADDING
  );
  modalContainer.addChild(content);

  // Add to root container
  const rootContainer = getRootContainer();
  rootContainer.addChild(modalContainer);

  // Enable sorting so zIndex works
  rootContainer.sortableChildren = true;

  // Add keyboard listener
  keydownHandler = createKeydownHandler();
  window.addEventListener('keydown', keydownHandler);

  console.log('[WelcomeBackModal] Modal shown');
}

/**
 * Hide and destroy the welcome-back modal.
 */
export function hideWelcomeBackModal(): void {
  // Remove keyboard listener
  if (keydownHandler) {
    window.removeEventListener('keydown', keydownHandler);
    keydownHandler = null;
  }

  // Destroy modal container
  if (modalContainer) {
    modalContainer.destroy({ children: true });
    modalContainer = null;
  }

  console.log('[WelcomeBackModal] Modal hidden');
}

/**
 * Check if the welcome-back modal is currently visible.
 *
 * @returns true if the modal is visible
 */
export function isWelcomeBackModalVisible(): boolean {
  return modalContainer !== null;
}

/**
 * Destroy the welcome-back modal system.
 * Call this during cleanup (e.g., HMR).
 */
export function destroyWelcomeBackModal(): void {
  hideWelcomeBackModal();
  onDismissCallback = null;
}
