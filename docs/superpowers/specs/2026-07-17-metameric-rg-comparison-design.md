# Metameric Rg Comparison Design

## Goal

Add an optional same-chromaticity, different-spectrum demonstration to the spectral optimizer. Users can hold CCT and Duv constant, vary TM-30 Rg, and see how spectral composition and colour-quality metrics change without disrupting the existing single-spectrum workflow or single-screen desktop layout.

## Interaction

- The default state remains the current single-spectrum interface.
- Add a compact `Same colour point` toggle to the optimizer controls.
- When enabled, show a target Rg slider, a `Set baseline` command, and a `Compare spectrum` checkbox.
- `Set baseline` stores the current channel values, SPD, chromaticity, and metrics in memory.
- Moving target Rg optimizes the active channel mix while keeping the selected CCT and Duv fixed.
- When comparison is enabled, the current SPD remains the primary solid curve and the baseline appears as a neutral grey dashed curve in the existing SPD chart.
- The CIE chart shows the baseline and current chromaticity markers together. They should overlap within the accepted chromaticity tolerance.
- Metric cards continue to show current values. Rf and Rg additionally show signed changes from the baseline, such as `Rg 112 (+12)`.
- Disabling the mode removes comparison annotations but does not unexpectedly reset the current channel mix.

## Layout

- Do not add another chart or permanent comparison panel.
- Place the new controls in the existing optimizer row and keep them hidden until the mode is enabled.
- Preserve the current no-scroll desktop workspace at 1366 x 768 and larger.
- On mobile, controls wrap naturally below CCT and Duv; charts remain single-column.

## Optimizer

The optimizer uses a deterministic multi-objective loss:

1. Chromaticity error against the target CCT/Duv receives the highest priority.
2. Rg error moves the solution toward the requested gamut target.
3. Rf receives a configurable floor penalty to prevent extreme saturation with unacceptable fidelity.
4. A small distance penalty from the baseline/current solution stabilizes channel values and avoids unnecessary jumps.

The result is accepted only when its chromaticity remains within the defined tolerance. If the requested Rg is unreachable with the loaded channels, the optimizer returns the closest feasible result and the UI labels it as `Nearest achievable Rg` rather than implying an exact match.

Suggested initial constraints:

- Target Rg range: 80-130.
- Default target: current Rg rounded to the nearest integer.
- Rf floor: 80.
- Chromaticity tolerance: Delta u'v' <= 0.002.

These values should be constants so they can be calibrated against real channel sets later.

## State And Data Flow

- `metamerModeEnabled`: controls visibility and optimizer behavior.
- `targetRg`: requested TM-30 gamut index.
- `baselineSnapshot`: immutable copy of channel values, SPD, xy/u'v', and metrics.
- Existing spectral and colour-quality functions remain the single source of truth.
- Baseline data is kept in memory only; reloading the page clears it.
- Importing a new channel set invalidates the previous baseline and prompts the user to set a new one.

## Error Handling

- Disable comparison until a baseline exists.
- If TM-30 cannot be calculated, disable target Rg and explain that valid spectral data is required.
- If fewer independent channels make the requested Rg infeasible, preserve the best valid same-colour-point result and show the achieved value.
- Never silently relax the chromaticity tolerance.

## Verification

- Confirm preset and optimizer paths still agree for neutral CCT targets.
- Verify the current and baseline points differ by no more than Delta u'v' 0.002.
- Verify increasing target Rg can produce a higher achieved Rg on a channel set with sufficient degrees of freedom.
- Verify Rf floor enforcement and unreachable-target messaging.
- Verify baseline/current SPD overlays, metric deltas, and reset behavior.
- Visual QA at 1366 x 768, 1440 x 1000, and 390 x 844.
- Run existing spectral-math and colour-quality tests plus dedicated metamer optimizer tests.
