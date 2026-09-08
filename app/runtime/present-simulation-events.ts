import type { Game, Hud, Modal } from "@/game/model";
import { makeHud } from "@/game/hud";
import type { SimulationEvent } from "@/game/simulation";
import {
  makeDropoffFareImpact,
  makePickupFareImpact,
} from "@/game/fare-presentation";
import type { CourierImpact } from "../courier-impact-overlay";

type FareImpact = ReturnType<typeof makePickupFareImpact> | ReturnType<typeof makeDropoffFareImpact>;

export type SimulationEventPresentation = Readonly<{
  game: () => Readonly<Game>;
  tone: (frequency: number, duration: number, type?: OscillatorType, endFrequency?: number) => void;
  announce: (message: string) => void;
  warmPassengerArt: (jobs: Game["fareJobs"]) => void;
  triggerFareImpact: (impact: FareImpact) => void;
  triggerCourierImpact: (impact: Omit<CourierImpact, "id">) => void;
  setHomeNotice: (message: string) => void;
  setCourierNotice: (message: string) => void;
  setGasNotice: (message: string) => void;
  setHud: (hud: Hud) => void;
  openModal: (modal: Exclude<Modal, null>) => void;
  schedule?: (callback: () => void, delay: number) => void;
}>;

function assertNever(event: never): never {
  throw new Error(`Unhandled simulation event: ${JSON.stringify(event)}`);
}

/** Exhaustive browser presentation for the renderer-neutral simulation protocol. */
export function presentSimulationEvents(
  events: readonly SimulationEvent[],
  presentation: SimulationEventPresentation,
) {
  const schedule = presentation.schedule ?? ((callback, delay) => window.setTimeout(callback, delay));
  const {
    game: getGame,
    tone,
    announce,
    warmPassengerArt,
    triggerFareImpact,
    triggerCourierImpact,
    setHomeNotice,
    setCourierNotice,
    setGasNotice,
    setHud,
    openModal,
  } = presentation;

  for (const event of events) {
    switch (event.type) {
      case "building-collision":
        tone(90, 0.18, "square", 45);
        break;
      case "traffic-collision":
        tone(105, 0.2, "square", 48);
        break;
      case "vehicle-overturned":
        announce("Taxi overturned. Stop moving, exit when safe, then right the taxi from outside.");
        tone(78, 0.24, "sawtooth", 42);
        schedule(() => tone(110, 0.16, "square", 62), 120);
        break;
      case "brake-drift-kick":
        tone(540 + event.strength * 180, 0.08, "sawtooth", 260);
        break;
      case "player-jumped":
        tone(210, 0.11, "triangle", 360);
        break;
      case "player-landed":
        tone(105 + event.strength * 30, 0.07, "square", 72);
        break;
      case "custom-destination-arrived":
        announce(getGame().fareDispatchEnabled
          ? "Custom destination reached. Job route restored."
          : "Custom destination reached. Remaining off duty.");
        tone(720, 0.16, "square", 960);
        break;
      case "fare-market-streamed":
        warmPassengerArt(getGame().fareJobs);
        break;
      case "regional-fare-offered":
        announce(`Fare six is ready in ${event.originRegion}. This passenger is headed to ${event.destinationRegion}.`);
        tone(392, 0.1, "square", 587);
        schedule(() => tone(784, 0.18, "sine", 1046), 90);
        break;
      case "pickup": {
        const simulation = getGame().drivingModel === "simulation";
        triggerFareImpact(makePickupFareImpact({ ...event, drivingModel: getGame().drivingModel }));
        announce(event.runKind === "free-run"
          ? simulation
            ? `${event.rider} picked up. Head to ${event.destination} whenever you are ready.`
            : `${event.rider} picked up. Eight boost added. Head to ${event.destination} whenever you are ready.`
          : `${event.rider} picked up. Plus ${event.bonusSeconds} seconds and eight boost. Head to ${event.destination}.`);
        tone(145, 0.08, "square", 88);
        schedule(() => tone(440, 0.14, "sine", 720), 65);
        break;
      }
      case "dropoff":
        warmPassengerArt(getGame().fareJobs);
        triggerFareImpact(makeDropoffFareImpact(event));
        announce(event.runKind === "free-run"
          ? `Delivered to ${event.destination}. Fare ${event.fareAward} dollars. Multiplier ${event.multiplier.toFixed(1)}.`
          : `Delivered to ${event.destination}. Fare ${event.fareAward} dollars, plus ${event.bonusSeconds} seconds. Multiplier ${event.multiplier.toFixed(1)}.`);
        tone(523, 0.1, "sine", 659);
        schedule(() => tone(659, 0.1, "sine", 784), 90);
        break;
      case "courier-pickup":
        triggerCourierImpact({
          kind: "pickup",
          cargo: event.cargo,
          destination: event.destination,
          detail: "RETURN TO TAXI",
        });
        announce(`${event.cargo} secured. Return to the taxi and deliver to ${event.destination}.`);
        tone(220, 0.08, "square", 520);
        schedule(() => tone(760, 0.12, "square", 1040), 70);
        break;
      case "courier-dropoff": {
        const freeRun = getGame().runKind === "free-run";
        triggerCourierImpact({
          kind: "dropoff",
          cargo: event.cargo,
          destination: event.destination,
          detail: freeRun
            ? `$${event.fareAward} · ${event.multiplier.toFixed(1)}× · FREE RUN`
            : `$${event.fareAward} · +${event.bonusSeconds} SEC · ${event.multiplier.toFixed(1)}×`,
        });
        announce(freeRun
          ? `Courier delivery complete at ${event.destination}. ${event.fareAward} dollars awarded.`
          : `Courier delivery complete at ${event.destination}. ${event.fareAward} dollars and ${event.bonusSeconds} seconds awarded.`);
        tone(520, 0.1, "square", 760);
        schedule(() => tone(880, 0.14, "sine", 1180), 85);
        break;
      }
      case "courier-blocked": {
        const message = event.reason === "no-contract"
          ? "Take a courier job from a dispatch board first."
          : event.reason === "pickup-taxi-too-far"
            ? "Park the taxi near the pickup entrance before collecting the package."
            : event.reason === "return-to-taxi"
              ? "Return to the taxi and load the package before delivery."
              : event.reason === "taxi-too-far"
                ? "Park the taxi near the destination entrance before the handoff."
                : "This is not the active courier handoff location.";
        announce(message);
        tone(170, 0.08, "square", 115);
        break;
      }
      case "clock-warning":
        tone(event.secondsRemaining <= 3 ? 1200 : 880, 0.07, "square", 760);
        break;
      case "vehicle-exited": {
        const current = getGame();
        announce(current.runKind === "free-run"
          ? current.onboard
            ? "Taxi exited with a passenger onboard. Explore on foot, then return when ready."
            : "Taxi exited. Walk with W A S D, run with Shift, jump with Space, and crouch with C or Control."
          : current.onboard
            ? "Taxi exited with a passenger onboard. The fare clock is still running. Return to the taxi quickly."
            : "Taxi exited. Run clock paused. Shift runs, Space jumps, and C or Control crouches.");
        tone(310, 0.08, "square", 440);
        break;
      }
      case "vehicle-entered": {
        const current = getGame();
        announce(current.runKind === "free-run"
          ? current.onboard ? "Back in the taxi. Continue the passenger route when ready." : "Back in the taxi. Free Run continues."
          : current.onboard ? "Back in the taxi. The passenger fare clock stayed live." : "Back in the taxi. Run clock resumed.");
        tone(440, 0.08, "square", 620);
        break;
      }
      case "vehicle-righted":
        announce("Taxi righted. Check for traffic, then get back in when it is safe.");
        tone(180, 0.09, "square", 280);
        schedule(() => tone(460, 0.1, "triangle", 620), 80);
        break;
      case "courier-loaded":
        announce(getGame().runKind === "free-run"
          ? `Back in the taxi. ${event.cargo} loaded. Drive to ${event.destination} whenever you are ready.`
          : `Back in the taxi. ${event.cargo} loaded. Run clock resumed. Drive to ${event.destination}.`);
        tone(560, 0.08, "square", 760);
        schedule(() => tone(820, 0.1, "square", 1040), 70);
        break;
      case "venue-entered":
        announce(`Entered ${event.label}.`);
        tone(520, 0.1, "sine", 760);
        break;
      case "venue-exited":
        announce(`Back outside ${event.label}.`);
        tone(420, 0.08, "sine", 300);
        break;
      case "service-used":
        if (event.serviceId === "home-hub") {
          setHomeNotice("");
          announce("Neon Lofts home hub open. Review your apartment, garage, upgrades, and career.");
          openModal("home");
          tone(680, 0.09, "square", 880);
        } else if (event.serviceId === "courier-board") {
          setCourierNotice("");
          announce("Courier board open. Review the available indoor pickup and delivery contracts.");
          openModal("courier");
          tone(620, 0.09, "square", 920);
        } else if (event.serviceId === "gas-counter") {
          const current = getGame();
          if (current.onboard) {
            const message = current.runKind === "free-run"
              ? "DROP OFF YOUR PASSENGER BEFORE SERVICING THE TAXI."
              : "DROP OFF YOUR PASSENGER BEFORE SERVICING THE TAXI. THE FARE CLOCK IS STILL RUNNING.";
            announce(message);
            setHud(makeHud(current));
            tone(170, 0.1, "square", 110);
          } else {
            setGasNotice("");
            announce(current.runKind === "free-run"
              ? "GO-GO GAS pit stop open. Free Run needs no clock service; permanent cab upgrades remain available."
              : "GO-GO GAS pit stop open. Buy run time or install permanent cab upgrades with banked fare.");
            openModal("gas");
            tone(620, 0.09, "square", 980);
          }
        } else {
          announce(`${event.venue.label}. The clerk says fresh stock is coming in.`);
          tone(680, 0.09, "square", 880);
        }
        break;
      case "interaction-blocked":
        announce(event.reason === "moving"
          ? "Stop the taxi before getting out."
          : "There is no safe room to exit here.");
        tone(180, 0.08, "square", 120);
        break;
      default:
        assertNever(event);
    }
  }
}
