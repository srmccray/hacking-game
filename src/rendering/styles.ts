/**
 * Text Style Presets for the Terminal Aesthetic
 *
 * These styles are designed for PixiJS 8.x Text components and follow
 * the hacker/terminal visual theme.
 *
 * Important: PixiJS 8.x uses nested object format for dropShadow.
 *
 * Usage:
 *   import { terminalStyle, titleStyle } from './styles';
 *   const text = new Text({ text: 'Hello', style: terminalStyle });
 */

import { TextStyle } from 'pixi.js';
import { COLORS } from './Renderer';

// ============================================================================
// Font Configuration
// ============================================================================

/**
 * Default font family for terminal text.
 * Monospace ensures consistent character width for the ASCII aesthetic.
 */
export const FONT_FAMILY = '"Courier New", Courier, monospace';

/**
 * Standard font sizes used throughout the game.
 */
export const FONT_SIZES = {
  SMALL: 12,
  NORMAL: 16,
  MEDIUM: 20,
  LARGE: 24,
  TITLE: 32,
  HERO: 48,
} as const;

// ============================================================================
// Drop Shadow Configuration
// ============================================================================

/**
 * Standard glow effect for terminal text.
 */
const TERMINAL_GLOW = {
  alpha: 0.5,
  blur: 2,
  color: COLORS.TERMINAL_GREEN,
  distance: 0,
};

/**
 * Bright glow for highlighted text.
 */
const BRIGHT_GLOW = {
  alpha: 0.7,
  blur: 4,
  color: COLORS.TERMINAL_BRIGHT,
  distance: 0,
};

/**
 * No glow (for cleaner text).
 */
const NO_GLOW = {
  alpha: 0,
  blur: 0,
  color: 0x000000,
  distance: 0,
};

// ============================================================================
// Text Style Presets
// ============================================================================

/**
 * Standard terminal text style.
 * Use for regular body text, descriptions, etc.
 */
export const terminalStyle = new TextStyle({
  fontFamily: FONT_FAMILY,
  fontSize: FONT_SIZES.NORMAL,
  fill: COLORS.TERMINAL_GREEN,
  dropShadow: TERMINAL_GLOW,
});

/**
 * Small terminal text style.
 * Use for secondary information, hints, etc.
 */
export const terminalSmallStyle = new TextStyle({
  fontFamily: FONT_FAMILY,
  fontSize: FONT_SIZES.SMALL,
  fill: COLORS.TERMINAL_DIM,
  dropShadow: NO_GLOW,
});

/**
 * Dimmed terminal text style.
 * Use for inactive items, disabled options, etc.
 */
export const terminalDimStyle = new TextStyle({
  fontFamily: FONT_FAMILY,
  fontSize: FONT_SIZES.NORMAL,
  fill: COLORS.TERMINAL_DIM,
  dropShadow: NO_GLOW,
});

/**
 * Bright terminal text style.
 * Use for highlighted items, selections, important info.
 */
export const terminalBrightStyle = new TextStyle({
  fontFamily: FONT_FAMILY,
  fontSize: FONT_SIZES.NORMAL,
  fill: COLORS.TERMINAL_BRIGHT,
  dropShadow: BRIGHT_GLOW,
});

/**
 * Title text style.
 * Use for scene titles, major headings.
 */
export const titleStyle = new TextStyle({
  fontFamily: FONT_FAMILY,
  fontSize: FONT_SIZES.TITLE,
  fill: COLORS.TERMINAL_GREEN,
  fontWeight: 'bold',
  dropShadow: BRIGHT_GLOW,
});

/**
 * Hero text style.
 * Use for main game title, very large headings.
 */
export const heroStyle = new TextStyle({
  fontFamily: FONT_FAMILY,
  fontSize: FONT_SIZES.HERO,
  fill: COLORS.TERMINAL_GREEN,
  fontWeight: 'bold',
  dropShadow: {
    alpha: 0.8,
    blur: 6,
    color: COLORS.TERMINAL_GREEN,
    distance: 0,
  },
});

/**
 * HUD text style.
 * Use for resource counts, stats display.
 */
export const hudStyle = new TextStyle({
  fontFamily: FONT_FAMILY,
  fontSize: FONT_SIZES.MEDIUM,
  fill: COLORS.TERMINAL_GREEN,
  dropShadow: TERMINAL_GLOW,
});

/**
 * HUD label style.
 * Use for resource labels, stat names.
 */
export const hudLabelStyle = new TextStyle({
  fontFamily: FONT_FAMILY,
  fontSize: FONT_SIZES.SMALL,
  fill: COLORS.TERMINAL_DIM,
  dropShadow: NO_GLOW,
});

/**
 * Button text style (normal state).
 */
export const buttonStyle = new TextStyle({
  fontFamily: FONT_FAMILY,
  fontSize: FONT_SIZES.NORMAL,
  fill: COLORS.TERMINAL_GREEN,
  dropShadow: TERMINAL_GLOW,
});

/**
 * Button text style (highlighted/selected state).
 */
export const buttonHighlightStyle = new TextStyle({
  fontFamily: FONT_FAMILY,
  fontSize: FONT_SIZES.NORMAL,
  fill: COLORS.TERMINAL_BRIGHT,
  fontWeight: 'bold',
  dropShadow: BRIGHT_GLOW,
});

/**
 * Error/warning text style.
 */
export const errorStyle = new TextStyle({
  fontFamily: FONT_FAMILY,
  fontSize: FONT_SIZES.NORMAL,
  fill: COLORS.TERMINAL_RED,
  dropShadow: {
    alpha: 0.5,
    blur: 2,
    color: COLORS.TERMINAL_RED,
    distance: 0,
  },
});

/**
 * Success text style.
 */
export const successStyle = new TextStyle({
  fontFamily: FONT_FAMILY,
  fontSize: FONT_SIZES.NORMAL,
  fill: COLORS.TERMINAL_BRIGHT,
  dropShadow: BRIGHT_GLOW,
});

/**
 * Input prompt style (e.g., "> Enter name:").
 */
export const promptStyle = new TextStyle({
  fontFamily: FONT_FAMILY,
  fontSize: FONT_SIZES.NORMAL,
  fill: COLORS.TERMINAL_CYAN,
  dropShadow: {
    alpha: 0.5,
    blur: 2,
    color: COLORS.TERMINAL_CYAN,
    distance: 0,
  },
});

/**
 * Score/number display style.
 */
export const scoreStyle = new TextStyle({
  fontFamily: FONT_FAMILY,
  fontSize: FONT_SIZES.LARGE,
  fill: COLORS.TERMINAL_YELLOW,
  fontWeight: 'bold',
  dropShadow: {
    alpha: 0.6,
    blur: 3,
    color: COLORS.TERMINAL_YELLOW,
    distance: 0,
  },
});

/**
 * Combo multiplier style.
 */
export const comboStyle = new TextStyle({
  fontFamily: FONT_FAMILY,
  fontSize: FONT_SIZES.MEDIUM,
  fill: COLORS.TERMINAL_CYAN,
  fontWeight: 'bold',
  dropShadow: {
    alpha: 0.6,
    blur: 3,
    color: COLORS.TERMINAL_CYAN,
    distance: 0,
  },
});

// ============================================================================
// Style Factory Functions
// ============================================================================

/**
 * Create a custom terminal style with specific color.
 *
 * @param color - The text fill color
 * @param size - Font size (default: NORMAL)
 * @param withGlow - Whether to add terminal glow effect
 * @returns A new TextStyle instance
 */
export function createTerminalStyle(
  color: number,
  size: number = FONT_SIZES.NORMAL,
  withGlow: boolean = true
): TextStyle {
  return new TextStyle({
    fontFamily: FONT_FAMILY,
    fontSize: size,
    fill: color,
    dropShadow: withGlow
      ? {
          alpha: 0.5,
          blur: 2,
          color: color,
          distance: 0,
        }
      : NO_GLOW,
  });
}

/**
 * Clone a style with modified properties.
 *
 * @param baseStyle - The style to clone
 * @param overrides - Properties to override
 * @returns A new TextStyle instance
 */
export function cloneStyle(
  baseStyle: TextStyle,
  overrides: Partial<{
    fontSize: number;
    fill: number;
    fontWeight: string;
  }>
): TextStyle {
  const style = baseStyle.clone();

  if (overrides.fontSize !== undefined) {
    style.fontSize = overrides.fontSize;
  }
  if (overrides.fill !== undefined) {
    style.fill = overrides.fill;
  }
  if (overrides.fontWeight !== undefined) {
    style.fontWeight = overrides.fontWeight as 'normal' | 'bold';
  }

  return style;
}
