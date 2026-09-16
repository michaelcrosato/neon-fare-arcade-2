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

Forty-eight lessons in `game/quantum-facts.ts` rotate from a seed-derived starting
position. Each of the 174 passenger portraits has exactly three original replies
in `game/passenger-quantum-responses.ts`: **522 distinct lines**. Voices follow
the illustrated tools, uniforms, hobbies and expressions. Source comments record
the authored character direction. The trio moves from interested through bemused
to politely finished; each line works independently of the selected lesson.

Replies belong to the stable passenger ID, not the portrait's position within an
atlas or the passenger's current fare slot. The run seed and art cell choose the
first reply; `Game.accordReplyCounts` then cycles that passenger through all three
before repeating, even if other passengers or whole six-fare cycles intervene.
Only an emitted conversation advances the counter. A fresh run resets the
history. Selection consumes no shared RNG. Route progress, lesson sequence,
reply counters and once-only state are serialized with deterministic Game data.

## Presentation and controls

`present-simulation-events.ts` sends the immutable card to `use-drive-events.ts`.
The hook pauses the real frame loop, clears driving input, and displays the
native `StoryCard` dialog over the still-visible game. Simulation time, passenger
rating time, time limits, fuel, traffic and fare-card animation all pause.

The passenger reply is the continue button. Only a fresh, unmodified **Enter**
press or a tap/click on that reply resumes; gamepad Cross/A works too after any
held press is released. Driving keys, Space (even on the focused reply), Escape,
held key repeats, clicks/taps on the lesson or backdrop, cancelled gestures and
the release of a driving touch cannot dismiss the card. Tab navigation, scrolling
and text copying remain available. Keyboard focus stays in the dialog and returns
on close.
The card opens at the start of the lesson with focus on the dialog, so a long
lesson cannot automatically scroll down to its reply. It is centered, scrolls
internally on small screens, occupies at most 82%
of viewport height, and leaves a margin around the game in both orientations.
Tire payoff uses the same presentation with a yellow paid-in-full motif.

## Fact sources

Copy is original and deliberately distinguishes quantum states from the driver's
jokes about cars. Beginner concepts and more technical lessons are self-contained;
the topic label names the concept rather than promising a difficulty level.
The following references support the lessons (numbers are the one-based order
in `QUANTUM_FACTS`). Checked September 15, 2026.

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

### Expanded lesson reference map

| Lessons | Topics | Primary teaching or research references |
| --- | --- | --- |
| 9–12 | Double slit, which-path records, Born rule, relative phase | [Caltech: Quantum Behavior](https://www.feynmanlectures.caltech.edu/III_01.html), [Probability Amplitudes](https://www.feynmanlectures.caltech.edu/III_03.html), [NIST: Measurement-induced decoherence](https://www.nist.gov/publications/measurement-induced-decoherence-and-information-double-slit-interference), [IBM: Quantum information](https://quantum.cloud.ibm.com/learning/en/courses/basics-of-quantum-information/single-systems/quantum-information) |
| 13–15 | Matter wavelength, stationary states, confined standing waves | [Caltech: Wave and Particle Viewpoints](https://www.feynmanlectures.caltech.edu/III_02.html), [Amplitudes with Time](https://www.feynmanlectures.caltech.edu/III_07.html), [MIT: Infinite Square Well](https://ocw.mit.edu/courses/8-04-quantum-physics-i-spring-2016/a565b327f85c7721b18f1074dbd69ede_MIT8_04S16_LecNotes11.pdf) |
| 16 | Harmonic oscillator and zero-point energy | [MIT: Quantum Optical Communication, lecture 4](https://ocw.mit.edu/courses/6-453-quantum-optical-communication-fall-2016/6d8771f65388b5a9fed79fe3110ac3e4_MIT6_453F16_Lect4_Notes.pdf) |
| 17–18 | Electron spin and incompatible spin measurements | [Caltech: Spin One-Half](https://www.feynmanlectures.caltech.edu/III_06.html) |
| 19–20 | Pauli exclusion and boson/fermion statistics | [Caltech: Identical Particles](https://www.feynmanlectures.caltech.edu/III_04.html), [DOE: Bosons and Fermions](https://www.energy.gov/science/doe-explainsbosons-and-fermions) |
| 21–22 | Bose–Einstein condensation and superfluidity | [NIST: Bose–Einstein Condensation](https://nvlpubs.nist.gov/nistpubs/sp958-lide/html/375-378.html), [DOE: Superfluids](https://www.energy.gov/science/bes/articles/discovering-secrets-superfluids), [Caltech: Superconductivity seminar](https://www.feynmanlectures.caltech.edu/III_21.html) |
| 23–25 | Cooper pairs, Josephson junctions, SQUID interference | [Caltech: Superconductivity seminar](https://www.feynmanlectures.caltech.edu/III_21.html) |
| 26 | Scanning tunnelling microscopy | [Nobel Prize: The Scanning Tunneling Microscope](https://educationalgames.nobelprize.org/educational/physics/microscopes/scanning/index.html) |
| 27–28 | Stimulated emission and photoemission | [Caltech: Identical Particles, emission and absorption](https://www.feynmanlectures.caltech.edu/III_04.html), [Nobel Prize: The Photoelectric Effect](https://educationalgames.nobelprize.org/educational/physics/quantised_world/waves-particles-1.html) |
| 29–30 | Atomic clocks and squeezed light | [NIST: How Atomic Clocks Work](https://www.nist.gov/atomic-clocks/how-do-atomic-clocks-work), [NIST: Squeezed Light](https://www.nist.gov/quantum-information-science/quantum-sensing-explained/squeezed-light-detecting-gravitational-waves) |
| 31–32 | Bell inequalities and teleportation | [Nobel Prize 2022: Scientific background for the public](https://www.nobelprize.org/uploads/2022/10/popular-physicsprize2022.pdf), [IBM: Quantum Teleportation](https://quantum.cloud.ibm.com/learning/en/modules/computer-science/quantum-teleportation) |
| 33–35 | Decoherence, mixtures, expectation values | [NIST: Measurement-induced decoherence](https://www.nist.gov/publications/measurement-induced-decoherence-and-information-double-slit-interference), [IBM: Bloch sphere and mixed states](https://quantum.cloud.ibm.com/learning/en/courses/general-formulation-of-quantum-information/density-matrices/bloch-sphere), [Caltech: Operators](https://www.feynmanlectures.caltech.edu/III_20.html) |
| 36 | LED band gaps and electron/hole recombination | [DOE: LED Technology Primer](https://www.energy.gov/management/articles/practical-primer-led-technology), [DOE: Radiative Recombination](https://www.energy.gov/science/bes/articles/led-lighting-may-now-shine-brighter) |
| 37–40 | Unitary gates, Hadamard, CNOT, Bloch sphere | [IBM: Single systems](https://quantum.cloud.ibm.com/learning/en/courses/basics-of-quantum-information/single-systems/quantum-information), [Multiple systems](https://quantum.cloud.ibm.com/learning/en/courses/basics-of-quantum-information/multiple-systems/quantum-information), [Bloch sphere](https://quantum.cloud.ibm.com/learning/en/courses/general-formulation-of-quantum-information/density-matrices/bloch-sphere) |
| 41–42 | Error correction and logical qubits | [IBM: Correcting Quantum Errors](https://quantum.cloud.ibm.com/learning/en/courses/foundations-of-quantum-error-correction/correcting-quantum-errors/introduction), [Fault-tolerant computation](https://learning.quantum.ibm.com/course/foundations-of-quantum-error-correction/fault-tolerant-quantum-computation) |
| 43–44 | Grover search and Shor factoring | [IBM: Grover's Algorithm](https://quantum.cloud.ibm.com/learning/en/modules/computer-science/grovers), [Shor's Algorithm](https://quantum.cloud.ibm.com/learning/en/modules/computer-science/shors-algorithm) |
| 45–46 | Quantum simulation and key distribution | [DOE: Quantum Computing](https://www.energy.gov/science/doe-explainsquantum-computing), [IBM: Quantum Key Distribution](https://quantum.cloud.ibm.com/learning/en/modules/computer-science/quantum-key-distribution) |
| 47–48 | Laser cooling and diamond NV sensing | [NIST: Laser Cooling](https://www.nist.gov/news-events/news/2021/01/bringing-atoms-standstill-nist-miniaturizes-laser-cooling), [NIST: Diamond NV Center Magnetometry](https://www.nist.gov/programs-projects/diamond-nv-center-magnetometry) |

Keep qualifications in the copy: ordinary single-photon photoemission has a
frequency threshold; zero-point energy is not extractable free fuel; conventional
superconductivity has operating limits; Bell violations do not allow faster-than-
light signalling; Grover's bound concerns oracle queries, not free hardware;
cryptographic security depends on device and protocol assumptions. Do not replace
these with the driver's exaggerated analogy.

## Verification

- `tests/game/accord-events.test.ts`: financing, threshold and once-only rules,
  route progress, deterministic content and trip reset, exact roster coverage,
  globally unique replies, repeat-rider rotation and complete lesson reachability.
- `tests/browser/accord-events.spec.ts`: real frame-loop pause and deliberate
  confirmation, ignored driving keys and stray clicks/taps, held/cancelled input,
  gamepad release/repress, native-dialog geometry, longest lesson/reply readability,
  tire payoff and free/paid tow cards in desktop, portrait and landscape for
  WebGPU and Canvas.
- `tests/runtime/run-records.test.ts`: negative run balance survives history
  normalization without a negative career credit.
