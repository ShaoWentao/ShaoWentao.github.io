# CCT Journey and Human-Centred Scenes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an accurate 1000-20000 K Planckian display locus, a 1600-12000 K animated optimized CCT journey, and six evidence-informed scene presets with neutral Duv.

**Architecture:** Extend the pure spectral math module with Planck integration and reusable journey/scene definitions, then connect those pure interfaces to existing optimizer state in `app.js`. Keep one timer owner, cache results by channel configuration and CCT, and render achieved rather than fabricated colour points.

**Tech Stack:** Browser JavaScript, Canvas 2D, Node.js assertion tests, static HTML/CSS, Playwright browser verification.

## Global Constraints

- Draw the Planckian locus from 1000 K through 20000 K using Planck SPD integration with existing CIE 1931 colour-matching functions.
- Limit target fitting, the slider, and animation to 1600-12000 K.
- Use Duv 0.0000 for all scenes and every animation node.
- Do not change exposure duration or visual-field factor when applying scenes or animation.
- Preserve deterministic optimization, actual achieved markers, one-screen desktop layout, and responsive mobile behavior.
- Do not modify unrelated dirty repository files.

---

### Task 1: Integrated Planckian Chromaticity

**Files:**
- Modify: `spectral_optimizer/spectral-math.js`
- Modify: `spectral_optimizer/spectral-math.test.js`

**Interfaces:**
- Produces: `blackbodySpd(temperature, wavelengths) -> number[]` and `blackbodyXy(temperature, wavelengths, xBar, yBar, zBar) -> {x, y}`.
- Consumes: existing wavelength and CIE 1931 colour-matching arrays.

- [ ] Add failing tests for finite normalized SPDs and reference xy values at 1000, 1600, 6500, 12000, and 20000 K.
- [ ] Run `node spectral_optimizer/spectral-math.test.js` and verify missing-function failures.
- [ ] Implement Planck spectral radiance using stable exponent handling and XYZ integration.
- [ ] Ensure invalid temperatures and mismatched arrays return safe results without NaN.
- [ ] Run `node spectral_optimizer/spectral-math.test.js` and confirm all old and new tests pass.
- [ ] Commit with `git commit -m "feat: add integrated Planckian chromaticity"`.

### Task 2: Journey and Scene Definitions

**Files:**
- Create: `spectral_optimizer/cct-journey.js`
- Create: `spectral_optimizer/cct-journey.test.js`

**Interfaces:**
- Produces: `buildCctJourney() -> number[]`, immutable `HUMAN_CENTRED_SCENES`, and `sceneById(id)`.
- Scene fields: `{ id, labelZh, labelEn, cctK, duv, illuminanceLux, emphasis }`.

- [ ] Write failing tests asserting exact endpoints, 500 K internal nodes, mirrored return order, all six scene values, Duv zero, and immutable definitions.
- [ ] Run `node spectral_optimizer/cct-journey.test.js` and verify module-not-found failure.
- [ ] Implement the journey as `1600, 2000, 2500 ... 12000 ... 2500, 2000, 1600` without duplicating 12000 at the turn.
- [ ] Implement the six confirmed scenes and CommonJS/browser exports.
- [ ] Run the new tests and confirm PASS.
- [ ] Commit with `git commit -m "feat: define CCT journey and scene presets"`.

### Task 3: Animation and Interface Integration

**Files:**
- Modify: `spectral_optimizer/index.html`
- Modify: `spectral_optimizer/styles.css`
- Modify: `spectral_optimizer/app.js`

**Interfaces:**
- Consumes: `SpectralMath.blackbodyXy`, `CctJourney.buildCctJourney`, and `CctJourney.HUMAN_CENTRED_SCENES`.
- Produces: play/pause/stop controls, 300 ms node playback, cached channel solutions, and six working scene buttons.

- [ ] Load `cct-journey.js` before `app.js`, change target slider to `min=1600 max=12000`, and replace the five scene buttons with six bilingual definitions.
- [ ] Draw the 1000-20000 K locus and collision-aware labels at 1000, 1600, 3000, 4000, 6500, 12000, and 20000 K using integrated xy values.
- [ ] Add icon play/pause and stop controls with accessible names and tooltips.
- [ ] Implement a single animation state object containing timer, index, status, cache, and channel signature.
- [ ] At each node set Duv zero, optimize once or use a valid cached solution, then update controls, charts, emitter preview, and metrics.
- [ ] Disable invalidating controls during active playback; pause preserves state; stop restores controls and retains the current recipe.
- [ ] Stop safely on visibility change and page unload; repeated play must not create another timer.
- [ ] Apply scenes by setting CCT, Duv zero, and eye illuminance before one deterministic optimization. Do not touch duration or field factor.
- [ ] Add Colour Vitality Rg emphasis only where supported by the existing objective; show achieved metrics without success claims.
- [ ] Run syntax plus all spectral, colour-quality, metamer, CLA, and journey tests.
- [ ] Commit with `git commit -m "feat: add animated CCT journey and scenes"`.

### Task 4: Complete Verification

**Files:**
- Modify only when a verified defect requires it: `spectral_optimizer/index.html`, `styles.css`, `app.js`, `spectral-math.js`, `cct-journey.js`, and their tests.

**Interfaces:**
- Verifies the full feature without introducing new APIs.

- [ ] Verify the complete `1600 -> 12000 -> 1600 K` round trip and confirm every node changes target, actual spectrum, and metrics appropriately.
- [ ] Verify unreachable endpoints show target and achieved markers separately.
- [ ] Verify pause/resume/stop, repeated play, visibility change, and unload leave at most one timer.
- [ ] Verify every scene's CCT, zero Duv, illuminance, and unchanged duration/field factor.
- [ ] Verify 1920x1080, 1366x768, and 390x844 have no overlap or horizontal overflow.
- [ ] Run `node --check spectral_optimizer/app.js` and all five existing suites plus `cct-journey.test.js`.
- [ ] Commit verified corrections, if any, with `git commit -m "fix: verify CCT journey behavior"`.
