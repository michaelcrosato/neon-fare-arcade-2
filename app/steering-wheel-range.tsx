import { useId } from "react";
import { DEFAULT_WHEEL_RANGE, WHEEL_RANGES, normalizeWheelRange, type WheelRange } from "./runtime/touch-driving";

export function SteeringWheelRange({ value = DEFAULT_WHEEL_RANGE, onChange }: {
  value?: WheelRange;
  onChange?: (range: WheelRange) => void;
}) {
  const hint = useId();
  return <label className="steering-wheel-range">
    <span>Wheel rotation range</span>
    <select value={value} onChange={event => onChange?.(normalizeWheelRange(event.target.value))} aria-describedby={hint}>
      {WHEEL_RANGES.map(range => <option key={range} value={range}>{range}° total (±{range / 2}°)</option>)}
    </select>
    <small id={hint}>Lower degrees give tighter steering. Saved on this device.</small>
  </label>;
}
