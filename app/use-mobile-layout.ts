"use client";

import { useSyncExternalStore } from "react";

// Keep this query in sync with the mobile section of 80-accessibility-motion-responsive.css.
const MOBILE_QUERY = "(max-width: 820px), (pointer: coarse)";
function subscribe(callback: () => void) {
  const media = window.matchMedia(MOBILE_QUERY);
  media.addEventListener("change", callback);
  return () => media.removeEventListener("change", callback);
}
const snapshot = () => window.matchMedia(MOBILE_QUERY).matches;
const serverSnapshot = () => false;

export function useMobileLayout() {
  return useSyncExternalStore(subscribe, snapshot, serverSnapshot);
}
