# CCT Journey and Human-Centred Scene Presets Design

## Goal

Replace the unsupported Duv-biased scene presets with practical visual, circadian, and colour-quality scenes, and add an animated colour-temperature journey whose target and resulting SPD move along the Planckian locus.

## Temperature Ranges

- The chromaticity diagram will draw the Planckian locus from 1000 K through 20000 K.
- The target CCT slider, optimizer, presets, and animation will operate only from 1600 K through 12000 K.
- Duv will remain 0.0000 throughout the animation.
- Planckian chromaticities across the full display range will be calculated by integrating Planck spectral radiance against the existing CIE 1931 colour-matching functions. The current polynomial approximation will not be extrapolated below its supported range.

The animation sequence will start at 1600 K, advance in nominal 500 K intervals, explicitly include 12000 K, then return over the same nodes and explicitly finish at 1600 K. Therefore the first interval may be 400 K (`1600 -> 2000`) while all internal intervals are 500 K.

## Animation

The interface will provide familiar play/pause and stop controls with tooltips. Playback will use approximately 300 ms per CCT node.

At each node the application will:

1. Set target CCT and target Duv = 0.0000.
2. Run the existing deterministic channel optimizer for that target.
3. Update channel controls, actual chromaticity, combined SPD, emitter preview, CLA 2.0/CS, CIE S 026 metrics, and colour-quality metrics.
4. Cache the resulting channel values by channel configuration and target CCT for subsequent playback.

The target marker will follow the Planckian locus. The actual marker will show the achieved colour point. The application must not place the actual marker on the target when the active channels cannot reach it.

During playback, controls that can invalidate the sequence will be disabled: target CCT, target Duv, scene presets, channel-mode selection, and SPD import. Pause preserves the current node and permits resume. Stop cancels playback, restores controls, and retains the current CCT and optimized spectrum.

Only one animation timer may exist. Starting playback repeatedly must not create overlapping optimization loops. Changing page visibility or unloading the page must stop the timer safely.

## Scene Presets

All scene presets use target Duv 0.0000. They do not change exposure duration or visual-field factor because those controls describe actual exposure conditions rather than a spectral recipe.

| Scene | Target CCT | Corneal illuminance | Optimization emphasis |
|---|---:|---:|---|
| Morning Transition | 3500 K | 250 lx | Moderate daytime circadian support with a visually warm transition |
| Daytime Focus | 5000 K | 400 lx | Higher daytime melanopic and CLA 2.0 response with neutral colour quality |
| Collaboration | 4000 K | 300 lx | Balanced facial appearance, colour fidelity, and moderate circadian support |
| Colour Vitality | 3500 K | 300 lx | Prefer high fidelity and an Rg target range of 105-115 where channel gamut permits |
| Evening Wind-down | 2700 K | 75 lx | Lower melanopic and CLA 2.0 stimulus with warm appearance |
| Night Low Disturbance | 2000 K | 10 lx | Minimize melanopic and CLA 2.0 stimulus while retaining basic visibility |

The preset values are design starting points, not medical prescriptions or guaranteed biological outcomes. Labels and tooltips will be bilingual and will describe design intent rather than claims such as guaranteed alertness, productivity, or sleep improvement.

Scene activation will update CCT, Duv, and corneal illuminance before running one deterministic optimization. `Colour Vitality` may add an Rg-oriented objective; other scenes retain the established colour-point and spectral-quality objective. If a metric target cannot be reached with the active channels, the interface displays the achieved values without claiming success.

## Chromaticity Diagram

The full 1000-20000 K Planckian locus will be drawn from integrated blackbody chromaticities. Visible labels will include 1000 K, 1600 K, 3000 K, 4000 K, 6500 K, 12000 K, and 20000 K, with collision-aware offsets at the compressed high-temperature end.

The diagram must remain readable at desktop and mobile sizes. Extending the locus must not change the diagram coordinate system or clip the spectral locus and channel gamut.

## Architecture

- Extend `spectral-math.js` with a tested Planck SPD integration function and a blackbody chromaticity function valid over 1000-20000 K.
- Keep animation state and scene application in `app.js`.
- Add controls and bilingual copy in `index.html`.
- Add compact responsive control styling in `styles.css`.
- Add deterministic unit tests for endpoint inclusion, locus values, scene definitions, timer state, and optimizer isolation.

## Verification

Automated tests will verify:

- Known blackbody chromaticity values at representative temperatures, including 1000 K, 1600 K, 6500 K, 12000 K, and 20000 K.
- The animation node list begins at 1600 K, includes 12000 K exactly, returns without duplicate terminal timers, and ends at 1600 K.
- Every scene has Duv 0.0000 and the specified CCT and illuminance.
- Scene activation does not alter duration or field factor.
- Pause, resume, stop, repeat-play, visibility change, and page unload do not leave overlapping timers.
- Existing spectral, colour-quality, metamer, CLA 2.0, and export tests continue to pass.

Browser verification will cover 1920x1080, 1366x768, and 390x844 viewports; full round-trip playback; unreachable endpoint behavior; control locking; and absence of overlap or horizontal overflow.

## Scope Limits

The animation visualizes recipes achievable by the active channel set; it is not a calibrated luminaire transition protocol. Psychological scene names describe intended atmosphere. Biological metrics remain model-based estimates and do not constitute medical guidance.
