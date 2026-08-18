# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

"Deterministic Chaos" - an interactive chaos teaching site, sibling of
`../kinematics` ("Motion in Force Fields"), which is the stack and convention
reference. Three canvas-2D tabs over one shared simulation core, ordered as the
pedagogy: **Lorenz** (the strange attractor, rho slider through the ~24.74
transition, hand-rolled yaw/pitch orthographic projection), **Pendulum**
(n-link, n = 2..5, posable by dragging joints), **N-body** (planar gravity,
four presets, draggable bodies and velocity arrows). Every tab runs one
reference trajectory plus K perturbed copies (copy k offset by k*epsilon on one
scene-designated component) and shows a divergence strip chart: log10
separation vs t, with the largest Lyapunov exponent fitted live by log-linear
regression below a saturation cutoff. Static site, GitHub Pages, English UI.

## Build & Development Commands

```bash
npm run dev       # Vite dev server on :5173 (strict port)
npm test          # vitest, pure core + store + formatters only
npm run build     # tsc --noEmit + vite build -> dist/
npm run preview   # serve the production build
```

## Architecture

```
src/
  sim/              pure core, no DOM, never throws
    ode.ts          Deriv = (t, y) => number[]; rk4Step on flat number[] states
                    (Lorenz 3, n-link pendulum 2n, planar n-body 4n)
    simulate.ts     simulate() -> {ts, ys} bounded by tMax + maxSamples (default
                    cap 20000) + an optional haltWhen predicate + an optional
                    stride (integrate at dt, record every stride-th step),
                    nonfinite (or halted) truncation at the last good sample;
                    sampleAt (linear interp, clamped, empty-safe); duration
    projection.ts   View3 {yaw, pitch}; R = Rx(pitch) * Rz(yaw); project drops
                    the rotated y (screen = [x', z']); unprojectDelta maps
                    screen-plane deltas back to world via R^T
    lorenz.ts       CLASSIC = (10, 28, 8/3); lorenzDeriv; fixedPoints (origin
                    always, C+- for rho > 1)
    pendulum.ts     absolute angles from the downward vertical, m = l = g = 1;
                    mass matrix A[i][j] = n - max(i, j); solveLinear (Gaussian
                    elimination, partial pivoting); pendulumDeriv,
                    pendulumEnergy (V zero at the pivot), jointPositions (y up),
                    poseDragThetas (drag posing)
    nbody.ts        planar, G = 1, softened kernel (r^2 + eps^2)^(3/2),
                    SOFTENING = 0.05; nbodyEnergy, nbodyAngularMomentum;
                    PRESETS: figure8, pythagorean, sun2planets, binaryPlanet
                    (all zero total momentum)
    ensemble.ts     perturb, runEnsemble (copy k gets +k*epsilon), separation
                    (full-state L2 at shared times), stateExtent (RMS deviation
                    from the time-mean), lyapunovFit (least-squares line through
                    (t, ln d); the window ends at the FIRST cutoff crossing so
                    saturated-tail dips cannot re-enter and bias the slope;
                    null under 2 usable samples)
  scenes.ts         SCENES: per-tab {dt, tMax, maxSamples, stride, epsScale,
                    fadeWindow} - lorenz 400/stride 2, pendulum 300/stride 5,
                    recording spacing 0.01 everywhere; fadeWindow (40/30/per
                    preset) is the age window trails stay visible for (n-body
                    horizon + fadeWindow come from the active preset, presets
                    200..600); FIT_FRACTION = 0.1
                    of stateExtent(reference) as the fit cutoff; buildEnsemble -
                    the only place simulations are built (the n-body branch
                    passes haltWhen: any body beyond 3 * halfExtent truncates
                    that member early; escapers freeze at their last sample)
  state.ts          one Store with subscribe(): scene mutations rebuild the
                    ensemble once, reset playback, bump revision, notify once;
                    playback/view/fade mutations notify without recompute
                    (rotating the Lorenz view or moving the fade sliders must
                    never resimulate; setFade clamps windowScale to [0.1, 4],
                    strength to [0, 1]); nbody addBody/removeBody (2..6 bodies,
                    copied arrays, reselect + recompute once; out-of-bounds
                    calls are notify-only no-ops); nbody selectBody
                    recomputes once on a changed index (it retargets the
                    ensemble perturbation), notify-only when unchanged
  ui/
    topbar.ts       three-tab switcher (Lorenz / Pendulum / N-body)
    playback.ts     play/pause, reset, scrubber, speed (0.25x..16x); pressing
                    Play with t at the horizon rewinds to 0 first
    controls.ts     sliderRow and numRow (clamped text field, commits on
                    Enter/blur, edit-safe refresh) -> ControlRow {el, refresh};
                    buttonRow, hitTest; attachDrag distinguishes taps (<= 4 px)
                    from drags (rAF-coalesced), sets hover/grab cursors -
                    ported from ../kinematics; attachTimelineScrub turns a
                    canvas into a click/drag timeline (frac callback,
                    rAF-coalesced, isConnected + zero-width guards) - the
                    divergence strips use it in all three scenes
    panel.ts        fmt, CAPTIONS, formulasFor (live-number formula lines per
                    scene incl. the delta(t) ~ delta0 * e^(lambda t) fit line),
                    createPanel
  render/
    viewport.ts     uniform min-fit world<->screen transform, y up (port)
    draw.ts         COLORS (CSS custom props resolved once at module load),
                    ensembleColor (10 distinct hues, k % length), drawFadingTrail
                    (alpha ramp toward the head; optional windowPts draws only
                    the trailing window; optional tailAlpha, default 0.05, sets
                    the ramp's dim end - scenes map it from fade.strength and
                    scale windowPts by fade.windowScale), drawTrailMap (uniform faint
                    full-trajectory map for the paused t=0 state),
                    drawDivergenceStrip (log10 d vs t per copy, dashed fit line,
                    playhead; series decimated to ~2 pts/px)
    lorenzScene.ts  projected butterfly; empty-canvas drag rotates (setView),
                    IC-dot drag moves y0 through unprojectDelta; rho slider
                    plus x0/y0/z0 typed fields (numRow)
    pendulumScene.ts arms + joints; joint drag poses the chain (dragged link
                    aims at the pointer, links below keep relative angles;
                    release from rest); tip trails for all copies; n slider
    nbodyScene.ts   presets, body drags (positions), velocity-arrow drags,
                    x/y/vx/vy typed fields (numRow) + mass slider for the
                    selected body, tap empty canvas to add a body (mass 1,
                    small starter velocity - a coincident arrow tip would be
                    unreachable behind the body handle) + remove-body button,
                    radius ~ mass^(1/3), per-body trails + ghost copies
  main.ts           SceneRenderer registry, subscribe-driven tab mount/unmount,
                    shared K, log10(epsilon), trail-window and fade-strength
                    rows in the playbar, rAF playback loop advancing t by
                    dt * speed to the horizon
tests/              vitest: sim core, ensemble math, store/scenes, formatters,
                    viewport - pure logic only, no DOM
```

Invariants worth keeping:

- Precompute + scrub: every scene mutation resimulates the whole ensemble over
  a fixed per-scene horizon; playback interpolates the same stored samples.
  One simulation code path, so trails and playback cannot disagree.
- delta0 = k*epsilon is deterministic; the Lyapunov fit and the tests know it
  exactly. The default Lorenz IC (-1.39, -2.47, 11.86) starts on the attractor
  (butterfly visible on load as a faint map; the on-load fitted lambda reads
  ~0.84 against the canonical 0.906). The Lorenz-classic fitted lambda must
  stay in [0.6, 1.2] and the pendulum energy drift under 1e-4 over the full
  300-unit horizon (measured 3.2e-8) - those unit tests are the honesty
  contract behind the captions; never loosen them to make a change pass.
- Trails are age-windowed during playback: only the trailing fadeWindow of
  history draws (bright ramp), older samples vanish; paused t=0 shows the whole
  run as a uniform faint map (drawTrailMap). The Pythagorean preset's reference
  genuinely halts near t ~ 92 (its famous ejection crosses 3 * halfExtent), so
  its playable horizon ends there - physics, not a bug.
- The pure core never throws: clamps, stop conditions, nonfinite truncation.
- setView notifies without recompute; selectBody recomputes on a changed
  index (it retargets the perturbation), notifies only when unchanged;
  setShared, patch*, and loadPreset recompute exactly once.
- Normalized units everywhere (Lorenz dimensionless, pendulum m = l = g = 1,
  n-body G = 1); captions state the normalization, readouts show no fake
  precision.

## Key Lessons & Pitfalls (inherited from ../kinematics, still true here)

- Time grids must divide the endpoint exactly in integrator convergence tests
  (dt = tEnd / N), or the test measures grid offset, not integrator error.
- Softening shifts periods: n-body closure tests against analytic periods need
  loose tolerance.
- Focus-based UI guards freeze on macOS: track scrubber interaction with
  pointerdown/up/cancel flags, never document.activeElement.
- Safari/WebKit does not synthesize a click when the DOM under the pointer
  mutates between press and release: per-frame render paths must write
  textContent idempotently (only on change), and buttons that live next to a
  rAF loop act on pointerup, with click as the keyboard-only path.
- RK4 is not symplectic; horizons are bounded and energy drift is measured (and
  test-bounded), not hidden.

## Conventions

- TypeScript strict, no UI framework, no runtime deps; devDeps only
  (typescript, vite, vitest).
- ASCII-only source. Unicode (Greek, superscripts) only in display strings and
  only as \uXXXX escapes; tests compare against the same escapes.
- Rendering is verified visually; vitest covers the pure core, the Store, and
  pure display formatters only. No DOM tests.
- Constants (dt, horizons, SOFTENING, FIT_FRACTION, presets) live in src/sim/
  and src/scenes.ts, never scattered through render code.
- Keep README.md and this file in sync with reality (the smart-commit skill
  handles this at commit time).

## Deploy

Push to `main` runs `.github/workflows/deploy.yml`: npm ci, vitest, Vite build,
then GitHub Pages deploy of `dist/`. One-time setup: repository Settings ->
Pages -> Source: GitHub Actions. Vite `base: './'`.

## Tone

Be a quirky friendly but critical peer reviewer: helpful, but hold the author to
high standards. Challenge inefficiencies - if something is being done the hard
way, call it out.
