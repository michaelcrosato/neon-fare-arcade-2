import type { DrivingStuntsHud } from "@/game/model";

export function stuntMeters(meters: number) {
  return `${Math.round(meters * 10) / 10} m`;
}

export function DrivingStuntFeedback({ stunts }: { stunts: DrivingStuntsHud }) {
  return <aside className="driving-stunts" aria-label="Driving distance feedback">
    {(["drift", "air"] as const).map(kind => {
      const stunt = stunts[kind];
      if (!stunt.active && !stunt.showResult) return null;
      const meters = stunt.active ? stunt.meters : stunt.lastMeters;
      return <div key={kind} className={`driving-stunt driving-stunt--${kind} ${stunt.active ? "is-active" : "is-complete"}`}>
        <small>{kind === "drift" ? stunt.active ? "DRIFTING!" : "DRIFT BANKED" : stunt.active ? "AIR!" : "LANDED!"}</small>
        <strong aria-label={`${kind === "drift" ? "Drift" : "Air"} distance ${stuntMeters(meters)}`}>{stuntMeters(meters)}</strong>
        <span>{stunt.active ? "DISTANCE" : meters >= stunt.bestMeters - .01 ? "RUN BEST" : `BEST ${stuntMeters(stunt.bestMeters)}`}</span>
      </div>;
    })}
    <span className="sr-only" role="status" aria-atomic="true">{(["drift", "air"] as const).map(kind => {
      const stunt = stunts[kind];
      return stunt.showResult ? `${kind === "drift" ? "Drift complete" : "Landed"}: ${stuntMeters(stunt.lastMeters)}. ` : "";
    }).join("")}</span>
  </aside>;
}

export function StuntStatistics({ stunts }: { stunts: DrivingStuntsHud }) {
  return <dl className="stunt-statistics" aria-label="Run driving distances">
    <div><dt>DRIFT DISTANCE</dt><dd>{stuntMeters(stunts.drift.totalMeters)}<small>BEST {stuntMeters(stunts.drift.bestMeters)}</small></dd></div>
    <div><dt>AIR DISTANCE</dt><dd>{stuntMeters(stunts.air.totalMeters)}<small>BEST {stuntMeters(stunts.air.bestMeters)}</small></dd></div>
  </dl>;
}
