# Deterministic Chaos

[![Deploy](https://github.com/GovitPowerz/teaching-physics-chaos/actions/workflows/deploy.yml/badge.svg)](https://github.com/GovitPowerz/teaching-physics-chaos/actions/workflows/deploy.yml)

**Try it live: <https://govitpowerz.github.io/teaching-physics-chaos/>**

An interactive chaos teaching site, sibling of **Motion in Force Fields**
(the `../kinematics` project next door, whose stack and conventions this repo
shares): the same equations, the same RK4 integrator, a tiny nudge in the
initial conditions, a completely different future. Every scene runs one
reference trajectory plus K perturbed copies; a divergence strip chart under
the canvas plots log10 of their state-space separation against time and fits
the largest Lyapunov exponent live.

## The three scenes

- **Lorenz** - the canonical strange attractor at sigma = 10, rho = 28,
  beta = 8/3, drawn through a hand-rolled yaw/pitch orthographic projection:
  drag empty canvas to rotate, drag the IC dot to move the start point in the
  current view plane, or type exact x0/y0/z0 coordinates. The default start
  point sits on the attractor, so the butterfly is fully formed on load. A rho
  slider (0..40) crosses the ~24.74 transition where the strange attractor
  dies. The divergence slope estimates the largest Lyapunov exponent
  (canonical 0.906; the on-load fit reads ~0.86), and a unit test pins the
  fit inside [0.6, 1.2].
- **Pendulum** - an n-link pendulum (n = 2..5, unit masses and lengths, g = 1):
  grab any joint to pose the chain (the dragged link aims at the pointer, the
  links below keep their relative angles), release starts from rest. The
  ensemble perturbs the tip angle; tip trails in distinct hues go from
  indistinguishable to unrelated. Total energy is shown live and its drift over
  the full horizon is bounded by a unit test.
- **N-body** - planar gravity, G = 1, softened kernel: the figure-8
  choreography, the Pythagorean (Burrau) problem, Sun + 2 planets, and
  binary + planet presets. Bodies and velocity arrows drag, the selected
  body's position and velocity can also be typed exactly, its mass slides,
  radii scale as mass^(1/3); the ensemble perturbs the selected body's
  position. Energy and angular momentum readouts keep the integrator honest.

Shared everywhere: a K slider (2..10 copies), a log-scale perturbation size,
and kinematics-style playback (play/pause, reset, scrubber, speed) over
precomputed trajectories - scrubbing back to the exact moment the copies split
costs nothing.

## Quick start

    npm install
    npm run dev       # dev server on :5173
    npm test          # vitest over the sim core, ensemble math, store, formatters
    npm run build     # tsc --noEmit + vite build -> dist/

## How it works

One fixed-step RK4 integrator (`src/sim/ode.ts`) advances flat `number[]`
states: Lorenz is 3 numbers, the n-link pendulum 2n, the planar n-body 4n.
`simulate()` (`src/sim/simulate.ts`) records a bounded sample table (tMax, a
sample cap, nonfinite truncation at the last good sample, and an optional halt
predicate - n-body ensemble members that fly beyond three times the preset's
half-extent truncate early and freeze at their last sample during playback);
playback and trails interpolate the same samples, so they cannot disagree.
`src/sim/ensemble.ts` builds the perturbed copies (copy k offsets one
scene-designated component by k*epsilon, so delta0 is known exactly), measures
full-state L2 separation, and fits lambda by log-linear regression below a
saturation cutoff (a fixed fraction of the reference trajectory's state-space
extent). The pendulum solves M(theta) * omegaDot = b by Gaussian elimination
with partial pivoting each derivative call; the n-body shares the sibling's
softened kernel (r^2 + 0.05^2)^(3/2). The pure core never throws: clamps, stop
conditions, and truncation instead of exceptions.

## Deploy

Pushing to `main` runs `.github/workflows/deploy.yml`: npm ci, vitest, Vite
build, then GitHub Pages deploy of `dist/` to the live URL above. One-time
setup: repository Settings -> Pages -> Source: GitHub Actions.
