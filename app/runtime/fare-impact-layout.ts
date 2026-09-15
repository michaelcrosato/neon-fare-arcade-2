export type FareRect = Readonly<{ x: number; y: number; width: number; height: number }>;

/** One compact, top-centered banner per safe viewport; independent of scene motion. */
export function fitFareImpact(width: number, height: number, layout: "desktop" | "mobile" = "desktop"): FareRect {
  const mobile = layout === "mobile";
  const fraction = mobile ? (width <= height ? 1 : .6) : .5;
  const cardWidth = Math.floor(width * fraction);
  const cardHeight = Math.floor(Math.min(height * (mobile ? .3 : .24), cardWidth / 1.8));
  return { x: (width - cardWidth) / 2, y: 0, width: cardWidth, height: cardHeight };
}

/** Only viewport/safe-area changes affect the fit; card kind and camera never do. */
export function presentFareImpact(element: HTMLDivElement, mobile: boolean) {
  const area = element.getBoundingClientRect();
  if (area.width <= 0 || area.height <= 0) return;
  const dock = element.closest(".game-stage")?.querySelector(".fare-card-stack")?.getBoundingClientRect();
  const rect = fitFareImpact(area.width, area.height, mobile ? "mobile" : "desktop");
  const art = Math.max(0, Math.floor(Math.min(rect.width * (rect.width < 240 ? .4 : .46), rect.height - 8)));
  const unit = Math.min((rect.width - art - 8) / 300, (rect.height - 8) / 220);
  const image = Math.max(art, rect.height - 8);
  const values = { x: rect.x, y: rect.y, width: rect.width, height: rect.height, art, image, unit };
  for (const [name, value] of Object.entries(values)) {
    const next = name === "unit" ? value.toFixed(3) : `${value}px`;
    if (element.style.getPropertyValue(`--fare-fit-${name}`) !== next) element.style.setProperty(`--fare-fit-${name}`, next);
  }
  // Measure the actual rail slot (including the empty first-card slot), so the
  // exit stays attached to the deck across viewport and camera changes.
  const canDock = !mobile && dock && dock.width > 0 && dock.height > 0 && rect.height > 0;
  element.dataset.docking = canDock ? "deck" : "fade";
  if (canDock) {
    const docking = {
      x: `${dock.x + dock.width / 2 - area.x - rect.x - rect.width / 2}px`,
      y: `${dock.y + dock.height / 2 - area.y - rect.y - rect.height / 2}px`,
      scale: Math.min(1, dock.width / rect.width, dock.height / rect.height).toFixed(5),
    };
    for (const [name, value] of Object.entries(docking)) {
      if (element.style.getPropertyValue(`--fare-dock-${name}`) !== value) element.style.setProperty(`--fare-dock-${name}`, value);
    }
  }
  element.dataset.layout = "wide";
  element.dataset.compact = String(rect.height < 190 || rect.width - art < 190);
  element.dataset.tight = String(rect.height < 160);
  element.style.visibility = rect.height > 0 ? "visible" : "hidden";
}
