import { useId } from "react";
import type { Hud } from "@/game/model";

/** A shared, scalable picture of the actual pickup cue, also used in reminders. */
function PickupColumnIllustration() {
  const gradient = useId();
  return (
    <svg className="pickup-column-picture" viewBox="0 0 420 280" role="img"
      aria-label="A waiting passenger inside a translucent blue pickup column, with a yellow taxi approaching the blue ring">
      <defs>
        <linearGradient id={gradient} x2="0" y2="1">
          <stop stopColor="#29caff" stopOpacity=".12" />
          <stop offset="1" stopColor="#29caff" stopOpacity=".5" />
        </linearGradient>
      </defs>
      <path fill="#cce6e5" d="M0 0h420v280H0z" />
      <g fill="#98b7b9" stroke="#46636c" strokeWidth="3">
        <path d="M0 35h65v145H0zM76 68h72v112H76zM339 24h81v156h-81z" />
      </g>
      <g fill="#eaf4ed">
        <path d="M14 52h14v22H14zm25 0h14v22H39zM14 86h14v22H14zm25 0h14v22H39zM92 86h14v22H92zm25 0h14v22h-14zM356 43h17v26h-17zm28 0h17v26h-17zM356 82h17v26h-17zm28 0h17v26h-17z" />
      </g>
      <path fill="#ece7d4" stroke="#172d3a" strokeWidth="3" d="M0 179h420v33H0z" />
      <path fill="#243642" d="M0 212h420v68H0z" />
      <path stroke="#ffe13a" strokeWidth="4" strokeDasharray="38 20" d="M0 262h420" />
      <path d="M227 37a58 14 0 0 1 116 0v160a58 16 0 0 1-116 0Z" fill={`url(#${gradient})`} stroke="#39cfff" strokeWidth="2" />
      <ellipse cx="285" cy="37" rx="58" ry="14" fill="#92eaff" fillOpacity=".2" stroke="#39cfff" strokeWidth="2" />
      <ellipse cx="285" cy="199" rx="65" ry="18" fill="#38cfff" fillOpacity=".2" stroke="#8eefff" strokeWidth="5" />
      <ellipse cx="285" cy="199" rx="56" ry="13" fill="none" stroke="#168cd9" strokeWidth="2" />
      <g stroke="#172d3a" strokeWidth="4" strokeLinejoin="round" strokeLinecap="round">
        <circle cx="284" cy="129" r="11" fill="#db9864" />
        <path d="m274 161-3 34m22-34 6 34" fill="none" />
        <path d="m272 146-9 24m33-24 12-16 1-13" fill="none" />
        <path d="M273 143h22l4 30h-29Z" fill="#fa704e" />
      </g>
      <g stroke="#172d3a" strokeWidth="4" strokeLinejoin="round">
        <path d="m29 211 23-31h71l30 31 22 5v29H18v-28Z" fill="#ffe13a" />
        <path d="m61 188-16 24h45v-24Zm36 0v24h42l-23-24Z" fill="#b9f0f3" />
        <path d="M76 173h31v10H76z" fill="#fff8e5" />
        <circle cx="48" cy="241" r="13" fill="#172d3a" />
        <circle cx="145" cy="241" r="13" fill="#172d3a" />
      </g>
      <path d="M69 222h9v8h-9zm18 0h9v8h-9zm18 0h9v8h-9z" fill="#172d3a" />
      <path d="M184 230h39q29 0 32-15m-13 4 13-6 5 13" fill="none" stroke="#ffe13a" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
      <g className="pickup-column-picture__label">
        <path fill="#172d3a" d="M18 13h177v37H18z" />
        <text x="31" y="38" fill="#fff8e5" fontSize="19" fontWeight="900">PICK UP HERE</text>
        <path d="M181 59q46 0 61 27m-14-1 15 3-2-15" fill="none" stroke="#172d3a" strokeWidth="4" strokeLinecap="round" />
      </g>
    </svg>
  );
}

export function PickupTutorial({ onContinue }: { onContinue: () => void }) {
  return (
    <>
      <p className="modal-kicker">YOUR FIRST FARE · QUICK GUIDE</p>
      <h2 id="modal-title" className="pickup-tutorial__title">BLUE COLUMNS = PASSENGERS</h2>
      <div className="pickup-tutorial__body">
        <PickupColumnIllustration />
        <div className="pickup-tutorial__copy" id="pickup-tutorial-description">
          <p><strong>Look for the tall, transparent blue columns.</strong> Each one marks a passenger waiting for a ride.</p>
          <ol>
            <li><b>SPOT IT</b><span>Drive toward any blue column.</span></li>
            <li><b>STOP IN IT</b><span>Slow down and stop inside the blue ring at its base. Your passenger gets in automatically.</span></li>
            <li><b>TAKE THE FARE</b><span>Follow their destination, then look for blue again.</span></li>
          </ol>
        </div>
      </div>
      <div className="pickup-tutorial__footer">
        <small>TAKE YOUR TIME · THE GAME IS PAUSED</small>
        <button className="primary-small" data-modal-autofocus="true" data-gamepad-confirm="true" onClick={onContinue}>GOT IT · LET’S DRIVE</button>
      </div>
    </>
  );
}

export function PickupReminder({ hud, fareCardActive }: { hud: Hud; fareCardActive: boolean }) {
  if (hud.deliveries < 1 || hud.deliveries > 3 || hud.passengerOnboard || hud.courierActive
    || !hud.fareDispatchEnabled || hud.playerMode !== "driving" || fareCardActive) return null;
  return (
    <aside className="pickup-reminder" role="status" aria-label="Next passenger reminder">
      <PickupColumnIllustration />
      <div><small>NEXT PASSENGER</small><strong>LOOK FOR BLUE COLUMNS</strong>
        <p>Stop in a blue ring to pick up your next passenger.</p></div>
    </aside>
  );
}
