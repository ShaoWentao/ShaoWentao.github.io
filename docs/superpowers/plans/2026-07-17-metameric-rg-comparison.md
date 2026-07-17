# Metameric Rg Comparison Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an optional same-colour-point mode that adjusts TM-30 Rg while preserving CCT/Duv and overlays a stored baseline without disrupting the default single-spectrum interface.

**Architecture:** Extract the deterministic metamer search into a pure testable module that consumes channel SPDs and the existing colour-quality callback. Keep baseline state and rendering integration in `app.js`, using the existing SPD and CIE canvases rather than adding panels. Controls remain collapsed until the mode is enabled.

**Tech Stack:** Browser JavaScript, Canvas 2D, existing CIE spectral data, existing ANSI/IES TM-30 implementation, Node assertion tests.

## Global Constraints

- Target Rg range is 80-130.
- Default target is the current Rg rounded to the nearest integer.
- Rf floor is 80.
- Accepted chromaticity error is Delta u'v' <= 0.002.
- Default single-spectrum behavior and the desktop 1366 x 768 no-scroll layout must remain intact.
- Unreached targets must report the closest Rg found in the deterministic bounded search and must never claim mathematical global optimality or silently relax chromaticity tolerance.

---

### Task 1: Pure Metamer Optimizer

**Files:**
- Create: `spectral_optimizer/metamer-optimizer.js`
- Create: `spectral_optimizer/metamer-optimizer.test.js`
- Modify: `spectral_optimizer/index.html`

**Interfaces:**
- Consumes: channel objects `{ id, spd }`, baseline percentages, `targetXy`, `targetRg`, and callbacks `evaluateSpd(spd)` and `xyToUv(x, y)`.
- Produces: `optimizeMetamer(options) -> { values, achievedRg, achievedRf, deltaUv, exact, feasible }`.

- [ ] **Step 1: Write failing deterministic optimizer tests**

Test that identical inputs return identical outputs, accepted results satisfy `deltaUv <= 0.002`, Rf never falls below 80, and an unreached target returns `exact: false` with the best feasible result discovered by the bounded search.

- [ ] **Step 2: Run the test and verify failure**

Run: `node spectral_optimizer/metamer-optimizer.test.js`
Expected: FAIL because `metamer-optimizer.js` does not exist.

- [ ] **Step 3: Implement bounded deterministic coordinate search**

Use deterministic baseline, corner, and interior seeds with fixed step sizes `[24, 12, 6, 3, 1, 0.5]`. Rank candidates lexicographically: reject chromaticity outside tolerance, then minimize Rg error, reject Rf below 80, then minimize distance from baseline. Export through CommonJS for Node and `window.METAMER_OPTIMIZER` for the browser.

- [ ] **Step 4: Run tests**

Run: `node spectral_optimizer/metamer-optimizer.test.js`
Expected: PASS for determinism, chromaticity, Rf floor, and bounded-search fallback behavior.

- [ ] **Step 5: Load the module before `app.js`**

Add `<script src="metamer-optimizer.js"></script>` immediately before the existing `app.js` script.

- [ ] **Step 6: Commit**

Run: `git add spectral_optimizer/metamer-optimizer.js spectral_optimizer/metamer-optimizer.test.js spectral_optimizer/index.html && git commit -m "feat: add deterministic metamer optimizer"`

### Task 2: Same-Colour-Point Controls And State

**Files:**
- Modify: `spectral_optimizer/index.html`
- Modify: `spectral_optimizer/styles.css`
- Modify: `spectral_optimizer/app.js`

**Interfaces:**
- Consumes: `METAMER_OPTIMIZER.optimizeMetamer` from Task 1 and existing `computeMetrics`, `combinedSPDFromValues`, and channel state.
- Produces: `metamerModeEnabled`, `targetRg`, `baselineSnapshot`, `captureBaseline()`, `clearBaseline()`, and `runMetamerOptimization()`.

- [ ] **Step 1: Add hidden compact controls**

Add a `Same colour point` checkbox, target Rg range input (`80-130`, step `1`), `Set baseline` button, comparison checkbox, and a one-line status element inside the existing optimizer row. Hide dependent controls until the mode is checked.

- [ ] **Step 2: Add state and immutable baseline capture**

Store copies of channel percentages, normalized SPD, xy, u'v', and metrics. Clear the snapshot whenever channel definitions are imported or mode changes between four and six channels.

- [ ] **Step 3: Connect target Rg optimization**

Call `optimizeMetamer` with the active target CCT/Duv colour point. Apply returned channel percentages through `applyValuesImmediate`. Show either `Target achieved` or `Closest Rg found in current search: N` based on `exact`.

- [ ] **Step 4: Preserve normal operation**

When the mode is off, all existing presets, target CCT/Duv controls, channel sliders, and optimization paths must execute unchanged. Turning the mode off hides annotations without resetting channel values.

- [ ] **Step 5: Fit the controls into current responsive layout**

Desktop controls stay within the 142 px optimizer row at 1366 x 768. Mobile controls wrap into one column without horizontal overflow.

- [ ] **Step 6: Commit**

Run: `git add spectral_optimizer/index.html spectral_optimizer/styles.css spectral_optimizer/app.js && git commit -m "feat: add same-colour-point Rg controls"`

### Task 3: Baseline Overlay And Metric Deltas

**Files:**
- Modify: `spectral_optimizer/app.js`
- Modify: `spectral_optimizer/styles.css`

**Interfaces:**
- Consumes: `baselineSnapshot` and comparison visibility state from Task 2.
- Produces: baseline SPD canvas layer, baseline CIE marker, and Rf/Rg delta labels.

- [ ] **Step 1: Draw baseline SPD**

In the existing SPD renderer, draw the normalized baseline as a neutral grey dashed line before the current combined SPD. Restore the canvas dash state afterward.

- [ ] **Step 2: Draw both chromaticity markers**

Add a hollow grey baseline marker and retain the current filled marker. Draw a subtle connector only when screen-space separation is visible.

- [ ] **Step 3: Add Rf/Rg deltas**

Append signed baseline differences beside current Rf and Rg, using `(+N)`, `(0)`, or `(-N)`. Remove the deltas whenever comparison is disabled or the baseline is cleared.

- [ ] **Step 4: Add visual semantics**

Use grey dashed styling for baseline and the existing warm accent for current data. Do not add new cards, charts, shadows, or decorative effects.

- [ ] **Step 5: Commit**

Run: `git add spectral_optimizer/app.js spectral_optimizer/styles.css && git commit -m "feat: overlay metamer baseline comparison"`

### Task 4: Integration And Visual Verification

**Files:**
- Modify: `spectral_optimizer/metamer-optimizer.test.js`
- Modify: `spectral_optimizer/app.js` only if verification exposes a defect.

**Interfaces:**
- Consumes: completed feature from Tasks 1-3.
- Produces: verified desktop/mobile behavior and regression coverage.

- [ ] **Step 1: Run automated tests**

Run: `node spectral_optimizer/spectral-math.test.js; node spectral_optimizer/colour-quality.test.js; node spectral_optimizer/metamer-optimizer.test.js; node --check spectral_optimizer/app.js`
Expected: all tests pass and syntax check exits 0.

- [ ] **Step 2: Verify same-colour behavior in a real browser**

At 4000 K / Duv 0, capture a baseline, request a higher achievable Rg, and assert the displayed Delta u'v' is no greater than 0.002, Rf is at least 80, and Rg changes in the requested direction.

- [ ] **Step 3: Verify failure messaging**

Request Rg 130 with the four-channel set. Confirm the UI reports the closest value found by the bounded search when exact attainment is impossible.

- [ ] **Step 4: Perform visual QA**

Capture 1366 x 768, 1440 x 1000, and 390 x 844 screenshots. Confirm no desktop page scrolling, no overlap, readable controls, and intact default single-spectrum layout.

- [ ] **Step 5: Commit verification fixes**

Run only if files changed: `git add spectral_optimizer && git commit -m "test: verify metamer comparison workflow"`
