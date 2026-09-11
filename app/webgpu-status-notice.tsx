"use client";

import { useEffect, useState } from "react";

export function WebGpuStatusNotice({ rendererKind }: { rendererKind: string }) {
  const [dismissedKind, setDismissedKind] = useState<string | null>(null);

  const isInitializing =
    rendererKind.startsWith("INITIALIZING") ||
    rendererKind.startsWith("REQUESTING") ||
    rendererKind.startsWith("CONFIGURING") ||
    rendererKind.startsWith("COMPILING");

  const isReady = rendererKind === "WEBGPU ACTIVE";
  const isFallback = rendererKind === "CANVAS FALLBACK";
  const isError = rendererKind === "DISPLAY UNAVAILABLE";

  useEffect(() => {
    if (!isReady && !isFallback && !isError) return;
    const timer = window.setTimeout(() => setDismissedKind(rendererKind), 3500);
    return () => window.clearTimeout(timer);
  }, [isFallback, isReady, isError, rendererKind]);

  if (dismissedKind === rendererKind) return null;

  const statusClass = isInitializing
    ? "is-loading"
    : isReady
      ? "is-ready"
      : isFallback
        ? "is-fallback"
        : "is-error";

  const headline = isInitializing
    ? "HARDWARE GRAPHICS"
    : isReady
      ? "HARDWARE ACCELERATION READY"
      : isFallback
        ? "CANVAS 2D MODE"
        : "GRAPHICS ERROR";

  const subline = isInitializing
    ? rendererKind
    : isReady
      ? "WEBGPU PIPELINE ACTIVE · 60FPS"
      : isFallback
        ? "CANVAS FALLBACK · COMPATIBILITY PIPELINE"
        : "DISPLAY CONTEXT UNAVAILABLE";

  return (
    <aside
      className={`webgpu-status-notice ${statusClass}`}
      role="status"
      aria-label="Graphics system status"
    >
      <span className="webgpu-status-dot" aria-hidden="true" />
      <div className="webgpu-status-info">
        <strong className="webgpu-status-title">{headline}</strong>
        <span className="webgpu-status-detail">{subline}</span>
      </div>
    </aside>
  );
}
