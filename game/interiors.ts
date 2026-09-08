import {
  BLUE,
  BONE,
  BRICK,
  CYAN,
  INK,
  LEAF,
  MAT_BUILDING,
  MAT_FOLIAGE,
  MAT_GENERIC,
  MAT_PERSON,
  MAT_SIDEWALK,
  MAT_SIGN,
  ORANGE,
  PAPER,
  PINK,
  RED,
  STEEL,
  WHITE,
  YELLOW,
} from "./config";
import { venueHasCourierBoard, venueHasCourierCounter } from "./courier";
import type {
  Box,
  Collider,
  Color,
  VenueKind,
  VenueRef,
  VenueServiceId,
  WorldInteraction,
  WorldView,
} from "./model";

const interiorCache = new Map<string, WorldView>();

function solid(colliders: Collider[], id: string, x: number, y: number, sx: number, sy: number, height: number) {
  colliders.push({ id, x, y, halfX: sx / 2, halfY: sy / 2, height });
}

function fixture(boxes: Box[], colliders: Collider[], id: string, x: number, y: number, sx: number, sy: number, height: number, color: Color) {
  boxes.push({ x: x + 0.25, y: y + 0.25, z: height / 2 + 0.45, sx: sx + 0.22, sy: sy + 0.22, sz: height, yaw: 0, color: INK, material: MAT_BUILDING });
  boxes.push({ x, y, z: height / 2 + 0.5, sx, sy, sz: height, yaw: 0, color, material: MAT_BUILDING });
  solid(colliders, id, x, y, sx, sy, height);
}

function addPerson(boxes: Box[], x: number, y: number, outfit: Color) {
  boxes.push({ x, y, z: 1.05, sx: 0.64, sy: 0.48, sz: 1.25, yaw: Math.PI / 2, color: outfit, material: MAT_PERSON });
  boxes.push({ x, y, z: 1.86, sx: 0.55, sy: 0.55, sz: 0.55, yaw: 0, color: PAPER, material: MAT_PERSON });
  boxes.push({ x, y, z: 2.2, sx: 0.62, sy: 0.62, sz: 0.2, yaw: 0, color: INK, material: MAT_PERSON });
}

export type InteriorDefinition = {
  primary: Color;
  accent: Color;
  fixture: Color;
  layout: "retail" | "food" | "arcade" | "lobby" | "residential" | "hospitality" | "garage" | "logistics" | "marina" | "studio" | "kiosk" | "home";
  services: readonly { id: VenueServiceId; label: string; x: number; y: number }[];
};

/**
 * Venue presentation registry. New venue kinds declare their theme and service
 * language here while continuing to use the stable pocket-scene protocol.
 */
export const INTERIOR_DEFINITIONS: Record<VenueKind, InteriorDefinition> = {
  lobby: { primary: RED, accent: CYAN, fixture: BONE, layout: "lobby", services: [{ id: "front-desk", label: "TALK TO RECEPTION", x: 2.4, y: -3.7 }] },
  shop: { primary: RED, accent: CYAN, fixture: BONE, layout: "retail", services: [{ id: "retail-counter", label: "TALK TO CLERK", x: 2.4, y: -3.7 }] },
  diner: { primary: RED, accent: CYAN, fixture: BONE, layout: "food", services: [{ id: "food-counter", label: "ORDER AT COUNTER", x: 2.4, y: -3.7 }] },
  gas: { primary: ORANGE, accent: RED, fixture: STEEL, layout: "garage", services: [{ id: "gas-counter", label: "BUY GAS + UPGRADES", x: 2.4, y: -3.7 }] },
  market: { primary: PINK, accent: YELLOW, fixture: BRICK, layout: "retail", services: [{ id: "retail-counter", label: "TALK TO VENDOR", x: 2.4, y: -3.7 }] },
  arcade: { primary: PINK, accent: CYAN, fixture: BLUE, layout: "arcade", services: [{ id: "arcade-counter", label: "TALK TO ATTENDANT", x: 2.4, y: -3.7 }] },
  home: { primary: YELLOW, accent: CYAN, fixture: BONE, layout: "home", services: [{ id: "home-hub", label: "OPEN HOME HUB", x: 4.2, y: -3.7 }] },
  office: { primary: BLUE, accent: CYAN, fixture: STEEL, layout: "lobby", services: [{ id: "front-desk", label: "TALK TO RECEPTION", x: 2.4, y: -3.7 }] },
  apartment: { primary: BRICK, accent: CYAN, fixture: BONE, layout: "residential", services: [{ id: "resident-bell", label: "CHECK THE MAIL DESK", x: 2.4, y: -3.7 }] },
  residence: { primary: BONE, accent: ORANGE, fixture: BRICK, layout: "residential", services: [{ id: "resident-bell", label: "RING THE RESIDENT", x: 2.4, y: -3.7 }] },
  motel: { primary: PINK, accent: CYAN, fixture: BONE, layout: "hospitality", services: [{ id: "front-desk", label: "TALK TO FRONT DESK", x: 2.4, y: -3.7 }] },
  hotel: { primary: BONE, accent: RED, fixture: STEEL, layout: "hospitality", services: [{ id: "front-desk", label: "TALK TO CONCIERGE", x: 2.4, y: -3.7 }] },
  civic: { primary: BRICK, accent: ORANGE, fixture: BONE, layout: "lobby", services: [{ id: "civic-desk", label: "CHECK THE PUBLIC DESK", x: 2.4, y: -3.7 }] },
  garage: { primary: BLUE, accent: PINK, fixture: STEEL, layout: "garage", services: [{ id: "service-desk", label: "TALK TO SERVICE DESK", x: 2.4, y: -3.7 }] },
  warehouse: { primary: ORANGE, accent: CYAN, fixture: STEEL, layout: "logistics", services: [{ id: "dispatch-desk", label: "CHECK DISPATCH", x: 2.4, y: -3.7 }] },
  factory: { primary: BRICK, accent: ORANGE, fixture: STEEL, layout: "logistics", services: [{ id: "dispatch-desk", label: "CHECK SHIPPING", x: 2.4, y: -3.7 }] },
  marina: { primary: BLUE, accent: CYAN, fixture: BRICK, layout: "marina", services: [{ id: "harbor-desk", label: "TALK TO HARBOR DESK", x: 2.4, y: -3.7 }] },
  terminal: { primary: ORANGE, accent: CYAN, fixture: STEEL, layout: "logistics", services: [{ id: "dispatch-desk", label: "CHECK TERMINAL DISPATCH", x: 2.4, y: -3.7 }] },
  studio: { primary: PINK, accent: CYAN, fixture: INK, layout: "studio", services: [{ id: "studio-desk", label: "TALK TO THE PRODUCER", x: 2.4, y: -3.7 }] },
  kiosk: { primary: YELLOW, accent: PINK, fixture: BONE, layout: "kiosk", services: [{ id: "kiosk-counter", label: "CHECK THE KIOSK", x: 2.4, y: -3.7 }] },
};

/**
 * Data-driven pocket scene. It replaces the streamed city while occupied,
 * keeping every exterior building shell and collider deterministic.
 */
export function interiorWorld(venue: VenueRef): WorldView {
  const cached = interiorCache.get(venue.id);
  if (cached) return cached;
  const boxes: Box[] = [];
  const colliders: Collider[] = [];
  const definition = INTERIOR_DEFINITIONS[venue.kind];
  boxes.push({ x: 0.45, y: 0.45, z: -0.1, sx: 30.9, sy: 25.9, sz: 0.8, yaw: 0, color: INK, material: MAT_GENERIC });
  boxes.push({ x: 0, y: 0, z: 0.34, sx: 30, sy: 25, sz: 0.24, yaw: 0, color: BONE, material: MAT_SIDEWALK });
  // Cutaway shell: back and side walls, with the camera-facing wall omitted.
  fixture(boxes, colliders, "wall-back", 0, -12.2, 30, 0.8, 7.5, definition.fixture);
  fixture(boxes, colliders, "wall-left", -14.6, 0, 0.8, 25, 7.5, definition.fixture);
  // The fixed interior camera looks in from +X,+Y, so both near walls are
  // visually cut away while collision-only boundaries contain the room.
  solid(colliders, "wall-right-cutaway", 14.6, 0, 0.8, 25, 7.5);
  solid(colliders, "wall-front-cutaway", 0, 12.2, 30, 0.8, 2.2);
  boxes.push({ x: 0, y: -11.65, z: 6.1, sx: 15, sy: 0.28, sz: 1.5, yaw: 0, color: INK, material: MAT_SIGN });
  boxes.push({ x: 0, y: -11.43, z: 6.15, sx: 14.2, sy: 0.12, sz: 1.12, yaw: 0, color: definition.primary, material: MAT_SIGN });

  if (definition.layout === "retail") {
    fixture(boxes, colliders, "counter", 4.2, -5.4, 13.5, 2.1, 1.45, definition.primary);
    for (const x of [-9.5, -5.7, -1.9]) fixture(boxes, colliders, `shelf-${x}`, x, -1.2, 2.1, 8, 1.55, definition.fixture);
    for (const x of [-9.5, -5.7, -1.9]) {
      boxes.push({ x, y: -1.2, z: 1.72, sx: 1.75, sy: 7.6, sz: 0.22, yaw: 0, color: definition.accent, material: MAT_SIGN });
    }
    for (const x of [9.1, 12.1]) fixture(boxes, colliders, `cooler-${x}`, x, -8.5, 2.35, 5.2, 3.8, BLUE);
    boxes.push({ x: 10.6, y: -11.05, z: 4.3, sx: 5.4, sy: 0.25, sz: 0.55, yaw: 0, color: CYAN, material: MAT_SIGN });
    addPerson(boxes, 2.4, -7.1, definition.accent);
  } else if (definition.layout === "food") {
    fixture(boxes, colliders, "food-counter", 4.2, -5.4, 13.5, 2.1, 1.45, definition.primary);
    for (const y of [-5.2, 0.2, 5.2]) {
      fixture(boxes, colliders, `booth-left-${y}`, -9.8, y, 4.8, 1.5, 0.9, RED);
      fixture(boxes, colliders, `booth-table-${y}`, -6.8, y, 1.2, 2.4, 0.82, BONE);
    }
    for (const x of [8.4, 11.2]) fixture(boxes, colliders, `kitchen-${x}`, x, -8.7, 2.2, 4.6, 2.1, STEEL);
    boxes.push({ x: -8.3, y: -11.05, z: 3.7, sx: 9.2, sy: 0.2, sz: 0.7, yaw: 0, color: CYAN, material: MAT_SIGN });
    addPerson(boxes, 2.4, -7.1, definition.accent);
  } else if (definition.layout === "arcade") {
    fixture(boxes, colliders, "prize-counter", 4.2, -5.4, 13.5, 2.1, 1.45, definition.primary);
    for (const x of [-10, -6.2, -2.4]) {
      for (const y of [-4.8, 0.2, 5.2]) {
        fixture(boxes, colliders, `cabinet-${x}-${y}`, x, y, 2.2, 1.5, 2.8, INK);
        boxes.push({ x: x + 0.05, y: y - 0.77, z: 2.1, sx: 1.55, sy: 0.12, sz: 1.15, yaw: 0, color: (Math.round(x + y) & 1) ? CYAN : PINK, material: MAT_SIGN });
      }
    }
    fixture(boxes, colliders, "air-hockey", 9.5, 1.8, 6.2, 3.5, 0.9, BLUE);
    boxes.push({ x: 9.5, y: -11.05, z: 4.15, sx: 7.2, sy: 0.2, sz: 0.7, yaw: 0, color: PINK, material: MAT_SIGN });
    addPerson(boxes, 2.4, -7.1, definition.accent);
  } else if (definition.layout === "lobby") {
    fixture(boxes, colliders, "reception", 3.8, -5.4, 14.5, 2.1, 1.45, definition.primary);
    for (const [x, y] of [[-8.8, -5], [-8.8, 0], [-2.5, 1.5]] as const) {
      fixture(boxes, colliders, `lobby-seat-${x}-${y}`, x, y, 4.3, 1.7, 0.8, definition.fixture);
    }
    for (const x of [8.5, 11.2]) fixture(boxes, colliders, `elevator-${x}`, x, -9, 2.2, 4.2, 4.5, STEEL);
    boxes.push({ x: 9.85, y: -11.08, z: 4.8, sx: 5.4, sy: 0.18, sz: 0.55, yaw: 0, color: definition.accent, material: MAT_SIGN });
    addPerson(boxes, 2.4, -7.1, definition.accent);
  } else if (definition.layout === "residential") {
    fixture(boxes, colliders, "mail-desk", 4.2, -5.4, 12.5, 2, 1.35, definition.primary);
    for (const x of [-10, -7.4, -4.8]) {
      boxes.push({ x, y: -11.05, z: 2.5, sx: 2.1, sy: 0.24, sz: 3.2, yaw: 0, color: x === -7.4 ? definition.accent : STEEL, material: MAT_SIGN });
    }
    fixture(boxes, colliders, "residence-couch", -6.2, 1.2, 7.4, 2.5, 1.1, BRICK);
    fixture(boxes, colliders, "residence-table", 5.7, 1.2, 4.5, 3.2, 0.85, BONE);
    fixture(boxes, colliders, "stairs", 10.2, -5.2, 5.8, 8.6, 1.1, STEEL);
    addPerson(boxes, 2.4, -7.1, definition.accent);
  } else if (definition.layout === "hospitality") {
    fixture(boxes, colliders, "front-desk", 4.2, -5.4, 13.5, 2.1, 1.45, definition.primary);
    for (const [x, y] of [[-8.8, -4.5], [-8.8, 0], [-2.8, 1.5]] as const) {
      fixture(boxes, colliders, `hotel-seat-${x}-${y}`, x, y, 4.4, 1.8, 0.9, BONE);
    }
    for (const x of [8, 10.8, 13]) fixture(boxes, colliders, `luggage-${x}`, x, 0.2, 1.8, 2.4, 1.2, x > 11 ? PINK : BLUE);
    boxes.push({ x: -7.5, y: -11.05, z: 3.1, sx: 8.5, sy: 0.2, sz: 2.8, yaw: 0, color: definition.accent, material: MAT_SIGN });
    addPerson(boxes, 2.4, -7.1, definition.accent);
  } else if (definition.layout === "garage") {
    fixture(boxes, colliders, "service-desk", 5.3, -5.4, 11.2, 2.1, 1.45, definition.primary);
    for (const x of [-10.2, -5.8]) {
      fixture(boxes, colliders, `tool-bench-${x}`, x, -5.6, 3.1, 7.2, 1.2, STEEL);
      boxes.push({ x, y: -9.2, z: 2.7, sx: 2.7, sy: 0.2, sz: 2.5, yaw: 0, color: definition.accent, material: MAT_SIGN });
    }
    fixture(boxes, colliders, "parts-rack", 9.8, 0.2, 5.8, 5.2, 2.6, INK);
    for (const y of [-1.2, 0.2, 1.6]) boxes.push({ x: 9.8, y, z: 2.7, sx: 5.2, sy: 0.35, sz: 0.28, yaw: 0, color: ORANGE, material: MAT_SIGN });
    addPerson(boxes, 2.4, -7.1, definition.accent);
  } else if (definition.layout === "logistics") {
    fixture(boxes, colliders, "dispatch", 4.2, -5.4, 13.5, 2.1, 1.45, definition.primary);
    for (const x of [-10, -6.4, -2.8]) fixture(boxes, colliders, `cargo-rack-${x}`, x, -1.2, 2.4, 8.2, 2.8, STEEL);
    for (const [x, y, color] of [[8.5, -0.5, ORANGE], [11.2, -0.5, BLUE], [9.8, 2.3, BRICK]] as const) {
      fixture(boxes, colliders, `cargo-${x}-${y}`, x, y, 2.2, 2.2, 1.8, color);
    }
    boxes.push({ x: -6.4, y: -11.05, z: 4.1, sx: 11.2, sy: 0.2, sz: 0.65, yaw: 0, color: definition.accent, material: MAT_SIGN });
    addPerson(boxes, 2.4, -7.1, definition.accent);
  } else if (definition.layout === "marina") {
    fixture(boxes, colliders, "harbor-desk", 4.2, -5.4, 13.5, 2.1, 1.45, definition.primary);
    for (const x of [-10, -6.2, -2.4]) fixture(boxes, colliders, `marina-rack-${x}`, x, -1.2, 2.2, 7.8, 1.6, BRICK);
    for (const [x, y] of [[8.4, -0.8], [11.2, -0.8], [9.8, 2.1]] as const) {
      fixture(boxes, colliders, `harbor-crate-${x}-${y}`, x, y, 2.2, 2.2, 1.55, x > 10 ? BLUE : ORANGE);
    }
    boxes.push({ x: 0, y: -11.05, z: 4.1, sx: 10.5, sy: 0.2, sz: 0.6, yaw: 0, color: CYAN, material: MAT_SIGN });
    addPerson(boxes, 2.4, -7.1, definition.accent);
  } else if (definition.layout === "studio") {
    fixture(boxes, colliders, "producer-desk", 4.2, -5.4, 13.5, 2.1, 1.45, definition.primary);
    fixture(boxes, colliders, "mix-console", -7.4, -2.2, 7.2, 3.2, 1.25, STEEL);
    for (const x of [-9.8, -7.4, -5]) boxes.push({ x, y: -2.6, z: 2.35, sx: 1.45, sy: 0.2, sz: 1.2, yaw: 0, color: x === -7.4 ? CYAN : PINK, material: MAT_SIGN });
    fixture(boxes, colliders, "recording-booth", 9.6, 1.3, 6.5, 5.7, 0.55, INK);
    boxes.push({ x: 9.6, y: -1.58, z: 2.8, sx: 5.8, sy: 0.18, sz: 3.9, yaw: 0, color: BLUE, material: MAT_SIGN });
    boxes.push({ x: 9.6, y: 1.3, z: 2.2, sx: 0.22, sy: 0.22, sz: 3.4, yaw: 0, color: YELLOW, material: MAT_SIGN });
    addPerson(boxes, 2.4, -7.1, definition.accent);
  } else if (definition.layout === "kiosk") {
    fixture(boxes, colliders, "kiosk-counter", 4.2, -5.4, 10.5, 2.1, 1.45, definition.primary);
    for (const [x, y, color] of [[-9, -4, PINK], [-9, 1, CYAN], [-3.5, 2.5, ORANGE]] as const) {
      fixture(boxes, colliders, `kiosk-display-${x}-${y}`, x, y, 3.6, 1.8, 1.2, color);
    }
    fixture(boxes, colliders, "kiosk-table", 8.8, 2.4, 4.8, 3.5, 0.85, BONE);
    boxes.push({ x: 0, y: -11.05, z: 4.1, sx: 12, sy: 0.2, sz: 0.65, yaw: 0, color: PINK, material: MAT_SIGN });
    addPerson(boxes, 2.4, -7.1, definition.accent);
  } else {
    // Home layout: sleeping/lounge zone, kitchenette, dispatch desk, trophy
    // wall, and a garage bench. Ownership changes the hub, not this cached art.
    fixture(boxes, colliders, "home-bed", -9.4, -6.7, 5.3, 7.1, 0.8, PAPER);
    boxes.push({ x: -9.4, y: -6.1, z: 1.02, sx: 4.8, sy: 4.8, sz: 0.32, yaw: 0, color: definition.accent, material: MAT_SIGN });
    fixture(boxes, colliders, "home-kitchen", 9.1, -8.5, 7.8, 2.2, 1.55, STEEL);
    fixture(boxes, colliders, "home-desk", 4.2, -6.2, 6.8, 1.8, 1.3, definition.primary);
    boxes.push({ x: 4.2, y: -7.08, z: 2.35, sx: 4.7, sy: 0.2, sz: 1.55, yaw: 0, color: CYAN, material: MAT_SIGN });
    fixture(boxes, colliders, "home-couch", -4.8, 2.8, 6.6, 2.6, 1.15, BRICK);
    boxes.push({ x: -4.8, y: 1.75, z: 1.7, sx: 6.1, sy: 0.35, sz: 1.25, yaw: 0, color: RED, material: MAT_SIGN });
    fixture(boxes, colliders, "home-workbench", 9.2, 4.6, 7.3, 2.1, 1.35, INK);
    for (const x of [-2.3, 0, 2.3]) {
      boxes.push({ x, y: -11.28, z: 3.2 + Math.abs(x) * 0.14, sx: 1.4, sy: 0.22, sz: 2.2, yaw: 0, color: x === 0 ? YELLOW : PINK, material: MAT_SIGN });
    }
  }

  if (venueHasCourierCounter(venue)) {
    fixture(boxes, colliders, "courier-counter", -6.2, 4.8, 5.2, 1.5, 1.25, ORANGE);
    boxes.push({ x: -6.2, y: 4.72, z: 2.02, sx: 2.1, sy: 1.05, sz: 1.15, yaw: Math.PI / 4, color: PINK, material: MAT_SIGN });
  }
  for (const x of [-11, -7.8, 8.2, 11.1]) {
    boxes.push({ x, y: 7.1, z: 0.9, sx: 2.2, sy: 2.2, sz: 1.05, yaw: 0, color: INK, material: MAT_GENERIC });
    boxes.push({ x, y: 7.1, z: 1.65, sx: 1.75, sy: 1.75, sz: 0.8, yaw: Math.PI / 4, color: LEAF, material: MAT_FOLIAGE });
  }
  boxes.push({ x: 0, y: 11.1, z: 1.6, sx: 4.5, sy: 0.32, sz: 2.6, yaw: 0, color: CYAN, material: MAT_SIGN });
  boxes.push({ x: 0, y: 10.7, z: 0.55, sx: 4.8, sy: 1.9, sz: 0.1, yaw: 0, color: WHITE, material: MAT_SIDEWALK });

  const services = [
    ...definition.services,
    ...(venueHasCourierBoard(venue)
      ? [{ id: "courier-board" as const, label: "OPEN COURIER BOARD", x: 9.2, y: 8.3 }]
      : []),
  ];
  const interactions: WorldInteraction[] = [
    { id: `${venue.id}:exit`, kind: "interior-exit", label: "STREET", x: 0, y: 10.2, heading: Math.PI / 2, radius: 2.4, venue },
    ...services.map((service): WorldInteraction => ({
      id: `${venue.id}:service:${service.id}`,
      kind: "service",
      serviceId: service.id,
      label: service.label,
      x: service.x,
      y: service.y,
      heading: -Math.PI / 2,
      radius: 2.5,
      venue,
    })),
    ...(venueHasCourierCounter(venue) ? [{
      id: `${venue.id}:courier-counter`,
      kind: "courier-counter" as const,
      label: "COURIER COUNTER",
      x: -6.2,
      y: 6.3,
      heading: Math.PI / 2,
      radius: 2.5,
      venue,
    }] : []),
  ];
  const world: WorldView = { key: `interior:${venue.id}`, boxes, colliders, chunks: [], interactions };
  interiorCache.set(venue.id, world);
  return world;
}

export const INTERIOR_ENTRY_POSE = { x: 0, y: 8.3, vx: 0, vy: 0, heading: -Math.PI / 2, speed: 0 } as const;
