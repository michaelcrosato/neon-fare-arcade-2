import type { RoadControlPoint } from "./geometry";

export type RoadKind = "boulevard" | "parkway" | "highway" | "ramp" | "roundabout";
export type GridConnectionMode = "crossings" | "explicit" | "none";

/** Dependency-neutral authoring contract for regional and shared roads. */
export type RoadPathDefinition = {
  id: string;
  name: string;
  kind: RoadKind;
  halfWidth: number;
  lanes: number;
  /** Lower values make fast roads attractive without changing physical distance. */
  travelWeight: number;
  points: readonly RoadControlPoint[];
  closed?: boolean;
  oneWay?: boolean;
  connectGrid: GridConnectionMode;
  junctions: readonly RoadControlPoint[];
};
