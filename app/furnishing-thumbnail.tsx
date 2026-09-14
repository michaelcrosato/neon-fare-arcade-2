import { furnishingModel } from "@/game/render/furnishings";
import type { FurnishingId } from "@/game/furnishing-catalog";

export function FurnishingThumbnail({ id }: { id: FurnishingId }) {
  const project = (x: number, y: number, z: number) => [(x - y) * .85, (x + y) * .36 - z] as const;
  const faces = furnishingModel(id).sort((a, b) => a.x + a.y + a.z - b.x - b.y - b.z).flatMap(box => {
    const { x, y, z, sx, sy, sz } = box;
    const left = x - sx / 2, right = x + sx / 2, front = y - sy / 2, back = y + sy / 2, top = z + sz / 2, bottom = z - sz / 2;
    return [
      { points: [[left, back, bottom], [right, back, bottom], [right, back, top], [left, back, top]], light: .8 },
      { points: [[right, front, bottom], [right, back, bottom], [right, back, top], [right, front, top]], light: .92 },
      { points: [[left, front, top], [right, front, top], [right, back, top], [left, back, top]], light: 1.12 },
    ].map(face => ({ points: face.points.map(([x, y, z]) => project(x, y, z)),
      color: `rgb(${box.color.slice(0, 3).map(value => Math.round(Math.min(1, value * face.light) * 255)).join(" ")})` }));
  });
  const xs = faces.flatMap(face => face.points.map(point => point[0])), ys = faces.flatMap(face => face.points.map(point => point[1]));
  const left = Math.min(...xs) - .7, top = Math.min(...ys) - .7, width = Math.max(...xs) - left + .7, height = Math.max(...ys) - top + .7;
  return <svg className="furnishing-thumbnail" viewBox={`${left} ${top} ${width} ${height}`} aria-hidden="true">
    {faces.map((face, i) => <polygon key={i} points={face.points.map(point => point.join(",")).join(" ")} fill={face.color} stroke="#161616" strokeWidth=".045" strokeLinejoin="round" />)}
  </svg>;
}
