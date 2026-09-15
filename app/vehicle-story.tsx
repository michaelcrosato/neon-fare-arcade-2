"use client";

import { useEffect, useRef, useState } from "react";

export function AccordStory() {
  const [open, setOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const element = dialog.current;
    if (!open || !element) return;
    // Stop at the native dialog before the parent setup's document-level trap.
    const keydown = (event: KeyboardEvent) => {
      event.stopPropagation();
      if (event.key === "Escape") { event.preventDefault(); element.close(); }
    };
    element.addEventListener("keydown", keydown);
    element.showModal();
    return () => element.removeEventListener("keydown", keydown);
  }, [open]);
  return <>
    <button ref={trigger} type="button" className="vehicle-story-trigger" onClick={() => setOpen(true)}>READ THE ACCORD&apos;S STORY <span aria-hidden="true">↗</span></button>
    {open && <dialog ref={dialog} className="vehicle-story" aria-labelledby="accord-story-title"
      onKeyDown={event => event.stopPropagation()} onClose={() => { setOpen(false); trigger.current?.focus(); }}>
      <header><div><small>GARAGE STORIES // 02</small><h2 id="accord-story-title">SECRET SPECIAL EDITION</h2></div>
        <button type="button" aria-label="Close Accord story" onClick={() => dialog.current?.close()}>CLOSE ×</button></header>
      {/* Poster artwork uses the same timeless clutch wording as the companion copy. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/art/vehicle-stories/accord-backstory.png" width="1536" height="1024" alt="Comic backstory poster of a white 2015 Honda Accord Coupe V6, showing its engine, manual shifter, winter tires and well-used odometer. The story is transcribed below." />
      <div className="vehicle-story__copy">
        <p className="vehicle-story__tagline">SAME STREETS. JUST GOES FASTER.</p>
        <p>It looks normal. Until you drive it. This one&apos;s special. An understated white coupe with subtle upgrades and a much bigger story.</p>
        <dl><div><dt>THE V6</dt><dd>The poster calls it an untuned V6 that feels closer to 300 horsepower. Familiar on the outside; eager when you put your foot down.</dd></div>
          <div><dt>THE CLUTCH</dt><dd>It sticks sometimes. Three complete clutch pumps restore drive; Automatic also accepts three gas taps.</dd></div>
          <div><dt>THE WINTER TIRES</dt><dd>Still being financed. Because sometimes you just don&apos;t have the cash. They are part of this car&apos;s particular grip and playful feel.</dd></div>
          <div><dt>154,298 KM AND COUNTING</dt><dd>Pretty good condition. Still going strong, minus the clutch. K&amp;N, Brembo and Injen stickers, a V6 THO plate, and a lot more driving left.</dd></div></dl>
        <p>More power in a familiar package. Subtle upgrades. A bigger story.</p>
        <a href="/art/vehicle-stories/accord-backstory.png" target="_blank" rel="noreferrer">OPEN POSTER ↗</a>
      </div>
    </dialog>}
  </>;
}
