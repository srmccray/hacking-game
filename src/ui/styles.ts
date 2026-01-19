/**
 * Shared TextStyles for the Hacker Incremental Game
 *
 * This module provides consistent text styling across the game UI,
 * maintaining the terminal/hacker aesthetic with glow effects.
 *
 * Usage:
 *   import { createTerminalText, STYLES } from '@ui/styles';
 *
 *   const text = createTerminalText('Hello, hacker!', STYLES.primary);
 */

import { Text, TextStyle } from 'pixi.js';
import {
  TERMINAL_GREEN,
  TERMINAL_DIM,
  TERMINAL_BRIGHT,
  TERMINAL_RED,
  colorToHex,
} from './renderer';

// ============================================================================
// Font Configuration
// ============================================================================

/**
 * Primary monospace font stack.
 * Falls back through common monospace fonts for cross-platform support.
 */
export const MONOSPACE_FONT = '"IBM Plex Mono", "Consolas", "Monaco", "Lucida Console", monospace';

/**
 * Default font size for UI text.
 */
export const DEFAULT_FONT_SIZE = 16;

/**
 * Large font size for headers.
 */
export const LARGE_FONT_SIZE = 24;

/**
 * Small font size for secondary info.
 */
export const SMALL_FONT_SIZE = 12;

// ============================================================================
// TextStyle Definitions
// ============================================================================

/**
 * Create the terminal glow drop shadow effect.
 *
 * @param color - The glow color as hex number
 * @param intensity - Glow intensity (0-1, default 0.8)
 * @returns Drop shadow configuration object for PixiJS 8.x
 */
function createGlowShadow(color: number, intensity: number = 0.8) {
  return {
    dropShadow: {
      color: colorToHex(color),
      blur: 4,
      alpha: intensity,
      distance: 0,
    },
  };
}

/**
 * Primary terminal text style (green with glow).
 * Use for main text, resource values, etc.
 */
export const primaryStyle = new TextStyle({
  fontFamily: MONOSPACE_FONT,
  fontSize: DEFAULT_FONT_SIZE,
  fill: colorToHex(TERMINAL_GREEN),
  ...createGlowShadow(TERMINAL_GREEN),
});

/**
 * Dimmed terminal text style (darker green).
 * Use for labels, secondary information.
 */
export const dimStyle = new TextStyle({
  fontFamily: MONOSPACE_FONT,
  fontSize: DEFAULT_FONT_SIZE,
  fill: colorToHex(TERMINAL_DIM),
  ...createGlowShadow(TERMINAL_DIM, 0.5),
});

/**
 * Bright/highlighted terminal text style.
 * Use for emphasis, active selections.
 */
export const brightStyle = new TextStyle({
  fontFamily: MONOSPACE_FONT,
  fontSize: DEFAULT_FONT_SIZE,
  fill: colorToHex(TERMINAL_BRIGHT),
  ...createGlowShadow(TERMINAL_BRIGHT),
});

/**
 * Header text style (larger, bright).
 * Use for section headers, titles.
 */
export const headerStyle = new TextStyle({
  fontFamily: MONOSPACE_FONT,
  fontSize: LARGE_FONT_SIZE,
  fill: colorToHex(TERMINAL_GREEN),
  fontWeight: 'bold',
  ...createGlowShadow(TERMINAL_GREEN),
});

/**
 * Small text style for secondary info.
 * Use for rates, timestamps, hints.
 */
export const smallStyle = new TextStyle({
  fontFamily: MONOSPACE_FONT,
  fontSize: SMALL_FONT_SIZE,
  fill: colorToHex(TERMINAL_DIM),
  ...createGlowShadow(TERMINAL_DIM, 0.4),
});

/**
 * Error/warning text style (red).
 * Use for errors, warnings, negative values.
 */
export const errorStyle = new TextStyle({
  fontFamily: MONOSPACE_FONT,
  fontSize: DEFAULT_FONT_SIZE,
  fill: colorToHex(TERMINAL_RED),
  ...createGlowShadow(TERMINAL_RED),
});

/**
 * Value text style for resource numbers.
 * Bright green, slightly larger for emphasis.
 */
export const valueStyle = new TextStyle({
  fontFamily: MONOSPACE_FONT,
  fontSize: 18,
  fill: colorToHex(TERMINAL_BRIGHT),
  fontWeight: 'bold',
  ...createGlowShadow(TERMINAL_GREEN),
});

/**
 * Label text style for resource labels.
 * Dimmer than values to create visual hierarchy.
 */
export const labelStyle = new TextStyle({
  fontFamily: MONOSPACE_FONT,
  fontSize: 14,
  fill: colorToHex(TERMINAL_DIM),
  ...createGlowShadow(TERMINAL_DIM, 0.4),
});

/**
 * Rate text style for per-second rates.
 * Small and dim to not distract from main values.
 */
export const rateStyle = new TextStyle({
  fontFamily: MONOSPACE_FONT,
  fontSize: 11,
  fill: colorToHex(TERMINAL_DIM),
  ...createGlowShadow(TERMINAL_DIM, 0.3),
});

// ============================================================================
// Convenience Export
// ============================================================================

/**
 * All styles grouped for easy access.
 */
export const STYLES = {
  primary: primaryStyle,
  dim: dimStyle,
  bright: brightStyle,
  header: headerStyle,
  small: smallStyle,
  error: errorStyle,
  value: valueStyle,
  label: labelStyle,
  rate: rateStyle,
} as const;

// ============================================================================
// Text Creation Utilities
// ============================================================================

/**
 * Create a Text object with a terminal-styled TextStyle.
 *
 * @param content - The text content
 * @param style - The TextStyle to use (from STYLES)
 * @returns A new Text object
 */
export function createTerminalText(
  content: string,
  style: TextStyle = primaryStyle
): Text {
  return new Text({
    text: content,
    style,
  });
}

/**
 * Create a Text object positioned at specific coordinates.
 *
 * @param content - The text content
 * @param x - X position
 * @param y - Y position
 * @param style - The TextStyle to use
 * @returns A new positioned Text object
 */
export function createPositionedText(
  content: string,
  x: number,
  y: number,
  style: TextStyle = primaryStyle
): Text {
  const text = createTerminalText(content, style);
  text.x = x;
  text.y = y;
  return text;
}

/**
 * Clone a TextStyle with optional modifications.
 *
 * @param baseStyle - The style to clone
 * @param modifications - Properties to override
 * @returns A new TextStyle
 */
export function cloneStyle(
  baseStyle: TextStyle,
  modifications: Partial<TextStyle> = {}
): TextStyle {
  return new TextStyle({
    ...baseStyle,
    ...modifications,
  });
}
