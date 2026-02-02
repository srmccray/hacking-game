/**
 * Town Scene Visuals - Cyberpunk ASCII Art Building Facades
 *
 * Renders the cyberpunk street environment with ASCII art building facades,
 * neon-colored signs, street-level details, and atmospheric elements.
 *
 * Building layout (left to right):
 * - Bio-Forge Cybernetics (magenta neon)
 * - Chip Shop (cyan neon)
 * - Neon Drip Cafe (yellow neon)
 * - Your Apartment (green neon)
 *
 * Uses box-drawing characters for buildings and pipes/cables for detail.
 */

import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import { COLORS } from '../../rendering/Renderer';
import { FONT_FAMILY } from '../../rendering/styles';

// ============================================================================
// Neon Color Constants
// ============================================================================

/** Neon colors for each storefront */
export const NEON_COLORS = {
  BIO_FORGE: 0xff00ff,    // Magenta - biotech/cybernetics
  CHIP_SHOP: 0x00ffff,    // Cyan - classic cyberpunk tech
  NEON_DRIP: 0xffaa00,    // Yellow/Amber - warm cafe
  APARTMENT: 0x00ff41,    // Terminal green - home
} as const;

/** Street surface color */
const STREET_COLOR = 0x1a1a2e;

/** Building wall color */
const BUILDING_COLOR = 0x111122;

/** Dim detail color for building elements */
const DETAIL_DIM = 0x333355;

/** Street line Y position (curb between buildings and walkway) */
export const STREET_LINE_Y = 300;

/** Building top Y position */
const BUILDING_TOP_Y = 60;

// ============================================================================
// Building Configuration
// ============================================================================

interface BuildingConfig {
  x: number;
  width: number;
  name: string;
  neonColor: number;
  ascii: string[];
  signText: string;
}

const BUILDINGS: BuildingConfig[] = [
  {
    x: 30,
    width: 170,
    name: 'bio-forge',
    neonColor: NEON_COLORS.BIO_FORGE,
    signText: 'BIO-FORGE',
    ascii: [
      '  ╔═══════════════╗  ',
      '  ║ BIO-FORGE     ║  ',
      '  ║  CYBERNETICS  ║  ',
      '  ╚═══════════════╝  ',
      '  ┌───────────────┐  ',
      '  │ ▪ ▪   ▪ ▪ ▪  │  ',
      '  │               │  ',
      '  │ ▪ ▪   ▪ ▪ ▪  │  ',
      '  │    ╔═══╗      │  ',
      '  │    ║   ║      │  ',
      '  │    ║   ║      │  ',
      '  └────╨───╨──────┘  ',
    ],
  },
  {
    x: 215,
    width: 170,
    name: 'chip-shop',
    neonColor: NEON_COLORS.CHIP_SHOP,
    signText: 'CHIP SHOP',
    ascii: [
      '  ╔═══════════════╗  ',
      '  ║  CHIP  SHOP   ║  ',
      '  ║   HARDWARE    ║  ',
      '  ╚═══════════════╝  ',
      '  ┌───────────────┐  ',
      '  │ □ □ □   □ □ □ │  ',
      '  │               │  ',
      '  │ □ □ □   □ □ □ │  ',
      '  │    ┌─────┐    │  ',
      '  │    │     │    │  ',
      '  │    │     │    │  ',
      '  └────┴─────┴────┘  ',
    ],
  },
  {
    x: 400,
    width: 170,
    name: 'neon-drip',
    neonColor: NEON_COLORS.NEON_DRIP,
    signText: 'NEON DRIP',
    ascii: [
      '  ╔═══════════════╗  ',
      '  ║  NEON  DRIP   ║  ',
      '  ║    CAFE       ║  ',
      '  ╚═══════════════╝  ',
      '  ┌───────────────┐  ',
      '  │ ▪   ▪   ▪   ▪│  ',
      '  │               │  ',
      '  │ ▪   ▪   ▪   ▪│  ',
      '  │    ┌─────┐    │  ',
      '  │    │ ~~~ │    │  ',
      '  │    │     │    │  ',
      '  └────┴─────┴────┘  ',
    ],
  },
  {
    x: 585,
    width: 170,
    name: 'apartment',
    neonColor: NEON_COLORS.APARTMENT,
    signText: 'YOUR APT',
    ascii: [
      '  ╔═══════════════╗  ',
      '  ║  YOUR  APT    ║  ',
      '  ║   ENTRANCE    ║  ',
      '  ╚═══════════════╝  ',
      '  ┌───────────────┐  ',
      '  │ □     │ □     │  ',
      '  │       │       │  ',
      '  │ □     │ □     │  ',
      '  │    ┌─────┐    │  ',
      '  │    │  @  │    │  ',
      '  │    │     │    │  ',
      '  └────┴─────┴────┘  ',
    ],
  },
];

// ============================================================================
// Rendering Functions
// ============================================================================

/**
 * Create the complete town background including sky, buildings, and street.
 */
export function createTownBackground(width: number, height: number): Container {
  const container = new Container();
  container.label = 'town-background';

  // Dark sky/background
  const bg = new Graphics();
  bg.fill({ color: COLORS.BACKGROUND, alpha: 1 });
  bg.rect(0, 0, width, height);
  bg.fill();
  container.addChild(bg);

  // Skyline silhouette at the very top
  const skyline = createSkylineSilhouette(width);
  container.addChild(skyline);

  // Building facades
  for (const building of BUILDINGS) {
    const facade = createBuildingFacade(building);
    container.addChild(facade);
  }

  // Street surface
  const street = createStreetSurface(width, height);
  container.addChild(street);

  // Cables between buildings
  const cables = createCables(width);
  container.addChild(cables);

  return container;
}

/**
 * Create a dim skyline silhouette at the top of the scene.
 */
function createSkylineSilhouette(_width: number): Container {
  const container = new Container();
  const graphics = new Graphics();

  // Draw irregular skyline shapes
  graphics.fill({ color: 0x0d0d1a, alpha: 1 });

  // Building silhouettes at varying heights
  const silhouettes = [
    { x: 0, w: 60, h: 40 },
    { x: 55, w: 40, h: 55 },
    { x: 90, w: 80, h: 35 },
    { x: 200, w: 50, h: 50 },
    { x: 245, w: 30, h: 30 },
    { x: 350, w: 70, h: 45 },
    { x: 450, w: 45, h: 55 },
    { x: 520, w: 60, h: 35 },
    { x: 600, w: 40, h: 50 },
    { x: 650, w: 80, h: 40 },
    { x: 740, w: 60, h: 45 },
  ];

  for (const s of silhouettes) {
    graphics.rect(s.x, BUILDING_TOP_Y - s.h, s.w, s.h);
  }
  graphics.fill();

  // Tiny window lights on silhouettes
  graphics.fill({ color: 0xffff88, alpha: 0.15 });
  const windowPositions = [
    { x: 15, y: 30 }, { x: 30, y: 35 },
    { x: 70, y: 20 }, { x: 75, y: 30 },
    { x: 215, y: 25 }, { x: 230, y: 35 },
    { x: 370, y: 30 }, { x: 390, y: 25 },
    { x: 465, y: 20 }, { x: 470, y: 30 },
    { x: 540, y: 35 }, { x: 625, y: 25 },
    { x: 670, y: 30 }, { x: 695, y: 25 },
    { x: 760, y: 30 },
  ];
  for (const w of windowPositions) {
    graphics.rect(w.x, w.y, 3, 3);
  }
  graphics.fill();

  container.addChild(graphics);
  return container;
}

/**
 * Create a single building facade with neon sign and ASCII art.
 */
function createBuildingFacade(config: BuildingConfig): Container {
  const container = new Container();
  container.label = `building-${config.name}`;

  // Building background rectangle
  const buildingBg = new Graphics();
  buildingBg.fill({ color: BUILDING_COLOR, alpha: 0.9 });
  buildingBg.rect(config.x, BUILDING_TOP_Y, config.width, STREET_LINE_Y - BUILDING_TOP_Y);
  buildingBg.fill();

  // Building outline
  buildingBg.stroke({ color: DETAIL_DIM, width: 1, alpha: 0.6 });
  buildingBg.rect(config.x, BUILDING_TOP_Y, config.width, STREET_LINE_Y - BUILDING_TOP_Y);
  buildingBg.stroke();
  container.addChild(buildingBg);

  // ASCII art for the building
  const asciiContainer = createBuildingAscii(config);
  container.addChild(asciiContainer);

  // Neon sign glow effect (soft glow behind the sign area)
  const glow = new Graphics();
  glow.fill({ color: config.neonColor, alpha: 0.06 });
  glow.rect(config.x + 10, BUILDING_TOP_Y + 5, config.width - 20, 55);
  glow.fill();
  container.addChild(glow);

  return container;
}

/**
 * Render ASCII art lines for a building.
 */
function createBuildingAscii(config: BuildingConfig): Container {
  const container = new Container();
  const lineHeight = 16;
  const startY = BUILDING_TOP_Y + 10;
  const centerX = config.x + config.width / 2;

  for (let i = 0; i < config.ascii.length; i++) {
    const line = config.ascii[i]!;
    // First 4 lines are the neon sign area - use neon color
    const isSign = i < 4;
    const color = isSign ? config.neonColor : DETAIL_DIM;
    const glowAlpha = isSign ? 0.8 : 0.3;

    const styleOpts: Record<string, unknown> = {
      fontFamily: FONT_FAMILY,
      fontSize: 12,
      fill: color,
    };
    if (isSign) {
      styleOpts['dropShadow'] = {
        color: config.neonColor,
        blur: 6,
        alpha: glowAlpha,
        distance: 0,
      };
    }
    const style = new TextStyle(styleOpts as ConstructorParameters<typeof TextStyle>[0]);

    const text = new Text({ text: line, style });
    text.anchor.set(0.5, 0);
    text.x = centerX;
    text.y = startY + i * lineHeight;
    container.addChild(text);
  }

  return container;
}

/**
 * Create the street surface with road markings and details.
 */
function createStreetSurface(width: number, height: number): Container {
  const container = new Container();
  const graphics = new Graphics();

  // Street surface (dark asphalt)
  graphics.fill({ color: STREET_COLOR, alpha: 0.8 });
  graphics.rect(0, STREET_LINE_Y, width, height - STREET_LINE_Y);
  graphics.fill();

  // Curb line (bright horizontal line separating buildings from street)
  graphics.stroke({ color: DETAIL_DIM, width: 2, alpha: 0.8 });
  graphics.moveTo(0, STREET_LINE_Y);
  graphics.lineTo(width, STREET_LINE_Y);
  graphics.stroke();

  // Secondary curb line for depth
  graphics.stroke({ color: DETAIL_DIM, width: 1, alpha: 0.3 });
  graphics.moveTo(0, STREET_LINE_Y + 3);
  graphics.lineTo(width, STREET_LINE_Y + 3);
  graphics.stroke();

  // Road center line (dashed)
  graphics.stroke({ color: 0x444466, width: 1, alpha: 0.4 });
  const centerLineY = height - 50;
  for (let x = 20; x < width; x += 40) {
    graphics.moveTo(x, centerLineY);
    graphics.lineTo(x + 20, centerLineY);
  }
  graphics.stroke();

  // Manhole cover
  graphics.stroke({ color: 0x333355, width: 1, alpha: 0.5 });
  graphics.circle(350, height - 40, 12);
  graphics.stroke();
  graphics.moveTo(344, height - 40);
  graphics.lineTo(356, height - 40);
  graphics.moveTo(350, height - 46);
  graphics.lineTo(350, height - 34);
  graphics.stroke();

  // Rain gutter line along the curb
  graphics.stroke({ color: 0x222244, width: 1, alpha: 0.3 });
  graphics.moveTo(0, STREET_LINE_Y + 15);
  graphics.lineTo(width, STREET_LINE_Y + 15);
  graphics.stroke();

  // Gutter drain markers
  for (let x = 100; x < width; x += 200) {
    graphics.stroke({ color: 0x333355, width: 1, alpha: 0.4 });
    graphics.rect(x - 5, STREET_LINE_Y + 10, 10, 8);
    graphics.stroke();
  }

  container.addChild(graphics);

  // Floor line (lower boundary reference)
  const floorLine = new Graphics();
  floorLine.stroke({ color: DETAIL_DIM, width: 1, alpha: 0.3 });
  floorLine.moveTo(0, height - 25);
  floorLine.lineTo(width, height - 25);
  floorLine.stroke();
  container.addChild(floorLine);

  return container;
}

/**
 * Create cables/wires running between buildings.
 */
function createCables(width: number): Container {
  const container = new Container();
  const graphics = new Graphics();

  // Horizontal cable across building tops
  graphics.stroke({ color: DETAIL_DIM, width: 1, alpha: 0.4 });
  graphics.moveTo(30, BUILDING_TOP_Y + 5);
  graphics.lineTo(width - 30, BUILDING_TOP_Y + 5);
  graphics.stroke();

  // Sagging cables between buildings
  const cablePoints = [
    { x1: 180, x2: 235, sagY: 8 },
    { x1: 365, x2: 420, sagY: 6 },
    { x1: 550, x2: 605, sagY: 7 },
  ];

  for (const cable of cablePoints) {
    graphics.stroke({ color: DETAIL_DIM, width: 1, alpha: 0.3 });
    const midX = (cable.x1 + cable.x2) / 2;
    graphics.moveTo(cable.x1, BUILDING_TOP_Y + 20);
    graphics.quadraticCurveTo(midX, BUILDING_TOP_Y + 20 + cable.sagY, cable.x2, BUILDING_TOP_Y + 20);
    graphics.stroke();
  }

  container.addChild(graphics);
  return container;
}

/**
 * Create the scene title text.
 */
export function createSceneTitle(width: number): Text {
  const style = new TextStyle({
    fontFamily: FONT_FAMILY,
    fontSize: 14,
    fill: COLORS.TERMINAL_DIM,
  });

  const title = new Text({ text: 'DOWNTOWN', style });
  title.anchor.set(0.5, 0.5);
  title.x = width / 2;
  title.y = 18;

  return title;
}

/**
 * Create the instructions bar at the bottom of the scene.
 */
export function createInstructions(width: number, height: number): Text {
  const style = new TextStyle({
    fontFamily: FONT_FAMILY,
    fontSize: 12,
    fill: COLORS.TERMINAL_DIM,
  });

  const instructions = new Text({
    text: 'WASD/Arrows: Move | Enter/Space: Interact | Esc: Apartment',
    style,
  });
  instructions.anchor.set(0.5, 0);
  instructions.x = width / 2;
  instructions.y = height - 20;

  return instructions;
}

/**
 * Get the station positions for the town scene.
 * Each station is positioned at the doorway/entrance of its building.
 */
export function getTownStationPositions(): Array<{
  type: string;
  x: number;
  y: number;
  neonColor: number;
  signText: string;
  buildingName: string;
}> {
  return BUILDINGS.map((b) => ({
    type: b.name,
    x: b.x + b.width / 2,
    y: STREET_LINE_Y + 40,
    neonColor: b.neonColor,
    signText: b.signText,
    buildingName: b.name,
  }));
}
