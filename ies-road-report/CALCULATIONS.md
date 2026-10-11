# Road report calculations

- Intensity: bilinear interpolation of Type C IES planes with 0-90 / 0-180 symmetry expansion.
- Flux / LCS: solid-angle integration at 2-degree C and 1-degree gamma resolution. Front is the half-space around the selected street-side C direction. These are luminaire photometric zones; mounting tilt affects ground plots, not these zones.
- BUG: IES TM-15-11 Addendum A, tables A-1/A-2/A-3. Each category uses the worst zone rating. Symmetric glare thresholds are selected when all eight octant fluxes lie within 10 percent of their mean. Upper-hemisphere data or explicit confirmation of zero uplight is required for U. Lower-hemisphere coverage is required for B/G.
- Beam: contiguous 50-percent intensity crossings around the maximum in each paired C plane, linearly interpolated at 0.5-degree sampling. The displayed mean uses the two principal plane widths.
- IES distribution: estimated from the sampled half-maximum trace in the peak's longitudinal MH region, with transverse boundaries 1, 1.75 and 2.75 MH. Circularity uses a 10-percent plane-flux tolerance; this is an engineering estimate, not a certified classification. Very Short denotes a peak below 1 MH, an extension used by the supplied reference report.
- Legacy IES cut-off: normalized by lamp lumens for relative photometry, or integrated fixture output for absolute photometry. Upper-hemisphere coverage is required. This legacy classification is distinct from BUG.
- CIE classifications: entered as declared values. No unverified CIE classification algorithm is used.
- Ground illuminance: I(C,gamma) * MH / distance^3, with inverse mounting-tilt rotation. CU is integrated over strips out to 15 MH longitudinally; numerical truncation can affect very wide distributions.
- Isocandela: D3 contour interpolation. The spherical graph is an orthographic projection of the C270-C90 hemisphere. The road graph uses transverse MH horizontally and longitudinal MH vertically; single-sided display follows the supplied template.
- Candela output: interpolated at 5-degree gamma increments, with all source C planes and automatic table pagination.

Sources:

- https://www.ies.org/wp-content/uploads/2017/03/TM-15-11BUGRatingsAddendum.pdf
- https://epg.modot.org/files/b/bd/901.11.5_IES_Distribution_Diagrams.pdf
- https://www.lrc.rpi.edu/programs/transportation/pdf/LRC-LESSReport.pdf
- https://www.cie.co.at/publications/road-lighting-lantern-and-installation-data-photometrics-classification-and

Run numerical checks with `node ies-road-report/metrics.test.js` from the repository root.
