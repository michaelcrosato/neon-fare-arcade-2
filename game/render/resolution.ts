/** Bound the scene surface independently of the full-resolution HTML HUD. */
export function renderTargetSize(
  cssWidth: number,
  cssHeight: number,
  deviceRatio: number,
  pixelBudget: number,
  maxDimension = 16384,
) {
  const width = Math.max(1, cssWidth);
  const height = Math.max(1, cssHeight);
  const scale = Math.min(
    Math.max(0.1, deviceRatio || 1),
    2,
    Math.sqrt(pixelBudget / (width * height)),
    maxDimension / Math.max(width, height),
  );
  return {
    width: Math.max(1, Math.floor(width * scale)),
    height: Math.max(1, Math.floor(height * scale)),
    scale,
  };
}
