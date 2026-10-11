# Spectral Emitter Preview Design

## Purpose

Add a compact luminaire-emitter preview to the unused lower-left area of the spectral optimizer. The preview shows the colour of the current mixed spectrum and updates whenever channel values or imported channel data change.

## Placement and appearance

- Place the component below the preset buttons inside the existing control panel.
- Use a centered circular emitter approximately 120 px in diameter on desktop.
- Render a restrained inner glow and edge highlight so it reads as an illuminated panel surface without decorative effects spilling into nearby controls.
- Show the measured CCT and CIE 1931 `x, y` coordinates below the emitter.
- When the combined spectrum has no output, show a neutral grey emitter and an explicit no-output state.
- On narrow screens, keep the component in document flow below the presets and scale it without horizontal overflow.

## Colour calculation

1. Use the current combined SPD already produced by the channel mixer.
2. Integrate the SPD with the existing CIE 1931 colour matching functions to obtain XYZ.
3. Normalize XYZ chromaticity while preserving a fixed preview luminance.
4. Convert linear XYZ to sRGB using the standard D65 matrix, apply sRGB transfer encoding, and gamut-clip only at the final display step.
5. Use the resulting display colour for the emitter surface. Do not derive the preview colour from CCT alone.

The preview is an on-screen approximation. Its accuracy remains limited by display calibration and gamut.

## Data flow

The existing scheduled render cycle calculates the combined SPD once per update. The emitter preview consumes that SPD and the associated metrics, then updates CSS custom properties and its text readout. It does not alter channel values, optimization results, or exported recipe data.

## Verification

- Moving any channel slider visibly updates the emitter.
- Applying a preset or optimizer result updates the emitter.
- Imported 3-6 channel SPD data work without a separate code path.
- Zero channel output produces the neutral no-output state.
- CCT and `x, y` values agree with the existing metric and chromaticity displays.
- The desktop single-screen layout and mobile layout remain free of overlap and horizontal scrolling.
