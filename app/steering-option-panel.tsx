"use client";

import { useEffect, type ReactNode } from "react";
import type { SteeringMode } from "./runtime/touch-driving";

export type SteeringOption = {
  id: SteeringMode;
  number: string;
  name: string;
  badge: string;
  description: string;
  graphic: ReactNode;
};

export const STEERING_OPTIONS: readonly SteeringOption[] = [
  {
    id: "default",
    number: "01",
    name: "DEFAULT",
    badge: "2 HAND · TOUCH DRAG",
    description: "Classic touch-drag steering on the left road surface with separate gas and brake pedals on the right.",
    graphic: (
      <svg viewBox="0 0 200 80" className="steering-card__svg" aria-hidden="true">
        <g transform="translate(10, 0)">
          <line x1="8" y1="40" x2="72" y2="40" stroke="currentColor" strokeWidth="3" strokeDasharray="4 3" opacity="0.4" />
          <path d="M 6 40 L 14 34 L 14 46 Z" fill="currentColor" opacity="0.6" />
          <path d="M 74 40 L 66 34 L 66 46 Z" fill="currentColor" opacity="0.6" />
          <circle cx="40" cy="40" r="15" fill="#00e5ff" stroke="#000" strokeWidth="2.5" />
          <circle cx="40" cy="40" r="7" fill="#fff" opacity="0.7" />
          <text x="40" y="68" textAnchor="middle" fontSize="9" fontWeight="900" fontFamily="monospace" fill="currentColor">LEFT THUMB</text>
        </g>
        <line x1="100" y1="12" x2="100" y2="68" stroke="currentColor" strokeWidth="2" strokeDasharray="3 3" opacity="0.25" />
        <g transform="translate(108, 0)">
          <rect x="8" y="18" width="30" height="42" rx="6" fill="#1a1a24" stroke="#ff3b30" strokeWidth="2.5" />
          <text x="23" y="43" textAnchor="middle" fontSize="9" fontWeight="900" fontFamily="monospace" fill="#ff3b30">BRAKE</text>
          <rect x="46" y="10" width="32" height="52" rx="6" fill="#1a1a24" stroke="#ffd700" strokeWidth="2.5" />
          <rect x="48" y="38" width="28" height="22" rx="4" fill="#ffd700" opacity="0.35" />
          <text x="62" y="39" textAnchor="middle" fontSize="10" fontWeight="900" fontFamily="monospace" fill="#ffd700">GAS</text>
          <text x="43" y="74" textAnchor="middle" fontSize="9" fontWeight="900" fontFamily="monospace" fill="currentColor">RIGHT THUMB</text>
        </g>
      </svg>
    ),
  },
  {
    id: "joystick",
    number: "02",
    name: "JOYSTICK · 1 HAND",
    badge: "1 HAND · SINGLE THUMB",
    description: "One thumb controls everything: up accelerates, down brakes, left & right steer with center deadzones and full diagonal support.",
    graphic: (
      <svg viewBox="0 0 200 80" className="steering-card__svg" aria-hidden="true">
        <g transform="translate(100, 40)">
          <circle cx="0" cy="0" r="34" fill="#16161e" stroke="currentColor" strokeWidth="2.5" opacity="0.8" />
          <circle cx="0" cy="0" r="12" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="2 2" opacity="0.35" />
          <text x="0" y="-22" textAnchor="middle" fontSize="8" fontWeight="900" fontFamily="monospace" fill="#ffd700">▲ GAS</text>
          <text x="0" y="30" textAnchor="middle" fontSize="8" fontWeight="900" fontFamily="monospace" fill="#ff3b30">▼ BRAKE</text>
          <text x="-24" y="3" textAnchor="middle" fontSize="10" fontWeight="900" fill="currentColor">◀</text>
          <text x="24" y="3" textAnchor="middle" fontSize="10" fontWeight="900" fill="currentColor">▶</text>
          <line x1="0" y1="0" x2="12" y2="-10" stroke="#ffd700" strokeWidth="4" strokeLinecap="round" />
          <circle cx="12" cy="-10" r="14" fill="#ffd700" stroke="#000" strokeWidth="2.5" />
          <circle cx="12" cy="-10" r="6" fill="#fff" opacity="0.7" />
        </g>
        <text x="26" y="44" textAnchor="middle" fontSize="9" fontWeight="900" fontFamily="monospace" fill="currentColor">1 THUMB</text>
        <text x="174" y="44" textAnchor="middle" fontSize="9" fontWeight="900" fontFamily="monospace" fill="currentColor">ALL IN 1</text>
      </svg>
    ),
  },
  {
    id: "wheel",
    number: "03",
    name: "WHEEL · RETURN",
    badge: "3.5 TURNS · REALISTIC",
    description: "Virtual steering wheel with 3.5 turns lock-to-lock (-630° to +630°). Holds angle while touched and smoothly returns toward center when released.",
    graphic: (
      <svg viewBox="0 0 200 80" className="steering-card__svg" aria-hidden="true">
        <path d="M 46 22 A 38 38 0 0 0 46 58" fill="none" stroke="#ffd700" strokeWidth="2.5" strokeDasharray="4 2" />
        <polygon points="43,26 48,18 52,25" fill="#ffd700" />
        <path d="M 154 58 A 38 38 0 0 0 154 22" fill="none" stroke="#ffd700" strokeWidth="2.5" strokeDasharray="4 2" />
        <polygon points="157,54 152,62 148,55" fill="#ffd700" />
        <text x="28" y="44" textAnchor="middle" fontSize="8" fontWeight="900" fontFamily="monospace" fill="currentColor">-630°</text>
        <text x="172" y="44" textAnchor="middle" fontSize="8" fontWeight="900" fontFamily="monospace" fill="currentColor">+630°</text>
        <g transform="translate(100, 40)">
          <circle cx="0" cy="0" r="30" fill="#121218" stroke="#1f1f28" strokeWidth="8" />
          <circle cx="0" cy="0" r="30" fill="none" stroke="#000" strokeWidth="1" />
          <rect x="-3" y="-34" width="6" height="8" rx="1" fill="#ffd700" stroke="#000" strokeWidth="1" />
          <rect x="-24" y="-3" width="16" height="6" rx="2" fill="#3a3a46" stroke="#111" strokeWidth="1" />
          <rect x="8" y="-3" width="16" height="6" rx="2" fill="#3a3a46" stroke="#111" strokeWidth="1" />
          <rect x="-3" y="6" width="6" height="18" rx="2" fill="#3a3a46" stroke="#111" strokeWidth="1" />
          <circle cx="0" cy="0" r="10" fill="#0d0d12" stroke="#ffd700" strokeWidth="2" />
          <circle cx="0" cy="0" r="5" fill="#222" />
        </g>
      </svg>
    ),
  },
];

type SteeringOptionPanelProps = {
  currentMode: SteeringMode;
  onSelect: (mode: SteeringMode) => void;
  onBack: () => void;
};

export function SteeringOptionPanel({ currentMode, onSelect, onBack }: SteeringOptionPanelProps) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "1") {
        event.preventDefault();
        onSelect("default");
      } else if (event.key === "2") {
        event.preventDefault();
        onSelect("joystick");
      } else if (event.key === "3") {
        event.preventDefault();
        onSelect("wheel");
      } else if (event.key === "Escape") {
        event.preventDefault();
        onBack();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onSelect, onBack]);

  return (
    <div className="driver-traits steering-options">
      <p className="modal-kicker">MOBILE CONTROLS · CHOOSE STEERING</p>
      <h2 id="modal-title">STEERING SYSTEM</h2>
      <p className="driver-traits__intro" id="steering-modal-description">
        Select how you want to control your vehicle on mobile. You can switch systems anytime in Options.
      </p>

      <div className="driver-traits__grid steering-options__grid" role="list" aria-label="Steering options">
        {STEERING_OPTIONS.map((option) => {
          const isSelected = option.id === currentMode;
          return (
            <article
              key={option.id}
              role="listitem"
              className={`driver-trait driver-trait--${option.id === "default" ? "street-ace" : option.id === "joystick" ? "drift-demon" : "redline-rush"} ${isSelected ? "is-selected-trait" : ""}`}
            >
              <span className="driver-trait__number">{option.number}</span>
              <small className="driver-trait__role">{option.badge}</small>
              <strong className="driver-trait__name">{option.name}</strong>

              <div className="steering-card__graphic-box">
                {option.graphic}
              </div>

              <p className="steering-card__desc">{option.description}</p>

              <button
                type="button"
                className="driver-trait__pick"
                data-modal-autofocus={isSelected ? "true" : option.id === "default" ? "true" : undefined}
                onClick={() => onSelect(option.id)}
                aria-label={`Select ${option.name}. ${option.description}`}
              >
                LOCK IN {option.name.split(" ")[0]} <b aria-hidden="true">➜</b>
              </button>
            </article>
          );
        })}
      </div>

      <div className="steering-options__footer">
        <button
          type="button"
          className="steering-options__back-btn"
          onClick={onBack}
          aria-label="Back to vehicle selection"
        >
          ‹ BACK TO VEHICLES
        </button>
      </div>
    </div>
  );
}
