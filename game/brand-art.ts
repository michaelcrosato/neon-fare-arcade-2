import type { BrandId } from "./brands";

const GLYPHS: Record<string, string[]> = {
  A: ["01110","11011","11011","11111","11011","11011","11011"], B: ["11110","11011","11011","11110","11011","11011","11110"],
  C: ["01111","11000","11000","11000","11000","11000","01111"], E: ["11111","11000","11000","11110","11000","11000","11111"],
  G: ["01111","11000","11000","11011","11011","11011","01111"], I: ["11111","01110","01110","01110","01110","01110","11111"],
  K: ["11011","11011","11110","11100","11110","11011","11011"], M: ["11011","11111","11111","11011","11011","11011","11011"],
  O: ["01110","11011","11011","11011","11011","11011","01110"], R: ["11110","11011","11011","11110","11110","11011","11011"],
  S: ["01111","11000","11000","01110","00011","00011","11110"], T: ["11111","01110","01110","01110","01110","01110","01110"],
  W: ["11011","11011","11011","11011","11111","11111","01110"], Y: ["11011","11011","01110","01110","01110","01110","01110"],
  "-": ["00000","00000","00000","11111","00000","00000","00000"], " ": ["00000","00000","00000","00000","00000","00000","00000"],
};
export type LogoRect = { x: number; y: number; width: number; height: number };
/** Greedy rectangles keep the exact same crisp custom wordmark cheap in 3D and SVG. */
export function wordmarkRects(text: string): LogoRect[] {
  const rectangles: LogoRect[] = [];
  for (const [letter, char] of [...text].entries()) {
    const grid = (GLYPHS[char] ?? GLYPHS[" "]).map(row => [...row].map(value => value === "1"));
    for (let y = 0; y < 7; y++) for (let x = 0; x < 5; x++) {
      if (!grid[y][x]) continue;
      let width = 1, height = 1;
      while (x + width < 5 && grid[y][x + width]) width++;
      while (y + height < 7 && grid[y + height].slice(x, x + width).every(Boolean)) height++;
      for (let row = y; row < y + height; row++) for (let col = x; col < x + width; col++) grid[row][col] = false;
      rectangles.push({ x: letter * 6 + x, y, width, height });
    }
  }
  return rectangles;
}
export function brandIcon(id: BrandId): readonly (readonly [number, number])[][] {
  if (id === "best-byte") return [[[42,8],[16,45],[39,45]], [[39,34],[27,78],[62,34]]];
  if (id === "cost-go") return [[[18,41],[39,41],[39,63],[18,63]], [[43,41],[64,41],[64,63],[43,63]], [[30,15],[52,15],[52,37],[30,37]]];
  if (id === "i-kit") return [[[40,10],[67,40],[40,70],[13,40]], [[21,75],[59,75],[59,79],[21,79]]];
  if (id === "wow-mart") return Array.from({ length: 6 }, (_, i) => {
    const angle = i * Math.PI / 3;
    return [12,30,30,12].map((radius, index): [number,number] => [40 + Math.cos(angle + (index < 2 ? -.12 : .12)) * radius, 43 + Math.sin(angle + (index < 2 ? -.12 : .12)) * radius]);
  });
  return [[[40,8],[62,42],[62,56],[54,69],[40,75],[26,69],[18,56],[18,42]]];
}
