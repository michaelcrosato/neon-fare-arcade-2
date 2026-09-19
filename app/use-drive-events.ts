import { useCallback, useRef, useState, type RefObject } from "react";
import type { Game, Hud, Mode } from "@/game/model";
import type { StoryCard } from "@/game/accord-events";
import { makeHud } from "@/game/hud";
import { isDriving } from "@/game/player";
import type { GamepadActions } from "./runtime/gamepad-input";

export function useDriveEvents({ gameRef, modeRef, modalDialogRef, clearInput, setHud, setMode, togglePause, resumeFromPause, cycleCamera }: {
  gameRef: RefObject<Game>; modeRef: RefObject<Mode>; modalDialogRef: RefObject<HTMLElement | null>;
  clearInput: () => void; setHud: (hud: Hud) => void; setMode: (mode: Mode) => void;
  togglePause: () => void; resumeFromPause: () => void; cycleCamera: () => void;
}) {
  const [storyCard, setStoryCard] = useState<StoryCard | null>(null);
  const storyCardRef = useRef<StoryCard | null>(null);
  const dismissStoryCard = useCallback(() => {
    if (!storyCardRef.current || document.hidden) return;
    storyCardRef.current = null;
    setStoryCard(null);
    clearInput();
    setMode(modalDialogRef.current ? "paused" : "playing");
  }, [clearInput, modalDialogRef, setMode]);
  const showStoryCard = useCallback((card: StoryCard) => {
    storyCardRef.current = card;
    setStoryCard(card);
    setHud(makeHud(gameRef.current));
    setMode("paused");
  }, [gameRef, setHud, setMode]);
  const onGamepadActions = useCallback((actions: GamepadActions) => {
    if (storyCardRef.current) { if (actions.confirm) dismissStoryCard(); return; }
    if (modalDialogRef.current) {
      if (actions.confirm) modalDialogRef.current.querySelector<HTMLButtonElement>("[data-gamepad-confirm='true']")?.click();
      return;
    }
    if (actions.pause && ["playing", "countdown", "paused"].includes(modeRef.current)) togglePause();
    else if (actions.confirm && modeRef.current === "paused") resumeFromPause();
    else if (actions.camera && modeRef.current === "playing" && isDriving(gameRef.current)) cycleCamera();
  }, [cycleCamera, dismissStoryCard, gameRef, modalDialogRef, modeRef, resumeFromPause, togglePause]);
  return { storyCard, storyCardRef, dismissStoryCard, showStoryCard, onGamepadActions };
}
