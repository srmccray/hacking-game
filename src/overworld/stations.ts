/**
 * Interactive Stations for the Apartment Overworld
 *
 * Stations are interactive objects in the apartment that the player can
 * interact with when nearby. Each station has a visual representation,
 * interaction zone, and callback for when activated.
 *
 * MVP Stations:
 * - Desk [D]: Launches Code Breaker minigame
 * - Couch [C]: Placeholder (post-MVP)
 * - Bed [B]: Placeholder (post-MVP)
 *
 * Usage:
 *   import { createStation, StationType, Station } from '@overworld/stations';
 *
 *   const desk = createStation('desk', 200, { onInteract: () => launchMinigame() });
 *   apartmentContainer.addChild(desk.container);
 */

import { Container, Text, Graphics, TextStyle } from 'pixi.js';
import { MONOSPACE_FONT } from '../ui/styles';
import { TERMINAL_GREEN, TERMINAL_DIM, TERMINAL_BRIGHT, colorToHex } from '../ui/renderer';

// ============================================================================
// Types
// ============================================================================

/** Available station types */
export type StationType = 'desk' | 'couch' | 'bed';

/** Station configuration */
export interface StationConfig {
  /** Callback when player interacts with this station */
  onInteract?: () => void;
  /** Whether the station is currently active/usable */
  enabled?: boolean;
}

/** A station instance */
export interface Station {
  /** The PixiJS container for this station */
  container: Container;
  /** Station type identifier */
  type: StationType;
  /** X position (center of station) */
  x: number;
  /** Width of the interaction zone */
  width: number;
  /** Whether the station is enabled */
  enabled: boolean;
  /** Update the interaction prompt visibility */
  showPrompt: (visible: boolean) => void;
  /** Trigger the station's interaction callback */
  interact: () => void;
  /** Update enabled state */
  setEnabled: (enabled: boolean) => void;
  /** Destroy the station */
  destroy: () => void;
}

// ============================================================================
// Station Visual Configuration
// ============================================================================

/** Configuration for each station type's appearance */
interface StationVisual {
  /** ASCII label displayed (e.g., "[D]") */
  label: string;
  /** Display name shown below */
  name: string;
  /** Width of the station graphic */
  width: number;
  /** Height of the station graphic */
  height: number;
  /** Whether this station is functional in MVP */
  functional: boolean;
  /** ASCII art representation */
  ascii: string[];
}

const STATION_VISUALS: Record<StationType, StationVisual> = {
  desk: {
    label: '[D]',
    name: 'DESK',
    width: 120,
    height: 80,
    functional: true,
    ascii: [
      '  ___________  ',
      ' |  MONITOR  | ',
      ' |___________| ',
      '[====DESK====] ',
    ],
  },
  couch: {
    label: '[C]',
    name: 'COUCH',
    width: 100,
    height: 60,
    functional: false,
    ascii: [
      '  _____  ',
      ' | TV  | ',
      ' |_____| ',
      '[=COUCH=]',
    ],
  },
  bed: {
    label: '[B]',
    name: 'BED',
    width: 90,
    height: 50,
    functional: false,
    ascii: [
      '[==BED==]',
    ],
  },
};

/** Interaction radius (how close player needs to be) */
export const INTERACTION_RADIUS = 60;

/** Floor Y position (where stations sit) */
export const FLOOR_Y = 420;

// ============================================================================
// Station Creation
// ============================================================================

/**
 * Create a new interactive station.
 *
 * @param type - The type of station to create
 * @param x - X position (center) in the apartment
 * @param config - Optional configuration
 * @returns A Station instance
 */
export function createStation(
  type: StationType,
  x: number,
  config: StationConfig = {}
): Station {
  const visual = STATION_VISUALS[type];
  const { onInteract, enabled = visual.functional } = config;

  const container = new Container();
  container.label = `station-${type}`;
  container.x = x;
  container.y = FLOOR_Y;

  // Create the ASCII art display
  const asciiContainer = createAsciiArt(visual, enabled);
  container.addChild(asciiContainer);

  // Create interaction prompt (hidden by default)
  const prompt = createInteractionPrompt(visual.functional);
  prompt.y = -visual.height - 60;
  prompt.visible = false;
  container.addChild(prompt);

  // Create the station object
  const station: Station = {
    container,
    type,
    x,
    width: visual.width,
    enabled,

    showPrompt(visible: boolean): void {
      prompt.visible = visible && station.enabled;
    },

    interact(): void {
      if (station.enabled && onInteract) {
        onInteract();
      }
    },

    setEnabled(newEnabled: boolean): void {
      station.enabled = newEnabled;
      // Update visual opacity based on enabled state
      asciiContainer.alpha = newEnabled ? 1 : 0.5;
    },

    destroy(): void {
      container.destroy({ children: true });
    },
  };

  // Set initial enabled state visual
  station.setEnabled(enabled);

  return station;
}

/**
 * Create the ASCII art representation of a station.
 */
function createAsciiArt(visual: StationVisual, enabled: boolean): Container {
  const container = new Container();
  container.label = 'ascii-art';

  // Determine style based on enabled state
  const textColor = enabled ? TERMINAL_GREEN : TERMINAL_DIM;
  const glowAlpha = enabled ? 0.8 : 0.3;

  const asciiStyle = new TextStyle({
    fontFamily: MONOSPACE_FONT,
    fontSize: 14,
    fill: colorToHex(textColor),
    dropShadow: {
      color: colorToHex(textColor),
      blur: 4,
      alpha: glowAlpha,
      distance: 0,
    },
  });

  // Render each line of ASCII art
  const lineHeight = 16;
  const totalHeight = visual.ascii.length * lineHeight;

  visual.ascii.forEach((line, index) => {
    const text = new Text({
      text: line,
      style: asciiStyle,
    });
    text.anchor.set(0.5, 0);
    text.y = -totalHeight + index * lineHeight;
    container.addChild(text);
  });

  return container;
}

/**
 * Create the interaction prompt shown when player is near.
 */
function createInteractionPrompt(functional: boolean): Container {
  const container = new Container();
  container.label = 'interaction-prompt';

  // Background box
  const bg = new Graphics();
  bg.fill({ color: 0x0a0a0a, alpha: 0.9 });
  bg.roundRect(-60, -15, 120, 30, 4);
  bg.fill();

  bg.stroke({ color: TERMINAL_GREEN, width: 1, alpha: 0.8 });
  bg.roundRect(-60, -15, 120, 30, 4);
  bg.stroke();
  container.addChild(bg);

  // Prompt text
  const promptText = functional
    ? '[ENTER] Interact'
    : 'Coming Soon';

  const shadowColor = functional ? TERMINAL_GREEN : TERMINAL_DIM;
  const promptStyle = new TextStyle({
    fontFamily: MONOSPACE_FONT,
    fontSize: 12,
    fill: functional ? colorToHex(TERMINAL_BRIGHT) : colorToHex(TERMINAL_DIM),
    dropShadow: {
      color: colorToHex(shadowColor),
      blur: 3,
      alpha: 0.6,
      distance: 0,
    },
  });

  const text = new Text({
    text: promptText,
    style: promptStyle,
  });
  text.anchor.set(0.5);
  container.addChild(text);

  return container;
}

// ============================================================================
// Station Manager
// ============================================================================

/**
 * Manages all stations in the apartment scene.
 */
export class StationManager {
  private stations: Station[] = [];
  private activeStation: Station | null = null;

  /**
   * Add a station to be managed.
   */
  addStation(station: Station): void {
    this.stations.push(station);
  }

  /**
   * Remove a station from management.
   */
  removeStation(station: Station): void {
    const index = this.stations.indexOf(station);
    if (index !== -1) {
      this.stations.splice(index, 1);
    }
    if (this.activeStation === station) {
      this.activeStation = null;
    }
  }

  /**
   * Update which station (if any) the player can interact with.
   *
   * @param playerX - Player's current X position
   * @returns The station the player can interact with, or null
   */
  updatePlayerPosition(playerX: number): Station | null {
    let closestStation: Station | null = null;
    let closestDistance = Infinity;

    // Find the closest station within interaction range
    for (const station of this.stations) {
      const distance = Math.abs(playerX - station.x);

      if (distance < INTERACTION_RADIUS && distance < closestDistance) {
        closestStation = station;
        closestDistance = distance;
      }
    }

    // Update prompt visibility
    for (const station of this.stations) {
      station.showPrompt(station === closestStation);
    }

    this.activeStation = closestStation;
    return closestStation;
  }

  /**
   * Get the currently active station (within interaction range).
   */
  getActiveStation(): Station | null {
    return this.activeStation;
  }

  /**
   * Interact with the active station (if any).
   *
   * @returns true if interaction occurred
   */
  interactWithActive(): boolean {
    if (this.activeStation && this.activeStation.enabled) {
      this.activeStation.interact();
      return true;
    }
    return false;
  }

  /**
   * Get all stations.
   */
  getAllStations(): Station[] {
    return [...this.stations];
  }

  /**
   * Find a station by type.
   */
  getStationByType(type: StationType): Station | undefined {
    return this.stations.find(s => s.type === type);
  }

  /**
   * Destroy all managed stations.
   */
  destroy(): void {
    for (const station of this.stations) {
      station.destroy();
    }
    this.stations = [];
    this.activeStation = null;
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let stationManagerInstance: StationManager | null = null;

/**
 * Get the global station manager instance.
 */
export function getStationManager(): StationManager {
  if (!stationManagerInstance) {
    stationManagerInstance = new StationManager();
  }
  return stationManagerInstance;
}

/**
 * Destroy the global station manager instance.
 */
export function destroyStationManager(): void {
  if (stationManagerInstance) {
    stationManagerInstance.destroy();
    stationManagerInstance = null;
  }
}
