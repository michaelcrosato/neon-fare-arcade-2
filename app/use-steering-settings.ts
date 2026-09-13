import { useCallback, useState } from "react";
import { normalizeWheelRange, type SteeringMode, type TouchDriving, type WheelRange } from "./runtime/touch-driving";
import { STEERING_MODE_STORAGE_KEY, WHEEL_RANGE_STORAGE_KEY, applySteeringForRun, parseStoredSteeringMode } from "./runtime/steering-mode";

/** Device-local control preferences; a run still locks its selected mode explicitly. */
export function useSteeringSettings(touchDriving: TouchDriving) {
  const [steeringMode, setSteeringModeState] = useState<SteeringMode>(() => {
    try {
      return parseStoredSteeringMode(localStorage.getItem(STEERING_MODE_STORAGE_KEY));
    } catch {}
    return "default";
  });
  const [wheelRange, setWheelRangeState] = useState<WheelRange>(() => {
    try { return normalizeWheelRange(localStorage.getItem(WHEEL_RANGE_STORAGE_KEY)); } catch { return normalizeWheelRange(null); }
  });
  const setWheelRange = useCallback((value: WheelRange) => {
    const range = normalizeWheelRange(value);
    touchDriving.setWheelRange(range);
    setWheelRangeState(range);
    try { localStorage.setItem(WHEEL_RANGE_STORAGE_KEY, String(range)); } catch {}
  }, [touchDriving]);
  const persistSteeringMode = useCallback((next: SteeringMode) => {
    setSteeringModeState(next);
    try { localStorage.setItem(STEERING_MODE_STORAGE_KEY, next); } catch {}
  }, []);
  const setSteeringMode = useCallback((next: SteeringMode) => {
    applySteeringForRun(touchDriving, next, persistSteeringMode);
  }, [persistSteeringMode, touchDriving]);
  return { steeringMode, setSteeringMode, persistSteeringMode, wheelRange, setWheelRange };
}
