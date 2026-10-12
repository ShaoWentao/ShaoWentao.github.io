# Spectrum report

TXT/SPD/CSV with two columns: wavelength (nm) and relative spectral power.
Tab, space, semicolon and comma-delimited CSV are accepted. Decimal comma is
accepted only with non-comma field delimiters. Wavelengths must increase;
negative, duplicate, malformed and all-zero input is rejected.

CIE 1931 2 degree observer: https://cie.co.at/datatable/cie-1931-colour-matching-functions-2-degree-observer
DOI: 10.25039/CIE.DS.xvudnb9b. Source: CIE 018:2019, Table 6.
Bundled CSV MD5: 17cca777db64b17170f06f67ce9d3ab7.

Spectrum is linearly interpolated onto the official 1 nm grid, integrated only
over supplied wavelengths (no extrapolation). x=X/(X+Y+Z), y=Y/(X+Y+Z),
u'=4X/(X+15Y+3Z), v'=9Y/(X+15Y+3Z). Peak wavelength is the largest input sample.
380-780 nm coverage is recommended; shorter coverage is flagged.

CCT, Duv, SDCM, CRI, TM-30, purity, dominant wavelength and FWHM are entered
instrument results, not calculated in this version. No unverified ellipse is
drawn. Relative SPD cannot determine absolute lumens or radiant flux; those
are entered measured values. Efficacy is entered flux divided by measured watts.
The DIALux LED_3000K reference must not be represented as a measured test.
Logo is extracted from the user-supplied reference PDF; laboratory, instrument,
tester and footer are not automatically claimed to be the reference's values.
