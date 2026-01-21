/**
 * Rendering system exports
 */

export { Renderer, COLORS } from './Renderer';

export {
  // Font configuration
  FONT_FAMILY,
  FONT_SIZES,
  // Text style presets
  terminalStyle,
  terminalSmallStyle,
  terminalDimStyle,
  terminalBrightStyle,
  titleStyle,
  heroStyle,
  hudStyle,
  hudLabelStyle,
  buttonStyle,
  buttonHighlightStyle,
  errorStyle,
  successStyle,
  promptStyle,
  scoreStyle,
  comboStyle,
  // Style factory functions
  createTerminalStyle,
  cloneStyle,
} from './styles';
