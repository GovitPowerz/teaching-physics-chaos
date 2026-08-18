# Chaos Scenes - Design

Date: 2026-08-17
Status: approved (brainstorming session)

## Goal

An interactive chaos teaching site, sibling of ../kinematics ("Motion in Force
Fields"), hosted on GitHub Pages. Thesis: **deterministic chaos** - the same
equations and the same integrator, a tiny nudge in initial conditions, a
completely different future. English UI. Explanation is carried by live formula
lines plus one- or two-sentence captions per scene, in the sibling's style.

## Site Structure

Three flat tabs over one shared simulation core. Tab order is the pedagogy:

1. **Lorenz** - the canonical strange attractor, chaos in 3 ODE dimensions
2. **Pendulum** - n-link pendulum (2..5), chaos in a mechanical system you can pose by hand
3. **N-body** - planar gravitational n-body, chaos in the solar-system setting

## The Shared Ensemble Mechanic

Every tab runs one reference trajectory plus K perturbed copies:

- K slider 2..10, default 5.
- Perturbation size epsilon on a log slider, per-scene scaled, default ~1e-6
  in normalized units. Copy k (1..K) adds +k*epsilon to one scene-designated
  scalar component (Lorenz: x0; pendulum: tip angle; n-body: selected body
  x position). Deterministic, so delta0 = k*epsilon is known exactly for the
  fit and tests.
- The ensemble is rebuilt on every IC drag, exactly like kinematics ghosts.
- A **divergence strip chart** under the canvas: log10 of state-space
  separation vs t for each copy - a straight climb whose slope is the largest
  Lyapunov exponent, then saturation.
- Live formula line delta(t) ~ delta0 * e^(lambda t), lambda fitted by
  log-linear regression over the pre-saturation window - samples where the
  separation is below a fixed fraction of the reference trajectory's
  state-space extent (Lorenz should land near the canonical ~0.9).
- Kinematics playback verbatim: play/pause, reset, scrubber, speed.

## Architecture

Kinematics structure, with the 2D-particle physics core generalized to
arbitrary-dimension first-order ODEs on flat number[] state vectors
(Lorenz: 3, n-link pendulum: 2N, planar n-body: 4N).

```
src/
  sim/              pure core, no DOM, never throws
    ode.ts          rk4Step(deriv, y, t, dt) on number[]; deriv(t, y) -> number[]
    simulate.ts     simulate() -> {ts, ys} with tMax, sample cap, nonfinite
                    truncation; sampleAt() interpolation (clamped, empty-safe)
    ensemble.ts     perturbed-copy construction, separation series, lyapunovFit
                    (log-linear regression up to a saturation cutoff)
    lorenz.ts       deriv(sigma, rho, beta); fixed-point helpers
    pendulum.ts     n-link (2..5), equal unit masses/lengths: M(theta)
                    mass-matrix assembly + Gaussian solve -> angular
                    accelerations; total energy for drift checks
    nbody.ts        planar gravity deriv with softened kernel (sibling's
                    (r^2 + eps^2)^(3/2)); energy + angular momentum; presets
                    (figure8, pythagorean, sun2planets, binaryPlanet)
    projection.ts   yaw/pitch rotation + orthographic [x,y,z] -> [sx,sy]
  scenes.ts         per-scene dt, horizon tMax, epsilon scale, sim builders
  state.ts          one Store + subscribe(); scene mutations rebuild the whole
                    ensemble once, reset playback, bump revision, notify once;
                    playback mutations notify without recompute; nbody body
                    selection recomputes once (it retargets the perturbation)
  ui/
    topbar.ts       three-tab switcher
    playback.ts     play/pause, reset, scrubber, speed
    panel.ts        formula lines + captions, memoized on tab + content
    controls.ts     sliders, text fields, drag handling - ported from sibling
  render/
    viewport.ts     world<->screen transform
    draw.ts         COLORS, fading trails, ensemble hue assignment,
                    divergence strip chart
    lorenzScene.ts  projected butterfly, rotate-drag, IC dot
    pendulumScene.ts arms, joints, tip trails
    nbodyScene.ts   bodies, velocity arrows, per-body trails
  main.ts           renderer registry, tab mount/unmount, rAF playback loop
tests/              vitest: sim core, ensemble math, store, formatters only
```

### Key decisions

1. **Precompute + scrub, the sibling invariant.** Dragging any control
   re-simulates the whole ensemble over a fixed per-scene horizon; playback
   interpolates the same stored samples. One simulation code path; trails and
   playback cannot disagree. Divergence saturates once copies decorrelate, so
   a bounded horizon loses nothing pedagogically, and backward scrubbing
   ("find the exact moment they split") comes free.
2. **One integrator: fixed-step RK4** on generic number[] states. Not
   symplectic; horizons are bounded and energy drift is measured, not hidden -
   pendulum and n-body display live energy readouts and unit tests bound the
   drift over a full horizon.
3. **Canvas 2D everywhere, zero rendering deps.** Lorenz gets a hand-rolled
   yaw/pitch rotation + orthographic projection module (~50 lines of pure,
   testable math). Pendulum and n-body are planar: their chaos is fully
   visible in 2D.
4. **Ensemble divergence is a testable invariant.** The fitted Lorenz lambda
   at classic parameters must land near 0.9 (loose tolerance) - enforced by a
   unit test, not just claimed in a caption.

### Interaction model (all scenes)

- Direct manipulation first: draggable IC handles with paired text fields
  (live-update while dragging, commit on Enter/blur, clamp, revert on invalid) -
  the sibling pattern.
- Shared controls: K, epsilon, playback. Per-scene controls below.
- Tap/drag distinction, hover/grab cursors: port controls.ts from the sibling.

## Scene Specs

### Tab 1: Lorenz

Classic parameters sigma = 10, rho = 28, beta = 8/3.

- Controls: rho slider (~0..40); crossing rho ~ 24.74 kills the strange
  attractor - that transition is a teaching beat, called out in the caption.
  sigma and beta fixed at classic values.
- View: drag on empty canvas rotates the projection (yaw/pitch); drag on the
  IC dot moves it in the current projection plane (screen delta mapped through
  the inverse rotation). Fading trails for all ensemble copies.
- Formulas: the three ODEs with live numbers + the lambda fit line.

### Tab 2: Pendulum

N-link pendulum, N slider 2..5, equal unit masses and lengths, g = 1.

- Controls: N slider; grab any joint to pose the chain: dragging joint j aims
  link j at the pointer while links below j keep their relative angles (the
  chain follows rigidly, no IK solve); release starts from rest (all
  omega = 0).
- Ensemble perturbs the tip angle by epsilon.
- Render: arms + joints for the reference copy, fading tip trails for every
  copy in distinct hues.
- Readouts: total energy E with drift kept honest by a unit test; lambda fit.
- N = 2 is regression-tested against the textbook closed-form double-pendulum
  accelerations.

### Tab 3: N-body

Planar gravitational n-body, G = 1, 2..6 bodies.

- Controls: preset buttons (figure-8 choreography, Pythagorean 3-body,
  Sun + 2 planets, binary + planet) - recorded deviation from the dropdown
  planned here: better direct-manipulation UX at four items; bodies
  draggable, velocity arrows draggable, mass slider for the selected body.
- Ensemble perturbs the selected body's initial position by epsilon.
- Render: bodies sized by mass^(1/3), per-body fading trails; ensemble copies
  as ghost trails.
- Readouts: total energy and angular momentum (conservation as honesty
  check); lambda fit.
- Softened 1/r^2 (sibling kernel). A copy leaving the domain bounds truncates
  at the last good sample - stop conditions, not exceptions.

## Units Policy

Normalized units everywhere: Lorenz is dimensionless by nature; pendulum
m = l = g = 1; n-body G = 1. Dimensionless readouts; captions state the
normalization. No fake precision.

## Testing (vitest, pure core only; rendering verified visually)

- RK4 4th-order convergence on the harmonic oscillator vs closed form
  (dt divides tEnd exactly - sibling lesson).
- Pendulum: N = 2 accelerations match the closed-form double-pendulum
  equations; energy drift over a full horizon below tolerance; mass-matrix
  solve vs hand-computed small cases.
- N-body: two-body circular orbit closes; energy and angular momentum
  conserved within tolerance; figure-8 preset returns near its start after
  one period (loose tolerance - softening shifts periods, sibling lesson).
- Lorenz: fixed points of the flow are stationary; two nearby ICs at classic
  parameters yield fitted lambda ~ 0.9 within loose tolerance.
- Ensemble: separation series and lyapunovFit on synthetic exponentials;
  saturation cutoff behavior.
- Projection: rotation matrix orthonormality; project/unproject round-trip in
  the projection plane.
- Store transition rules; formula formatters.

## Error Handling

Clamps and stop conditions, not exceptions: inputs clamp to ranges, invalid
typed values revert, every simulate() is bounded by tMax plus a sample cap,
and a non-finite step truncates the trajectory at the last good sample. The
pure core never throws.

## Deploy

Copy the sibling's .github/workflows/deploy.yml (npm ci, vitest, Vite build,
Pages deploy of dist/). vite base './', dev port 5173 strict. One-time setup:
repository Settings -> Pages -> Source: GitHub Actions.

## Out of Scope (deliberate)

- No three.js; Lorenz 3D is a hand-rolled orthographic projection.
- No Poincare sections, no bifurcation diagrams (candidate v2 material).
- No unequal pendulum masses/lengths; no 3D n-body.
- No French localization; no long-form lesson panels.
- No mobile-first work beyond the sibling's responsive defaults.
