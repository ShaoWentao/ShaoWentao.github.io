// Rea, Nagare, and Figueiro CLA 2.0, using corrected Equation 3 from the
// 2022 corrigendum and constants published by the official CS Calculator 2.0.
const CLA2_MODEL_DATA = typeof module !== 'undefined' && module.exports
  ? require('./circadian-data.js').CLA2_DATA
  : window.CLA2_DATA;

const CLA2_CONSTANTS = Object.freeze({
  normalization: 1548,
  k: 0.2616,
  blueYellow: 0.21,
  rodMel: 2.30,
  rodBlueYellow: 1.60,
  gMel: 1.00,
  gBlueYellow: 0.16,
  rodSat: 6.5215,
  halfSaturation: 355.7,
  exponent: 1.1026,
  maxCS: 0.7
});

const LUMINOUS_EFFICACY = 683;
const VALID_FIELD_FACTORS = Object.freeze([0.5, 1, 2]);

function normalizeDuration(durationHours) {
  const duration = Number(durationHours) || 1;
  return Math.min(3, Math.max(0.5, duration));
}

function normalizeFieldFactor(fieldFactor) {
  const factor = Number(fieldFactor);
  return VALID_FIELD_FACTORS.includes(factor) ? factor : 1;
}

function claToCS(cla, durationHours = 1, fieldFactor = 1) {
  const duration = normalizeDuration(durationHours);
  const factor = normalizeFieldFactor(fieldFactor);
  const stimulus = Math.max(0, Number(cla) || 0)
    * duration * factor / CLA2_CONSTANTS.halfSaturation;
  return CLA2_CONSTANTS.maxCS
    * (1 - 1 / (1 + Math.pow(stimulus, CLA2_CONSTANTS.exponent)));
}

function emptyResult(durationHours, fieldFactor) {
  return {
    cla: 0,
    cs: 0,
    blueYellowState: 'inactive',
    durationHours,
    fieldFactor
  };
}

function isNumericArray(values) {
  return Array.isArray(values) || (ArrayBuffer.isView(values)
    && typeof values.length === 'number'
    && (values.length === 0 || typeof values[0] === 'number'));
}

function isValidSpectrum(wavelengths, values) {
  if (!isNumericArray(wavelengths) || !isNumericArray(values)
    || wavelengths.length < 2 || wavelengths.length !== values.length) {
    return false;
  }

  let hasEnergy = false;
  for (let index = 0; index < wavelengths.length; index += 1) {
    const wavelength = wavelengths[index];
    const value = values[index];
    if (!Number.isFinite(wavelength) || !Number.isFinite(value) || value < 0
      || (index > 0 && wavelength <= wavelengths[index - 1])) {
      return false;
    }
    hasEnergy ||= value > 0;
  }
  return hasEnergy;
}

function interpolateSpectrum(wavelengths, values, targetWavelengths) {
  const interpolated = new Array(targetWavelengths.length).fill(0);
  let sourceIndex = 0;

  for (let index = 0; index < targetWavelengths.length; index += 1) {
    const target = targetWavelengths[index];
    if (target < wavelengths[0] || target > wavelengths.at(-1)) continue;

    while (sourceIndex + 1 < wavelengths.length
      && wavelengths[sourceIndex + 1] < target) {
      sourceIndex += 1;
    }

    if (target === wavelengths.at(-1)) {
      interpolated[index] = values.at(-1);
      continue;
    }

    const lowerWavelength = wavelengths[sourceIndex];
    const upperWavelength = wavelengths[sourceIndex + 1];
    const fraction = (target - lowerWavelength) / (upperWavelength - lowerWavelength);
    interpolated[index] = values[sourceIndex]
      + fraction * (values[sourceIndex + 1] - values[sourceIndex]);
  }

  return interpolated;
}

function weightedIntegral(spectrum, sensitivity) {
  let total = 0;
  for (let index = 0; index < spectrum.length; index += 1) {
    total += spectrum[index] * sensitivity[index];
  }
  return total;
}

function calculateCLA2(options = {}) {
  const durationHours = normalizeDuration(options.durationHours);
  const fieldFactor = normalizeFieldFactor(options.fieldFactor);
  const illuminanceLux = Number(options.illuminanceLux);

  if (!isValidSpectrum(options.wavelengths, options.values)
    || !Number.isFinite(illuminanceLux) || illuminanceLux <= 0) {
    return emptyResult(durationHours, fieldFactor);
  }

  const relativeSPD = interpolateSpectrum(
    options.wavelengths,
    options.values,
    CLA2_MODEL_DATA.wavelengths
  );
  const relativePhotopic = weightedIntegral(relativeSPD, CLA2_MODEL_DATA.photopic);
  if (!Number.isFinite(relativePhotopic) || relativePhotopic <= 0) {
    return emptyResult(durationHours, fieldFactor);
  }

  const irradianceScale = illuminanceLux / (LUMINOUS_EFFICACY * relativePhotopic);
  const irradianceSPD = relativeSPD.map((value) => value * irradianceScale);
  const photopicMacular = weightedIntegral(irradianceSPD, CLA2_MODEL_DATA.photopicMacular);
  const sConeMacular = weightedIntegral(irradianceSPD, CLA2_MODEL_DATA.sConeMacular);
  const scotopic = weightedIntegral(irradianceSPD, CLA2_MODEL_DATA.scotopic);
  const melanopsin = weightedIntegral(irradianceSPD, CLA2_MODEL_DATA.melanopsin);

  const melDenominator = photopicMacular + CLA2_CONSTANTS.gMel * sConeMacular;
  const blueYellowDenominator = photopicMacular
    + CLA2_CONSTANTS.gBlueYellow * sConeMacular;
  if (melDenominator <= 0 || blueYellowDenominator <= 0) {
    return emptyResult(durationHours, fieldFactor);
  }

  const blueYellow = sConeMacular - CLA2_CONSTANTS.k * photopicMacular;
  const blueYellowActive = blueYellow >= 0;
  const rodSaturation = 1 - Math.exp(-scotopic / CLA2_CONSTANTS.rodSat);
  const melRodSuppression = CLA2_CONSTANTS.rodMel
    * (scotopic / melDenominator) * rodSaturation;

  let response = melanopsin - melRodSuppression;
  if (blueYellowActive) {
    const blueYellowRodSuppression = CLA2_CONSTANTS.rodBlueYellow
      * (scotopic / blueYellowDenominator) * rodSaturation;
    response += CLA2_CONSTANTS.blueYellow * blueYellow - blueYellowRodSuppression;
  }

  const cla = Math.max(0, CLA2_CONSTANTS.normalization * response);
  if (!Number.isFinite(cla)) return emptyResult(durationHours, fieldFactor);

  return {
    cla,
    cs: claToCS(cla, durationHours, fieldFactor),
    blueYellowState: blueYellowActive ? 'active' : 'inactive',
    durationHours,
    fieldFactor
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { CLA2_CONSTANTS, calculateCLA2, claToCS };
}
if (typeof window !== 'undefined') {
  window.CLA2_CONSTANTS = CLA2_CONSTANTS;
  window.calculateCLA2 = calculateCLA2;
  window.claToCS = claToCS;
}
