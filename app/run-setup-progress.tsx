export function RunSetupProgress({ current, simulation = false }: { current: "vehicles" | "traits" | "steering"; simulation?: boolean }) {
  const steps = simulation ? ["vehicles", "steering"] : ["vehicles", "traits", "steering"];
  return <ol className="run-setup-progress" aria-label="Run setup steps">
    {steps.map((step, index) => <li key={step} aria-current={current === step ? "step" : undefined}>
      <b>{String(index + 1).padStart(2, "0")}</b><span>{step === "vehicles" ? "VEHICLE" : step === "traits" ? "EDGE" : "STEERING"}</span>
    </li>)}
  </ol>;
}
