"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { applyDevelopmentSettings, normalizeDevelopmentSettings, type DevelopmentSettings } from "@/game/development-settings";
import type { Game } from "@/game/model";

const STORAGE_KEY = "neon-fare-development-v1";

export function useDevelopmentMode(gameRef: RefObject<Game>, onChange: () => void) {
  const [settings, setSettings] = useState(() => normalizeDevelopmentSettings(null));
  const settingsRef = useRef(settings);
  const changeSettings = useCallback((value: DevelopmentSettings) => {
    const next = applyDevelopmentSettings(gameRef.current, value);
    settingsRef.current = next;
    setSettings(next);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
    onChange();
  }, [gameRef, onChange]);

  useEffect(() => {
    let saved: unknown = null;
    try { saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null"); } catch {}
    const next = normalizeDevelopmentSettings(saved);
    settingsRef.current = next;
    applyDevelopmentSettings(gameRef.current, next);
    const frame = window.requestAnimationFrame(() => setSettings(next));
    return () => window.cancelAnimationFrame(frame);
  }, [gameRef]);

  return { settings, settingsRef, changeSettings };
}
