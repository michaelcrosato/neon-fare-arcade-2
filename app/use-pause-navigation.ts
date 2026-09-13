import { useCallback, useRef, useState, type RefObject } from "react";
import type { Mode } from "@/game/model";
import type { PauseView } from "./pause-menu";

/** Options and Escape share a hub without creating a run from the lobby. */
export function usePauseNavigation(mode: RefObject<Mode>, announce: (message: string) => void) {
  const [menuOptionsOpen, setMenuOptionsOpen] = useState(false);
  const [pauseView, setPauseView] = useState<PauseView>("drive");
  const returnMode = useRef<"playing" | "countdown">("playing");
  const preparePauseMode = useCallback((next: Mode) => {
    if (next === "paused" && mode.current !== "paused") {
      returnMode.current = mode.current === "countdown" ? "countdown" : "playing";
      setPauseView("drive");
    }
    setMenuOptionsOpen(false);
  }, [mode]);
  const resumePauseMenu = useCallback((setMode: (mode: Mode) => void) => {
    if (menuOptionsOpen) setMenuOptionsOpen(false);
    else { setMode(returnMode.current); announce("Game resumed."); }
  }, [announce, menuOptionsOpen]);
  const togglePauseMenu = useCallback((setMode: (mode: Mode) => void) => {
    if (mode.current === "playing" || mode.current === "countdown") {
      setMode("paused"); announce("Game paused.");
    } else if (mode.current === "paused" || menuOptionsOpen) resumePauseMenu(setMode);
    else setMenuOptionsOpen(true);
  }, [announce, menuOptionsOpen, mode, resumePauseMenu]);
  return { menuOptionsOpen, pauseView, setPauseView, preparePauseMode, resumePauseMenu, togglePauseMenu };
}
