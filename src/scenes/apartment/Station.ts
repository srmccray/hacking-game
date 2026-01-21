/**
 * Interactive Stations for the Apartment Scene
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
 *   import { Station, StationType } from './Station';
 *
 *   const desk = new Station('desk', 200, 270, { onInteract: () => launchMinigame() });
 *   apartmentContainer.addChild(desk.container);
 */

import { Container, Text, Graphics, TextStyle } from 'pixi.js';
import { COLORS } from '../../rendering/Renderer';
import { FONT_FAMILY } from '../../rendering/styles';
import type { BoundingBox } from './Player';

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

// ============================================================================
// Visual Configuration
// ============================================================================

const STATION_VISUALS: Record<StationType, StationVisual> = {
  desk: {
    label: '[D]',
    name: 'DESK',
    width: 120,
    height: 50,
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
    height: 40,
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
    height: 30,
    functional: false,
    ascii: [
      '[==BED==]',
    ],
  },
};

/** Floor Y position (where stations sit) */
export const FLOOR_Y = 420;

// ============================================================================
// Collision Detection
// ============================================================================

/**
 * Check for AABB (Axis-Aligned Bounding Box) collision between two rectangles.
 *
 * @param rect1 - First collision rectangle
 * @param rect2 - Second collision rectangle
 * @returns true if the rectangles overlap
 */
export function checkAABBCollision(rect1: BoundingBox, rect2: BoundingBox): boolean {
  return (
    rect1.x < rect2.x + rect2.width &&
    rect1.x + rect1.width > rect2.x &&
    rect1.y < rect2.y + rect2.height &&
    rect1.y + rect1.height > rect2.y
  );
}

// ============================================================================
// Station Class
// ============================================================================

/**
 * Interactive station class for the apartment scene.
 */
export class Station {
  /** The PixiJS container for this station */
  readonly container: Container;

  /** Station type identifier */
  readonly type: StationType;

  /** X position (center of station) */
  readonly x: number;

  /** Y position (bottom of station) */
  readonly y: number;

  /** Width of the station */
  readonly width: number;

  /** Height of the station */
  readonly height: number;

  /** Whether the station is enabled */
  enabled: boolean;

  /** Interaction callback */
  private readonly onInteractCallback: (() => void) | undefined;

  /** ASCII art container */
  private readonly asciiContainer: Container;

  /** Interaction prompt container */
  private readonly prompt: Container;

  /**
   * Create a new station.
   *
   * @param type - The type of station to create
   * @param x - X position (center) in the apartment
   * @param y - Y position (bottom) in the apartment
   * @param config - Optional configuration
   */
  constructor(
    type: StationType,
    x: number,
    y: number = FLOOR_Y,
    config: StationConfig = {}
  ) {
    const visual = STATION_VISUALS[type];
    this.type = type;
    this.x = x;
    this.y = y;
    this.width = visual.width;
    this.height = visual.height;
    this.enabled = config.enabled ?? visual.functional;
    this.onInteractCallback = config.onInteract;

    this.container = new Container();
    this.container.label = `station-${type}`;
    this.container.x = x;
    this.container.y = y;

    // Create the ASCII art display
    this.asciiContainer = this.createAsciiArt(visual);
    this.container.addChild(this.asciiContainer);

    // Create interaction prompt (hidden by default)
    this.prompt = this.createInteractionPrompt(visual.functional);
    this.prompt.y = -visual.height - 60;
    this.prompt.visible = false;
    this.container.addChild(this.prompt);

    // Set initial enabled state visual
    this.setEnabled(this.enabled);
  }

  // ==========================================================================
  // Visuals
  // ==========================================================================

  /**
   * Create the ASCII art representation of the station.
   */
  private createAsciiArt(visual: StationVisual): Container {
    const asciiContainer = new Container();
    asciiContainer.label = 'ascii-art';

    // Determine style based on enabled state
    const textColor = this.enabled ? COLORS.TERMINAL_GREEN : COLORS.TERMINAL_DIM;
    const glowAlpha = this.enabled ? 0.8 : 0.3;

    const asciiStyle = new TextStyle({
      fontFamily: FONT_FAMILY,
      fontSize: 14,
      fill: textColor,
      dropShadow: {
        color: textColor,
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
      asciiContainer.addChild(text);
    });

    return asciiContainer;
  }

  /**
   * Create the interaction prompt shown when player is nearby.
   */
  private createInteractionPrompt(functional: boolean): Container {
    const promptContainer = new Container();
    promptContainer.label = 'interaction-prompt';

    // Background box
    const bg = new Graphics();
    bg.fill({ color: 0x0a0a0a, alpha: 0.9 });
    bg.roundRect(-60, -15, 120, 30, 4);
    bg.fill();

    bg.stroke({ color: COLORS.TERMINAL_GREEN, width: 1, alpha: 0.8 });
    bg.roundRect(-60, -15, 120, 30, 4);
    bg.stroke();
    promptContainer.addChild(bg);

    // Prompt text
    const promptText = functional ? '[ENTER] Interact' : 'Coming Soon';
    const shadowColor = functional ? COLORS.TERMINAL_GREEN : COLORS.TERMINAL_DIM;

    const textStyle = new TextStyle({
      fontFamily: FONT_FAMILY,
      fontSize: 12,
      fill: functional ? COLORS.TERMINAL_BRIGHT : COLORS.TERMINAL_DIM,
      dropShadow: {
        color: shadowColor,
        blur: 3,
        alpha: 0.6,
        distance: 0,
      },
    });

    const text = new Text({
      text: promptText,
      style: textStyle,
    });
    text.anchor.set(0.5);
    promptContainer.addChild(text);

    return promptContainer;
  }

  // ==========================================================================
  // Public API
  // ==========================================================================

  /**
   * Update the interaction prompt visibility.
   *
   * @param visible - Whether to show the prompt
   */
  showPrompt(visible: boolean): void {
    this.prompt.visible = visible && this.enabled;
  }

  /**
   * Trigger the station's interaction callback.
   */
  interact(): void {
    if (this.enabled && this.onInteractCallback) {
      this.onInteractCallback();
    }
  }

  /**
   * Update enabled state and visual appearance.
   *
   * @param enabled - New enabled state
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    // Update visual opacity based on enabled state
    this.asciiContainer.alpha = enabled ? 1 : 0.5;
  }

  /**
   * Get collision rectangle for AABB detection.
   * Station is anchored at bottom-center, so calculate top-left corner.
   * Bottom padding allows player to get closer to furniture visually.
   */
  getCollisionRect(): BoundingBox {
    const bottomPadding = 30; // Allow player to overlap with bottom of station visual
    return {
      x: this.x - this.width / 2,
      y: this.y - this.height,
      width: this.width,
      height: Math.max(this.height - bottomPadding, 10), // Shrink from bottom, min 10px
    };
  }

  /**
   * Check if a point is within the station's collision area.
   *
   * @param point - Point to check
   */
  containsPoint(point: { x: number; y: number }): boolean {
    const rect = this.getCollisionRect();
    return (
      point.x >= rect.x &&
      point.x <= rect.x + rect.width &&
      point.y >= rect.y &&
      point.y <= rect.y + rect.height
    );
  }

  /**
   * Destroy the station and clean up resources.
   */
  destroy(): void {
    this.container.destroy({ children: true });
  }
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
   * Uses AABB collision detection.
   *
   * @param playerRect - Player's collision rectangle
   * @returns The station the player can interact with, or null
   */
  updatePlayerPosition(playerRect: BoundingBox): Station | null {
    let closestStation: Station | null = null;

    // Check for collision with each station
    for (const station of this.stations) {
      const stationRect = station.getCollisionRect();
      if (checkAABBCollision(playerRect, stationRect)) {
        closestStation = station;
        break;
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
   * Set the active station directly.
   * Updates prompt visibility for all stations.
   *
   * @param station - The station to set as active, or null to clear
   */
  setActiveStation(station: Station | null): void {
    for (const s of this.stations) {
      s.showPrompt(s === station);
    }
    this.activeStation = station;
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
   * Check if a proposed position would collide with any station.
   *
   * @param proposedRect - The proposed collision rectangle
   * @returns The first station that would be collided with, or null
   */
  checkCollision(proposedRect: BoundingBox): Station | null {
    for (const station of this.stations) {
      const stationRect = station.getCollisionRect();
      if (checkAABBCollision(proposedRect, stationRect)) {
        return station;
      }
    }
    return null;
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
