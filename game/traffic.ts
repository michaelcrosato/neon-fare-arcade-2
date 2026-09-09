import { TRAFFIC_LANE_OFFSET } from "./config";
import type { TrafficCar } from "./model";
import { nearestRoadProjection, sampleSpecialRoad, specialRoadLength, specialRoadSurfaceIndex } from "./road-network";
import { gridStreetPointEnabled } from "./road-topology";
import { ROAD_SURFACE_HEIGHT } from "./roads/contact";
import { inElevatedTerrain, roadDesignHeight } from "./terrain/region-forms";
import { groundAt } from "./vehicle-road-contact";
import { containingRegionForPosition } from "./regions";

export function alignGridTraffic(car: TrafficCar) {
  if (car.motion.kind !== "grid") return;
  const cedar = containingRegionForPosition(car.x, car.y)?.id === "cedar-vale";
  if (!inElevatedTerrain(car.x, car.y) && !cedar) { car.z = 0; car.pitch = 0; car.roll = 0; return; }
  const axis = car.motion.axis === "x" ? "horizontal" : "vertical";
  if (!gridStreetPointEnabled(car, axis)) {
    const projection = nearestRoadProjection({ x: car.x, y: car.y }, car.heading);
    if (projection.kind !== "street") {
      const path = specialRoadSurfaceIndex.query(projection.point, 2)
        .filter((sample) => sample.roadId === projection.roadId)
        .sort((a, b) => a.centerDistance - b.centerDistance)[0];
      if (path) {
        car.dir = Math.cos(path.heading - car.heading) >= 0 ? 1 : -1;
        car.motion = { kind: "path", roadId: projection.roadId, progress: path.distance };
        advancePathTraffic(car, 0);
        return;
      }
    }
  }
  const support = groundAt({ x: car.x, y: car.y, z: roadDesignHeight(car.x, car.y) + ROAD_SURFACE_HEIGHT }, 0.85);
  car.z = support.height;
  car.pitch = Math.atan2(support.normal.x * Math.cos(car.heading) + support.normal.y * Math.sin(car.heading), support.normal.z);
  car.roll = Math.atan2(support.normal.x * Math.sin(car.heading) - support.normal.y * Math.cos(car.heading), support.normal.z);
}

export function advancePathTraffic(car: TrafficCar, travelDistance: number) {
  if (car.motion.kind !== "path") return false;
  car.motion.progress += travelDistance * car.dir;
  const pathLength = specialRoadLength(car.motion.roadId);
  let sample = sampleSpecialRoad(
    car.motion.roadId,
    car.motion.progress,
    TRAFFIC_LANE_OFFSET * car.dir,
  );
  if (sample && !sample.road.closed && (car.motion.progress <= 0 || car.motion.progress >= pathLength)) {
    car.dir = (car.dir > 0 ? -1 : 1) as 1 | -1;
    car.motion.progress = Math.max(0, Math.min(pathLength, car.motion.progress));
    sample = sampleSpecialRoad(
      car.motion.roadId,
      car.motion.progress,
      TRAFFIC_LANE_OFFSET * car.dir,
    );
  }
  if (!sample) return false;
  car.x = sample.point.x;
  car.y = sample.point.y;
  car.z = sample.point.z + ROAD_SURFACE_HEIGHT;
  car.pitch = -Math.atan(sample.grade) * car.dir;
  car.roll = sample.bank * car.dir;
  car.heading = sample.heading + (car.dir < 0 ? Math.PI : 0);
  return true;
}
