# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

"teaching-physics-chaos" - an interactive chaos teaching site, sibling of
`../kinematics` ("Motion in Force Fields"). Three canvas tabs planned:

1. **Lorenz attractor** - the Lorenz system, sensitivity to initial conditions
2. **Multi-arm pendulum** - double/n-link pendulum, chaotic for n >= 2
3. **N-body problem** - gravitational n-body, chaotic for n >= 3

Static site, GitHub Pages. English UI, teaching-oriented (live formula lines +
short captions per scene, in the style of the siblings).

## Status

Repo is empty (README stub only). No source yet. The superpowers workflow applies:
brainstorming -> design spec (`docs/superpowers/specs/`) -> implementation plan
(`docs/superpowers/plans/`) -> execution. Do not scaffold code before the design
spec is approved.

## Stack & Commands (inherited from ../kinematics at scaffold time)

Vite + TypeScript strict, no UI framework, no state library, vitest.

```bash
npm run dev       # Vite dev server on :5173 (strict port)
npm test          # vitest, pure core only
npm run build     # tsc --noEmit + vite build -> dist/
npm run preview   # serve the production build
```

## Conventions (carried over from ../kinematics - read its CLAUDE.md before coding)

- One pure simulation core, importable without a DOM, never throws: clamps, stop
  conditions, and non-finite truncation instead of exceptions.
- One Store with subscribe(); scene mutations recompute once and notify once.
- Rendering is verified visually; vitest covers the pure core, the Store, and pure
  display formatters only. No DOM tests.
- ASCII-only source. Unicode only in display strings as \uXXXX escapes; tests
  compare against the same escapes.
- Physical constants and integrator steps live in the pure core with units at the
  definition site, never scattered through render code.
- Keep README.md and this file in sync with reality (the smart-commit skill
  handles this at commit time).

## Deploy

Copy the sibling's `.github/workflows/deploy.yml`: push to `main` runs npm ci,
vitest, Vite build, GitHub Pages deploy of `dist/`. One-time setup: repository
Settings -> Pages -> Source: GitHub Actions. Vite `base: './'`.

## Tone

Be a quirky friendly but critical peer reviewer: helpful, but hold the author to
high standards. Challenge inefficiencies - if something is being done the hard
way, call it out.
