# The spirit of the Accord

Every fresh Accord run starts with a run fare balance of **−$1,000** for its
financed winter tires, in all run kinds, driving models and shifting modes.
Existing career money is separate. End-of-run banking credits only a positive
net run balance; unfinished financing remains visible in that run's history.
It does not remove career money. A new run starts the financing story again.
The Crown and GT-R start at zero.

The first fixed step with a **strictly positive** Accord run balance emits one
`story-card` event with `kind: tires-paid`. Reaching exactly zero does not yet
trigger it. Falling into debt and earning money again cannot repeat it.
Financing is initialized in `state.ts`; `accord-events.ts` owns its milestone.

At a normal Accord passenger pickup, `beginAccordTrip` snapshots the canonical
road route between the passenger's approach points. Each fixed step projects
the cab onto that route, respecting elevation and rejecting distant parallel
streets. After at least half a second, crossing 50% of that route triggers one
quantum conversation. Distance spent driving away or circling at the pickup
does not count. Custom GPS waypoints do not replace the passenger's trip route.
Empty cabs, other vehicles, walking, and courier assignments cannot trigger a
conversation. Returning from walking can trigger a still-unshared trip.

Eight facts rotate from a seed-derived starting position, with ten passenger
responses ranging from fascinated to politely uninterested. Selection consumes
no shared RNG. The route, sequence and once-only state are replayable Game data.

## Presentation and controls

`present-simulation-events.ts` sends the immutable card to `use-drive-events.ts`.
The hook pauses the real frame loop, clears driving input, and displays the
native `StoryCard` dialog over the still-visible game. Simulation time, passenger
rating time, time limits, fuel, traffic and fare-card animation all pause.

The passenger reply is the continue button. A fresh key, tap or click resumes;
gamepad Cross/A works too. Held key repeats and the release of a driving touch
cannot dismiss the card. Keyboard focus stays in the dialog and returns on close.
The card is centered, scrolls internally on small screens, occupies at most 82%
of viewport height, and leaves a margin around the game in both orientations.
Tire payoff uses the same presentation with a yellow paid-in-full motif.

## Fact sources

Copy is original and deliberately distinguishes quantum states from the driver's
jokes about cars. References:

- [DOE: Quantum Mechanics](https://www.energy.gov/science/doe-explainsquantum-mechanics)
  — photons, quantized energy and wave behavior.
- [DOE: Quantum Networks](https://www.energy.gov/science/doe-explainsquantum-networks)
  — superposition, measurement and the no-cloning rule.
- [NIST: Quantum and Dance](https://www.nist.gov/blogs/taking-measure/quantum-and-dance-it-takes-2-entangle)
  — tunneling and entanglement, including the limit on faster-than-light messages.
- [NIST: Squeezed Light](https://www.nist.gov/quantum-information-science/quantum-sensing-explained/squeezed-light-detecting-gravitational-waves)
  — intrinsic quantum uncertainty.
- [NIST: Quantum Computing Explained](https://www.nist.gov/quantum-information-science/quantum-computing-explained)
  — qubits, measurement, interference and useful algorithms.
- [NIST: Quantum Sensing Explained](https://www.nist.gov/quantum-information-science/quantum-sensing-explained)
  — allowed energy levels and optical transitions.

## Verification

- `tests/game/accord-events.test.ts`: financing, threshold and once-only rules,
  route progress, deterministic content and trip reset.
- `tests/browser/accord-events.spec.ts`: real frame-loop pause and resume,
  input repeats, native-dialog geometry, tire payoff and free/paid tow cards in
  desktop, portrait and landscape for WebGPU and Canvas.
- `tests/runtime/run-records.test.ts`: negative run balance survives history
  normalization without a negative career credit.
