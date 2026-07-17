# Spectral Emitter Preview Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a live circular emitter preview whose display colour is calculated from the current mixed SPD.

**Architecture:** Add pure XYZ-to-sRGB display conversion helpers to the existing spectral math module and cover them with deterministic tests. Add a compact preview component to the left control panel and update it from the existing scheduled render cycle using the same combined SPD and metrics as the charts.

**Tech Stack:** Vanilla HTML, CSS, JavaScript, Canvas-independent CIE spectral calculations, Node.js assertion tests, Playwright visual verification.

## Global Constraints

- Derive preview colour from the current combined SPD through CIE XYZ and sRGB, never from CCT alone.
- Keep the component below presets in the left panel and prevent desktop or mobile overflow.
- Display measured CCT and CIE 1931 `x, y` coordinates.
- Show a neutral explicit no-output state when spectral power is zero.
- Do not change optimization results or exported recipe data.

---

### Task 1: Display-colour conversion

**Files:**
- Modify: `spectral_optimizer/spectral-math.js`
- Modify: `spectral_optimizer/spectral-math.test.js`

**Interfaces:**
- Consumes: XYZ tristimulus values calculated from the current SPD.
- Produces: `xyzToDisplaySrgb(X, Y, Z)` returning `{ r, g, b, css }`, with RGB channels in `0..255`.

- [ ] **Step 1: Write failing conversion tests**

Add assertions that equal-energy white produces finite, near-neutral RGB values; zero XYZ returns black; and saturated inputs are clipped to `0..255`.

- [ ] **Step 2: Run the test and verify failure**

Run: `node spectral_optimizer/spectral-math.test.js`

Expected: failure because `xyzToDisplaySrgb` is not exported.

- [ ] **Step 3: Implement standard XYZ to sRGB conversion**

Normalize XYZ by `Y`, apply the D65 XYZ-to-linear-sRGB matrix, apply the standard sRGB transfer function, then clip and quantize only the display result.

- [ ] **Step 4: Run the test and verify success**

Run: `node spectral_optimizer/spectral-math.test.js`

Expected: `spectral-math tests passed`.

### Task 2: Live emitter component

**Files:**
- Modify: `spectral_optimizer/index.html`
- Modify: `spectral_optimizer/styles.css`
- Modify: `spectral_optimizer/app.js`

**Interfaces:**
- Consumes: `getCombinedSPD()`, `xyzFromSPD()`, `calculateMetrics()`, and `SpectralMath.xyzToDisplaySrgb()`.
- Produces: `updateEmitterPreview(combinedSPD, metrics)` that updates the emitter CSS colour and CCT/xy readout.

- [ ] **Step 1: Add semantic preview markup below presets**

Create a compact section with a circular emitter, a live status label, CCT, and `x, y` readout.

- [ ] **Step 2: Style lit and no-output states**

Use a 120 px circular surface, restrained inner light, a defined edge, responsive sizing, and no external glow that overlaps controls.

- [ ] **Step 3: Connect the preview to scheduled updates**

Calculate XYZ and xy from the combined SPD, call `xyzToDisplaySrgb`, update CSS custom properties and text, and use a neutral state when total output is zero.

- [ ] **Step 4: Run all calculation tests**

Run:

```text
node spectral_optimizer/spectral-math.test.js
node spectral_optimizer/colour-quality.test.js
node spectral_optimizer/metamer-optimizer.test.js
node --check spectral_optimizer/app.js
```

Expected: all tests pass without syntax errors.

- [ ] **Step 5: Verify browser behaviour**

At `1366x768`, confirm the preview occupies the lower-left gap without changing the single-screen layout. At `390x844`, confirm no horizontal scrolling. Move a channel slider, apply a preset, run optimization, and reset all channels; verify the preview changes and the zero-output state appears.

- [ ] **Step 6: Commit the implementation**

Stage only the spectral optimizer files and commit with `feat: add live spectral emitter preview`.
