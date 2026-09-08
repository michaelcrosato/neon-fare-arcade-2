import { TRAFFIC_LANE_OFFSET } from "./config";
import type { TrafficCar } from "./model";
import { sampleSpecialRoad, specialRoadLength } from "./road-network";

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
  car.heading = sample.heading + (car.dir < 0 ? Math.PI : 0);
  return true;
}
