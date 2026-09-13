import { HORIZON_COLUMNS, HORIZON_HEIGHT, HORIZON_WIDTH, horizonNoise, horizonVantage, makeHorizonProfile } from "@/game/render/horizon";
import type { WorldPoint } from "@/game/model";

const TAU = Math.PI * 2;
const rgb = (color: readonly number[]) => `rgb(${color.map(Math.round).join(" ")})`;
const elevationY = (elevation: number) => HORIZON_HEIGHT * (.5 - elevation / Math.PI);

/** Vector-authored distant art stays independent of 3D chunk/actor budgets. */
export function paintHorizonPanorama(canvas: HTMLCanvasElement, point: WorldPoint) {
  canvas.width = HORIZON_WIDTH; canvas.height = HORIZON_HEIGHT;
  const ctx = canvas.getContext("2d")!;
  const profile = makeHorizonProfile(point);
  const warm = profile.regionId === "copper-mesa" || profile.regionId === "ironwake-works";
  const tropical = profile.regionId === "cypress-reach";
  const fog = warm ? "#c4ceca" : tropical ? "#bfd4d5" : "#bdd3d8";
  const sky = ctx.createLinearGradient(0, 0, 0, HORIZON_HEIGHT / 2);
  sky.addColorStop(0, "#398ec4"); sky.addColorStop(.64, "#78b9da");
  sky.addColorStop(.9, tropical ? "#d8dde0" : warm ? "#dfded0" : "#d3e3e6");
  sky.addColorStop(1, fog);
  ctx.fillStyle = sky; ctx.fillRect(0, 0, HORIZON_WIDTH, HORIZON_HEIGHT);

  const shape = (points: number[][], fill: string, stroke?: string) => {
    ctx.beginPath(); ctx.moveTo(points[0][0], points[0][1]);
    for (const [x, y] of points.slice(1)) ctx.lineTo(x, y);
    ctx.closePath(); ctx.fillStyle = fill; ctx.fill();
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = .85; ctx.stroke(); }
  };
  const line = (points: number[][], color: string, width = 1) => {
    ctx.beginPath(); ctx.moveTo(points[0][0], points[0][1]);
    for (const [x, y] of points.slice(1)) ctx.lineTo(x, y);
    ctx.strokeStyle = color; ctx.lineWidth = width; ctx.stroke();
  };
  const wrapped = (bearing: number, elevation: number, draw: () => void) => {
    const x = (bearing / TAU + .5) * HORIZON_WIDTH, y = elevationY(elevation);
    for (const offset of [-HORIZON_WIDTH, 0, HORIZON_WIDTH]) {
      ctx.save(); ctx.translate(x + offset, y); draw(); ctx.restore();
    }
  };

  // A single sun and shared clouds remain on the celestial compass in every region.
  wrapped(.32, .32, () => {
    ctx.fillStyle = "#eed6a5"; ctx.beginPath(); ctx.arc(0, 0, 22, 0, TAU); ctx.fill();
    for (let ray = 0; ray < 8; ray++) {
      const angle = ray * Math.PI / 4;
      line([[Math.cos(angle) * 17, Math.sin(angle) * 17], [Math.cos(angle) * 21, Math.sin(angle) * 21]], "#dba949", 1.5);
    }
    const vertices = Array.from({ length: 10 }, (_, i) => [Math.cos(i / 10 * TAU) * 12, Math.sin(i / 10 * TAU) * 12]);
    shape(vertices, "#ffdb80", "#c9a463");
    shape(vertices.map(([x, y]) => [x * .7 - 2, y * .7 - 2]), "#ffe9ab");
  });
  for (const [bearing, elevation, scale] of [[-2.7, .35, 1], [-1.06, .43, 1.2], [.88, .25, .8], [2.2, .5, 1.05], [3.05, .22, .62]]) {
    wrapped(bearing, elevation, () => {
      ctx.scale(scale, scale);
      ctx.beginPath(); ctx.moveTo(-40, 8);
      ctx.bezierCurveTo(-50, -7, -28, -14, -21, -9);
      ctx.bezierCurveTo(-16, -28, 7, -29, 15, -12);
      ctx.bezierCurveTo(31, -21, 43, -9, 39, -2);
      ctx.bezierCurveTo(59, -3, 54, 10, 39, 11);
      ctx.lineTo(-30, 12); ctx.closePath();
      ctx.fillStyle = "#f3eee0"; ctx.fill(); ctx.lineWidth = .8; ctx.strokeStyle = "#9baeb5"; ctx.stroke();
      shape([[-38, 7], [-12, 3], [9, 6], [39, 3], [44, 9], [23, 12], [-30, 12]], "#d1dfe0");
    });
  }

  // Each filled strip extends beneath the horizon. Overlap prevents subpixel seams;
  // there are no angular gates, rectangular cutouts or floating bottom edges.
  const step = HORIZON_WIDTH / HORIZON_COLUMNS;
  for (let i = 0; i < HORIZON_COLUMNS; i++) {
    const a = profile.columns[i], b = profile.columns[i + 1], x = i * step;
    shape([[x, elevationY(a.far)], [x + step + .4, elevationY(b.far)], [x + step + .4, HORIZON_HEIGHT], [x, HORIZON_HEIGHT]], rgb(a.farColor));
  }
  // Paint snow after the whole far ridge, so the next ground strip cannot erase
  // the previous cap's antialiased edge and leave a row of vertical teeth.
  for (let i = 0; i < HORIZON_COLUMNS; i++) {
    const a = profile.columns[i], b = profile.columns[i + 1], x = i * step;
    const snowy = ["mountain", "alpine"].includes(a.ridge.setting);
    if (snowy && a.far > .13 && b.far > .13) {
      const depthA = .015 + horizonNoise(-Math.PI + i / HORIZON_COLUMNS * TAU, 77, 19) * .018;
      const depthB = .015 + horizonNoise(-Math.PI + (i + 1) / HORIZON_COLUMNS * TAU, 77, 19) * .018;
      shape([[x, elevationY(a.far)], [x + step + .3, elevationY(b.far)], [x + step + .3, elevationY(b.far - depthB)], [x, elevationY(a.far - depthA)]], "#e4e6df");
    }
  }
  // Faceted middle ridges give the distant land depth without black slab outlines.
  for (let i = 0; i < HORIZON_COLUMNS; i++) {
    const a = profile.columns[i], b = profile.columns[i + 1], x = i * step;
    const bearing = -Math.PI + i / HORIZON_COLUMNS * TAU;
    const ridge = .38 + horizonNoise(bearing, 39, 67) * .3;
    const ridgeB = .38 + horizonNoise(bearing + TAU / HORIZON_COLUMNS, 39, 67) * .3;
    const middle = a.farColor.map((value, c) => value * .55 + a.nearColor[c] * .45);
    shape([[x, elevationY(a.far * ridge)], [x + step + .4, elevationY(b.far * ridgeB)], [x + step + .4, HORIZON_HEIGHT], [x, HORIZON_HEIGHT]], rgb(middle));
  }
  // A distant City can rise behind Cedar's trees or Copper's lower ground.
  // The nearer ridge still masks it, and distance keeps it smaller and hazier.
  for (let i = 0; i < 256; i++) {
    const column = profile.columns[Math.floor(i / 256 * HORIZON_COLUMNS)];
    if (!column.distantCity) continue;
    const bearing = -Math.PI + (i + .5) / 256 * TAU;
    const scale = Math.min(.6, 1600 / (column.distantCity.distance + 1200));
    const height = (.04 + horizonNoise(bearing, 256, 53) * .09) * scale;
    if (height <= column.foreground) continue;
    wrapped(bearing, 0, () => {
      const base = -column.foreground * HORIZON_HEIGHT / Math.PI;
      shape([[-2, base], [-2, -height * HORIZON_HEIGHT / Math.PI], [3, -height * HORIZON_HEIGHT / Math.PI], [3, base]], "#a6b9bd");
    });
  }
  for (let i = 0; i < HORIZON_COLUMNS; i++) {
    const a = profile.columns[i], b = profile.columns[i + 1], x = i * step;
    shape([[x, elevationY(a.near)], [x + step + .4, elevationY(b.near)], [x + step + .4, HORIZON_HEIGHT], [x, HORIZON_HEIGHT]], rgb(a.nearColor));
  }

  // Small, readable silhouettes distinguish the actual region in that bearing.
  // They sit on continuous ground and avoid duplicating named 3D landmarks.
  for (let i = 0; i < 256; i++) {
    const bearing = -Math.PI + (i + .2 + horizonNoise(i, 41, 71) * .6) / 256 * TAU;
    const column = profile.columns[Math.floor((i + .5) / 256 * HORIZON_COLUMNS)];
    const setting = column.target.setting, noise = horizonNoise(bearing, 256, 53);
    const base = column.near, ink = "#65878e";
    wrapped(bearing, base - .008, () => {
      const detailScale = Math.max(.4, Math.min(1, 1400 / (column.target.distance + 1200)));
      ctx.scale(detailScale, detailScale);
      const pine = (x: number, size: number) => {
        shape([[x, -size], [x + size * .3, -size * .4], [x + size * .18, -size * .4], [x + size * .4, 0], [x - size * .4, 0], [x - size * .18, -size * .4], [x - size * .3, -size * .4]], "#75968c");
      };
      const palm = (x: number, height: number) => {
        line([[x, 2], [x + 2, -height]], "#87978b", 1.4);
        for (const direction of [-1, 1]) {
          shape([[x + 2, -height], [x + direction * 8, -height - 3], [x + direction * 12, -height + 1], [x + direction * 5, -height - 1]], "#749a90");
          shape([[x + 2, -height], [x + direction * 7, -height + 1], [x + direction * 8, -height + 5]], "#6d938c");
        }
      };
      if (["mountain", "alpine", "headlands", "foothills"].includes(setting)) {
        if (noise > .18) pine(-3, 3 + noise * 10);
        if (noise > .5) pine(2, 3 + noise * 5);
      } else if (["residential", "countryside"].includes(setting)) {
        if (i % 5 === 0 && setting === "residential") {
          shape([[-7, 3], [-7, -2], [-2, -6 - noise * 3], [3, -2], [3, 3]], "#bec2aa");
          line([[-7, -2], [-2, -6 - noise * 3], [3, -2]], "#91a197", 1);
        }
        if (noise > .25) {
          ctx.fillStyle = "#86a18c"; ctx.beginPath(); ctx.ellipse(3, -2, 3 + noise * 4, 3 + noise * 6, 0, 0, TAU); ctx.fill();
        }
      } else if (setting === "city") {
        if (noise < .15) return;
        const cluster = .5 + horizonNoise(bearing, 9, 61) * .5;
        const height = (8 + noise * 24) * cluster, width = 3 + noise * 4;
        shape([[-width, 3], [-width, -height], [width, -height], [width, 3]], "#8ba6ae", ink);
        shape([[0, -height], [width, -height], [width, 3], [0, 3]], "#7499a5");
        if (i % 3 === 0) shape([[-width * .65, -height], [-width * .65, -height - 5], [width * .65, -height - 5], [width * .65, -height]], "#94b1b8", ink);
        for (let y = -height + 4; y < -1; y += 5) line([[-width + 1, y], [width - 1, y]], "#bdd0cb", .8);
      } else if (setting === "industrial") {
        shape([[-6, 3], [-6, -3], [-3, -7], [0, -3], [3, -7], [6, -3], [6, 3]], "#9aaba9");
        if (i % 4 === 0) {
          shape([[-2, 0], [-2, -19], [1, -19], [1, 0]], "#a59185");
          line([[-2, -14], [1, -14]], "#c1b7a7", 2);
        }
        if (i % 11 === 0) {
          line([[-5, 1], [-5, -21], [13, -24], [19, -18]], "#819ba0", 1.5);
          line([[-5, -19], [17, -19], [13, -24], [-5, -19]], "#819ba0", 1);
          line([[12, -20], [12, -6]], "#819ba0", .8);
        }
      } else if (setting === "wetland" || setting === "coastal") {
        if (i % 7 < 3) {
          const height = setting === "wetland" ? 6 + noise * 17 : 3 + noise * 7;
          shape([[-5, 3], [-5, -height], [4, -height], [4, 3]], i % 2 ? "#c2bdb5" : "#b7c9c6", "#99b3b2");
          for (let y = -height + 3; y < 0; y += 4) line([[-5, y], [4, y]], "#9ebbbd", .8);
        } else if (i % 7 > 4) palm(0, 8 + noise * 8);
      } else if (setting === "desert" || setting === "badlands") {
        if (noise > .65) {
          shape([[-8, 4], [-5, -2], [-3, -10 - noise * 6], [2, -10 - noise * 6], [4, -1], [9, 4]], "#b89981");
          line([[-4, -6], [3, -6]], "#cfb197", 1);
        }
      } else if (setting === "ocean") {
        line([[-5, 2], [5, 2]], "#d0e0dd", .7);
        if (i % 19 === 0) {
          shape([[-3, 7], [5, 7], [3, 9], [-2, 9]], "#9bb8be");
          shape([[1, 6], [1, -1], [4, 6]], "#e0e6db");
        }
      }
    });
  }
  const haze = ctx.createLinearGradient(0, elevationY(-.015), 0, elevationY(-.23));
  haze.addColorStop(0, "#bdd3d800"); haze.addColorStop(1, fog);
  ctx.fillStyle = haze; ctx.fillRect(0, elevationY(-.015), HORIZON_WIDTH, HORIZON_HEIGHT);
  return profile;
}

/** Two bounded canvases support travel/region crossfades without per-frame art
 * generation or downloads. Reduced-motion renders use seconds=0 and switch directly. */
export class HorizonPanorama {
  current = document.createElement("canvas");
  previous = document.createElement("canvas");
  revision = 0;
  regionId = "";
  private key = "";
  private changedAt = 0;

  update(point: WorldPoint, seconds: number) {
    const vantage = horizonVantage(point);
    if (vantage.key !== this.key) {
      [this.previous, this.current] = [this.current, this.previous];
      paintHorizonPanorama(this.current, vantage);
      if (!this.key) {
        this.previous.width = HORIZON_WIDTH; this.previous.height = HORIZON_HEIGHT;
        this.previous.getContext("2d")!.drawImage(this.current, 0, 0);
      }
      this.changedAt = this.key ? seconds : seconds - 1;
      this.key = vantage.key; this.regionId = vantage.regionId; this.revision++;
    }
    const blend = seconds === 0 ? 1 : Math.max(0, Math.min(1, (seconds - this.changedAt) / .4));
    return { current: this.current, previous: this.previous, revision: this.revision, regionId: this.regionId, blend };
  }
}
