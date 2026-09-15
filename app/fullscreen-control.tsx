"use client";

import { useEffect, useState } from "react";
import { requestGameFullscreen } from "./runtime/game-display";

export function FullscreenControl() {
  const [active, setActive] = useState(false);
  const [notice, setNotice] = useState("");
  useEffect(() => {
    const sync = () => setActive(Boolean(document.fullscreenElement
      || (document as Document & { webkitFullscreenElement?: Element }).webkitFullscreenElement));
    const frame = requestAnimationFrame(sync);
    document.addEventListener("fullscreenchange", sync);
    document.addEventListener("webkitfullscreenchange", sync);
    return () => { cancelAnimationFrame(frame); document.removeEventListener("fullscreenchange", sync); document.removeEventListener("webkitfullscreenchange", sync); };
  }, []);
  return <div className="fullscreen-control">
    <button type="button" className="fullscreen-control__button" disabled={active} onClick={async () => {
      const result = await requestGameFullscreen();
      setNotice(result === "unsupported"
        ? "This browser does not offer fullscreen. On iPhone or iPad, use Safari’s Share menu → Add to Home Screen, then open the game from that icon."
        : result === "blocked" ? "Fullscreen was blocked. Open the game directly in your browser, then try this button again."
          : "Fullscreen is on. You can return here whenever you need it.");
    }}><span aria-hidden="true">⛶</span><strong>{active ? "FULLSCREEN IS ON" : "ENTER FULLSCREEN"}</strong><small>MORE ROOM TO DRIVE</small></button>
    {notice && <p role="status">{notice}</p>}
  </div>;
}
