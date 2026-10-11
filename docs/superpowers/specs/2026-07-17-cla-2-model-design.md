# CLA 2.0 and Circadian Stimulus Design

## Goal

Replace the current melanopic-DER approximation of circadian stimulus with the complete Rea, Nagare, and Figueiro CLA 2.0 model. Keep the CIE S 026 melanopic DER and melanopic EDI calculations as separate metrics rather than treating them as substitutes for CLA 2.0.

## Scientific Basis

The implementation will follow Equation 3 from Rea, Nagare, and Figueiro (2021), including the normalization correction published in the 2022 corrigendum. Model constants will match the Light and Health Research Center CS Calculator 2.0 implementation:

- normalization: 1548
- blue-yellow coefficient: 0.21
- blue-yellow threshold coefficient: 0.2616
- rod coefficients: 2.30 and 1.60
- rod denominator coefficients: 1.00 and 0.16
- rod saturation: 6.5215 W/m2
- CS half-saturation: 355.7
- CS exponent: 1.1026
- CS upper asymptote: 0.7

CLA 2.0 requires its own melanopsin, S-cone, photopic, scotopic, and macular-normalized spectral efficiency functions. The implementation must not substitute the CIE S 026 melanopic action spectrum for the model's corrected melanopsin function.

## Architecture

The feature may use multiple JavaScript files:

- `circadian-math.js`: pure CLA 2.0 and CS calculations with no DOM dependencies.
- `circadian-data.js`: wavelength grid and model spectral efficiency data.
- `circadian-math.test.js`: deterministic regression and behavior tests.
- `app.js`: supplies the combined SPD and corneal illuminance, displays results, and manages controls.

The calculation module will accept an SPD sampled over the wavelength range supported by the model, corneal photopic illuminance, exposure duration, and visual-field factor. It will normalize the relative SPD to the requested illuminance before calculating the required irradiance-weighted integrals.

The returned result will include:

- `cla`: CLA 2.0, clamped to zero when the piecewise result is negative.
- `cs`: Circadian Stimulus calculated from CLA 2.0.
- `blueYellowState`: whether the blue-yellow opponent term is active.
- `durationHours` and `fieldFactor`: the conditions used for CS.

Invalid, empty, or zero-energy spectra will return zero-valued metrics without producing `NaN` or `Infinity`.

## Model Behavior

The CLA 2.0 calculation will implement:

1. The corrected blue-yellow opponent condition using the macular-normalized S-cone and photopic functions.
2. The corrected melanopsin contribution.
3. Both rod suppression terms and their separate cone denominators.
4. The piecewise addition of the blue-yellow contribution only when its condition is non-negative.
5. Final non-negative clipping before conversion to CS.

CS will use:

`CS = 0.7 * (1 - 1 / (1 + ((t * f * CLA) / 355.7)^1.1026))`

Exposure duration `t` will be limited to 0.5-3.0 hours. Visual-field factor `f` will offer these documented values:

- `0.5`: superior visual field, such as ceiling-mounted downlights.
- `1.0`: central visual field, the default condition.
- `2.0`: full visual field.

Changing duration or visual-field factor changes only CS. It must not alter channel powers, the combined SPD, CCT, Duv, colour quality, CLA 2.0, melanopic DER, or melanopic EDI.

## Interface

The existing CS metric card will remain in the one-screen metric strip. Its primary value will be CS on the 0-0.7 scale, and its secondary line will show the corresponding `CLA 2.0` value. The card label and tooltip will identify the Rea model and show the active duration and visual-field condition.

The optimizer controls will gain:

- an exposure-duration control covering 0.5-3.0 hours, default 1.0 hour;
- a visual-field selector with superior, central, and full-field options, default central.

These controls will update CS immediately without invoking the spectral optimizer. CIE S 026 melanopic DER and melanopic EDI will retain their existing cards and labels.

The exported recipe JSON will include CLA 2.0, CS, duration, visual-field factor, melanopic DER, and melanopic EDI as separately named fields.

## Verification

Automated tests will cover:

- CIE Illuminant A at 1000 lx producing approximately CLA 2.0 = 813.
- CS conversion matching the published response equation.
- duration and field factors changing CS while leaving CLA unchanged.
- piecewise blue-yellow behavior for warm and cool spectra.
- deterministic results for identical inputs.
- zero and malformed spectra returning safe values.
- regression checks against reference results from the official CS Calculator 2.0 or its published source.

Existing spectral, colour-quality, and metamer tests must continue to pass. Browser verification will check the standard desktop workspace, a mobile viewport, real-time condition updates, and the absence of layout overflow.

## Scope Limits

This feature reports CLA 2.0 and CS as model-based estimates. It does not claim that CS is a CIE standard, does not predict daytime alertness or health outcomes, and does not model intermittent exposure, pupil size, prior light history, or exposure durations outside the published 0.5-3.0-hour range.
