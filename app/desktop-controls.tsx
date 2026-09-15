"use client";

import { useEffect, useState } from "react";
import { connectedGamepads } from "./runtime/gamepad-input";

export function DesktopControls({ onStart }: { onStart?: () => void }) {
  const [connected, setConnected] = useState(false);
  useEffect(() => {
    const check = () => setConnected(connectedGamepads().some(pad => pad?.connected && pad.mapping === "standard"));
    const timer = window.setInterval(check, 600);
    return () => window.clearInterval(timer);
  }, []);
  return <div className="desktop-controls">
    <div className="desktop-controls__grid" role="list" aria-label="Desktop control options">
      <article role="listitem"><span className="desktop-controls__number">01 / READY</span><div className="desktop-controls__keys" aria-hidden="true"><kbd>W</kbd><div><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd><span>↖</span></div></div>
        <h3>KEYBOARD &amp; MOUSE</h3><p>WASD / arrow keys drive and steer. Use the mouse to choose menus and map destinations.</p>
        <small>SPACE · BOOST / SIM HANDBRAKE<br />E · INTERACT　 C · CAMERA<br />P / ESC · PAUSE<br />MANUAL ACCORD: SHIFT · CLUTCH, Z / X · GEARS</small>
        {onStart && <button className="driver-trait__pick" data-modal-autofocus="true" aria-label="Select DEFAULT keyboard and mouse controls" onClick={onStart}>DRIVE WITH KEYS <b>↗</b></button>}
      </article>
      <article role="listitem"><span className="desktop-controls__number">02 / {connected ? "CONNECTED" : "PLUG IN & PLAY"}</span>
        <svg className="desktop-controls__pad" viewBox="0 0 200 100" aria-hidden="true"><path d="M48 18Q26 16 16 48L7 78Q6 98 24 88L59 69h82l35 19q18 10 17-10l-9-30q-10-32-32-30Z" fill="#eee8da" stroke="currentColor" strokeWidth="5" /><path d="M62 23h76v45H62Z" fill="#171b24" /><circle cx="74" cy="68" r="12" fill="#10151f" /><circle cx="126" cy="68" r="12" fill="#10151f" /><path d="M36 37v26m-13-13h26" stroke="#10151f" strokeWidth="7" /><g fontSize="16" fill="#10151f" textAnchor="middle"><text x="160" y="36">△</text><text x="160" y="68">✕</text><text x="145" y="53">□</text><text x="177" y="53">○</text></g></svg>
        <h3>GAMEPAD</h3><p>PS5-style layout via your browser’s standard controller mapping. Connect by USB or Bluetooth, then press a button.</p>
        <small>LEFT STICK · STEER　 R2 / L2 · GAS / BRAKE<br />✕ · BOOST / SIM HANDBRAKE　 □ · INTERACT<br />△ · CAMERA　 OPTIONS · PAUSE<br />MANUAL ACCORD: L1 · CLUTCH, D-PAD ← / → · GEARS</small>
        {onStart && <button className="driver-trait__pick" aria-label="Select gamepad controls" onClick={onStart}>DRIVE WITH GAMEPAD <b>↗</b></button>}
      </article>
      <article role="listitem" className="desktop-controls__future"><span className="desktop-controls__number">03 / COMING LATER</span><div className="desktop-controls__wheel" aria-hidden="true">⊕</div>
        <h3>STEERING WHEEL</h3><p>A real wheel, pedals and proper calibration deserve their own development pass.</p><small>PHYSICAL WHEEL SUPPORT IS PLANNED.<br />THIS BAY IS A PLACEHOLDER.</small>
        {onStart && <button className="driver-trait__pick" disabled>SUPPORT COMING LATER</button>}
      </article>
    </div>
    <p className="desktop-controls__status" role="status">{connected ? "GAMEPAD CONNECTED · Keyboard and mouse remain available." : "Keyboard and mouse are ready. A connected gamepad appears after its first button press."}</p>
  </div>;
}
