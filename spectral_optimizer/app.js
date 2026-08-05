/* ============================================================
   Computational Lighting Spectral Optimizer — Application Logic
   Human-Centric Lighting Research Tool
   ============================================================ */

(() => {
'use strict';

// ═══════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════

const LAMBDA_MIN = 380;
const LAMBDA_MAX = 780;
const LAMBDA_STEP = 1;
const NUM_POINTS = (LAMBDA_MAX - LAMBDA_MIN) / LAMBDA_STEP + 1;

// Pre-compute wavelength array
const wavelengths = new Float64Array(NUM_POINTS);
for (let i = 0; i < NUM_POINTS; i++) {
    wavelengths[i] = LAMBDA_MIN + i * LAMBDA_STEP;
}

const CIE_DATA = window.CIE_SPECTRAL_DATA || {};
const SPECTRAL_MATH = window.SpectralMath || {};
const CHROMATICITY_DIAGRAM = window.ChromaticityDiagram || {};
const COLOUR_QUALITY = window.ColourQuality || {};
const METAMER_OPTIMIZER = window.METAMER_OPTIMIZER || {};
const METAMER_WORKER_CLIENT = window.MetamerWorkerClient || {};
const SCENE_OPTIMIZER_CORE = window.SceneOptimizerCore || {};
const SCENE_OPTIMIZER_WORKER_CLIENT = window.SceneOptimizerWorkerClient || {};
const CANDIDATE_SHORTLIST = window.CandidateShortlist || {};
const CCT_JOURNEY = window.CctJourney || {};
const BUILD_INFO = window.SPECTRAL_BUILD_INFO || {};
const RECIPE_EXPORT = window.RECIPE_EXPORT || {};
const MATERIAL_OPTIMIZER = window.MaterialOptimizer || {};
const MATERIAL_COLOR = window.MaterialColor || {};
const MATERIAL_DATA = window.MATERIAL_REFLECTANCE_DATA || {};
const DINING_LIGHT_DATA = window.DiningLightData || {};
const MATERIAL_UPLOAD = window.MaterialUpload || {};
const MATERIAL_PREFERENCE_PROFILES = window.MaterialPreferenceProfiles || {};
const SPD_IMPORT = window.SpdImport || {};
const WORKSPACE_STORE = window.SpectralWorkspaceStore || null;
const calculateCLA2 = window.calculateCLA2;
const METAMER_CHROMATICITY_TOLERANCE = 0.0005;

if (typeof calculateCLA2 !== 'function') {
    throw new Error('CLA 2.0 calculation module failed to load.');
}
if (typeof SPECTRAL_MATH.blackbodyXy !== 'function' ||
    typeof CANDIDATE_SHORTLIST.selectCandidateShortlist !== 'function' ||
    typeof CHROMATICITY_DIAGRAM.createPlotGeometry !== 'function' ||
    typeof CHROMATICITY_DIAGRAM.projectPoint !== 'function' ||
    typeof CCT_JOURNEY.buildCctJourney !== 'function' ||
    typeof BUILD_INFO.getBuildInfo !== 'function' ||
    typeof RECIPE_EXPORT.buildRecipeDocument !== 'function' ||
    typeof RECIPE_EXPORT.downloadJsonFile !== 'function' ||
    typeof MATERIAL_OPTIMIZER.optimizeMaterialFidelity !== 'function' ||
    typeof MATERIAL_COLOR.calculateMaterialDelta !== 'function' ||
    !Array.isArray(CCT_JOURNEY.HUMAN_CENTRED_SCENES)) {
    throw new Error('CCT journey modules failed to load.');
}

// ═══════════════════════════════════════════════
// CHANNEL DEFINITIONS
// ═══════════════════════════════════════════════

// Channel data are engineering approximations, not standard LED chip data.
// To use a real LED package, add either:
// - spd: 401 values from 380nm to 780nm at 1nm spacing, or
// - spdSamples: [[wavelengthNm, relativePower], ...] measured from the chip datasheet.
// When spd/spdSamples is present, the Gaussian peak/sigma model is bypassed.
const FALLBACK_CHANNELS_4CH = [
    { id: 'red',       name: 'Red',        nameCN: '红',   peak: 625, sigma: 15, color: '#ff3b3b', colorRGB: [255,59,59],    waveLabel: '625 nm' },
    { id: 'green',     name: 'Green',      nameCN: '绿',   peak: 525, sigma: 20, color: '#2dff6e', colorRGB: [45,255,110],   waveLabel: '525 nm' },
    { id: 'blue',      name: 'Blue',       nameCN: '蓝',   peak: 460, sigma: 15, color: '#3b7dff', colorRGB: [59,125,255],   waveLabel: '460 nm' },
    { id: 'warmwhite', name: 'Warm White', nameCN: '暖白',  peak: null, sigma: null, color: '#ffc966', colorRGB: [255,201,102], waveLabel: '3000K', isWarmWhite: true }
];

const CHANNELS_4CH = Array.isArray(window.DEFAULT_RGBW_CHANNELS)
    ? window.DEFAULT_RGBW_CHANNELS
    : FALLBACK_CHANNELS_4CH;

const FALLBACK_CHANNELS_6CH = [
    { id: 'red',   name: 'Red',   nameCN: '红',   peak: 625, sigma: 15, color: '#ff3b3b', colorRGB: [255,59,59],   waveLabel: '625 nm' },
    { id: 'green', name: 'Green', nameCN: '绿',   peak: 525, sigma: 20, color: '#2dff6e', colorRGB: [45,255,110],  waveLabel: '525 nm' },
    { id: 'blue',  name: 'Blue',  nameCN: '蓝',   peak: 460, sigma: 15, color: '#3b7dff', colorRGB: [59,125,255],  waveLabel: '460 nm' },
    { id: 'cyan',  name: 'Cyan',  nameCN: '青',   peak: 490, sigma: 15, color: '#36d6e7', colorRGB: [54,214,231],  waveLabel: '490 nm' },
    { id: 'lime',  name: 'Lime',  nameCN: '黄绿', peak: 550, sigma: 18, color: '#aaff33', colorRGB: [170,255,51],  waveLabel: '550 nm' },
    { id: 'amber', name: 'Amber', nameCN: '琥珀', peak: 590, sigma: 15, color: '#ff9f33', colorRGB: [255,159,51],  waveLabel: '590 nm' }
];

const CHANNELS_6CH = Array.isArray(window.DEFAULT_RGBCLA_CHANNELS)
    ? window.DEFAULT_RGBCLA_CHANNELS.map(channel => ({ ...channel }))
    : FALLBACK_CHANNELS_6CH;

const CHANNEL_SETS = {
    3: CHANNELS_6CH.slice(0, 3),
    4: CHANNELS_4CH,
    5: CHANNELS_6CH.filter(ch => ch.id !== 'lime'),
    6: CHANNELS_6CH
};

const IMPORT_COLORS = ['#ff3b3b', '#2dff6e', '#3b7dff', '#36d6e7', '#ff9f33', '#aaff33'];
const IMPORT_COLOR_RGB = [[255,59,59], [45,255,110], [59,125,255], [54,214,231], [255,159,51], [170,255,51]];

// ═══════════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════════

let currentMode = 4;
let importedChannels = null;
let importedSourceName = '';
let channelValues = {};   // id -> 0..100
let showD65 = false;
let chromaticityChannelPointsVisible = false;
let animFrameId = null;
let metamerModeEnabled = false;
let metamerProfile = 'off';
let metamerOptimizationGeneration = 0;
let sceneOptimizationGeneration = 0;
let targetRg = 100;
let baselineSnapshot = null;
let compareSpectrumEnabled = false;
let isMetamerOptimizing = false;
let materialOptimizationGeneration = 0;
let isMaterialOptimizing = false;
let diningOptimizationSession = null;
const materialOptimizationBaselines = new Map();
const diningOptimizationBaselines = new Map();
const metamerWorkerClient = typeof METAMER_WORKER_CLIENT.createMetamerWorkerClient === 'function'
    ? METAMER_WORKER_CLIENT.createMetamerWorkerClient({
        workerUrl: 'metamer-worker.js?v=20260804-dining-cuisine-only'
    })
    : null;
const sceneOptimizerWorkerClient = typeof SCENE_OPTIMIZER_WORKER_CLIENT.createSceneOptimizerWorkerClient === 'function'
    ? SCENE_OPTIMIZER_WORKER_CLIENT.createSceneOptimizerWorkerClient({
        workerUrl: 'scene-optimizer-worker.js?v=20260804-dining-cuisine-only'
    })
    : null;
const cctAnimation = {
    timer: null,
    index: 0,
    generation: 0,
    status: 'stopped',
    cache: new Map(),
    channelSignature: '',
    lockedControls: new Map()
};

// ═══════════════════════════════════════════════
// DOM REFERENCES
// ═══════════════════════════════════════════════

const canvas = document.getElementById('spd-canvas');
const ctx = canvas.getContext('2d');
const canvasWrapper = document.getElementById('canvas-wrapper');
const channelsContainer = document.getElementById('channels-container');
const modeCheckbox = document.getElementById('mode-checkbox');
const modeLabel4 = document.getElementById('mode-label-4ch');
const modeLabel6 = document.getElementById('mode-label-6ch');
const spdImportInput = document.getElementById('spd-import-input');
const spdImportBtn = document.getElementById('spd-import-btn');
const spdImportStatus = document.getElementById('spd-import-status');
const preserveChannelPower = document.getElementById('preserve-channel-power');
const d65Toggle = document.getElementById('d65-toggle');
const emitterPreview = document.getElementById('emitter-preview');
const emitterDisc = document.getElementById('emitter-disc');
const emitterPreviewStatus = document.getElementById('emitter-preview-status');
const emitterPreviewCct = document.getElementById('emitter-preview-cct');

// Metric elements
const valCCT = document.getElementById('val-cct');
const valCRI = document.getElementById('val-cri');
const valR9 = document.getElementById('val-r9');
const valRf = document.getElementById('val-rf');
const valMel = document.getElementById('val-mel');
const valCS  = document.getElementById('val-cs');
const valMedi = document.getElementById('val-medi');
const barCCT = document.getElementById('bar-cct');
const barCRI = document.getElementById('bar-cri');
const barR9 = document.getElementById('bar-r9');
const barRf = document.getElementById('bar-rf');
const barMel = document.getElementById('bar-mel');
const barCS  = document.getElementById('bar-cs');
const barMedi = document.getElementById('bar-medi');
const valCLA2 = document.getElementById('val-cla2');
const cla2Conditions = document.getElementById('cla2-conditions');
const circadianStatus = document.getElementById('circadian-status');

// Optimizer elements

// CIE 1931 DOM References
const cieCanvas = document.getElementById('cie-canvas');
const cieCtx = cieCanvas ? cieCanvas.getContext('2d') : null;
const cieCanvasWrapper = document.getElementById('cie-canvas-wrapper');

let cieOffscreenCanvas = null;
let cie1931GeometryCache = null;
const blackbodyXyCache = new Map();
let currentX = 0.3127;
let currentY = 0.3290;

// CCT, Duv and illuminance target controllers DOM references
const targetCctSlider = document.getElementById('target-cct-slider');
const targetCctVal = document.getElementById('target-cct-val');
const targetDuvSlider = document.getElementById('target-duv-slider');
const targetDuvVal = document.getElementById('target-duv-val');
const colourTuningGroup = document.querySelector('.tuning-group-colour');
const colourTargetMode = document.getElementById('colour-target-mode');
const pastelFitStatus = document.getElementById('pastel-fit-status');
const eyeIlluminanceSlider = document.getElementById('eye-illuminance');
const eyeIlluminanceVal = document.getElementById('eye-illuminance-val');
const exposureDurationSlider = document.getElementById('exposure-duration');
const exposureDurationVal = document.getElementById('exposure-duration-val');
const visualFieldSelect = document.getElementById('visual-field-factor');
const exportRecipeBtn = document.getElementById('export-recipe-btn');
const buildVersionLabel = document.getElementById('build-version');
const metamerModeCheckbox = document.getElementById('metamer-mode-checkbox');
const metamerDependentControls = document.getElementById('metamer-dependent-controls');
const targetRgSlider = document.getElementById('target-rg-slider');
const targetRgVal = document.getElementById('target-rg-val');
const setBaselineBtn = document.getElementById('set-baseline-btn');
const compareSpectrumCheckbox = document.getElementById('compare-spectrum-checkbox');
const metamerStatus = document.getElementById('metamer-status');
const metamerColourDelta = document.getElementById('metamer-colour-delta');
const cctJourneyPlayBtn = document.getElementById('cct-journey-play');
const cctJourneyStopBtn = document.getElementById('cct-journey-stop');
const cctJourneyStatus = document.getElementById('cct-journey-status');

// Metric card elements for Rg
const valRg = document.getElementById('val-rg');
const valDeltaUv = document.getElementById('val-delta-uv');
const barRg = document.getElementById('bar-rg');
const barDeltaUv = document.getElementById('bar-delta-uv');

if (buildVersionLabel && typeof BUILD_INFO.compactLabel === 'function') {
    buildVersionLabel.textContent = BUILD_INFO.compactLabel();
}

// Target parameters state
let targetCCT = 4000;
let targetDuv = 0.0;
let eyeIlluminance = 300;
let exposureDurationHours = 1;
let visualFieldFactor = 1;

const VISUAL_FIELD_LABELS = Object.freeze({
    0.5: '上方视野',
    1: '中央视野',
    2: '全视野'
});

let isLightTheme = false;
function updateThemeState() {
    isLightTheme = document.documentElement.getAttribute('data-theme') === 'light' || 
                   (document.body && window.getComputedStyle(document.body).backgroundColor.includes('247'));
}

// ═══════════════════════════════════════════════
// CIE 1931 CHROMATICITY MATH & RENDERING
// ═══════════════════════════════════════════════

function xyToUv(x, y) {
    const denom = -2 * x + 12 * y + 3;
    if (Math.abs(denom) < 1e-12) return { u: 0.2, v: 0.3 };
    return {
        u: (4 * x) / denom,
        v: (6 * y) / denom
    };
}

function uvToXy(u, v) {
    const denom = u - 4 * v + 2;
    if (Math.abs(denom) < 1e-12) return { x: 0.33, y: 0.33 };
    return {
        x: (1.5 * u) / denom,
        y: v / denom
    };
}

function getTargetXY(T, Duv) {
    if (SPECTRAL_MATH.targetXyFromCctDuv) {
        return SPECTRAL_MATH.targetXyFromCctDuv(T, Duv);
    }
    const xy_p = planckianXY(T);
    const uv_p = xyToUv(xy_p.x, xy_p.y);
    
    const xy_1 = planckianXY(T - 20);
    const xy_2 = planckianXY(T + 20);
    const uv_1 = xyToUv(xy_1.x, xy_1.y);
    const uv_2 = xyToUv(xy_2.x, xy_2.y);
    
    const du = uv_2.u - uv_1.u;
    const dv = uv_2.v - uv_1.v;
    const len = Math.sqrt(du * du + dv * dv);
    
    if (len === 0) return xy_p;
    
    // Normal vector pointing "above" the locus (towards green, larger v)
    const nu = dv / len;
    const nv = -du / len;
    
    const u_target = uv_p.u + Duv * nu;
    const v_target = uv_p.v + Duv * nv;
    
    return uvToXy(u_target, v_target);
}

function estimateRg(spd, cct) {
    const maxVal = Math.max(...spd);
    if (maxVal < 1e-10) return 100;
    const normSpd = spd.map(s => s / maxVal);
    
    let sum = 0, sumSq = 0;
    for (let i = 0; i < NUM_POINTS; i++) {
        sum += normSpd[i];
        sumSq += normSpd[i] * normSpd[i];
    }
    const mean = sum / NUM_POINTS;
    const variance = (sumSq / NUM_POINTS) - (mean * mean);
    
    let redPower = 0, greenPower = 0, bluePower = 0;
    let total = 0;
    for (let i = 0; i < NUM_POINTS; i++) {
        const l = wavelengths[i];
        if (l >= 610 && l <= 640) redPower += spd[i];
        if (l >= 510 && l <= 540) greenPower += spd[i];
        if (l >= 440 && l <= 470) bluePower += spd[i];
        total += spd[i];
    }
    
    const rRatio = total > 0 ? redPower / total : 0;
    const gRatio = total > 0 ? greenPower / total : 0;
    const bRatio = total > 0 ? bluePower / total : 0;
    
    const peakiness = variance * 12.0;
    const saturationFactor = (rRatio * 1.5 + gRatio * 1.2 + bRatio * 0.8) * 1.4;
    
    let rg = 98 + peakiness * 8.0 + saturationFactor * 12.0;
    return Math.max(90, Math.min(120, rg));
}

function planckianXY(T) {
    let x;
    if (T < 4000) {
        x = -0.2661239 * (1e9 / (T*T*T)) - 0.2343589 * (1e6 / (T*T)) + 0.8776956 * (1e3 / T) + 0.179910;
    } else {
        x = -3.0258469 * (1e9 / (T*T*T)) + 2.1070379 * (1e6 / (T*T)) + 0.2226347 * (1e3 / T) + 0.240390;
    }
    let y;
    if (T < 4000) {
        y = -1.1063814 * x * x * x - 1.34811020 * x * x + 2.18555832 * x - 0.20219683;
    } else {
        y = -0.9549476 * x * x * x - 1.37418593 * x * x + 2.09137015 * x - 0.16851597;
    }
    return { x, y };
}

function integratedBlackbodyXy(temperature) {
    if (blackbodyXyCache.has(temperature)) return blackbodyXyCache.get(temperature);
    const xy = SPECTRAL_MATH.blackbodyXy(
        temperature,
        wavelengths,
        preCieX,
        preCieY,
        preCieZ
    );
    const integrated = Number.isFinite(xy.x) && Number.isFinite(xy.y) ? xy : planckianXY(temperature);
    blackbodyXyCache.set(temperature, integrated);
    return integrated;
}

function drawCctLocusLabels(context, temperatures, width, height, pad) {
    const occupied = [];
    const offsets = [[5, -5], [5, 11], [-5, -5], [-5, 11], [8, 3], [-8, 3]];
    context.textBaseline = 'alphabetic';

    for (const temperature of temperatures) {
        const xy = integratedBlackbodyXy(temperature);
        const point = projectXY(xy.x, xy.y, width, height, pad);
        const label = `${temperature}K`;
        const labelWidth = context.measureText(label).width;
        let placement = null;

        for (const [offsetX, offsetY] of offsets) {
            const alignRight = offsetX < 0;
            const x = point.x + offsetX - (alignRight ? labelWidth : 0);
            const y = point.y + offsetY;
            const box = { x: x - 2, y: y - 9, width: labelWidth + 4, height: 12 };
            const inside = box.x >= 2 && box.y >= 2 && box.x + box.width <= width - 2 && box.y + box.height <= height - 2;
            const collides = occupied.some(other =>
                box.x < other.x + other.width && box.x + box.width > other.x &&
                box.y < other.y + other.height && box.y + box.height > other.y
            );
            if (inside && !collides) {
                placement = { x, y, box };
                break;
            }
        }

        context.beginPath();
        context.arc(point.x, point.y, 2, 0, 2 * Math.PI);
        context.fill();
        if (placement) {
            occupied.push(placement.box);
            context.fillText(label, placement.x, placement.y);
        }
    }
}

function getCie1931Geometry(w, h, pad = 35) {
    const key = `${Math.round(w * 100) / 100}:${Math.round(h * 100) / 100}:${pad}`;
    if (!cie1931GeometryCache || cie1931GeometryCache.key !== key) {
        cie1931GeometryCache = {
            key,
            value: CHROMATICITY_DIAGRAM.createPlotGeometry(w, h, {
                xMax: 0.85,
                yMax: 0.85,
                padding: { left: pad, right: pad, top: pad, bottom: pad }
            })
        };
    }
    return cie1931GeometryCache.value;
}

function projectXY(x, y, w, h, pad = 35) {
    return CHROMATICITY_DIAGRAM.projectPoint(x, y, getCie1931Geometry(w, h, pad));
}

function generateCIEBackground() {
    if (!cieCanvas || !cieCtx) return;
    const w = cieCanvas._logicalWidth || 300;
    const h = cieCanvas._logicalHeight || 300;
    const dpr = window.devicePixelRatio || 1;
    const pad = 35;
    const geometry = getCie1931Geometry(w, h, pad);
    const scaleX = geometry.scale;
    const scaleY = geometry.scale;

    // Create offscreen canvas if not exists
    if (!cieOffscreenCanvas) {
        cieOffscreenCanvas = document.createElement('canvas');
    }
    cieOffscreenCanvas.width = w * dpr;
    cieOffscreenCanvas.height = h * dpr;
    const oCtx = cieOffscreenCanvas.getContext('2d');
    oCtx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // 1. Draw solid background
    oCtx.fillStyle = isLightTheme ? '#fffaf0' : '#0a0d16';
    oCtx.fillRect(0, 0, w, h);

    // 2. Build tongue clipping path
    oCtx.save();
    oCtx.beginPath();
    
    // Draw tongue boundary from 380nm to 780nm
    let first = true;
    for (let l = 380; l <= 780; l++) {
        const X = cieX(l);
        const Y = cieY(l);
        const Z = cieZ(l);
        const sum = X + Y + Z;
        if (sum > 0) {
            const cx = X / sum;
            const cy = Y / sum;
            const pt = projectXY(cx, cy, w, h, pad);
            if (first) {
                oCtx.moveTo(pt.x, pt.y);
                first = false;
            } else {
                oCtx.lineTo(pt.x, pt.y);
            }
        }
    }
    oCtx.closePath();
    oCtx.clip();

    // 3. Render sRGB pixel grid inside tongue
    // The gamut background is decorative; a dense 0.0035 xy grid creates
    // roughly 60,000 canvas fills and can lock tablets for tens of seconds.
    // Canvas interpolation keeps this coarser grid visually smooth while the
    // locus, channel points and measured coordinates remain full precision.
    const step = 0.008;
    for (let xVal = 0.0; xVal <= 0.85; xVal += step) {
        for (let yVal = 0.0; yVal <= 0.85; yVal += step) {
            if (yVal === 0) continue;
            const Y = 1.0;
            const X = xVal / yVal;
            const Z = (1.0 - xVal - yVal) / yVal;
            if (X < 0 || Z < 0) continue;

            // CIE XYZ to sRGB D65 transform
            let rLinear = 3.2406 * X - 1.5372 * Y - 0.4986 * Z;
            let gLinear = -0.9689 * X + 1.8758 * Y + 0.0415 * Z;
            let bLinear = 0.0557 * X - 0.2040 * Y + 1.0570 * Z;

            // Gamut projection (clip negative to zero, then normalize brightness)
            rLinear = Math.max(0, rLinear);
            gLinear = Math.max(0, gLinear);
            bLinear = Math.max(0, bLinear);
            const maxVal = Math.max(rLinear, gLinear, bLinear);
            if (maxVal > 0) {
                rLinear /= maxVal;
                gLinear /= maxVal;
                bLinear /= maxVal;
            }

            // Gamma correction (sRGB standard)
            const gamma = (c) => c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1.0 / 2.4) - 0.055;
            const r = Math.round(gamma(rLinear) * 255);
            const g = Math.round(gamma(gLinear) * 255);
            const b = Math.round(gamma(bLinear) * 255);

            const pt = projectXY(xVal, yVal, w, h, pad);
            const rw = scaleX * step + 0.9;
            const rh = scaleY * step + 0.9;
            oCtx.fillStyle = `rgb(${r}, ${g}, ${b})`;
            oCtx.fillRect(pt.x, pt.y - rh, rw, rh);
        }
    }
    oCtx.restore();
}

function computeChannelChromaticities() {
    const channels = getActiveChannels();
    for (const ch of channels) {
        if (!ch.chromaticity) {
            let X = 0, Y = 0, Z = 0;
            for (let i = 0; i < NUM_POINTS; i++) {
                const s = getChannelSPDValue(ch, wavelengths[i]);
                X += s * preCieX[i] * LAMBDA_STEP;
                Y += s * preCieY[i] * LAMBDA_STEP;
                Z += s * preCieZ[i] * LAMBDA_STEP;
            }
            const sum = X + Y + Z;
            ch.chromaticity = sum > 0 ? { x: X / sum, y: Y / sum } : { x: 0.33, y: 0.33 };
        }
    }
}

function renderCIE() {
    if (!cieCanvas || !cieCtx) return;
    const w = cieCanvas._logicalWidth || 300;
    const h = cieCanvas._logicalHeight || 300;
    const pad = 35;
    const geometry = getCie1931Geometry(w, h, pad);

    cieCtx.clearRect(0, 0, w, h);

    // 1. Draw offscreen background tongue
    if (cieOffscreenCanvas) {
        cieCtx.drawImage(cieOffscreenCanvas, 0, 0, w, h);
    }

    // Determine theme mode for stroke coloring
    const strokeColor = isLightTheme ? 'rgba(33, 29, 23, 0.25)' : 'rgba(255, 255, 255, 0.2)';
    const textColor = isLightTheme ? '#221e18' : '#ebeff5';
    const accentColor = isLightTheme ? '#c9942d' : '#e4b85b';

    // 2. Draw chromaticity coordinate grid lines
    cieCtx.strokeStyle = strokeColor;
    cieCtx.lineWidth = 1;
    cieCtx.setLineDash([2, 4]);
    cieCtx.font = '9px "JetBrains Mono", monospace';
    cieCtx.fillStyle = isLightTheme ? 'rgba(33, 29, 23, 0.6)' : 'rgba(235, 239, 245, 0.6)';

    // Vertical grid lines (x)
    for (let gx = 0.1; gx <= 0.8; gx += 0.1) {
        const pt1 = projectXY(gx, 0.0, w, h, pad);
        const pt2 = projectXY(gx, 0.85, w, h, pad);
        cieCtx.beginPath();
        cieCtx.moveTo(pt1.x, pt1.y);
        cieCtx.lineTo(pt2.x, pt2.y);
        cieCtx.stroke();
        
        cieCtx.textAlign = 'center';
        cieCtx.fillText(gx.toFixed(1), pt1.x, geometry.bottom + 17);
    }

    // Horizontal grid lines (y)
    for (let gy = 0.1; gy <= 0.8; gy += 0.1) {
        const pt1 = projectXY(0.0, gy, w, h, pad);
        const pt2 = projectXY(0.85, gy, w, h, pad);
        cieCtx.beginPath();
        cieCtx.moveTo(pt1.x, pt1.y);
        cieCtx.lineTo(pt2.x, pt2.y);
        cieCtx.stroke();
        
        cieCtx.textAlign = 'right';
        cieCtx.fillText(gy.toFixed(1), geometry.left - 7, pt1.y + 3);
    }
    cieCtx.setLineDash([]); // Reset line dash

    // Grid labels
    cieCtx.textAlign = 'right';
    cieCtx.fillText('x', geometry.right, geometry.bottom + 29);
    cieCtx.textAlign = 'left';
    cieCtx.fillText('y', geometry.left - 22, geometry.top + 3);

    // 3. Draw Planckian locus (黑体轨迹)
    cieCtx.strokeStyle = isLightTheme ? 'rgba(33, 29, 23, 0.7)' : 'rgba(255, 255, 255, 0.8)';
    cieCtx.lineWidth = 2;
    cieCtx.beginPath();
    
    let first = true;
    for (let t = 1000; t <= 20000; t += 100) {
        const xy = integratedBlackbodyXy(t);
        const pt = projectXY(xy.x, xy.y, w, h, pad);
        if (first) {
            cieCtx.moveTo(pt.x, pt.y);
            first = false;
        } else {
            cieCtx.lineTo(pt.x, pt.y);
        }
    }
    cieCtx.stroke();

    // Draw CCT ticks on Planckian Locus
    const ticks = [1600, 3000, 6500, 12000];
    cieCtx.fillStyle = isLightTheme ? '#221e18' : '#ffffff';
    cieCtx.font = '8px "JetBrains Mono", monospace';
    cieCtx.lineWidth = 1;

    drawCctLocusLabels(cieCtx, ticks, w, h, pad);
    document.documentElement.dataset.cie1931CctTicks = ticks.join(',');

    const activeCh = getActiveChannels();
    document.documentElement.dataset.cie1931ChannelPoints = chromaticityChannelPointsVisible ? 'visible' : 'hidden';

    if (chromaticityChannelPointsVisible) {
    // 4. Draw the convex gamut boundary. Broadband white channels naturally
    // remain inside the RGB hull instead of becoming an extra polygon vertex.
    const gamutCandidates = activeCh
        .filter(ch => ch.chromaticity && Number.isFinite(ch.chromaticity.x) && Number.isFinite(ch.chromaticity.y))
        .map(ch => ({ ch, x: ch.chromaticity.x, y: ch.chromaticity.y }))
        .sort((a, b) => a.x - b.x || a.y - b.y);
    const cross = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
    const lower = [];
    const upper = [];
    for (const point of gamutCandidates) {
        while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], point) <= 0) lower.pop();
        lower.push(point);
    }
    for (let i = gamutCandidates.length - 1; i >= 0; i--) {
        const point = gamutCandidates[i];
        while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], point) <= 0) upper.pop();
        upper.push(point);
    }
    const polyCh = lower.slice(0, -1).concat(upper.slice(0, -1)).map(point => point.ch);
    
    if (polyCh.length >= 3) {
        cieCtx.strokeStyle = accentColor;
        cieCtx.lineWidth = 1.5;
        cieCtx.setLineDash([4, 4]);
        cieCtx.beginPath();
        
        for (let i = 0; i < polyCh.length; i++) {
            const ch = polyCh[i];
            if (ch.chromaticity) {
                const pt = projectXY(ch.chromaticity.x, ch.chromaticity.y, w, h, pad);
                if (i === 0) cieCtx.moveTo(pt.x, pt.y);
                else cieCtx.lineTo(pt.x, pt.y);
            }
        }
        cieCtx.closePath();
        cieCtx.stroke();
        cieCtx.setLineDash([]);
    }

    // 5. Draw channels' chromaticity nodes
    for (const ch of activeCh) {
        if (ch.chromaticity) {
            const pt = projectXY(ch.chromaticity.x, ch.chromaticity.y, w, h, pad);
            
            // Draw dot shadow
            cieCtx.shadowColor = ch.color;
            cieCtx.shadowBlur = 8;

            cieCtx.fillStyle = ch.color;
            cieCtx.beginPath();
            cieCtx.arc(pt.x, pt.y, 5, 0, 2 * Math.PI);
            cieCtx.fill();
            
            cieCtx.shadowBlur = 0; // reset shadow
            
            cieCtx.strokeStyle = '#ffffff';
            cieCtx.lineWidth = 1.5;
            cieCtx.stroke();

            // Label with proportion
            cieCtx.fillStyle = textColor;
            cieCtx.font = 'bold 8.5px "JetBrains Mono", monospace';
            const pct = channelValues[ch.id] || 0;
            const labelStr = `${ch.isWhiteChannel ? ch.name : ch.waveLabel.replace(' nm', '')} (${pct}%)`;
            cieCtx.fillText(labelStr, pt.x + 6, pt.y + 11);
        }
    }
    }

    const mPt = projectXY(currentX, currentY, w, h, pad);
    const comparisonBaseline = getActiveComparisonBaseline(activeCh);
    if (comparisonBaseline) {
        const baselinePt = projectXY(comparisonBaseline.xy.x, comparisonBaseline.xy.y, w, h, pad);
        const separation = Math.hypot(mPt.x - baselinePt.x, mPt.y - baselinePt.y);
        cieCtx.save();
        cieCtx.strokeStyle = isLightTheme ? 'rgba(74, 74, 74, 0.72)' : 'rgba(190, 190, 190, 0.78)';
        cieCtx.lineWidth = 1.5;
        if (separation >= 6) {
            cieCtx.setLineDash([2, 3]);
            cieCtx.globalAlpha = 0.55;
            cieCtx.beginPath();
            cieCtx.moveTo(baselinePt.x, baselinePt.y);
            cieCtx.lineTo(mPt.x, mPt.y);
            cieCtx.stroke();
            cieCtx.globalAlpha = 1;
        }
        cieCtx.setLineDash([3, 3]);
        cieCtx.beginPath();
        cieCtx.arc(baselinePt.x, baselinePt.y, 7, 0, 2 * Math.PI);
        cieCtx.stroke();
        cieCtx.restore();
    }

    // 6. Draw the requested target independently from the achieved colour point.
    const neutralTargetXy = integratedBlackbodyXy(targetCCT);
    const requestedTargetXy = Math.abs(targetDuv) < 1e-12
        ? neutralTargetXy
        : getTargetXY(targetCCT, targetDuv);
    const targetPt = projectXY(requestedTargetXy.x, requestedTargetXy.y, w, h, pad);
    const pointLabelSeparation = Math.hypot(mPt.x - targetPt.x, mPt.y - targetPt.y);
    const pointLabelsStacked = pointLabelSeparation < 28;
    document.documentElement.dataset.cie1931PointLabels = pointLabelsStacked ? 'stacked' : 'separate';
    cieCtx.save();
    cieCtx.strokeStyle = '#ff6b25';
    cieCtx.lineWidth = 1.5;
    cieCtx.setLineDash([3, 2]);
    cieCtx.beginPath();
    cieCtx.arc(targetPt.x, targetPt.y, 6, 0, 2 * Math.PI);
    cieCtx.stroke();
    cieCtx.setLineDash([]);
    cieCtx.fillStyle = textColor;
    cieCtx.font = 'bold 8px "JetBrains Mono", monospace';
    cieCtx.lineWidth = 3;
    cieCtx.strokeStyle = 'rgba(251, 250, 247, 0.94)';
    const targetLabelY = targetPt.y - (pointLabelsStacked ? 15 : 7);
    cieCtx.strokeText(`目标 ${targetCCT} K`, targetPt.x + 8, targetLabelY);
    cieCtx.fillText(`目标 ${targetCCT} K`, targetPt.x + 8, targetLabelY);
    cieCtx.restore();
    
    // Outer blinking halo
    const pulse = 6 + 3 * Math.sin(Date.now() / 150);
    cieCtx.strokeStyle = accentColor;
    cieCtx.lineWidth = 1.5;
    cieCtx.beginPath();
    cieCtx.arc(mPt.x, mPt.y, pulse, 0, 2 * Math.PI);
    cieCtx.stroke();

    // Center dot
    cieCtx.fillStyle = '#fbfaf7';
    cieCtx.beginPath();
    cieCtx.arc(mPt.x, mPt.y, 4, 0, 2 * Math.PI);
    cieCtx.fill();
    cieCtx.strokeStyle = '#000000';
    cieCtx.lineWidth = 1;
    cieCtx.stroke();

    // Floating text metadata
    cieCtx.fillStyle = textColor;
    cieCtx.font = 'bold 9px "JetBrains Mono", monospace';
    const achievedEstimate = SPECTRAL_MATH.estimateCctAndDuvFromXy
        ? SPECTRAL_MATH.estimateCctAndDuvFromXy(currentX, currentY)
        : null;
    const cctVal = achievedEstimate && Number.isFinite(achievedEstimate.cct)
        ? Math.round(achievedEstimate.cct)
        : 0;
    const currentLabelY = mPt.y + (pointLabelsStacked ? 18 : 3);
    cieCtx.lineWidth = 3;
    cieCtx.strokeStyle = 'rgba(251, 250, 247, 0.94)';
    cieCtx.strokeText(`当前 ${cctVal} K`, mPt.x + 10, currentLabelY);
    cieCtx.fillText(`当前 ${cctVal} K`, mPt.x + 10, currentLabelY);
}

// ═══════════════════════════════════════════════
// SPECTRAL MATH
// ═══════════════════════════════════════════════

function gaussian(lambda, peak, sigma) {
    const diff = lambda - peak;
    return Math.exp(-(diff * diff) / (2 * sigma * sigma));
}

/** Warm White LED: blue pump + phosphor broadband */
function warmWhiteSPD(lambda) {
    return 0.25 * gaussian(lambda, 450, 14) + 0.75 * gaussian(lambda, 575, 65);
}

/** Get SPD value for a channel at wavelength lambda */
function getChannelSPDValue(ch, lambda) {
    if (ch.spd && ch.spd.length) {
        return spectralArrayAt(ch.spd, lambda);
    }
    if (ch.spdSamples && ch.spdSamples.length) {
        return interpolateSamples(ch.spdSamples, lambda);
    }
    if (ch.isWarmWhite) return warmWhiteSPD(lambda);
    return gaussian(lambda, ch.peak, ch.sigma);
}

function spectralArrayAt(arr, lambda) {
    const idx = Math.round((lambda - LAMBDA_MIN) / LAMBDA_STEP);
    return idx >= 0 && idx < arr.length ? arr[idx] : 0;
}

function interpolateSamples(samples, lambda) {
    if (typeof SPD_IMPORT.interpolateZeroOutside !== 'function') return 0;
    return SPD_IMPORT.interpolateZeroOutside(samples, lambda);
}

/** Pre-compute full SPD array for a channel */
function computeChannelSPD(ch) {
    const spd = new Float64Array(NUM_POINTS);
    for (let i = 0; i < NUM_POINTS; i++) {
        spd[i] = getChannelSPDValue(ch, wavelengths[i]);
    }
    return spd;
}

function getActiveChannels() {
    return importedChannels || CHANNEL_SETS[currentMode] || CHANNELS_4CH;
}

function normalizeArray(arr) {
    let max = 0;
    for (const value of arr) {
        if (Number.isFinite(value) && value > max) max = value;
    }
    if (max <= 1e-9) return Array.from(arr, () => 0);
    return Array.from(arr, value => Math.max(0, value || 0) / max);
}

function combinedSPDFromValues(channels, values) {
    const combined = new Float64Array(NUM_POINTS);
    for (let c = 0; c < channels.length; c++) {
        const duty = (values[c] || 0) / 100;
        if (duty < 1e-6) continue;
        for (let i = 0; i < NUM_POINTS; i++) {
            combined[i] += duty * getChannelSPDValue(channels[c], wavelengths[i]);
        }
    }
    return combined;
}

function xyzFromSPD(spd) {
    let X = 0, Y = 0, Z = 0;
    for (let i = 0; i < NUM_POINTS; i++) {
        const s = spd[i] || 0;
        X += s * preCieX[i] * LAMBDA_STEP;
        Y += s * preCieY[i] * LAMBDA_STEP;
        Z += s * preCieZ[i] * LAMBDA_STEP;
    }
    return { X, Y, Z };
}

function xyFromSPD(spd) {
    const { X, Y, Z } = xyzFromSPD(spd);
    const sum = X + Y + Z;
    if (sum <= 1e-12) return { x: 0, y: 0 };
    return { x: X / sum, y: Y / sum };
}

// ─── CIE 1931 Color Matching Functions (Gaussian Approx) ───

function spectralDataAt(arr, lambda) {
    if (!arr || !arr.length) return 0;
    const idx = Math.round((lambda - LAMBDA_MIN) / LAMBDA_STEP);
    return idx >= 0 && idx < arr.length ? arr[idx] : 0;
}

function cieX(lambda) {
    return spectralDataAt(CIE_DATA.xBar, lambda);
}

function cieY(lambda) {
    return spectralDataAt(CIE_DATA.yBar, lambda);
}

function cieZ(lambda) {
    return spectralDataAt(CIE_DATA.zBar, lambda);
}

/** Photopic luminosity V(lambda) = CIE 1931 y-bar */
function vLambda(lambda) {
    return cieY(lambda);
}

/** Melanopic action spectrum from CIE S 026:2018 */
function melanopicSensitivity(lambda) {
    return spectralDataAt(CIE_DATA.melanopic, lambda);
}

// Pre-compute sensitivity curves for performance
const preV = new Float64Array(NUM_POINTS);
const preMel = new Float64Array(NUM_POINTS);
const preCieX = new Float64Array(NUM_POINTS);
const preCieY = new Float64Array(NUM_POINTS);
const preCieZ = new Float64Array(NUM_POINTS);

for (let i = 0; i < NUM_POINTS; i++) {
    const l = wavelengths[i];
    preV[i] = vLambda(l);
    preMel[i] = melanopicSensitivity(l);
    preCieX[i] = cieX(l);
    preCieY[i] = cieY(l);
    preCieZ[i] = cieZ(l);
}

// ─── D65 Daylight Reference (CIE Standard Illuminant Tabulated Data) ───

const preD65 = new Float64Array(NUM_POINTS);
{
    let maxVal = 0;
    for (let i = 0; i < NUM_POINTS; i++) {
        const val = spectralDataAt(CIE_DATA.d65, wavelengths[i]);
        preD65[i] = val;
        if (val > maxVal) maxVal = val;
    }
    for (let i = 0; i < NUM_POINTS; i++) {
        preD65[i] = maxVal > 0 ? preD65[i] / maxVal : 0;
    }
}

function estimateCCTFromXYZ(X, Y, Z) {
    const sum = X + Y + Z;
    if (sum <= 1e-12) return 0;
    const x = X / sum;
    const y = Y / sum;
    if (SPECTRAL_MATH.estimateCctAndDuvFromXy) {
        return SPECTRAL_MATH.estimateCctAndDuvFromXy(x, y).cct;
    }
    return 0;
}

const D65_MELANOPIC_RATIO = (() => {
    let melSum = 0;
    let vSum = 0;
    for (let i = 0; i < NUM_POINTS; i++) {
        melSum += preD65[i] * preMel[i] * LAMBDA_STEP;
        vSum += preD65[i] * preV[i] * LAMBDA_STEP;
    }
    return vSum > 1e-10 ? melSum / vSum : 1;
})();

function melanopicDERFromSums(melSum, vSum) {
    const melanopicRatio = vSum > 1e-10 ? melSum / vSum : 0;
    return D65_MELANOPIC_RATIO > 1e-10 ? melanopicRatio / D65_MELANOPIC_RATIO : 0;
}

function wavelengthToRGB(lambda) {
    const anchors = [
        [380, 72, 0, 120],
        [405, 92, 0, 210],
        [430, 48, 42, 255],
        [450, 0, 68, 255],
        [470, 0, 128, 255],
        [490, 0, 215, 230],
        [510, 0, 190, 88],
        [530, 80, 210, 24],
        [560, 190, 220, 0],
        [580, 255, 218, 0],
        [600, 255, 128, 0],
        [620, 255, 48, 0],
        [645, 235, 0, 0],
        [700, 190, 0, 0],
        [780, 115, 0, 0]
    ];

    if (lambda <= anchors[0][0]) return anchors[0].slice(1);
    if (lambda >= anchors[anchors.length - 1][0]) return anchors[anchors.length - 1].slice(1);

    let lo = anchors[0];
    let hi = anchors[anchors.length - 1];
    for (let i = 0; i < anchors.length - 1; i++) {
        if (lambda >= anchors[i][0] && lambda <= anchors[i + 1][0]) {
            lo = anchors[i];
            hi = anchors[i + 1];
            break;
        }
    }

    const t = (lambda - lo[0]) / (hi[0] - lo[0]);
    const r = lo[1] + (hi[1] - lo[1]) * t;
    const g = lo[2] + (hi[2] - lo[2]) * t;
    const b = lo[3] + (hi[3] - lo[3]) * t;

    return [
        Math.round(r),
        Math.round(g),
        Math.round(b)
    ];
}

// ═══════════════════════════════════════════════
// METRICS CALCULATION
// ═══════════════════════════════════════════════

function calculateCircadianMetrics(combinedSPD) {
    return calculateCLA2({
        wavelengths,
        values: combinedSPD,
        illuminanceLux: eyeIlluminance,
        durationHours: exposureDurationHours,
        fieldFactor: visualFieldFactor
    });
}

function calculateMetrics(combinedSPD) {
    let X = 0, Y = 0, Z = 0;
    let melSum = 0, vSum = 0;
    let totalPower = 0;

    for (let i = 0; i < NUM_POINTS; i++) {
        const s = combinedSPD[i];
        X += s * preCieX[i] * LAMBDA_STEP;
        Y += s * preCieY[i] * LAMBDA_STEP;
        Z += s * preCieZ[i] * LAMBDA_STEP;
        melSum += s * preMel[i] * LAMBDA_STEP;
        vSum += s * preV[i] * LAMBDA_STEP;
        totalPower += s;
    }

    if (totalPower < 1e-10) {
        currentX = 0.3127;
        currentY = 0.3290;
        return {
            cct: 0,
            duv: null,
            ra: 0,
            r9: 0,
            rf: 0,
            rg: 0,
            melanopicDER: 0,
            melanopicEDI: 0,
            cs: 0,
            cla: 0,
            blueYellowState: 'inactive'
        };
    }

    const sum = X + Y + Z;
    currentX = sum > 0 ? X / sum : 0.3127;
    currentY = sum > 0 ? Y / sum : 0.3290;

    const cct = estimateCCTFromXYZ(X, Y, Z);
    const cctDuv = SPECTRAL_MATH.estimateCctAndDuvFromXy
        ? SPECTRAL_MATH.estimateCctAndDuvFromXy(currentX, currentY)
        : null;
    const quality = COLOUR_QUALITY.calculateColourQualityFromSpectrum
        ? COLOUR_QUALITY.calculateColourQualityFromSpectrum({
            wavelengths,
            values: combinedSPD
        })
        : { ra: estimateCRI(combinedSPD), r9: 0, rf: 0, rg: estimateRg(combinedSPD, cct) };
    const melanopicDER = melanopicDERFromSums(melSum, vSum);
    const melanopicEDI = eyeIlluminance * melanopicDER;
    const circadian = calculateCircadianMetrics(combinedSPD);
    return {
        cct: Math.round(cct),
        duv: Number.isFinite(cctDuv?.duv) ? cctDuv.duv : null,
        ra: quality.ra,
        r9: quality.r9,
        rf: quality.rf,
        rg: quality.rg,
        melanopicDER,
        melanopicEDI,
        cla: circadian.cla,
        cs: circadian.cs,
        blueYellowState: circadian.blueYellowState,
        quality
    };
}

function estimateCRI(spd) {
    // Divide visible spectrum into 8 bands (like Ra's 8 test colors)
    const bandWidth = 50;
    const bands = [];
    for (let start = 380; start < 780; start += bandWidth) {
        let bandPower = 0;
        let count = 0;
        for (let i = 0; i < NUM_POINTS; i++) {
            if (wavelengths[i] >= start && wavelengths[i] < start + bandWidth) {
                bandPower += spd[i];
                count++;
            }
        }
        bands.push(count > 0 ? bandPower / count : 0);
    }

    const maxBand = Math.max(...bands);
    if (maxBand < 1e-10) return 0;

    const normalized = bands.map(b => b / maxBand);
    const mean = normalized.reduce((a, b) => a + b, 0) / normalized.length;

    // Uniformity metric
    const variance = normalized.reduce((a, b) => a + (b - mean) ** 2, 0) / normalized.length;
    const uniformity = 1 - Math.min(Math.sqrt(variance), 1);

    // Coverage: what fraction of bands have >5% power
    const coverage = normalized.filter(b => b > 0.05).length / normalized.length;

    // Spectral fullness bonus for warm white / broadband sources
    const midBandPresence = normalized.slice(2, 6).reduce((a, b) => a + b, 0) / 4;

    let cri = uniformity * 50 + coverage * 30 + midBandPresence * 20;
    return Math.max(0, Math.min(100, Math.round(cri)));
}

// ═══════════════════════════════════════════════
// COMBINED SPD COMPUTATION
// ═══════════════════════════════════════════════

function getCombinedSPD() {
    const channels = getActiveChannels();
    const combined = new Float64Array(NUM_POINTS);

    for (const ch of channels) {
        const duty = (channelValues[ch.id] || 0) / 100;
        if (duty < 1e-6) continue;
        for (let i = 0; i < NUM_POINTS; i++) {
            combined[i] += duty * getChannelSPDValue(ch, wavelengths[i]);
        }
    }
    return combined;
}

function setMetamerStatus(message) {
    if (metamerStatus) metamerStatus.textContent = message;
}

function returnToRegularMode(message = '常规模式') {
    if (isMetamerOptimizing) cancelActiveMetamerOptimization('切换到常规模式');
    metamerProfile = 'off';
    metamerModeEnabled = false;
    const offInput = document.querySelector('input[name="metamer-profile"][value="off"]');
    if (offInput) offInput.checked = true;
    document.querySelectorAll('.metamer-profile-button').forEach(button => {
        const selected = button.dataset.metamerProfile === 'off';
        button.classList.toggle('is-selected', selected);
        button.setAttribute('aria-pressed', String(selected));
    });
    normalizeChannelValuesToDisplayedPrecision();
    clearBaseline();
    syncMetamerTargetPolicy();
    syncChannelSliderPrecision();
    setMetamerStatus(message);
}

function updateTargetRgControl(value) {
    if (!Number.isFinite(value) || value <= 0) {
        targetRg = null;
        if (targetRgVal) targetRgVal.textContent = '--';
        return false;
    }
    targetRg = Math.max(80, Math.min(130, Math.round(value)));
    if (targetRgSlider) targetRgSlider.value = targetRg;
    if (targetRgVal) targetRgVal.textContent = targetRg;
    return true;
}

function hasValidMetamerMetrics(metrics) {
    return Boolean(metrics) &&
        Number.isFinite(metrics.rg) && metrics.rg > 0 &&
        Number.isFinite(metrics.rf) && metrics.rf > 0;
}

function baselineMatchesActiveChannels(channels) {
    return Boolean(baselineSnapshot) &&
        baselineSnapshot.channelIds.length === channels.length &&
        baselineSnapshot.channelIds.every((id, index) => id === channels[index].id);
}

function getActiveComparisonBaseline(channels = getActiveChannels()) {
    const snapshot = METAMER_OPTIMIZER.resolveComparisonBaseline({
        metamerModeEnabled,
        compareSpectrumEnabled,
        baselineSnapshot,
        activeChannelIds: channels.map(channel => channel.id)
    });
    if (!snapshot) return null;

    const hasValidSpd = Array.isArray(snapshot.normalizedSpd) &&
        snapshot.normalizedSpd.length === NUM_POINTS &&
        snapshot.normalizedSpd.every(Number.isFinite);
    const hasValidXy = snapshot.xy &&
        Number.isFinite(snapshot.xy.x) && Number.isFinite(snapshot.xy.y);

    return hasValidSpd && hasValidXy && hasValidMetamerMetrics(snapshot.metrics)
        ? snapshot
        : null;
}

function syncMetamerControls(metrics) {
    const hasValidMetrics = hasValidMetamerMetrics(metrics);
    const hasBaseline = hasValidMetrics && baselineMatchesActiveChannels(getActiveChannels());
    const comparisonAvailable = metamerModeEnabled && hasBaseline;
    const playbackLocked = cctAnimation.status !== 'stopped';

    if (hasValidMetrics && !Number.isFinite(targetRg)) updateTargetRgControl(metrics.rg);
    if (targetRgSlider) targetRgSlider.disabled = playbackLocked || isMetamerOptimizing || !hasValidMetrics;
    if (setBaselineBtn) setBaselineBtn.disabled = playbackLocked || isMetamerOptimizing || !hasValidMetrics;
    if (compareSpectrumCheckbox) {
        compareSpectrumCheckbox.disabled = playbackLocked || isMetamerOptimizing || !comparisonAvailable;
        if (!comparisonAvailable) compareSpectrumCheckbox.checked = false;
    }
    if (!comparisonAvailable) compareSpectrumEnabled = false;

    if (!hasValidMetrics && metamerModeEnabled) {
        updateTargetRgControl(NaN);
        setMetamerStatus('当前没有可用于同色异谱优化的有效光谱。');
    }

    return hasValidMetrics;
}

function channelDisplayValue(value) {
    return Number.isInteger(value) ? String(value) : Number(value).toFixed(1);
}

function syncChannelSliderPrecision() {
    const step = '0.1';
    for (const channel of getActiveChannels()) {
        const value = channelValues[channel.id] || 0;
        const slider = document.getElementById(`ch-slider-${channel.id}`);
        const label = document.getElementById(`ch-val-${channel.id}`);
        const uiValue = Number(value.toFixed(1));
        if (slider) {
            slider.step = step;
            slider.value = uiValue;
            slider.style.setProperty('--slider-fill', `${uiValue}%`);
        }
        if (label) label.textContent = `${channelDisplayValue(value)}%`;
    }
}

function normalizeChannelValuesToDisplayedPrecision() {
    for (const channel of getActiveChannels()) {
        const value = channelValues[channel.id] || 0;
        channelValues[channel.id] = Math.max(0, Math.min(100, Number(value.toFixed(1))));
    }
}

function resetComparisonVisibility() {
    compareSpectrumEnabled = false;
    if (compareSpectrumCheckbox) {
        compareSpectrumCheckbox.checked = false;
        compareSpectrumCheckbox.disabled = true;
    }
}

function clearMetamerColourDelta() {
    if (!metamerColourDelta) return;
    metamerColourDelta.textContent = '';
    metamerColourDelta.removeAttribute('data-delta-uv');
    metamerColourDelta.classList.remove('outside-tolerance');
}

function updateMetamerColourDelta(combined) {
    const channels = getActiveChannels();
    if (!metamerModeEnabled || !baselineMatchesActiveChannels(channels)) {
        clearMetamerColourDelta();
        return;
    }

    const currentXy = xyFromSPD(combined);
    const currentUv = xyToUv(currentXy.x, currentXy.y);
    const deltaUv = METAMER_OPTIMIZER.deltaUvBetween(baselineSnapshot.uv, currentUv);
    if (!Number.isFinite(deltaUv)) {
        clearMetamerColourDelta();
        return;
    }

    metamerColourDelta.textContent = `基准/当前 Δuv（CIE 1960）：${deltaUv.toFixed(6)}`;
    metamerColourDelta.dataset.deltaUv = deltaUv.toFixed(9);
    metamerColourDelta.classList.toggle('outside-tolerance', deltaUv > METAMER_CHROMATICITY_TOLERANCE);
}

function captureBaseline() {
    const channels = getActiveChannels();
    const combined = getCombinedSPD();
    const metrics = calculateMetrics(combined);
    if (!syncMetamerControls(metrics)) return;
    const xy = xyFromSPD(combined);
    const uv = xyToUv(xy.x, xy.y);
    const percentages = {};
    for (const channel of channels) percentages[channel.id] = channelValues[channel.id] || 0;

    baselineSnapshot = Object.freeze({
        channelIds: Object.freeze(channels.map(channel => channel.id)),
        values: Object.freeze(channels.map(channel => channelValues[channel.id] || 0)),
        percentages: Object.freeze(percentages),
        normalizedSpd: Object.freeze(normalizeArray(combined)),
        xy: Object.freeze({ x: xy.x, y: xy.y }),
        uv: Object.freeze({ u: uv.u, v: uv.v }),
        metrics: Object.freeze({ ...metrics })
    });

    syncMetamerControls(metrics);
    setMetamerStatus(`已设置基准：Rg ${Math.round(baselineSnapshot.metrics.rg)}`);
    scheduleUpdate();
}

function clearBaseline(message = '') {
    if (isMetamerOptimizing) cancelActiveMetamerOptimization('Metamer baseline changed');
    baselineSnapshot = null;
    resetComparisonVisibility();
    clearMetamerColourDelta();
    if (message && metamerModeEnabled) setMetamerStatus(message);
}

function metamerOptimizerChannels(channels) {
    return channels.map(channel => {
        const spd = new Array(NUM_POINTS);
        for (let index = 0; index < NUM_POINTS; index++) {
            spd[index] = getChannelSPDValue(channel, wavelengths[index]);
        }
        return { id: channel.id, peak: channel.peak || null, spd };
    });
}

function runMetamerOptimizationSync(payload) {
    return METAMER_OPTIMIZER.optimizeMetamer({
        ...payload,
        evaluateSpd(spd) {
            const xy = xyFromSPD(spd);
            return { ...calculateMetrics(spd), xy };
        },
        xyToUv
    });
}

async function calculateMetamerOptimization(payload) {
    if (metamerWorkerClient && metamerWorkerClient.isSupported()) {
        try {
            return await metamerWorkerClient.optimize(payload);
        } catch (error) {
            if (error && error.code === 'METAMER_CANCELLED') throw error;
            console.warn('Metamer worker unavailable; using synchronous fallback.', error);
        }
    }
    return runMetamerOptimizationSync(payload);
}

function cancelActiveMetamerOptimization(message = 'Metamer optimization was cancelled') {
    metamerOptimizationGeneration += 1;
    if (metamerWorkerClient) metamerWorkerClient.cancel(message);
    isMetamerOptimizing = false;
    if (metamerDependentControls) metamerDependentControls.removeAttribute('aria-busy');
}

async function runMetamerOptimization() {
    if (!metamerModeEnabled) return;
    if (typeof METAMER_OPTIMIZER.optimizeMetamer !== 'function') {
        setMetamerStatus('同色异谱优化模块未加载。');
        return;
    }

    const metrics = calculateMetrics(getCombinedSPD());
    if (!syncMetamerControls(metrics)) return;

    const channels = getActiveChannels();
    if (!baselineMatchesActiveChannels(channels)) {
        setMetamerStatus('请先建立当前色点基准。');
        return;
    }

    const lockedBaseline = baselineSnapshot;
    const lockedProfile = metamerProfile;
    const generation = ++metamerOptimizationGeneration;
    isMetamerOptimizing = true;
    syncMetamerControls(metrics);
    if (metamerDependentControls) metamerDependentControls.setAttribute('aria-busy', 'true');
    setMetamerStatus('正在优化同色异谱配方…');

    try {
        await yieldForPaint();
        if (generation !== metamerOptimizationGeneration || !metamerModeEnabled ||
            baselineSnapshot !== lockedBaseline) return;

        const payload = {
            channels: metamerOptimizerChannels(channels),
            baselineValues: lockedBaseline.values.slice(),
            targetXy: lockedProfile === 'saturation'
                ? getTargetXY(targetCCT, 0)
                : METAMER_OPTIMIZER.getBaselineTargetXy(lockedBaseline),
            targetRg,
            objective: lockedProfile
        };
        const result = await calculateMetamerOptimization(payload);
        if (generation !== metamerOptimizationGeneration || !metamerModeEnabled ||
            metamerProfile !== lockedProfile || baselineSnapshot !== lockedBaseline) return;

        if (!result.feasible || !result.values) {
            setMetamerStatus(lockedProfile === 'fidelity'
                ? '当前色点下未找到更高显色的可行配方。'
                : '当前色点下未找到目标饱和度的可行配方。');
            scheduleUpdate();
            return;
        }

        const valuesById = {};
        for (let index = 0; index < channels.length; index++) {
            valuesById[channels[index].id] = result.values[index];
        }
        const renderVersion = applyValuesImmediate(valuesById);
        const rendered = await waitForBaseRender(renderVersion);
        if (generation !== metamerOptimizationGeneration || !metamerModeEnabled ||
            metamerProfile !== lockedProfile || baselineSnapshot !== lockedBaseline) return;
        if (!rendered) updateMetrics(getCombinedSPD());
        const achieved = calculateMetrics(getCombinedSPD());
        if (lockedProfile === 'fidelity') {
            setMetamerStatus(`高显色完成 · Rf ${Math.round(achieved.rf)} · Ra ${Math.round(achieved.ra)} · R9 ${Math.round(achieved.r9)}`);
        } else {
            const warningItems = [];
            if (achieved.rf < 75) warningItems.push('Rf偏低');
            if (achieved.ra < 80) warningItems.push('Ra偏低');
            if (achieved.r9 < 20) warningItems.push('R9偏低');
            const warningText = warningItems.length
                ? ` · 颜色偏差较明显（${warningItems.join('、')}）`
                : '';
            setMetamerStatus(`高饱和完成 · Rg ${Math.round(achieved.rg)} · Rf ${Math.round(achieved.rf)} · Ra ${Math.round(achieved.ra)} · R9 ${Math.round(achieved.r9)}${warningText}`);
        }
    } catch (error) {
        if (error && error.code === 'METAMER_CANCELLED') return;
        console.error('Metamer optimization failed:', error);
        setMetamerStatus('同色异谱优化失败，请调整目标后重试。');
    } finally {
        if (generation !== metamerOptimizationGeneration) return;
        isMetamerOptimizing = false;
        if (metamerDependentControls) metamerDependentControls.removeAttribute('aria-busy');
        syncMetamerControls(calculateMetrics(getCombinedSPD()));
    }
}

// ═══════════════════════════════════════════════
// CANVAS RENDERING
// ═══════════════════════════════════════════════

const PLOT_PADDING = { top: 30, right: 30, bottom: 55, left: 55 };

function resizeCanvasElement(element, context, rect, dpr) {
    const backingWidth = Math.max(1, Math.round(rect.width * dpr));
    const backingHeight = Math.max(1, Math.round(rect.height * dpr));
    const resized = element.width !== backingWidth || element.height !== backingHeight;
    if (resized) {
        element.width = backingWidth;
        element.height = backingHeight;
    }
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    element._logicalWidth = rect.width;
    element._logicalHeight = rect.height;
    return resized;
}

function resizeCanvas(options = {}) {
    const prepareCieBackground = options.prepareCieBackground !== false;
    const dpr = window.devicePixelRatio || 1;
    if (canvasWrapper && canvas) {
        const rect = canvas.getBoundingClientRect();
        resizeCanvasElement(canvas, ctx, rect, dpr);
    }
    if (cieCanvasWrapper && cieCanvas && cieCtx) {
        const rect = cieCanvas.getBoundingClientRect();
        const cieResized = resizeCanvasElement(cieCanvas, cieCtx, rect, dpr);
        if (prepareCieBackground && (cieResized || !cieOffscreenCanvas)) generateCIEBackground();
    }
}

function renderSPD(combinedOverride = null) {
    const W = canvas._logicalWidth || 800;
    const H = canvas._logicalHeight || 400;
    const plotX = PLOT_PADDING.left;
    const plotY = PLOT_PADDING.top;
    const plotW = W - PLOT_PADDING.left - PLOT_PADDING.right;
    const plotH = H - PLOT_PADDING.top - PLOT_PADDING.bottom;

    ctx.clearRect(0, 0, W, H);

    // ── Background ──
    ctx.fillStyle = '#fbfaf7';
    ctx.fillRect(0, 0, W, H);

    // ── Wavelength color strip at bottom ──
    const stripH = 8;
    const stripY = plotY + plotH + 1;
    for (let i = 0; i < plotW; i++) {
        const lambda = LAMBDA_MIN + (i / plotW) * (LAMBDA_MAX - LAMBDA_MIN);
        const [r, g, b] = wavelengthToRGB(lambda);
        ctx.fillStyle = `rgb(${r},${g},${b})`;
        ctx.fillRect(plotX + i, stripY, 1.5, stripH);
    }

    // ── Grid Lines ──
    ctx.strokeStyle = 'rgba(50, 45, 37, 0.12)';
    ctx.lineWidth = 1;

    // Vertical grid every 50nm
    for (let nm = 400; nm <= 750; nm += 50) {
        const x = plotX + ((nm - LAMBDA_MIN) / (LAMBDA_MAX - LAMBDA_MIN)) * plotW;
        ctx.beginPath();
        ctx.moveTo(x, plotY);
        ctx.lineTo(x, plotY + plotH);
        ctx.stroke();

        // Labels
        ctx.fillStyle = 'rgba(42, 37, 30, 0.72)';
        ctx.font = '11px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`${nm}`, x, stripY + stripH + 14);
    }

    // Horizontal grid
    for (let v = 0; v <= 1; v += 0.2) {
        const y = plotY + plotH - v * plotH;
        ctx.beginPath();
        ctx.moveTo(plotX, y);
        ctx.lineTo(plotX + plotW, y);
        ctx.stroke();

        // Labels
        ctx.fillStyle = 'rgba(42, 37, 30, 0.68)';
        ctx.font = '11px "JetBrains Mono", monospace';
        ctx.textAlign = 'right';
        ctx.fillText(v.toFixed(1), plotX - 8, y + 3);
    }

    // ── Axis labels ──
    ctx.fillStyle = 'rgba(42, 37, 30, 0.78)';
    ctx.font = '12px "Inter", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('波长 λ (nm)', plotX + plotW / 2, H - 4);

    ctx.save();
    ctx.translate(12, plotY + plotH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('相对功率', 0, 0);
    ctx.restore();

    // ── D65 Reference ──
    if (showD65) {
        ctx.beginPath();
        ctx.setLineDash([6, 4]);
        ctx.strokeStyle = 'rgba(42, 47, 58, 0.34)';
        ctx.lineWidth = 1.5;
        for (let i = 0; i < NUM_POINTS; i++) {
            const x = plotX + (i / (NUM_POINTS - 1)) * plotW;
            const y = plotY + plotH - preD65[i] * plotH;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.setLineDash([]);

        // D65 label
        ctx.fillStyle = 'rgba(42, 47, 58, 0.45)';
        ctx.font = '10px "JetBrains Mono", monospace';
        ctx.textAlign = 'left';
        const d65X = plotX + ((460 - LAMBDA_MIN) / (LAMBDA_MAX - LAMBDA_MIN)) * plotW;
        ctx.fillText('D65', d65X, plotY + 15);
    }

    if (window.SpectralProfessional) {
        window.SpectralProfessional.drawActionCurves({
            ctx,
            plotX,
            plotY,
            plotW,
            plotH,
            fallback: {
                photopic: preV,
                melanopic: preMel
            }
        });
    }

    // ── Compute combined SPD & find max ──
    const channels = getActiveChannels();
    const combined = combinedOverride || getCombinedSPD();
    let maxCombined = 0;
    for (let i = 0; i < NUM_POINTS; i++) {
        if (combined[i] > maxCombined) maxCombined = combined[i];
    }
    const scale = maxCombined > 1e-6 ? 1 / maxCombined : 1;

    // ── Individual channel curves ──
    for (const ch of channels) {
        const duty = (channelValues[ch.id] || 0) / 100;
        if (duty < 1e-3) continue;

        ctx.beginPath();
        ctx.setLineDash([4, 3]);
        ctx.strokeStyle = ch.color + 'b8';
        ctx.lineWidth = 1.55;

        for (let i = 0; i < NUM_POINTS; i++) {
            const val = duty * getChannelSPDValue(ch, wavelengths[i]) * scale;
            const x = plotX + (i / (NUM_POINTS - 1)) * plotW;
            const y = plotY + plotH - val * plotH;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.setLineDash([]);
    }

    // ── Combined SPD curve (main) ──
    const comparisonBaseline = getActiveComparisonBaseline(channels);
    if (comparisonBaseline) {
        ctx.save();
        ctx.setLineDash([6, 4]);
        ctx.strokeStyle = 'rgba(90, 90, 90, 0.72)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let i = 0; i < NUM_POINTS; i++) {
            const x = plotX + (i / (NUM_POINTS - 1)) * plotW;
            const y = plotY + plotH - comparisonBaseline.normalizedSpd[i] * plotH;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.restore();
    }

    if (maxCombined > 1e-6) {
        // Main line
        ctx.beginPath();
        ctx.strokeStyle = '#25211c';
        ctx.lineWidth = 1.8;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        for (let i = 0; i < NUM_POINTS; i++) {
            const val = combined[i] * scale;
            const x = plotX + (i / (NUM_POINTS - 1)) * plotW;
            const y = plotY + plotH - val * plotH;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.stroke();

        // Gradient fill under combined
        ctx.beginPath();
        for (let i = 0; i < NUM_POINTS; i++) {
            const val = combined[i] * scale;
            const x = plotX + (i / (NUM_POINTS - 1)) * plotW;
            const y = plotY + plotH - val * plotH;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.lineTo(plotX + plotW, plotY + plotH);
        ctx.lineTo(plotX, plotY + plotH);
        ctx.closePath();
        const combinedGrad = ctx.createLinearGradient(plotX, 0, plotX + plotW, 0);
        for (let nm = LAMBDA_MIN; nm <= LAMBDA_MAX; nm += 10) {
            const [r, g, b] = wavelengthToRGB(nm);
            combinedGrad.addColorStop(
                (nm - LAMBDA_MIN) / (LAMBDA_MAX - LAMBDA_MIN),
                `rgb(${r},${g},${b})`
            );
        }
        ctx.fillStyle = combinedGrad;
        ctx.fill();

        // Redraw the combined outline above the full-colour spectral fill.
        ctx.beginPath();
        ctx.strokeStyle = '#25211c';
        ctx.lineWidth = 1.8;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        for (let i = 0; i < NUM_POINTS; i++) {
            const val = combined[i] * scale;
            const x = plotX + (i / (NUM_POINTS - 1)) * plotW;
            const y = plotY + plotH - val * plotH;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.stroke();

        // Channel signatures sit above the spectral fill as coloured dashed
        // guides, matching the requested instrument-style presentation.
        for (const ch of channels) {
            const duty = (channelValues[ch.id] || 0) / 100;
            if (duty < 1e-3) continue;
            ctx.beginPath();
            ctx.setLineDash([4, 3]);
            const channelRgb = /^#[0-9a-f]{6}$/i.test(ch.color)
                ? [
                    parseInt(ch.color.slice(1, 3), 16),
                    parseInt(ch.color.slice(3, 5), 16),
                    parseInt(ch.color.slice(5, 7), 16)
                ]
                : [55, 68, 82];
            ctx.strokeStyle = `rgb(${Math.round(channelRgb[0] * 0.68)},${Math.round(channelRgb[1] * 0.68)},${Math.round(channelRgb[2] * 0.68)})`;
            ctx.lineWidth = 1.5;
            for (let i = 0; i < NUM_POINTS; i++) {
                const val = duty * getChannelSPDValue(ch, wavelengths[i]) * scale;
                const x = plotX + (i / (NUM_POINTS - 1)) * plotW;
                const y = plotY + plotH - val * plotH;
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.stroke();
            ctx.setLineDash([]);
        }
    }

    // ── Plot border ──
    ctx.strokeStyle = 'rgba(42, 37, 30, 0.18)';
    ctx.lineWidth = 1.2;
    ctx.strokeRect(plotX, plotY, plotW, plotH);
}

// ═══════════════════════════════════════════════
// METRICS DISPLAY
// ═══════════════════════════════════════════════

let prevMetrics = { cct: 0, ra: 0, r9: 0, rf: 0, rg: 0, melanopicDER: 0, melanopicEDI: 0, cs: 0, cla: 0 };

function updateCircadianConditionLabels() {
    if (exposureDurationVal) exposureDurationVal.textContent = `${exposureDurationHours.toFixed(1)} h`;
    if (cla2Conditions) {
        const fieldLabel = VISUAL_FIELD_LABELS[visualFieldFactor] || VISUAL_FIELD_LABELS[1];
        const conditionText = `Rea CLA 2.0 模型，暴露时长 ${exposureDurationHours.toFixed(1)} h，${fieldLabel}。`;
        if (cla2Conditions.textContent !== conditionText) cla2Conditions.textContent = conditionText;
    }
}

function announceCircadianConditionUpdate(metrics) {
    if (!circadianStatus) return;
    const fieldLabel = VISUAL_FIELD_LABELS[visualFieldFactor] || VISUAL_FIELD_LABELS[1];
    const cs = metrics.cs > 0 ? metrics.cs.toFixed(3) : '0';
    const cla = metrics.cla > 0 ? Math.round(metrics.cla).toLocaleString() : '0';
    circadianStatus.textContent = `Rea CLA 2.0 条件：${exposureDurationHours.toFixed(1)} h，${fieldLabel}。CS ${cs}；CLA ${cla}。`;
}

function renderCircadianMetric(metrics) {
    updateMetricCard('cs', valCS, barCS, metrics.cs, prevMetrics.cs, {
        format: value => value > 0 ? value.toFixed(3) : '--',
        barFill: (metrics.cs / 0.7) * 100,
        barColor: metrics.cs > 0.3 ? '#a6e96b' : metrics.cs > 0.1 ? '#e4b85b' : '#ff6b25'
    });
    const cla = metrics.cla > 0 ? Math.round(metrics.cla).toLocaleString() : '--';
    const fieldLabel = VISUAL_FIELD_LABELS[visualFieldFactor] || VISUAL_FIELD_LABELS[1];
    if (valCLA2) valCLA2.textContent = `CLA 2.0 ${cla}\n${exposureDurationHours.toFixed(1)} h · ${fieldLabel}`;
    updateCircadianConditionLabels();
}

function refreshCircadianMetricOnly(announce = false) {
    const circadian = calculateCircadianMetrics(getCombinedSPD());
    renderCircadianMetric(circadian);
    window.WorkbenchSummary?.updateCsCondition?.({
        cs: circadian.cs,
        exposureHours: exposureDurationHours,
        visualFieldLabel: VISUAL_FIELD_LABELS[visualFieldFactor] || VISUAL_FIELD_LABELS[1]
    });
    prevMetrics.cs = circadian.cs;
    prevMetrics.cla = circadian.cla;
    if (announce) announceCircadianConditionUpdate(circadian);
}

function publishWorkspaceResult(combined, metrics) {
    if (!WORKSPACE_STORE || typeof WORKSPACE_STORE.setCurrentResult !== 'function') return;

    const channels = getActiveChannels();
    const totalPower = combined.reduce((sum, value) => sum + Math.max(0, value), 0);
    const hasOutput = totalPower > 1e-10;
    const xyz = hasOutput ? xyzFromSPD(combined) : null;
    const xy = hasOutput ? xyFromSPD(combined) : null;
    const uv1960 = xy && typeof CHROMATICITY_DIAGRAM.xyTo1960Uv === 'function'
        ? CHROMATICITY_DIAGRAM.xyTo1960Uv(xy.x, xy.y)
        : null;
    const uv1976 = xy && typeof CHROMATICITY_DIAGRAM.xyTo1976UpVp === 'function'
        ? CHROMATICITY_DIAGRAM.xyTo1976UpVp(xy.x, xy.y)
        : null;
    const pastelActive = Boolean(colourTuningGroup?.classList.contains('is-pastel-target'));
    const pastelMatch = pastelActive ? String(colourTargetMode?.textContent || '').match(/P\d{2}/) : null;

    WORKSPACE_STORE.setCurrentResult({
        channelCount: channels.length,
        source: {
            type: importedChannels ? 'imported' : 'built-in',
            name: importedChannels
                ? (importedSourceName || `${channels.length}-channel imported SPD`)
                : (currentMode === 6 ? '6-channel RGBCLA built-in model' : '4-channel RGBW built-in model')
        },
        target: {
            colourMode: pastelActive ? 'pastel' : 'white',
            pastelId: pastelMatch ? pastelMatch[0] : null,
            profile: metamerModeEnabled ? metamerProfile : 'standard',
            cct: targetCCT,
            duv: targetDuv,
            targetRg: metamerModeEnabled ? targetRg : null
        },
        spectrum: {
            wavelengths: Array.from(wavelengths),
            values: Array.from(combined)
        },
        xyz: hasOutput ? { X: xyz.X, Y: xyz.Y, Z: xyz.Z } : { X: null, Y: null, Z: null },
        chromaticity: hasOutput ? {
            x: xy.x,
            y: xy.y,
            u: uv1960?.u ?? null,
            v: uv1960?.v ?? null,
            up: uv1976?.up ?? null,
            vp: uv1976?.vp ?? null
        } : {
            x: null,
            y: null,
            u: null,
            v: null,
            up: null,
            vp: null
        },
        metrics: hasOutput ? {
            cct: metrics.cct,
            duv: metrics.duv,
            ra: metrics.ra,
            r9: metrics.r9,
            rf: metrics.rf,
            rg: metrics.rg,
            melanopicDER: metrics.melanopicDER,
            melanopicEDI: metrics.melanopicEDI,
            cla2: metrics.cla,
            cs: metrics.cs
        } : {
            cct: null,
            duv: null,
            ra: null,
            r9: null,
            rf: null,
            rg: null,
            melanopicDER: null,
            melanopicEDI: null,
            cla2: null,
            cs: null
        },
        channels: channels.map(channel => ({
            id: channel.id,
            name: channel.nameCN || channel.name,
            duty: (channelValues[channel.id] || 0) / 100,
            spd: Array.from(wavelengths, lambda => getChannelSPDValue(channel, lambda))
        }))
    });
}

function buildProfessionalPayload(combined, metrics) {
    const professionalChannels = getActiveChannels();
    const professionalBaseline = getActiveComparisonBaseline(professionalChannels);
    const neutralTargetXy = integratedBlackbodyXy(targetCCT);
    const professionalTargetXy = Math.abs(targetDuv) < 1e-12
        ? neutralTargetXy
        : getTargetXY(targetCCT, targetDuv);
    return {
        spd: combined,
        metrics,
        xyz: xyzFromSPD(combined),
        x: currentX,
        y: currentY,
        target: {
            x: professionalTargetXy.x,
            y: professionalTargetXy.y,
            cct: targetCCT,
            duv: targetDuv
        },
        baseline: professionalBaseline ? {
            x: professionalBaseline.xy.x,
            y: professionalBaseline.xy.y
        } : null,
        channels: professionalChannels.map(channel => ({
            id: channel.id,
            name: channel.nameCN || channel.name,
            color: channel.color,
            duty: (channelValues[channel.id] || 0) / 100,
            x: channel.chromaticity ? channel.chromaticity.x : NaN,
            y: channel.chromaticity ? channel.chromaticity.y : NaN,
            spd: wavelengths.map(lambda => getChannelSPDValue(channel, lambda))
        })),
        fallback: {
            photopic: preV,
            melanopic: preMel,
            d65: preD65,
            xBar: preCieX,
            yBar: preCieY,
            zBar: preCieZ
        }
    };
}

function updateMetrics(combined = getCombinedSPD()) {
    const m = calculateMetrics(combined);
    const hasOutput = combined.some(value => Number.isFinite(value) && value > 1e-10);
    if (hasOutput) {
        window.WorkbenchSummary?.update({
            cct: m.cct,
            targetCct: targetCCT,
            duv: m.duv,
            targetDuv,
            rf: m.rf,
            rg: m.rg,
            melanopicEdi: m.melanopicEDI,
            melanopicDer: m.melanopicDER,
            eyeIlluminance,
            cs: m.cs,
            exposureHours: exposureDurationHours,
            visualFieldLabel: VISUAL_FIELD_LABELS[visualFieldFactor] || VISUAL_FIELD_LABELS[1]
        });
    } else {
        window.WorkbenchSummary?.clear();
    }
    publishWorkspaceResult(combined, m);
    updateEmitterPreview(combined, m);
    if (metamerModeEnabled) syncMetamerControls(m);
    updateMetamerColourDelta(combined);

    const professionalPayload = buildProfessionalPayload(combined, m);
    if (window.SpectralProfessional?.updateBase) {
        window.SpectralProfessional.updateBase(professionalPayload);
    }

    // CCT
    updateMetricCard('cct', valCCT, barCCT, m.cct, prevMetrics.cct, {
        format: v => v > 0 ? Math.round(v).toLocaleString() : '--',
        barFill: Math.min(100, (m.cct / 10000) * 100),
        barColor: m.cct < 3500 ? '#ffb347' : m.cct < 5000 ? '#e4b85b' : '#f6f1e8'
    });

    updateMetricCard('delta-uv', valDeltaUv, barDeltaUv, m.duv, prevMetrics.duv, {
        format: value => Number.isFinite(value) ? `${value >= 0 ? '+' : ''}${value.toFixed(4)}` : '--',
        barFill: Number.isFinite(m.duv) ? Math.min(100, Math.abs(m.duv) / 0.01 * 100) : 0,
        barColor: Number.isFinite(m.duv) && Math.abs(m.duv) <= 0.003 ? '#34c759' : '#e4b85b'
    });

    // CIE general colour rendering index
    updateMetricCard('cri', valCRI, barCRI, m.ra, prevMetrics.ra, {
        format: v => v > 0 ? Math.round(v) : '--',
        barFill: m.ra,
        barColor: m.ra >= 90 ? '#a6e96b' : m.ra >= 80 ? '#e4b85b' : '#ff6b25'
    });

    updateMetricCard('r9', valR9, barR9, m.r9, prevMetrics.r9, {
        format: v => Number.isFinite(v) ? Math.round(v) : '--',
        barFill: Math.max(0, Math.min(100, m.r9)),
        barColor: m.r9 >= 80 ? '#a6e96b' : m.r9 >= 50 ? '#e4b85b' : '#ff6b25'
    });

    updateMetricCard('rf', valRf, barRf, m.rf, prevMetrics.rf, {
        format: v => v > 0 ? Math.round(v) : '--',
        barFill: m.rf,
        barColor: m.rf >= 90 ? '#a6e96b' : m.rf >= 80 ? '#e4b85b' : '#ff6b25'
    });

    // Melanopic EDI
    updateMetricCard('mel', valMel, barMel, m.melanopicDER, prevMetrics.melanopicDER, {
        format: v => v > 0 ? v.toFixed(2) : '--',
        barFill: Math.min(100, m.melanopicDER * 50),
        barColor: '#e4b85b'
    });

    renderCircadianMetric(m);

    // CIE S 026 melanopic equivalent daylight illuminance
    updateMetricCard('medi', valMedi, barMedi, m.melanopicEDI, prevMetrics.melanopicEDI, {
        format: v => v > 0 ? Math.round(v).toLocaleString() : '--',
        barFill: Math.min(100, m.melanopicEDI / 2.5),
        barColor: '#ff6b25'
    });

    // Rg
    updateMetricCard('rg', valRg, barRg, m.rg, prevMetrics.rg || 100, {
        format: v => v > 0 ? Math.round(v) : '--',
        barFill: ((m.rg - 90) / 30) * 100,
        barColor: '#a6e96b'
    });

    const comparisonBaseline = getActiveComparisonBaseline();
    updateMetricDelta(valRf, m.rf, comparisonBaseline?.metrics.rf);
    updateMetricDelta(valRg, m.rg, comparisonBaseline?.metrics.rg);

    prevMetrics = { cct: m.cct, duv: m.duv, ra: m.ra, r9: m.r9, rf: m.rf, melanopicDER: m.melanopicDER, melanopicEDI: m.melanopicEDI, cs: m.cs, cla: m.cla, rg: m.rg };
    return { combined, metrics: m, professionalPayload };
}

function updateDeferredAnalysis(payload, version, isCurrent) {
    if (!payload?.metrics || !isCurrent(version)) return;
    const { combined, metrics, professionalPayload } = payload;
    if (!scheduleSimulationActive) updateColorSamples(combined, metrics.quality);
    if (!isCurrent(version)) return;
    if (window.MaterialPanel) window.MaterialPanel.update(combined, metrics, { version, isCurrent });
    if (window.DiningPanel) window.DiningPanel.update(combined, metrics, { version, isCurrent });
    if (!isCurrent(version)) return;
    if (window.SpectralProfessional?.updateDeferred) {
        window.SpectralProfessional.updateDeferred(professionalPayload);
    }
    if (isCurrent(version)) {
        const completedAt = performance.now();
        document.documentElement.dataset.deferredAnalysisVersion = String(version);
        document.documentElement.dataset.deferredAnalysisTime = completedAt.toFixed(1);
        document.dispatchEvent(new CustomEvent('spectral-deferred-analysis-complete', {
            detail: { version, completedAt }
        }));
    }
}

function materialModelsById(materialIds, transientModels) {
    const builtins = typeof MATERIAL_DATA.listMaterials === 'function' ? MATERIAL_DATA.listMaterials() : [];
    const dining = typeof DINING_LIGHT_DATA.listMaterials === 'function' ? DINING_LIGHT_DATA.listMaterials() : [];
    const users = typeof MATERIAL_UPLOAD.loadUserMaterials === 'function' ? MATERIAL_UPLOAD.loadUserMaterials() : [];
    const transient = Array.isArray(transientModels) ? transientModels : [];
    const byId = new Map([...builtins, ...dining, ...users, ...transient].map(material => [material.id, material]));
    return (Array.isArray(materialIds) ? materialIds : [])
        .map(id => byId.get(id))
        .filter(material => material && Array.isArray(material.reflectance) && material.reflectance.length === 81);
}

function dispatchMaterialOptimizationResult(detail) {
    document.dispatchEvent(new CustomEvent('spectral-material-optimization-result', { detail }));
}

function materialOptimizationKey(request, channels, materials) {
    return JSON.stringify({
        goal: request.goal || request.mode || 'preference',
        level: request.level || 'recommended',
        scope: request.scope || 'selected',
        channels: channels.map(channel => channel.id),
        materials: materials.map(material => material.id).sort()
    });
}

function diningOptimizationKey(request, channels, materials) {
    const targetMode = request.targetMode === 'recommended' ? 'recommended' : 'current';
    return JSON.stringify({
        cuisine: request.cuisineProfileId || 'comprehensive',
        goal: request.goal || request.mode || 'preference',
        level: request.level || 'recommended',
        targetMode,
        targetCct: targetMode === 'recommended' ? Number(request.targetCct) || 0 : null,
        targetDuv: targetMode === 'recommended' ? Number(request.targetDuv) || 0 : null,
        channels: channels.map(channel => channel.id),
        materials: materials.map(material => material.id).sort()
    });
}

function sameChannelValues(left, right) {
    return Array.isArray(left) && Array.isArray(right) && left.length === right.length &&
        left.every((value, index) => {
            // The regular-mode handoff rounds values to the 0.1% UI precision.
            // Compare at that same precision so an applied result is not mistaken
            // for an external channel edit.
            const roundedLeft = Number(Number(value).toFixed(1));
            const roundedRight = Number(Number(right[index]).toFixed(1));
            return Math.abs(roundedLeft - roundedRight) <= 1e-9;
        });
}

function resolveDiningOptimizationSession(channels, liveValues) {
    const channelSignature = activeChannelSignature(channels);
    const canReuse = diningOptimizationSession &&
        diningOptimizationSession.channelSignature === channelSignature &&
        (sameChannelValues(liveValues, diningOptimizationSession.resultValues) ||
            sameChannelValues(liveValues, diningOptimizationSession.sourceValues));
    if (!canReuse) {
        diningOptimizationBaselines.clear();
        diningOptimizationSession = {
            channelSignature,
            sourceValues: liveValues.slice(),
            resultValues: liveValues.slice()
        };
    }
    return diningOptimizationSession;
}

function scaleChannelValuesToPhotopicY(channels, values, targetY) {
    const source = Array.isArray(values) ? values.map(value => Math.max(0, Math.min(100, Number(value) || 0))) : [];
    if (!source.length || !(targetY > 0)) return source;
    const currentY = xyzFromSPD(combinedSPDFromValues(channels, source)).Y;
    if (!(currentY > 0)) return source;
    const maxValue = Math.max(...source);
    const requestedScale = targetY / currentY;
    const headroomScale = maxValue > 0 ? 100 / maxValue : 1;
    const scale = Math.min(requestedScale, headroomScale);
    return source.map(value => Number(Math.max(0, Math.min(100, value * scale)).toFixed(4)));
}

function fitDiningValuesToTarget(channels, preparedChannels, sourceValues, targetCct, targetXy) {
    let fittedValues = null;
    if (typeof SCENE_OPTIMIZER_CORE.fitChannelsToTarget === 'function') {
        fittedValues = SCENE_OPTIMIZER_CORE.fitChannelsToTarget(
            preparedChannels,
            targetCct,
            targetXy,
            sourceValues
        );
    } else {
        const fallback = optimizeChannelsToXy(targetXy, { channels, seedValues: sourceValues });
        fittedValues = fallback && fallback.values;
    }
    if (!Array.isArray(fittedValues) || fittedValues.length !== channels.length) return null;
    const sourceY = xyzFromSPD(combinedSPDFromValues(channels, sourceValues)).Y;
    return scaleChannelValuesToPhotopicY(channels, fittedValues, sourceY);
}

function synchronizeRequestedTarget(cct, duv) {
    if (!Number.isFinite(Number(cct)) || !Number.isFinite(Number(duv))) return;
    targetCCT = Math.round(Number(cct));
    targetDuv = Number(duv);
    syncCctAndDuvControls();
    scheduleUpdate();
}

function buildMaterialOptimizationSnapshot(channels, values, optimizationTarget) {
    const spd = combinedSPDFromValues(channels, values);
    const xy = xyFromSPD(spd);
    const cctDuv = SPECTRAL_MATH.estimateCctAndDuvFromXy
        ? SPECTRAL_MATH.estimateCctAndDuvFromXy(xy.x, xy.y)
        : { cct: estimateCCTFromXYZ(...Object.values(xyzFromSPD(spd))), duv: null };
    const quality = COLOUR_QUALITY.calculateColourQualityFromSpectrum
        ? COLOUR_QUALITY.calculateColourQualityFromSpectrum({ wavelengths, values: spd })
        : { ra: 0, r9: 0, rf: 0, rg: 0 };
    const target = optimizationTarget || { cct: targetCCT, duv: targetDuv, xy: getTargetXY(targetCCT, targetDuv) };
    const targetXy = target.xy;
    const xyz = xyzFromSPD(spd);
    return {
        spd: Array.from(spd),
        channels: channels.map((channel, index) => ({
            id: channel.id,
            name: channel.nameCN || channel.name || channel.id,
            value: Number(values[index] || 0)
        })),
        metrics: {
            cct: Number.isFinite(cctDuv?.cct) ? cctDuv.cct : 0,
            duv: Number.isFinite(cctDuv?.duv) ? cctDuv.duv : null,
            x: xy.x,
            y: xy.y,
            ra: quality.ra,
            r9: quality.r9,
            rf: quality.rf,
            rg: quality.rg,
            photopicY: xyz.Y,
            spectralPower: spd.reduce((sum, value) => sum + Number(value || 0), 0)
        },
        target: {
            cct: target.cct,
            duv: target.duv,
            x: targetXy.x,
            y: targetXy.y
        }
    };
}

function applyTransientProfileOverride(profile, override, level) {
    if (!profile || !override || typeof override !== 'object') return profile;
    const levelOverride = override.levels && override.levels[level] && typeof override.levels[level] === 'object'
        ? override.levels[level]
        : {};
    const allowedLevelFields = [
        'targetDeltaC', 'targetDeltaH', 'targetDeltaL',
        'maxAbsDeltaH', 'maxAbsDeltaL', 'maxDeltaE00'
    ];
    const merged = {
        ...profile,
        source: 'cuisine',
        importance: Number.isFinite(Number(override.importance)) ? Number(override.importance) : profile.importance,
        weights: Object.freeze(Object.assign({}, profile.weights, override.weights || {}))
    };
    allowedLevelFields.forEach(field => {
        if (Number.isFinite(Number(levelOverride[field]))) merged[field] = Number(levelOverride[field]);
    });
    return Object.freeze(merged);
}

function resolvedProfilesForMaterials(materials, level, sessionOverrides, transientOverrides, usePersistentOverrides = true) {
    if (typeof MATERIAL_PREFERENCE_PROFILES.resolveMaterialPreference !== 'function') return {};
    let persistent = {};
    try {
        persistent = usePersistentOverrides && typeof MATERIAL_PREFERENCE_PROFILES.loadOverrides === 'function'
            ? MATERIAL_PREFERENCE_PROFILES.loadOverrides(window.localStorage)
            : {};
    } catch (error) { /* local storage unavailable */ }
    const overrides = Object.assign({}, persistent, sessionOverrides || {});
    return Object.fromEntries(materials.map(material => {
        const resolved = MATERIAL_PREFERENCE_PROFILES.resolveMaterialPreference(material, level, overrides);
        const transient = transientOverrides && transientOverrides[material.id];
        return [material.id, applyTransientProfileOverride(resolved, transient, level)];
    }));
}

function scheduleMaterialOptimizationTask(task, fallbackDelayMs = 250) {
    let scheduled = false;
    let fallbackTimer = 0;
    const scheduleOnce = () => {
        if (scheduled) return;
        scheduled = true;
        if (fallbackTimer) clearTimeout(fallbackTimer);
        setTimeout(task, 0);
    };

    fallbackTimer = setTimeout(scheduleOnce, fallbackDelayMs);
    if (typeof requestAnimationFrame !== 'function') {
        scheduleOnce();
        return;
    }
    try {
        requestAnimationFrame(scheduleOnce);
    } catch (error) {
        scheduleOnce();
    }
}

function handleMaterialOptimizationRequest(event) {
    const request = event.detail || {};
    const goal = request.goal === 'fidelity' || request.mode === 'fidelity' ? 'fidelity' : 'preference';
    const level = ['soft', 'recommended', 'vivid'].includes(request.level) ? request.level : 'recommended';
    const cuisineProfileId = typeof request.cuisineProfileId === 'string' ? request.cuisineProfileId : '';
    const cuisineProfileName = typeof request.cuisineProfileName === 'string' ? request.cuisineProfileName : '';
    const isDiningOptimization = Boolean(cuisineProfileId);
    const targetMode = isDiningOptimization && request.targetMode === 'recommended' ? 'recommended' : 'current';
    const requestedCct = Number(request.targetCct);
    const requestedDuv = Number(request.targetDuv);
    const cctRange = Array.isArray(request.cctRange) && request.cctRange.length === 2
        ? request.cctRange.map(Number) : null;
    const recommendedCct = Number.isFinite(requestedCct) && (!cctRange ||
        (requestedCct >= cctRange[0] && requestedCct <= cctRange[1])) ? requestedCct : null;
    const resultContext = {
        cuisineProfileId,
        cuisineProfileName,
        targetMode
    };
    if (isMaterialOptimizing) {
        dispatchMaterialOptimizationResult({ goal, mode: goal, level, ...resultContext, error: '材质光色优化正在运行。' });
        return;
    }

    const materials = materialModelsById(request.materialIds, request.materialModels);
    if (!materials.length) {
        dispatchMaterialOptimizationResult({ goal, mode: goal, level, ...resultContext, error: '当前范围没有可用的材质反射率数据。' });
        return;
    }

    const channels = getActiveChannels();
    if (channels.length < 2) {
        dispatchMaterialOptimizationResult({ goal, mode: goal, level, ...resultContext, error: '至少需要两个可调通道才能优化材质光色。' });
        return;
    }

    stopCctJourney();
    stopSchedule();
    returnToRegularMode(goal === 'fidelity' ? '材质准确还原优化模式' : '材质偏好增强优化模式');
    const generation = ++materialOptimizationGeneration;
    isMaterialOptimizing = true;

    scheduleMaterialOptimizationTask(async () => {
            try {
                const preparedChannels = channels.map(channel => ({
                    id: channel.id,
                    peak: Number(channel.peak) || 560,
                    spd: Array.from(wavelengths, wavelength => getChannelSPDValue(channel, wavelength))
                }));
                const liveValues = channels.map(channel => channelValues[channel.id] || 0);
                let initialValues = liveValues;
                let materialBaseline = null;
                let diningBaseline = null;
                if (isDiningOptimization) {
                    const session = resolveDiningOptimizationSession(channels, liveValues);
                    const key = diningOptimizationKey(request, channels, materials);
                    const cached = diningOptimizationBaselines.get(key);
                    initialValues = session.sourceValues.slice();
                    if (cached && sameChannelValues(cached.initialValues, session.sourceValues)) {
                        diningBaseline = cached;
                    } else {
                        diningBaseline = {
                            initialValues: session.sourceValues.slice(),
                            resultValues: session.sourceValues.slice()
                        };
                        diningOptimizationBaselines.set(key, diningBaseline);
                    }
                } else {
                    const key = materialOptimizationKey(request, channels, materials);
                    const cached = materialOptimizationBaselines.get(key);
                    if (cached && sameChannelValues(liveValues, cached.resultValues)) {
                        initialValues = cached.initialValues.slice();
                        materialBaseline = cached;
                    } else {
                        materialBaseline = { initialValues: liveValues.slice(), resultValues: liveValues.slice() };
                        materialOptimizationBaselines.set(key, materialBaseline);
                    }
                }
                const activeBaseline = diningBaseline || materialBaseline;
                const initialSpd = combinedSPDFromValues(channels, initialValues);
                const initialXy = xyFromSPD(initialSpd);
                const initialEstimate = SPECTRAL_MATH.estimateCctAndDuvFromXy
                    ? SPECTRAL_MATH.estimateCctAndDuvFromXy(initialXy.x, initialXy.y) : null;
                const cachedReferenceCct = activeBaseline && Number.isFinite(activeBaseline.referenceCct)
                    ? activeBaseline.referenceCct : null;
                const cachedReferenceDuv = activeBaseline && Number.isFinite(activeBaseline.referenceDuv)
                    ? activeBaseline.referenceDuv : null;
                const referenceCct = targetMode === 'recommended' && recommendedCct
                    ? recommendedCct
                    : (cachedReferenceCct || Number(initialEstimate?.cct) ||
                        (Number.isFinite(Number(request.cct)) && Number(request.cct) > 0
                            ? Number(request.cct) : targetCCT));
                const referenceDuv = targetMode === 'recommended' && Number.isFinite(requestedDuv)
                    ? requestedDuv : (cachedReferenceDuv ?? (Number(initialEstimate?.duv) || 0));
                const targetXy = targetMode === 'recommended'
                    ? getTargetXY(referenceCct, referenceDuv)
                    : initialXy;
                const optimizationTarget = { cct: referenceCct, duv: referenceDuv, xy: targetXy };
                if (activeBaseline) {
                    activeBaseline.referenceCct = referenceCct;
                    activeBaseline.referenceDuv = referenceDuv;
                }
                resultContext.referenceCct = referenceCct;
                resultContext.referenceDuv = referenceDuv;
                const maxDeltaUpVp = 0.0015;
                const targetUpVp = CHROMATICITY_DIAGRAM.xyTo1976UpVp(targetXy.x, targetXy.y);
                const beforeSnapshot = buildMaterialOptimizationSnapshot(channels, initialValues, optimizationTarget);
                let optimizationInitialValues = initialValues.slice();
                if (targetMode === 'recommended') {
                    const fittedValues = fitDiningValuesToTarget(
                        channels,
                        preparedChannels,
                        initialValues,
                        referenceCct,
                        targetXy
                    );
                    if (!fittedValues) {
                        dispatchMaterialOptimizationResult({
                            goal,
                            mode: goal,
                            level,
                            ...resultContext,
                            improved: false,
                            applied: false,
                            recommendedTargetApplied: false,
                            materialCount: materials.length,
                            beforeSnapshot,
                            afterSnapshot: beforeSnapshot,
                            message: '当前通道无法生成菜系推荐色点的基础配方。'
                        });
                        return;
                    }
                    const fittedXy = xyFromSPD(combinedSPDFromValues(channels, fittedValues));
                    const fittedUpVp = CHROMATICITY_DIAGRAM.xyTo1976UpVp(fittedXy.x, fittedXy.y);
                    const fittedDeltaUpVp = Math.hypot(
                        fittedUpVp.up - targetUpVp.up,
                        fittedUpVp.vp - targetUpVp.vp
                    );
                    if (fittedDeltaUpVp > maxDeltaUpVp + 1e-12) {
                        const unavailableSnapshot = buildMaterialOptimizationSnapshot(channels, fittedValues, optimizationTarget);
                        dispatchMaterialOptimizationResult({
                            goal,
                            mode: goal,
                            level,
                            ...resultContext,
                            improved: false,
                            applied: false,
                            recommendedTargetApplied: false,
                            materialCount: materials.length,
                            beforeSnapshot,
                            optimizationBaselineSnapshot: unavailableSnapshot,
                            afterSnapshot: beforeSnapshot,
                            message: '当前通道无法在允许色差内达到菜系推荐色点。'
                        });
                        return;
                    }
                    optimizationInitialValues = fittedValues;
                }
                const optimizationBaselineSnapshot = buildMaterialOptimizationSnapshot(
                    channels,
                    optimizationInitialValues,
                    optimizationTarget
                );

                const evaluateMaterials = spd => materials.map(material =>
                    MATERIAL_COLOR.calculateMaterialDelta(spd, {
                        material,
                        cct: referenceCct,
                        referenceMode: 'auto'
                    })
                );
                const commonOptions = {
                    channels: preparedChannels,
                    initialValues: optimizationInitialValues,
                    targetXy,
                    maxDeltaUpVp,
                    valueQuantum: 0.1,
                    stepSizes: isDiningOptimization ? [8, 3, 1, 0.3] : [10, 4, 1, 0.3],
                    maxPasses: materials.length > 8 ? 1 : 2,
                    worstWeight: 0.35,
                    quantityFromSpd(spd) { return xyzFromSPD(spd).Y; },
                    maxRelativeQuantityError: 0.005,
                    xyFromSpd: xyFromSPD,
                    xyToUpVp: CHROMATICITY_DIAGRAM.xyTo1976UpVp
                };
                const profilesByMaterialId = goal === 'preference'
                    ? resolvedProfilesForMaterials(
                        materials,
                        level,
                        request.sessionOverrides,
                        request.profileOverridesByMaterialId,
                        !isDiningOptimization
                    )
                    : null;
                const result = goal === 'fidelity'
                    ? MATERIAL_OPTIMIZER.optimizeMaterialFidelity({
                        ...commonOptions,
                        rmsWeight: 0.10,
                        evaluateSpd(spd) {
                            return MATERIAL_OPTIMIZER.summarizeMaterialResults(evaluateMaterials(spd));
                        }
                    })
                    : MATERIAL_OPTIMIZER.optimizeMaterialPreference({
                        ...commonOptions,
                        profilesByMaterialId,
                        evaluateSpd: evaluateMaterials
                    });

                if (generation !== materialOptimizationGeneration) return;
                const spectralImproved = Boolean(
                    result.feasible &&
                    result.improved &&
                    Array.isArray(result.values) &&
                    result.values.length === channels.length
                );
                const recommendedTargetApplied = Boolean(result.feasible && targetMode === 'recommended');
                const applied = spectralImproved || recommendedTargetApplied;
                const finalValues = spectralImproved
                    ? result.values.slice()
                    : recommendedTargetApplied
                        ? optimizationInitialValues.slice()
                        : initialValues.slice();
                const afterSnapshot = buildMaterialOptimizationSnapshot(
                    channels,
                    finalValues,
                    optimizationTarget
                );

                if (!result.feasible) {
                    dispatchMaterialOptimizationResult({
                        goal,
                        mode: goal,
                        level,
                        ...resultContext,
                        improved: false,
                        applied: false,
                        recommendedTargetApplied: false,
                        materialCount: materials.length,
                        before: result.before,
                        after: result.after,
                        beforeSnapshot,
                        optimizationBaselineSnapshot,
                        afterSnapshot: beforeSnapshot,
                        message: goal === 'fidelity'
                            ? '当前通道在目标色点下没有可用的准确还原配方。'
                            : '当前通道在目标色点下没有可用的偏好增强配方。'
                    });
                    return;
                }

                if (recommendedTargetApplied) synchronizeRequestedTarget(referenceCct, referenceDuv);
                if (applied && !sameChannelValues(liveValues, finalValues)) {
                    const valuesById = {};
                    channels.forEach((channel, index) => {
                        valuesById[channel.id] = finalValues[index];
                    });
                    const renderVersion = applyValuesImmediate(valuesById);
                    await waitForBaseRender(renderVersion, 5000);
                    await waitForDeferredRender(renderVersion, 7000);
                    if (generation !== materialOptimizationGeneration) return;
                }
                if (activeBaseline) activeBaseline.resultValues = finalValues.slice();
                if (isDiningOptimization && applied && diningOptimizationSession) {
                    diningOptimizationSession.resultValues = finalValues.slice();
                }

                const beforePhotopicY = Number(beforeSnapshot.metrics.photopicY);
                const afterPhotopicY = Number(afterSnapshot.metrics.photopicY);
                const relativeOutputChangePercent = beforePhotopicY > 0 && Number.isFinite(afterPhotopicY)
                    ? (afterPhotopicY / beforePhotopicY - 1) * 100
                    : 0;
                const noImprovementMessage = recommendedTargetApplied
                    ? '已采用菜系推荐色点；当前目标色点下未找到额外的光谱优化收益。'
                    : goal === 'fidelity'
                        ? '当前色点和通道范围内未找到更低的综合色差。'
                        : '当前色点和通道范围内未找到更接近各材质偏好目标的配方。';
                dispatchMaterialOptimizationResult({
                    goal,
                    mode: goal,
                    level,
                    ...resultContext,
                    improved: spectralImproved,
                    applied,
                    recommendedTargetApplied,
                    before: result.before,
                    after: result.after,
                    beforeSnapshot,
                    optimizationBaselineSnapshot,
                    afterSnapshot,
                    perMaterial: result.perMaterial || [],
                    evaluations: result.evaluations,
                    materialCount: materials.length,
                    relativeOutputChangePercent,
                    message: spectralImproved ? '' : noImprovementMessage
                });
            } catch (error) {
                console.error('Material appearance optimization failed:', error);
                dispatchMaterialOptimizationResult({
                    goal,
                    mode: goal,
                    level,
                    ...resultContext,
                    error: '材质光色优化失败：' + (error && error.message ? error.message : '未知错误')
                });
            } finally {
                if (generation === materialOptimizationGeneration) isMaterialOptimizing = false;
            }
    });
}

document.addEventListener('spectral-material-optimization-request', handleMaterialOptimizationRequest);

function updateMetricCard(id, valueEl, barEl, newVal, oldVal, opts) {
    if (!valueEl || !barEl) return;
    valueEl.textContent = opts.format(newVal);
    const barScale = Math.max(0, Math.min(1, Number(opts.barFill) / 100));
    barEl.style.setProperty('--bar-scale', barScale.toFixed(4));
    barEl.style.setProperty('--bar-color', opts.barColor);
}

function updateMetricDelta(valueEl, value, baselineValue) {
    const text = METAMER_OPTIMIZER.formatRoundedMetricDelta(value, baselineValue);
    if (!text) return;

    const delta = Math.round(value - baselineValue);
    const deltaEl = document.createElement('span');
    deltaEl.className = `metric-delta metric-delta-${delta > 0 ? 'positive' : delta < 0 ? 'negative' : 'neutral'}`;
    deltaEl.textContent = text;
    valueEl.append(' ', deltaEl);
}

// ═══════════════════════════════════════════════
// UI: CHANNEL SLIDERS
// ═══════════════════════════════════════════════

function buildChannelSliders() {
    computeChannelChromaticities();
    const allChannels = getActiveChannels();

    // Initialize values for all channels
    for (const ch of allChannels) {
        if (channelValues[ch.id] === undefined) channelValues[ch.id] = importedChannels ? 100 : 0;
    }

    channelsContainer.innerHTML = '';

    // Use the current mode's channels
    for (const ch of allChannels) {
        const row = document.createElement('div');
        const value = channelValues[ch.id];
        const uiValue = Number(value.toFixed(1));
        row.className = 'channel-row';
        row.id = `ch-row-${ch.id}`;
        row.innerHTML = `
            <div class="channel-header">
                <span class="channel-label">
                    <span class="channel-dot" style="color: ${ch.color}; background: ${ch.color};"></span>
                    <span>${ch.nameCN || ch.name}</span>
                    <span class="channel-wavelength">${ch.waveLabel}</span>
                </span>
                <span class="channel-value" id="ch-val-${ch.id}" style="color: ${ch.color};">${channelDisplayValue(value)}%</span>
            </div>
            <input type="range" class="channel-slider" id="ch-slider-${ch.id}"
                   min="0" max="100" step="0.1" value="${uiValue}"
                   style="--ch-color: ${ch.color}; --slider-fill: ${uiValue}%;"
                   aria-label="${ch.nameCN || ch.name}通道输出">
        `;
        channelsContainer.appendChild(row);

        // Slider event
        const slider = row.querySelector('.channel-slider');
        slider.addEventListener('input', debounce(() => {
            cancelActiveSceneOptimization('Manual channel adjustment');
            clearPastelTarget('已改为手动通道调整；选择色卡可重新启用淡彩目标。');
            const val = parseFloat(slider.value);
            channelValues[ch.id] = val;
            document.getElementById(`ch-val-${ch.id}`).textContent = `${channelDisplayValue(val)}%`;
            slider.style.setProperty('--slider-fill', `${val}%`);
            scheduleUpdate();
        }, 8));
    }
}

function updateModeLabels() {
    if (importedChannels) {
        modeLabel4.textContent = `${importedChannels.length} 通道 SPD`;
        modeLabel6.textContent = '已导入';
        modeLabel4.classList.add('active');
        modeLabel6.classList.remove('active');
        return;
    }
    modeLabel4.textContent = '4 通道';
    modeLabel6.textContent = '6 通道 RGBCLA';
    modeLabel4.classList.toggle('active', currentMode === 4);
    modeLabel6.classList.toggle('active', currentMode === 6);
}

function setImportStatus(text, isError = false) {
    if (!spdImportStatus) return;
    spdImportStatus.textContent = text;
    spdImportStatus.style.color = isError ? '#ff7b7b' : '';
}

function parseSPDText(text, fileName = '导入的 SPD') {
    if (typeof SPD_IMPORT.parseSpdText !== 'function') {
        throw new Error('SPD 导入模块未加载。');
    }
    const parsed = SPD_IMPORT.parseSpdText(text, { minChannels: 3, maxChannels: 6 });
    const keepRelativePower = !preserveChannelPower || preserveChannelPower.checked;
    const normalizedSamples = SPECTRAL_MATH.normalizeImportedChannels
        ? SPECTRAL_MATH.normalizeImportedChannels(parsed.channelSamples, keepRelativePower)
        : parsed.channelSamples;

    return normalizedSamples.map((samples, c) => {
        const max = samples.reduce((value, sample) => Math.max(value, sample[1]), 0);
        if (max <= 1e-9) {
            throw new Error(`第 ${c + 1} 个通道没有有效功率数据。`);
        }
        let peakSample = samples[0];
        for (const sample of samples) {
            if (sample[1] > peakSample[1]) peakSample = sample;
        }
        const headerName = parsed.headers[c + 1] && parsed.headers[c + 1].trim();
        const isWhiteChannel = /^(w|ww|cw|nw|white|warm\s*white|cool\s*white|neutral\s*white)$/i.test(headerName || '');
        const color = isWhiteChannel ? '#d4a12a' : IMPORT_COLORS[c % IMPORT_COLORS.length];
        return {
            id: `imported-${c + 1}`,
            name: headerName || `Channel ${c + 1}`,
            nameCN: `通道${c + 1}`,
            peak: peakSample[0],
            sigma: null,
            color,
            colorRGB: isWhiteChannel ? [212,161,42] : IMPORT_COLOR_RGB[c % IMPORT_COLOR_RGB.length],
            waveLabel: isWhiteChannel ? (headerName || 'W') : `${Math.round(peakSample[0])} nm`,
            spdSamples: samples,
            isWhiteChannel,
            imported: true,
            sourceName: fileName
        };
    });
}

function loadImportedChannels(channels, fileName) {
    cancelActiveSceneOptimization('Imported SPD changed');
    clearPastelTarget();
    returnToRegularMode('已导入通道，当前为常规模式。');
    importedChannels = channels;
    importedSourceName = fileName;
    currentMode = channels.length;
    channelValues = {};
    for (const ch of importedChannels) channelValues[ch.id] = 100;
    updateModeLabels();
    buildChannelSliders();
    const calibration = !preserveChannelPower || preserveChannelPower.checked ? '保留相对功率' : '各通道峰值归一化';
    setImportStatus(`已导入 ${channels.length} 通道：${fileName}（${calibration}）`);
    scheduleUpdate();
}

function updateEmitterPreview(combined, metrics) {
    if (!emitterPreview || !emitterDisc) return;
    const xyz = xyzFromSPD(combined);
    const total = xyz.X + xyz.Y + xyz.Z;
    if (!(total > 1e-10)) {
        emitterPreview.classList.add('is-off');
        emitterDisc.style.removeProperty('--emitter-colour');
        emitterDisc.setAttribute('aria-label', '当前没有光谱输出');
        if (emitterPreviewStatus) emitterPreviewStatus.textContent = '无输出';
        if (emitterPreviewCct) emitterPreviewCct.textContent = '-- K';
        return;
    }

    const x = xyz.X / total;
    const y = xyz.Y / total;
    const display = SPECTRAL_MATH.xyzToDisplaySrgb
        ? SPECTRAL_MATH.xyzToDisplaySrgb(xyz.X, xyz.Y, xyz.Z)
        : { css: '#f4ead6' };
    emitterPreview.classList.remove('is-off');
    emitterDisc.style.setProperty('--emitter-colour', display.css);
    emitterDisc.setAttribute('aria-label', `当前混合光色，${Math.round(metrics.cct)} K`);
    if (emitterPreviewStatus) emitterPreviewStatus.textContent = '实时';
    if (emitterPreviewCct) emitterPreviewCct.textContent = `${Math.round(metrics.cct).toLocaleString()} K`;
}

function updateEmitterPreviewFast(combined) {
    const xyz = xyzFromSPD(combined);
    const total = xyz.X + xyz.Y + xyz.Z;
    const cct = total > 1e-10 ? estimateCCTFromXYZ(xyz.X, xyz.Y, xyz.Z) : 0;
    updateEmitterPreview(combined, { cct });
    if (emitterPreviewStatus && total > 1e-10) emitterPreviewStatus.textContent = '更新中';
}

function buildCurrentRecipeDocument(timestamp = new Date()) {
    const channels = getActiveChannels();
    const combined = getCombinedSPD();
    const metrics = calculateMetrics(combined);
    const xy = xyFromSPD(combined);
    const upvp1976 = CHROMATICITY_DIAGRAM.xyTo1976UpVp(xy.x, xy.y);
    const cctDuv = SPECTRAL_MATH.estimateCctAndDuvFromXy
        ? SPECTRAL_MATH.estimateCctAndDuvFromXy(xy.x, xy.y)
        : { cct: metrics.cct, duv: null };
    const maxPower = Math.max(...combined, 0);
    const normalizedSpd = Array.from(combined, value => maxPower > 0 ? value / maxPower : 0);

    return RECIPE_EXPORT.buildRecipeDocument({
        exportedAt: timestamp.toISOString(),
        buildInfo: BUILD_INFO.getBuildInfo(),
        source: importedSourceName || `${channels.length}-channel built-in model`,
        targets: {
            cctK: targetCCT,
            duv: targetDuv,
            eyeIlluminanceLux: eyeIlluminance,
            sameColourPointMode: metamerModeEnabled,
            metamerProfile: metamerModeEnabled ? metamerProfile : null,
            targetRg: metamerModeEnabled ? targetRg : null
        },
        result: {
            cctK: Math.round(cctDuv.cct || metrics.cct),
            duv: Number.isFinite(cctDuv.duv) ? cctDuv.duv : null,
            x: xy.x,
            y: xy.y,
            up: upvp1976.up,
            vp: upvp1976.vp,
            ra: metrics.ra,
            r9: metrics.r9,
            rf: metrics.rf,
            rg: metrics.rg
        },
        circadian: {
            cla2: metrics.cla,
            cs: metrics.cs,
            exposureDurationHours,
            visualFieldFactor,
            blueYellowState: metrics.blueYellowState
        },
        melanopic: {
            der: metrics.melanopicDER,
            ediLux: metrics.melanopicEDI
        },
        channels: channels.map(channel => ({
            id: channel.id,
            name: channel.name,
            nominalWavelength: channel.waveLabel || null,
            drivePercent: channelValues[channel.id] || 0
        })),
        wavelengths: Array.from(wavelengths),
        normalizedSpd
    });
}

function exportCurrentRecipe() {
    const timestamp = new Date();
    const stamp = timestamp.toISOString().replace(/[:.]/g, '-');
    const recipe = buildCurrentRecipeDocument(timestamp);
    RECIPE_EXPORT.downloadJsonFile(`spectral-recipe-${stamp}.json`, recipe);
}

function recipeModeLabel() {
    const pastelActive = Boolean(colourTuningGroup?.classList.contains('is-pastel-target'));
    if (pastelActive) return '淡彩光';
    if (metamerProfile === 'fidelity') return '高显色';
    if (metamerProfile === 'saturation') return '高饱和';
    return '常规';
}

function createRecipeExportContext() {
    const channels = getActiveChannels().slice();
    const saturationTarget = Number.isFinite(targetRg) && targetRg >= 105 ? targetRg : 120;
    return {
        channels,
        workerChannels: metamerOptimizerChannels(channels),
        wavelengths: Array.from(wavelengths),
        source: importedSourceName || `${channels.length}-channel built-in model`,
        defaultIlluminanceLux: eyeIlluminance,
        exposureDurationHours,
        visualFieldFactor,
        targetRg: saturationTarget,
        pastelSamples: Array.isArray(window.PASTEL_PALETTE?.samples)
            ? window.PASTEL_PALETTE.samples.slice()
            : [],
        scheduleStages: scheduleStagesFromUi().map(stage => ({ ...stage })),
        current: {
            targetCctK: targetCCT,
            targetDuv,
            illuminanceLux: eyeIlluminance,
            mode: recipeModeLabel(),
            channelPercents: Object.fromEntries(channels.map(channel => [channel.id, channelValues[channel.id] || 0]))
        }
    };
}

function calculateRecipeMetrics(combined, context, illuminanceLux) {
    const base = calculateMetrics(combined);
    const lux = Number.isFinite(Number(illuminanceLux)) ? Number(illuminanceLux) : context.defaultIlluminanceLux;
    const circadian = calculateCLA2({
        wavelengths,
        values: combined,
        illuminanceLux: lux,
        durationHours: context.exposureDurationHours,
        fieldFactor: context.visualFieldFactor
    });
    return {
        ...base,
        melanopicEDI: lux * base.melanopicDER,
        cla: circadian.cla,
        cs: circadian.cs
    };
}

function buildRecipeFromValues(context, options) {
    const values = Array.isArray(options.values)
        ? options.values.map(value => Math.max(0, Math.min(100, Number(value) || 0)))
        : context.channels.map(channel => Number(options.channelPercents?.[channel.id]) || 0);
    const combined = combinedSPDFromValues(context.channels, values);
    const xy = xyFromSPD(combined);
    const upvp1976 = CHROMATICITY_DIAGRAM.xyTo1976UpVp(xy.x, xy.y);
    const estimate = SPECTRAL_MATH.estimateCctAndDuvFromXy
        ? SPECTRAL_MATH.estimateCctAndDuvFromXy(xy.x, xy.y)
        : { cct: computeCCTFromValues(context.channels, values), duv: null };
    const metrics = calculateRecipeMetrics(combined, context, options.illuminanceLux);
    const maxPower = Math.max(...combined, 0);
    const normalizedSpd = Array.from(combined, value => maxPower > 0 ? value / maxPower : 0);
    const targetXy = options.targetXy || (
        Number.isFinite(options.targetCctK) && Number.isFinite(options.targetDuv)
            ? getTargetXY(options.targetCctK, options.targetDuv)
            : null
    );
    const fitDeltaUv = Number.isFinite(options.fitDeltaUv)
        ? options.fitDeltaUv
        : targetXy
            ? (() => {
                const actualUv = xyToUv(xy.x, xy.y);
                const expectedUv = xyToUv(targetXy.x, targetXy.y);
                return Math.hypot(actualUv.u - expectedUv.u, actualUv.v - expectedUv.v);
            })()
            : null;
    let status = options.status || '完成';
    if (!options.status && Number.isFinite(fitDeltaUv)) {
        if (options.mode === '淡彩光') {
            status = fitDeltaUv <= 0.003 ? '完成' : fitDeltaUv <= 0.01 ? '最接近结果' : '超出当前色域';
        } else if (fitDeltaUv > 0.003) status = '最接近结果';
    }
    const channelPercents = {};
    context.channels.forEach((channel, index) => {
        channelPercents[channel.id] = values[index];
    });
    return {
        id: options.id,
        name: options.name,
        mode: options.mode,
        targets: {
            cctK: Number.isFinite(options.targetCctK) ? options.targetCctK : null,
            duv: Number.isFinite(options.targetDuv) ? options.targetDuv : null,
            illuminanceLux: Number.isFinite(options.illuminanceLux)
                ? options.illuminanceLux
                : context.defaultIlluminanceLux,
            startTime: options.startTime || '',
            transitionMinutes: Number.isFinite(options.transitionMinutes) ? options.transitionMinutes : null
        },
        result: {
            cctK: Number.isFinite(estimate.cct) ? Math.round(estimate.cct) : metrics.cct,
            duv: Number.isFinite(estimate.duv) ? estimate.duv : metrics.duv,
            x: xy.x,
            y: xy.y,
            up: upvp1976.up,
            vp: upvp1976.vp
        },
        metrics: {
            ra: metrics.ra,
            r9: metrics.r9,
            rf: metrics.rf,
            rg: metrics.rg,
            melanopicDer: metrics.melanopicDER,
            melanopicEdiLux: metrics.melanopicEDI,
            cla2: metrics.cla,
            cs: metrics.cs
        },
        channelPercents,
        rawSpd: Array.from(combined),
        normalizedSpd,
        fitDeltaUv,
        status,
        note: options.note || '',
        values,
        baseRecipeId: options.baseRecipeId || '',
        brightnessPercent: Number.isFinite(options.brightnessPercent) ? options.brightnessPercent : null,
        brightnessModel: options.brightnessModel || '',
        calibrationStatus: options.calibrationStatus || '',
        spectralReferenceId: options.spectralReferenceId || ''
    };
}

function buildSingleRecipe(context) {
    const values = context.channels.map(channel => context.current.channelPercents[channel.id] || 0);
    return buildRecipeFromValues(context, {
        id: 'CURRENT',
        name: '当前目标点',
        mode: context.current.mode,
        values,
        targetCctK: context.current.targetCctK,
        targetDuv: context.current.targetDuv,
        illuminanceLux: context.current.illuminanceLux
    });
}

function buildRegularRecipe(context, cctK) {
    const solved = optimizeValuesForScene(context.channels, cctK, 0, '', { skipColourQuality: true });
    return buildRecipeFromValues(context, {
        id: `STD-${cctK}`,
        name: `常规 ${cctK} K`,
        mode: '常规',
        values: solved.values,
        targetCctK: cctK,
        targetDuv: 0,
        illuminanceLux: context.defaultIlluminanceLux
    });
}

async function buildMetamerRecipe(context, profile, cctK, baselineRecipe, seedValues) {
    const saturation = profile === 'saturation';
    const mode = saturation ? '高饱和' : '高显色';
    const prefix = saturation ? 'SAT' : 'FID';
    const baselineValues = context.channels.map(channel => baselineRecipe.channelPercents[channel.id] || 0);
    const targetXy = saturation
        ? getTargetXY(cctK, 0)
        : { x: baselineRecipe.result.x, y: baselineRecipe.result.y };
    const result = await calculateMetamerOptimization({
        channels: context.workerChannels,
        baselineValues,
        seedValues: Array.isArray(seedValues) ? seedValues : baselineValues,
        targetXy,
        targetRg: saturation ? context.targetRg : 100,
        objective: profile,
        searchProfile: 'batch'
    });
    const hasResult = Boolean(result?.feasible && Array.isArray(result.values));
    const values = hasResult ? result.values : baselineValues;
    return buildRecipeFromValues(context, {
        id: `${prefix}-${cctK}`,
        name: `${mode} ${cctK} K`,
        mode,
        values,
        targetCctK: cctK,
        targetDuv: 0,
        targetXy,
        illuminanceLux: context.defaultIlluminanceLux,
        fitDeltaUv: Number.isFinite(result?.deltaUv) ? result.deltaUv : baselineRecipe.fitDeltaUv,
        status: hasResult ? undefined : '最接近结果',
        note: hasResult
            ? (saturation && result.qualityLevel === 'warning' ? '达到目标饱和度附近，显色质量处于警示区间。' : '')
            : '当前通道模型未找到满足约束的同色异谱解，保留常规配方。'
    });
}

function buildPastelRecipe(context, sample, seedValues) {
    const result = optimizeChannelsToXy(sample.xy, {
        channels: context.channels,
        seedValues
    });
    const values = result?.values || context.channels.map(() => 0);
    return buildRecipeFromValues(context, {
        id: sample.id,
        name: `${sample.id} ${sample.name}`,
        mode: '淡彩光',
        values,
        targetXy: sample.xy,
        illuminanceLux: context.defaultIlluminanceLux,
        fitDeltaUv: result?.error,
        status: result ? undefined : '计算失败',
        note: result ? `目标色样 RGB(${sample.rgb.join(', ')})` : '未生成有效淡彩配方。'
    });
}

function buildSceneRecipe(context, stage) {
    const scene = CCT_JOURNEY.sceneById(stage.sceneId);
    if (!scene) {
        return buildRecipeFromValues(context, {
            id: `SCENE-${stage.id}`,
            name: stage.labelZh,
            mode: '情景模式',
            values: context.channels.map(() => 0),
            illuminanceLux: 0,
            startTime: stage.time,
            transitionMinutes: 30,
            status: '计算失败',
            note: '未找到对应情景参数。'
        });
    }
    const solved = optimizeValuesForScene(
        context.channels,
        scene.cctK,
        scene.duv || 0,
        scene.emphasis,
        { skipColourQuality: true }
    );
    return buildRecipeFromValues(context, {
        id: `SCENE-${stage.id.toUpperCase()}`,
        name: stage.labelZh,
        mode: '情景模式',
        values: solved.values,
        targetCctK: scene.cctK,
        targetDuv: scene.duv || 0,
        illuminanceLux: scene.illuminanceLux,
        startTime: stage.time,
        transitionMinutes: 30,
        note: scene.emphasis || ''
    });
}

function buildBrightnessRecipe(context, baseRecipe, brightnessPercent) {
    const percent = Math.max(1, Math.min(100, Math.round(Number(brightnessPercent) || 0)));
    const factor = percent / 100;
    const baseValues = Array.isArray(baseRecipe?.values)
        ? baseRecipe.values
        : context.channels.map(channel => Number(baseRecipe?.channelPercents?.[channel.id]) || 0);
    const values = baseValues.map(value => Math.max(0, Math.min(100, value * factor)));
    const channelPercents = {};
    context.channels.forEach((channel, index) => {
        channelPercents[channel.id] = values[index];
    });
    const baseIlluminance = Number.isFinite(Number(baseRecipe?.targets?.illuminanceLux))
        ? Number(baseRecipe.targets.illuminanceLux)
        : context.defaultIlluminanceLux;
    const scaledIlluminance = baseIlluminance * factor;
    const baseSpectrum = Array.isArray(baseRecipe?.rawSpd) && baseRecipe.rawSpd.length
        ? baseRecipe.rawSpd
        : baseRecipe?.normalizedSpd || [];
    const rawSpd = Array.from(baseSpectrum, value => Number(value || 0) * factor);
    const basePeak = Math.max(...baseSpectrum, 0);
    const brightnessSpd = rawSpd.map(value => basePeak > 0 ? value / basePeak : 0);
    const circadian = calculateCLA2({
        wavelengths,
        values: baseSpectrum,
        illuminanceLux: scaledIlluminance,
        durationHours: context.exposureDurationHours,
        fieldFactor: context.visualFieldFactor
    });
    const brightnessCode = String(percent).padStart(3, '0');
    const brightnessRecipeId = `${baseRecipe.id}-B${brightnessCode}`;
    const model = '固定通道SPD同比例缩放';
    const calibrationStatus = '未导入分级实测SPD';
    return {
        id: brightnessRecipeId,
        name: `${baseRecipe.name} · ${percent}%`,
        mode: baseRecipe.mode,
        targets: {
            ...(baseRecipe.targets || {}),
            illuminanceLux: scaledIlluminance
        },
        result: { ...(baseRecipe.result || {}) },
        metrics: {
            ...(baseRecipe.metrics || {}),
            melanopicEdiLux: scaledIlluminance * (Number(baseRecipe?.metrics?.melanopicDer) || 0),
            cla2: circadian.cla,
            cs: circadian.cs
        },
        channelPercents,
        rawSpd,
        normalizedSpd: Array.from(baseRecipe?.normalizedSpd || []),
        fitDeltaUv: baseRecipe.fitDeltaUv,
        status: baseRecipe.status || '完成',
        note: `${model}；${calibrationStatus}。该亮度节点需结合灯具实测调光曲线复核。`,
        values,
        baseRecipeId: baseRecipe.id,
        brightnessPercent: percent,
        brightnessModel: model,
        calibrationStatus,
        spectralReferenceId: brightnessRecipeId,
        brightnessSpd,
        spectralScaleBasis: '基础配方100%峰值=1'
    };
}

function cancelRecipeExportOptimization() {
    if (metamerWorkerClient) metamerWorkerClient.cancel('Batch recipe export cancelled');
}

async function handleSPDImport(file) {
    if (!file) return;
    try {
        const text = await file.text();
        const channels = parseSPDText(text, file.name);
        loadImportedChannels(channels, file.name);
    } catch (error) {
        setImportStatus(error.message || '导入失败，请检查文件格式。', true);
    } finally {
        if (spdImportInput) spdImportInput.value = '';
    }
}

if (spdImportBtn && spdImportInput) {
    spdImportBtn.addEventListener('click', () => spdImportInput.click());
    spdImportInput.addEventListener('change', () => handleSPDImport(spdImportInput.files && spdImportInput.files[0]));
}

window.addEventListener('dragover', event => {
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
});

window.addEventListener('drop', event => {
    event.preventDefault();
    if (cctAnimation.status !== 'stopped') return;
    const file = event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files[0];
    if (!file) return;
    if (!/\.(csv|txt|tsv)$/i.test(file.name)) {
        setImportStatus('请拖入 CSV、TXT 或 TSV 格式的通道 SPD 文件。', true);
        return;
    }
    handleSPDImport(file);
});

// ═══════════════════════════════════════════════
// MODE TOGGLE
// ═══════════════════════════════════════════════

modeCheckbox.addEventListener('change', () => {
    cancelActiveSceneOptimization('Channel mode changed');
    returnToRegularMode('常规模式');
    importedChannels = null;
    importedSourceName = '';
    setImportStatus('已切换回内置模拟通道');
    currentMode = modeCheckbox.checked ? 6 : 4;
    const nextChannels = getActiveChannels();
    const seedValues = optimizerSeedForTarget(nextChannels, 0.25, targetCCT);
    channelValues = Object.fromEntries(nextChannels.map((channel, index) => [
        channel.id,
        seedValues[index]
    ]));
    updateModeLabels();
    buildChannelSliders();
    scheduleUpdate();
    runRealtimeOptimizer();
});

// Init mode labels
updateModeLabels();

// D65 toggle
d65Toggle.addEventListener('change', () => {
    showD65 = d65Toggle.checked;
    scheduleUpdate();
});

document.addEventListener('spectral-professional-overlay-change', () => renderSPD());
document.addEventListener('spectral-professional-curves-ready', () => {
    scheduleUpdate();
});

// ═══════════════════════════════════════════════
// PRESETS
// ═══════════════════════════════════════════════

const PRESETS = {
    d50:      { reference: 'd50' },
    d55:      { reference: 'd55' },
    daylight: { reference: 'd65' },
    d75:      { reference: 'd75' },
    warm:     {
        valuesByMode: {
            4: { red: 93, green: 18, blue: 6, warmwhite: 80 },
            6: { red: 67, green: 4, blue: 9, cyan: 40, lime: 29, amber: 34 }
        }
    },
    cool:     {
        valuesByMode: {
            4: { red: 78, green: 67, blue: 77, warmwhite: 16 },
            6: { red: 90, green: 77, blue: 90, cyan: 35, lime: 7, amber: 33 }
        }
    },
    reset:    { values: { red: 0,  green: 0,  blue: 0,  warmwhite: 0,  cyan: 0,  lime: 0,  amber: 0  } }
};

function getPlanckianSPD(T) {
    if (typeof SPECTRAL_MATH.blackbodySpd === 'function') {
        return Float64Array.from(SPECTRAL_MATH.blackbodySpd(T, wavelengths));
    }
    const spd = new Float64Array(NUM_POINTS);
    const c2 = 1.438776877e7;
    for (let i = 0; i < NUM_POINTS; i++) {
        const l = wavelengths[i];
        spd[i] = 1.0 / (Math.pow(l, 5) * Math.expm1(c2 / (l * T)));
    }
    const maxVal = Math.max(...spd);
    if (maxVal > 0) {
        for (let i = 0; i < NUM_POINTS; i++) spd[i] /= maxVal;
    }
    return spd;
}

document.querySelectorAll('.preset-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const presetKey = btn.dataset.preset;
        if (!presetKey) return;
        cancelActiveSceneOptimization('Preset changed');
        clearPastelTarget();
        
        // 1. Reset check
        if (presetKey === 'reset') {
            returnToRegularMode('已重置为无输出状态。');
            const values = {};
            const channels = getActiveChannels();
            for (const ch of channels) values[ch.id] = 0;
            animateToValues(values);
            return;
        }

        // 2. Dynamic CCT preset check (e.g. cct-1600)
        if (presetKey.startsWith('cct-')) {
            const cct = parseInt(presetKey.replace('cct-', ''));
            if (Number.isFinite(cct)) {
                targetCCT = cct;
                targetDuv = 0;
                syncCctAndDuvControls();
                applyTargetOptimization();
                return;
            }
        }

        // 3. Static references check (e.g. d50, daylight)
        const preset = PRESETS[presetKey];
        if (!preset) return;
        if (preset.reference) {
            const fitted = fitChannelsToReference(CIE_DATA[preset.reference]);
            animateToValues(fitted);
            return;
        }
        const values = (preset.valuesByMode ? (preset.valuesByMode[currentMode] || preset.valuesByMode[4]) : preset.values) || {};
        animateToValues(values);
    });
});



function fitChannelsToReference(referenceSPD, explicitChannels = null) {
    const channels = Array.isArray(explicitChannels) && explicitChannels.length
        ? explicitChannels
        : getActiveChannels();
    if (!referenceSPD || !referenceSPD.length || !channels.length) {
        return {};
    }
    if (typeof SCENE_OPTIMIZER_CORE.fitChannelsToReference === 'function') {
        const values = SCENE_OPTIMIZER_CORE.fitChannelsToReference(
            metamerOptimizerChannels(channels),
            Array.from(referenceSPD)
        );
        const result = {};
        channels.forEach((channel, index) => { result[channel.id] = values[index]; });
        return result;
    }

    const target = normalizeArray(referenceSPD);
    const targetXy = xyFromSPD(referenceSPD);
    const n = channels.length;

    function loss(vals) {
        const rawCombined = combinedSPDFromValues(channels, vals);
        const combined = normalizeArray(rawCombined);
        const xy = xyFromSPD(rawCombined);
        let sum = 0;
        let weightSum = 0;
        for (let i = 0; i < NUM_POINTS; i += 2) {
            const wavelength = wavelengths[i];
            const visibleWeight = wavelength >= 420 && wavelength <= 700 ? 1 : 0.45;
            const diff = combined[i] - target[i];
            sum += diff * diff * visibleWeight;
            weightSum += visibleWeight;
        }
        const spectralLoss = sum / Math.max(1, weightSum);
        const xyLoss = (xy.x - targetXy.x) ** 2 + (xy.y - targetXy.y) ** 2;
        return spectralLoss + xyLoss * 650;
    }

    const seeds = [
        Array.from({ length: n }, () => 50),
        Array.from({ length: n }, () => 100),
        Array.from({ length: n }, () => 25),
        channels.map(ch => {
            const peak = ch.peak || 560;
            if (peak < 480) return 72;
            if (peak < 545) return 58;
            if (peak < 600) return 42;
            return 30;
        }),
        channels.map(ch => {
            const peak = ch.peak || 560;
            if (peak < 480) return 35;
            if (peak < 545) return 46;
            if (peak < 600) return 60;
            return 52;
        })
    ];

    let bestValues = seeds[0].slice();
    let bestLoss = Infinity;

    for (const seed of seeds) {
        const values = seed.slice(0, n);
        let currentLoss = loss(values);
        let step = 34;

        for (let round = 0; round < 12; round++) {
            let improved = false;
            for (let c = 0; c < n; c++) {
                const original = values[c];
                let channelBestValue = original;
                let channelBestLoss = currentLoss;
                const candidates = [
                    Math.max(0, original - step),
                    Math.min(100, original + step),
                    Math.max(0, original - step * 0.5),
                    Math.min(100, original + step * 0.5),
                    Math.max(0, original - step * 0.25),
                    Math.min(100, original + step * 0.25)
                ];
                for (const candidate of candidates) {
                    values[c] = candidate;
                    const candidateLoss = loss(values);
                    if (candidateLoss + 1e-10 < channelBestLoss) {
                        channelBestLoss = candidateLoss;
                        channelBestValue = candidate;
                        improved = true;
                    }
                }
                values[c] = channelBestValue;
                currentLoss = channelBestLoss;
            }
            if (!improved) step *= 0.5;
            if (step < 0.35) break;
        }

        if (currentLoss < bestLoss) {
            bestLoss = currentLoss;
            bestValues = values.slice();
        }
    }

    const maxValue = Math.max(...bestValues);
    if (maxValue > 0 && maxValue < 98) {
        const scale = 98 / maxValue;
        for (let c = 0; c < n; c++) {
            bestValues[c] = Math.min(100, bestValues[c] * scale);
        }
    }

    const result = {};
    for (let c = 0; c < n; c++) {
        result[channels[c].id] = Number(Math.max(0, Math.min(100, bestValues[c])).toFixed(4));
    }
    return result;
}

function animateToValues(targetValues, duration = 220) {
    if (animFrameId !== null) {
        cancelAnimationFrame(animFrameId);
        animFrameId = null;
    }
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || duration <= 0) {
        applyValuesImmediate(targetValues);
        return;
    }
    const channels = getActiveChannels();
    const startValues = {};
    for (const ch of channels) {
        startValues[ch.id] = channelValues[ch.id] || 0;
    }

    const startTime = performance.now();

    function animate(now) {
        const t = Math.min((now - startTime) / duration, 1);
        const eased = easeInOutValue(t);

        for (const ch of channels) {
            const target = targetValues[ch.id] !== undefined ? targetValues[ch.id] : channelValues[ch.id];
            const interpolated = startValues[ch.id] + (target - startValues[ch.id]) * eased;
            const val = t === 1 ? target : Math.round(interpolated);
            channelValues[ch.id] = val;

            const slider = document.getElementById(`ch-slider-${ch.id}`);
            const label = document.getElementById(`ch-val-${ch.id}`);
            if (slider) {
                slider.value = val;
                slider.style.setProperty('--slider-fill', `${val}%`);
            }
            if (label) label.textContent = `${val}%`;
        }

        scheduleUpdate();

        if (t < 1) {
            animFrameId = requestAnimationFrame(animate);
        } else {
            animFrameId = null;
            applyValuesImmediate(targetValues);
        }
    }

    animFrameId = requestAnimationFrame(animate);
}

function easeInOutValue(progress) {
    const x1 = 0.77;
    const x2 = 0.175;
    const sample = (t, a1, a2) => 3 * (1 - t) * (1 - t) * t * a1 + 3 * (1 - t) * t * t * a2 + t * t * t;
    const slope = (t, a1, a2) => 3 * (1 - t) * (1 - t) * a1 + 6 * (1 - t) * t * (a2 - a1) + 3 * t * t * (1 - a2);
    let t = progress;
    for (let iteration = 0; iteration < 5; iteration++) {
        const currentSlope = slope(t, x1, x2);
        if (Math.abs(currentSlope) < 1e-6) break;
        t -= (sample(t, x1, x2) - progress) / currentSlope;
        t = Math.max(0, Math.min(1, t));
    }
    return sample(t, 0, 1);
}

// ═══════════════════════════════════════════════
// AI OPTIMIZER
// ═══════════════════════════════════════════════

function computeCCTFromValues(channels, values) {
    const spd = combinedSPDFromValues(channels, values);
    const { X, Y, Z } = xyzFromSPD(spd);
    return estimateCCTFromXYZ(X, Y, Z);
}

function optimizerSeedForTarget(channels, targetCS, targetCCT = 4000) {
    return channels.map(ch => {
        const peak = ch.peak || (ch.isWarmWhite ? 575 : 560);
        if (targetCCT >= 4800) {
            if (peak < 485) return 62;
            if (peak < 545) return 58;
            if (peak < 585) return 46;
            return 28;
        }
        if (targetCCT >= 3800) {
            if (peak < 485) return 44;
            if (peak < 545) return 52;
            if (peak < 585) return 54;
            return 42;
        }
        if (targetCCT >= 3000) {
            if (peak < 485) return 22;
            if (peak < 545) return 34;
            if (peak < 600) return 58;
            return 68;
        }
        if (peak < 485) return 6;
        if (peak < 545) return 12;
        if (peak < 600) return 44;
        return 88;
    });
}

function radicalInverse(index, base) {
    let fraction = 1;
    let value = 0;
    while (index > 0) {
        fraction /= base;
        value += fraction * (index % base);
        index = Math.floor(index / base);
    }
    return value;
}

function prioritizeColourFidelity(channels, solution, targetCCT, targetDuv) {
    if (channels.length < 3) return solution;
    if (channels.length <= 4) return solution;

    const targetXy = getTargetXY(targetCCT, targetDuv);
    const targetUv = xyToUv(targetXy.x, targetXy.y);
    const primes = [2, 3, 5, 7, 11, 13];
    const colourPointCandidates = [];
    let sequence = 0;
    let best = null;

    function collect(values) {
        const spd = combinedSPDFromValues(channels, values);
        const xy = xyFromSPD(spd);
        const uv = xyToUv(xy.x, xy.y);
        const deltaUv = Math.hypot(uv.u - targetUv.u, uv.v - targetUv.v);
        if (!Number.isFinite(deltaUv) || deltaUv > METAMER_CHROMATICITY_TOLERANCE) return;
        colourPointCandidates.push({
            values: values.slice(),
            xy,
            deltaUv,
            sequence: sequence++
        });
    }

    function evaluate(candidate) {
        const spd = combinedSPDFromValues(channels, candidate.values);
        const metrics = calculateMetrics(spd);
        if (!Number.isFinite(metrics.ra) || !Number.isFinite(metrics.r9) ||
            !Number.isFinite(metrics.rf) || metrics.rf < 80) return;
        const ranked = {
            values: candidate.values,
            ra: metrics.ra,
            r9: metrics.r9,
            rf: metrics.rf,
            xy: candidate.xy
        };
        if (METAMER_OPTIMIZER.isBetterColourCandidate(ranked, best,
            { mode: 'fidelity', r9Floor: 50 })) best = ranked;
    }

    collect(solution.values);
    for (let sample = 1; sample <= 8192; sample++) {
        const globalValues = channels.map((channel, index) => radicalInverse(sample, primes[index]) * 100);
        collect(globalValues);

        const localValues = channels.map((channel, index) => Math.max(0, Math.min(100,
            solution.values[index] + (radicalInverse(sample, primes[index]) - 0.5) * 120)));
        collect(localValues);
    }

    const shortlist = CANDIDATE_SHORTLIST.selectCandidateShortlist(colourPointCandidates, {
        maxCandidates: 512,
        precisionFraction: 0.5
    });
    const baselineCandidate = colourPointCandidates[0];
    if (baselineCandidate && !shortlist.includes(baselineCandidate)) shortlist.unshift(baselineCandidate);
    shortlist.forEach(evaluate);

    if (!best) return solution;
    return {
        values: best.values,
        cct: computeCCTFromValues(channels, best.values),
        error: Math.hypot(best.xy.x - targetXy.x, best.xy.y - targetXy.y)
    };
}

function prioritizeColourVitality(channels, solution) {
    if (channels.length < 4) return solution;

    const baselineSpd = combinedSPDFromValues(channels, solution.values);
    const baselineXy = xyFromSPD(baselineSpd);
    const baselineUv = xyToUv(baselineXy.x, baselineXy.y);
    const targetRg = 110;
    const primes = [2, 3, 5, 7, 11, 13];
    const colourPointCandidates = [];
    let sequence = 0;
    let best = null;

    function collect(values) {
        const spd = combinedSPDFromValues(channels, values);
        const xy = xyFromSPD(spd);
        const uv = xyToUv(xy.x, xy.y);
        const deltaUv = Math.hypot(uv.u - baselineUv.u, uv.v - baselineUv.v);
        if (!Number.isFinite(deltaUv) || deltaUv > METAMER_CHROMATICITY_TOLERANCE) return;
        colourPointCandidates.push({
            values: values.slice(),
            xy,
            deltaUv,
            sequence: sequence++
        });
    }

    function evaluate(candidate) {
        const spd = combinedSPDFromValues(channels, candidate.values);
        const metrics = calculateMetrics(spd);
        if (!Number.isFinite(metrics.rg) || !Number.isFinite(metrics.ra) ||
            !Number.isFinite(metrics.r9) || !Number.isFinite(metrics.rf) || metrics.rf < 80) return;
        const ranked = {
            values: candidate.values,
            rgError: Math.abs(metrics.rg - targetRg),
            ra: metrics.ra,
            r9: metrics.r9,
            rf: metrics.rf,
            xy: candidate.xy
        };
        if (METAMER_OPTIMIZER.isBetterColourCandidate(ranked, best,
            { mode: 'vitality', r9Floor: 40 })) best = ranked;
    }

    collect(solution.values);
    for (let sample = 1; sample <= 8192; sample++) {
        collect(channels.map((channel, index) => radicalInverse(sample, primes[index]) * 100));
    }
    const shortlist = CANDIDATE_SHORTLIST.selectCandidateShortlist(colourPointCandidates, {
        maxCandidates: 512,
        precisionFraction: 0.5
    });
    const baselineCandidate = colourPointCandidates[0];
    if (baselineCandidate && !shortlist.includes(baselineCandidate)) shortlist.unshift(baselineCandidate);
    shortlist.forEach(evaluate);
    if (!best) return solution;

    return {
        values: best.values,
        cct: computeCCTFromValues(channels, best.values),
        error: Math.hypot(best.xy.x - baselineXy.x, best.xy.y - baselineXy.y)
    };
}

function optimizeValuesForScene(channels, targetCCT, targetDuv, emphasis = '', options = {}) {
    if (typeof SCENE_OPTIMIZER_CORE.optimizeScene === 'function') {
        return SCENE_OPTIMIZER_CORE.optimizeScene(
            buildSceneOptimizerPayload(channels, targetCCT, targetDuv, emphasis, options)
        );
    }
    const n = channels.length;
    const skipColourQuality = options.skipColourQuality === true;

    // A neutral CCT target must use the same full-spectrum fit as the CCT
    // preset buttons. Matching chromaticity alone can produce a metamer with
    // very different colour-quality and circadian metrics.
    if (Math.abs(targetDuv) < 1e-9) {
        const fitted = fitChannelsToReference(getPlanckianSPD(targetCCT), channels);
        const values = channels.map(ch => fitted[ch.id] || 0);
        const finalSpd = combinedSPDFromValues(channels, values);
        const finalXy = xyFromSPD(finalSpd);
        const targetXyLoc = getTargetXY(targetCCT, 0);
        const solution = {
            values,
            cct: computeCCTFromValues(channels, values),
            error: Math.hypot(finalXy.x - targetXyLoc.x, finalXy.y - targetXyLoc.y)
        };
        if (skipColourQuality) return solution;
        return emphasis === 'high-fidelity-and-rg-105-115'
            ? prioritizeColourVitality(channels, solution)
            : prioritizeColourFidelity(channels, solution, targetCCT, targetDuv);
    }

    const seeds = [
        optimizerSeedForTarget(channels, 0.25, targetCCT),
        optimizerSeedForTarget(channels, 0.25, targetCCT + 1000),
        optimizerSeedForTarget(channels, 0.25, targetCCT - 1000),
        Array.from({ length: n }, () => 50),
        channels.map(ch => ((ch.peak || 560) < 500 ? 60 : 35)),
        channels.map(ch => ((ch.peak || 560) < 500 ? 20 : 80))
    ];

    const tXy = getTargetXY(targetCCT, targetDuv);

    function loss(values) {
        const spd = combinedSPDFromValues(channels, values);
        const { X, Y, Z } = xyzFromSPD(spd);
        const sum = X + Y + Z;
        if (sum <= 1e-12) return 999.0;
        
        const x = X / sum;
        const y = Y / sum;
        const cct = estimateCCTFromXYZ(X, Y, Z);
        // Target errors
        const cctError = Number.isFinite(cct) && cct > 0 ? Math.log(cct / targetCCT) : 2;
        const xyError = (x - tXy.x) * (x - tXy.x) + (y - tXy.y) * (y - tXy.y);
        
        // Power/dimming penalty
        const avg = values.reduce((sum, v) => sum + v, 0) / n;
        const dimmingPenalty = (100.0 - avg) * 0.000005;

        return cctError * cctError * 1.5 + xyError * 980.0 + dimmingPenalty;
    }

    let bestValues = seeds[0].slice();
    let bestLoss = Infinity;
    for (const seed of seeds) {
        const values = seed.slice(0, n).map(value => Math.max(0, Math.min(100, value)));
        let currentLoss = loss(values);
        let step = 36;

        for (let round = 0; round < 12; round++) {
            let improved = false;
            for (let c = 0; c < n; c++) {
                const original = values[c];
                let channelBestValue = original;
                let channelBestLoss = currentLoss;
                const candidates = [
                    Math.max(0, original - step),
                    Math.min(100, original + step),
                    Math.max(0, original - step * 0.5),
                    Math.min(100, original + step * 0.5),
                    Math.max(0, original - step * 0.25),
                    Math.min(100, original + step * 0.25)
                ];
                for (const candidate of candidates) {
                    values[c] = candidate;
                    const candidateLoss = loss(values);
                    if (candidateLoss + 1e-10 < channelBestLoss) {
                        channelBestLoss = candidateLoss;
                        channelBestValue = candidate;
                        improved = true;
                    }
                }
                values[c] = channelBestValue;
                currentLoss = channelBestLoss;
            }
            if (!improved) step *= 0.5;
            if (step < 0.35) break;
        }

        if (currentLoss < bestLoss) {
            bestLoss = currentLoss;
            bestValues = values.slice();
        }
    }

    const finalCct = computeCCTFromValues(channels, bestValues);
    const finalSpd = combinedSPDFromValues(channels, bestValues);
    const finalXy = xyFromSPD(finalSpd);
    
    const targetXyLoc = getTargetXY(targetCCT, targetDuv);
    const dist = Math.sqrt((finalXy.x - targetXyLoc.x) ** 2 + (finalXy.y - targetXyLoc.y) ** 2);

    return {
        values: bestValues,
        cct: finalCct,
        error: dist
    };
}

function buildSceneOptimizerPayload(channels, targetCct, targetDuvValue, emphasis = '', options = {}) {
    return {
        channels: metamerOptimizerChannels(channels),
        initialValues: channels.map(channel => channelValues[channel.id] || 0),
        targetCct,
        targetDuv: targetDuvValue,
        targetXy: getTargetXY(targetCct, targetDuvValue),
        referenceSpd: Math.abs(targetDuvValue) < 1e-9
            ? Array.from(getPlanckianSPD(targetCct))
            : null,
        emphasis,
        skipColourQuality: options.skipColourQuality === true,
        chromaticityTolerance: METAMER_CHROMATICITY_TOLERANCE,
        maxGlobalSamples: Number.isInteger(options.maxGlobalSamples) ? options.maxGlobalSamples : undefined,
        maxCandidates: Number.isInteger(options.maxCandidates) ? options.maxCandidates : undefined
    };
}

async function calculateSceneOptimization(payload) {
    const localFileMode = window.location && window.location.protocol === 'file:';
    if (!localFileMode && sceneOptimizerWorkerClient && sceneOptimizerWorkerClient.isSupported()) {
        try {
            return await sceneOptimizerWorkerClient.optimize(payload);
        } catch (error) {
            if (error && error.code === 'SCENE_OPTIMIZER_CANCELLED') throw error;
            throw error;
        }
    }
    if (typeof SCENE_OPTIMIZER_CORE.optimizeScene !== 'function') {
        throw new Error('Scene optimizer core unavailable');
    }
    return SCENE_OPTIMIZER_CORE.optimizeScene(payload);
}

function cancelActiveSceneOptimization(message = 'Scene optimization was cancelled') {
    sceneOptimizationGeneration += 1;
    if (sceneOptimizerWorkerClient) sceneOptimizerWorkerClient.cancel(message);
}

function waitForBaseRender(version, timeoutMs = 2000) {
    if (Number(document.documentElement.dataset.baseMetricsVersion || 0) >= version) {
        return Promise.resolve(true);
    }
    return new Promise(resolve => {
        let timer = 0;
        const cleanup = () => {
            document.removeEventListener('spectral-base-render-complete', handleComplete);
            if (timer) clearTimeout(timer);
        };
        const handleComplete = event => {
            if (Number(event.detail?.version || 0) < version) return;
            cleanup();
            resolve(true);
        };
        document.addEventListener('spectral-base-render-complete', handleComplete);
        timer = setTimeout(() => {
            cleanup();
            resolve(false);
        }, timeoutMs);
    });
}

function waitForDeferredRender(version, timeoutMs = 5000) {
    if (Number(document.documentElement.dataset.deferredAnalysisVersion || 0) >= version) {
        return Promise.resolve(true);
    }
    return new Promise(resolve => {
        let timer = 0;
        const cleanup = () => {
            document.removeEventListener('spectral-deferred-analysis-complete', handleComplete);
            if (timer) clearTimeout(timer);
        };
        const handleComplete = event => {
            if (Number(event.detail?.version || 0) < version) return;
            cleanup();
            resolve(true);
        };
        document.addEventListener('spectral-deferred-analysis-complete', handleComplete);
        timer = setTimeout(() => {
            cleanup();
            resolve(false);
        }, timeoutMs);
    });
}

function applyValuesImmediate(vals) {
    const channels = getActiveChannels();
    for (const ch of channels) {
        if (vals[ch.id] === undefined) continue;
        channelValues[ch.id] = vals[ch.id];
        const slider = document.getElementById(`ch-slider-${ch.id}`);
        const label = document.getElementById(`ch-val-${ch.id}`);
        const uiValue = Number(Number(vals[ch.id]).toFixed(1));
        if (slider) {
            slider.step = '0.1';
            slider.value = uiValue;
            slider.style.setProperty('--slider-fill', `${uiValue}%`);
        }
        if (label) label.textContent = `${channelDisplayValue(vals[ch.id])}%`;
    }
    return scheduleUpdate();
}

function syncCctAndDuvControls() {
    if (targetCctSlider) {
        targetCctSlider.value = targetCCT;
        targetCctVal.textContent = `${targetCCT} K`;
        syncTargetSliderFill(targetCctSlider);
    }
    if (targetDuvSlider) {
        targetDuvSlider.value = targetDuv;
        targetDuvVal.textContent = `${targetDuv >= 0 ? '+' : ''}${targetDuv.toFixed(4)}`;
        syncTargetSliderFill(targetDuvSlider);
    }
}

function activeChannelSignature(channels) {
    let hash = 2166136261;
    for (const channel of channels) {
        const identity = `${channel.id}:${channel.peak || 0}:${channel.isWarmWhite ? 1 : 0}`;
        for (let index = 0; index < identity.length; index++) {
            hash ^= identity.charCodeAt(index);
            hash = Math.imul(hash, 16777619);
        }
        for (let index = 0; index < NUM_POINTS; index += 16) {
            hash ^= Math.round(getChannelSPDValue(channel, wavelengths[index]) * 1e6);
            hash = Math.imul(hash, 16777619);
        }
    }
    return `${channels.length}:${(hash >>> 0).toString(16)}`;
}

function solutionValuesById(channels, solution) {
    const valuesById = {};
    channels.forEach((channel, index) => {
        valuesById[channel.id] = solution.values[index];
    });
    return valuesById;
}

async function solveJourneyNode(cctK) {
    const channels = getActiveChannels();
    const signature = activeChannelSignature(channels);
    cctAnimation.channelSignature = signature;
    const cacheKey = `${signature}:${cctK}`;
    const cached = cctAnimation.cache.get(cacheKey);
    if (cached) return cached;

    const payload = buildSceneOptimizerPayload(channels, cctK, 0);
    const solved = await calculateSceneOptimization(payload);
    const valuesById = Object.freeze({ ...solutionValuesById(channels, solved) });
    cctAnimation.cache.set(cacheKey, valuesById);
    return valuesById;
}

function setInvalidatingControlsLocked(locked) {
    const controls = document.querySelectorAll([
        '#mode-checkbox',
        '#spd-import-btn',
        '#preserve-channel-power',
        '#target-cct-slider',
        '#target-duv-slider',
        'input[name="metamer-profile"]',
        '#target-rg-slider',
        '#set-baseline-btn',
        '#compare-spectrum-checkbox',
        '.metamer-profile-button',
        '.channel-slider',
        '.preset-btn',
        '.opt-preset-btn'
    ].join(','));

    if (locked) {
        cctAnimation.lockedControls.clear();
        controls.forEach(control => {
            cctAnimation.lockedControls.set(control, control.disabled);
            control.disabled = true;
        });
        return;
    }

    cctAnimation.lockedControls.forEach((wasDisabled, control) => {
        if (control.isConnected) control.disabled = wasDisabled;
    });
    cctAnimation.lockedControls.clear();
    syncMetamerControls(calculateMetrics(getCombinedSPD()));
}

function updateCctJourneyControls() {
    const playing = cctAnimation.status === 'playing';
    if (cctJourneyPlayBtn) {
        cctJourneyPlayBtn.querySelector('span').textContent = playing ? '\u275A\u275A' : '\u25B6';
        cctJourneyPlayBtn.setAttribute('aria-label', playing ? 'Pause CCT journey' : 'Play CCT journey');
        cctJourneyPlayBtn.title = playing ? 'Pause CCT journey' : 'Play CCT journey';
    }
    if (cctJourneyStopBtn) cctJourneyStopBtn.disabled = cctAnimation.status === 'stopped';
}

function rgbCss(rgb) {
    return `rgb(${rgb.join(', ')})`;
}

function createSampleChip(sample) {
    const chip = document.createElement('article');
    chip.className = 'color-sample-swatch';
    chip.setAttribute('aria-label', `${sample.id}: reference and current spectrum comparison`);

    const colors = [
        ['color-sample-ref', sample.refRGB, '参考'],
        ['color-sample-test', sample.testRGB, '当前']
    ];
    for (const [className, rgb, label] of colors) {
        const color = document.createElement('div');
        color.className = className;
        if (rgb) {
            color.style.backgroundColor = rgbCss(rgb);
            color.title = `${label}: ${rgbCss(rgb)}`;
        } else {
            color.classList.add('is-unavailable');
            color.title = '当前光谱不可用';
        }
        chip.appendChild(color);
    }

    const label = document.createElement('span');
    label.className = 'color-sample-label';
    label.textContent = sample.id;
    chip.appendChild(label);
    return chip;
}

function createTcsChart(quality) {
    const chart = document.createElement('div');
    chart.className = 'tcs-bars';
    const values = Array.isArray(quality?.ri) ? quality.ri : [];
    const heading = document.createElement('p');
    heading.className = 'tcs-ra-summary';
    heading.textContent = Number.isFinite(quality?.ra) ? `Ra = ${quality.ra.toFixed(1)}` : 'Ra = --';
    chart.appendChild(heading);
    const barColors = ['#e8a39a','#e39a68','#c6bd48','#4fa7a0','#3daeb8','#58c7c7','#9994ce','#887fbc','#e53d37','#d6d333','#4ca567','#5065b3','#d8d2cc','#3b9a66','#d09a7f'];
    for (let index = 0; index < 15; index++) {
        const value = Number.isFinite(values[index]) ? values[index] : null;
        const row = document.createElement('div');
        row.className = 'tcs-bar-row';
        const name = document.createElement('span');
        name.className = 'tcs-bar-name';
        name.textContent = `R${index + 1}`;
        const track = document.createElement('span');
        track.className = 'tcs-bar-track';
        const fill = document.createElement('span');
        fill.className = 'tcs-bar-fill';
        fill.style.width = `${value === null ? 0 : Math.max(0, Math.min(100, value))}%`;
        fill.style.backgroundColor = barColors[index];
        fill.classList.toggle('is-low', value !== null && value < 80);
        track.appendChild(fill);
        const number = document.createElement('strong');
        number.className = 'tcs-bar-value';
        number.textContent = value === null ? '--' : Math.round(value).toString();
        row.append(name, track, number);
        chart.appendChild(row);
    }
    const axis = document.createElement('div');
    axis.className = 'tcs-axis';
    for (let value = 0; value <= 100; value += 10) {
        const tick = document.createElement('span');
        tick.textContent = value;
        axis.appendChild(tick);
    }
    chart.appendChild(axis);
    return chart;
}

function svgElement(name, attributes = {}) {
    const element = document.createElementNS('http://www.w3.org/2000/svg', name);
    Object.entries(attributes).forEach(([key, value]) => element.setAttribute(key, value));
    return element;
}

function createCesVectorGraphic(quality) {
    const wrap = document.createElement('div');
    wrap.className = 'ces-vector-wrap';
    const graphic = document.createElement('div');
    graphic.className = 'ces-vector-graphic';
    const svg = svgElement('svg', { viewBox: '-132 -132 264 264', role: 'img', 'aria-label': 'TM-30 colour vector graphic' });
    const hueColors = ['#ef5350','#f06d3b','#e99b32','#d6b735','#a7bd3f','#70b653','#38ab78','#26a69a','#2aa8bd','#4285c5','#5b72c5','#745bb8','#9554ae','#b64f9c','#d44f7d','#e65363'];
    for (let index = 0; index < 16; index++) {
        const start = (index * 22.5 - 90) * Math.PI / 180;
        const end = ((index + 1) * 22.5 - 90) * Math.PI / 180;
        const x1 = 118 * Math.cos(start), y1 = 118 * Math.sin(start);
        const x2 = 118 * Math.cos(end), y2 = 118 * Math.sin(end);
        svg.appendChild(svgElement('path', {
            d: `M 0 0 L ${x1} ${y1} A 118 118 0 0 1 ${x2} ${y2} Z`,
            fill: hueColors[index], opacity: '0.045'
        }));
    }
    [25, 50, 75, 100].forEach(radius => svg.appendChild(svgElement('circle', {
        cx: 0, cy: 0, r: radius, fill: 'none', stroke: '#b9b2a8', 'stroke-width': radius === 100 ? 1.4 : 0.7
    })));
    for (let index = 0; index < 16; index++) {
        const angle = (index + 0.5) * Math.PI / 8;
        svg.appendChild(svgElement('line', {
            x1: 0, y1: 0, x2: 112 * Math.cos(angle), y2: -112 * Math.sin(angle),
            stroke: '#c8c1b7', 'stroke-width': 0.65
        }));
        const label = svgElement('text', {
            x: 122 * Math.cos(angle), y: -122 * Math.sin(angle),
            fill: '#7d766d', 'font-size': 8, 'text-anchor': 'middle', 'dominant-baseline': 'middle'
        });
        label.textContent = index + 1;
        svg.appendChild(label);
    }
    const referencePoints = Array.from({ length: 16 }, (_, index) => {
        const angle = (index + 0.5) * Math.PI / 8;
        return `${100 * Math.cos(angle)},${-100 * Math.sin(angle)}`;
    }).join(' ');
    svg.appendChild(svgElement('polygon', {
        points: referencePoints, fill: 'none', stroke: '#7f786f', 'stroke-width': 1.5, 'stroke-dasharray': '4 3'
    }));
    if (Array.isArray(quality?.vector)) {
        const testPoints = quality.vector.map(point => `${Math.max(-125, Math.min(125, point.x))},${Math.max(-125, Math.min(125, -point.y))}`).join(' ');
        svg.appendChild(svgElement('polygon', {
            points: testPoints, fill: 'rgba(220,65,49,0.08)', stroke: '#dc4131', 'stroke-width': 2.6, 'stroke-linejoin': 'round'
        }));
        quality.vector.forEach((point, index) => svg.appendChild(svgElement('circle', {
            cx: Math.max(-125, Math.min(125, point.x)),
            cy: Math.max(-125, Math.min(125, -point.y)),
            r: 2.5, fill: hueColors[index], stroke: '#fff', 'stroke-width': 0.7
        })));
    }
    graphic.appendChild(svg);
    const metricItems = [
        ['ces-rf', Number.isFinite(quality?.rf) ? Math.round(quality.rf) : '--', 'Rf'],
        ['ces-rg', Number.isFinite(quality?.rg) ? Math.round(quality.rg) : '--', 'Rg'],
        ['ces-cct', Number.isFinite(quality?.cct) && quality.cct > 0 ? `${Math.round(quality.cct)} K` : '--', 'CCT'],
        ['ces-duv', Number.isFinite(quality?.duv) ? quality.duv.toFixed(4) : '--', 'Duv']
    ];
    metricItems.forEach(([className, value, label]) => {
        const metric = document.createElement('div');
        metric.className = `ces-corner-metric ${className}`;
        const strong = document.createElement('strong');
        strong.textContent = value;
        const span = document.createElement('span');
        span.textContent = label;
        metric.append(strong, span);
        graphic.appendChild(metric);
    });
    wrap.appendChild(graphic);
    const summary = document.createElement('p');
    summary.className = 'ces-vector-summary';
    summary.textContent = quality?.vector
        ? '虚线为参考圆，红色轮廓为当前光谱；向外表示该色相饱和度增强，向内表示降低。'
        : '尚无有效光谱 · 虚线为参考圆';
    wrap.appendChild(summary);
    return wrap;
}

function optimizeChannelsToXy(targetXy, options = {}) {
    const channels = Array.isArray(options.channels) && options.channels.length
        ? options.channels
        : getActiveChannels();
    if (!channels.length) return null;
    const targetUv = xyToUv(targetXy.x, targetXy.y);
    const current = Array.isArray(options.seedValues) && options.seedValues.length === channels.length
        ? options.seedValues.slice()
        : channels.map(channel => channelValues[channel.id] || 0);
    const seeds = [
        current,
        channels.map(() => 50),
        channels.map(() => 100),
        channels.map(channel => (channel.chromaticity?.x || 0.33) > targetXy.x ? 65 : 25),
        channels.map(channel => (channel.chromaticity?.y || 0.33) > targetXy.y ? 65 : 25)
    ];

    const evaluate = values => {
        const xy = xyFromSPD(combinedSPDFromValues(channels, values));
        const uv = xyToUv(xy.x, xy.y);
        return { xy, error: Math.hypot(uv.u - targetUv.u, uv.v - targetUv.v) };
    };

    let best = null;
    for (const seed of seeds) {
        const values = seed.slice();
        let result = evaluate(values);
        for (const step of [32, 16, 8, 4, 2, 1, 0.5]) {
            let improved = true;
            let passes = 0;
            while (improved && passes++ < 3) {
                improved = false;
                for (let index = 0; index < values.length; index++) {
                    const original = values[index];
                    let localBest = result;
                    let localValue = original;
                    for (const candidate of [Math.max(0, original - step), Math.min(100, original + step)]) {
                        values[index] = candidate;
                        const tested = evaluate(values);
                        if (tested.error + 1e-10 < localBest.error) {
                            localBest = tested;
                            localValue = candidate;
                        }
                    }
                    values[index] = localValue;
                    if (localBest !== result) {
                        result = localBest;
                        improved = true;
                    }
                }
            }
        }
        if (!best || result.error < best.error) best = { values: values.slice(), ...result };
    }

    const maxValue = Math.max(...best.values);
    if (maxValue > 0) best.values = best.values.map(value => Math.min(100, value * 100 / maxValue));
    best.actualXy = xyFromSPD(combinedSPDFromValues(channels, best.values));
    return best;
}

function clearPastelTarget(message = '选择色卡后，将按当前通道光谱拟合目标色点。') {
    const wasActive = Boolean(colourTuningGroup && colourTuningGroup.classList.contains('is-pastel-target'));
    if (colourTuningGroup) colourTuningGroup.classList.remove('is-pastel-target');
    if (colourTargetMode) colourTargetMode.textContent = '白光目标';
    document.querySelectorAll('.pastel-color-card.is-selected').forEach(card => card.classList.remove('is-selected'));
    if (pastelFitStatus) {
        pastelFitStatus.textContent = message;
        pastelFitStatus.classList.remove('is-warning');
    }
    if (wasActive && metamerStatus && metamerStatus.textContent.includes('淡彩目标')) {
        setMetamerStatus('常规模式');
    }
}

function applyPastelTarget(sample, button) {
    cancelActiveSceneOptimization('Pastel target changed');
    const result = optimizeChannelsToXy(sample.xy);
    if (!result) return;
    returnToRegularMode('常规模式 · 淡彩目标');
    const values = {};
    getActiveChannels().forEach((channel, index) => { values[channel.id] = result.values[index]; });
    document.querySelectorAll('.pastel-color-card.is-selected').forEach(card => card.classList.remove('is-selected'));
    button.classList.add('is-selected');
    if (colourTuningGroup) colourTuningGroup.classList.add('is-pastel-target');
    if (colourTargetMode) colourTargetMode.textContent = `淡彩目标 ${sample.id}`;
    animateToValues(values);
    if (pastelFitStatus) {
        const accuracy = result.error <= 0.003 ? '精确拟合' : result.error <= 0.01 ? '近似拟合' : '超出当前通道色域';
        pastelFitStatus.textContent = `${sample.id} ${sample.name} · ${accuracy} · Δuv ${result.error.toFixed(4)} · 当前使用淡彩目标，调整CCT或Duv可返回白光目标。`;
        pastelFitStatus.classList.toggle('is-warning', result.error > 0.01);
    }
}

function createPastelCard(sample) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'pastel-color-card';
    button.style.backgroundColor = rgbCss(sample.rgb);
    button.setAttribute('aria-label', `${sample.id} ${sample.name}`);
    const id = document.createElement('strong');
    id.textContent = sample.id;
    const name = document.createElement('span');
    name.textContent = sample.name;
    button.append(id, name);
    button.addEventListener('click', () => applyPastelTarget(sample, button));
    return button;
}

function updateColorSamples(spd, precomputedQuality = null) {
    const grid = document.getElementById('color-samples-grid');
    const pastelGrid = document.getElementById('pastel-palette-grid');
    if (!grid) return;
    grid.replaceChildren();

    if (pastelGrid && !pastelGrid.childElementCount) {
        const fragment = document.createDocumentFragment();
        PASTEL_PALETTE.samples.forEach(sample => fragment.appendChild(createPastelCard(sample)));
        pastelGrid.appendChild(fragment);
    }
    let quality = precomputedQuality;
    if (!quality) {
        quality = typeof COLOUR_QUALITY.calculateColourQualityFromSpectrum === 'function'
            ? COLOUR_QUALITY.calculateColourQualityFromSpectrum({ wavelengths, values: spd })
            : null;
    }
    if (quality && quality.cct > 0 && SPECTRAL_MATH.estimateCctAndDuvFromXy) {
        const xy = xyFromSPD(spd);
        const estimate = SPECTRAL_MATH.estimateCctAndDuvFromXy(xy.x, xy.y);
        quality.duv = estimate.duv;
    }
    grid.appendChild(createTcsChart(quality));
    grid.appendChild(createCesVectorGraphic(quality));
}

function stopCctJourney() {
    cctAnimation.generation += 1;
    if (cctAnimation.timer !== null) {
        clearTimeout(cctAnimation.timer);
        cctAnimation.timer = null;
    }
    if (sceneOptimizerWorkerClient) sceneOptimizerWorkerClient.cancel('CCT journey stopped');
    cctAnimation.index = 0;
    cctAnimation.status = 'stopped';
    setInvalidatingControlsLocked(false);
    updateCctJourneyControls();
    if (cctJourneyStatus) cctJourneyStatus.textContent = `${targetCCT} K`;
}

function pauseCctJourney() {
    if (cctAnimation.status !== 'playing') return;
    cctAnimation.generation += 1;
    if (cctAnimation.timer !== null) {
        clearTimeout(cctAnimation.timer);
        cctAnimation.timer = null;
    }
    if (sceneOptimizerWorkerClient) sceneOptimizerWorkerClient.cancel('CCT journey paused');
    cctAnimation.status = 'paused';
    updateCctJourneyControls();
    if (cctJourneyStatus) cctJourneyStatus.textContent = `已暂停 · ${targetCCT} K`;
}

async function advanceCctJourney() {
    if (cctAnimation.status !== 'playing') return;
    const journey = CCT_JOURNEY.buildCctJourney();
    if (cctAnimation.index >= journey.length) {
        stopCctJourney();
        return;
    }

    const generation = cctAnimation.generation;
    const nodeIndex = cctAnimation.index;
    const cctK = journey[nodeIndex];
    targetCCT = cctK;
    targetDuv = 0;
    syncCctAndDuvControls();
    if (cctJourneyStatus) cctJourneyStatus.textContent = `计算中 · ${cctK} K`;

    try {
        const valuesById = await solveJourneyNode(cctK);
        if (generation !== cctAnimation.generation || cctAnimation.status !== 'playing') return;
        applyValuesImmediate(valuesById);
        cctAnimation.index = nodeIndex + 1;
        if (cctJourneyStatus) cctJourneyStatus.textContent = `${cctK} K`;
        if (cctAnimation.index >= journey.length) {
            stopCctJourney();
            return;
        }
        cctAnimation.timer = setTimeout(() => {
            cctAnimation.timer = null;
            advanceCctJourney();
        }, 300);
    } catch (error) {
        if (error && error.code === 'SCENE_OPTIMIZER_CANCELLED') return;
        console.error('CCT journey node optimization failed:', error);
        stopCctJourney();
    }
}

function playCctJourney() {
    if (cctAnimation.status === 'playing' || cctAnimation.timer !== null) return;
    clearPastelTarget();
    runRealtimeOptimizerDebounced.cancel();
    cancelActiveSceneOptimization('CCT journey started');
    if (cctAnimation.status === 'stopped') cctAnimation.index = 0;
    cctAnimation.generation += 1;
    cctAnimation.status = 'playing';
    setInvalidatingControlsLocked(true);
    updateCctJourneyControls();
    advanceCctJourney();
}

function applyHumanCentredScene(scene) {
    if (!scene) return;
    stopCctJourney();
    runRealtimeOptimizerDebounced.cancel();
    targetCCT = scene.cctK;
    targetDuv = 0;
    eyeIlluminance = scene.illuminanceLux;
    syncCctAndDuvControls();
    if (cctJourneyStatus) cctJourneyStatus.textContent = `${targetCCT} K`;
    if (eyeIlluminanceSlider) {
        eyeIlluminanceSlider.value = eyeIlluminance;
        eyeIlluminanceVal.textContent = `${eyeIlluminance} lux`;
        syncTargetSliderFill(eyeIlluminanceSlider);
    }

    applyTargetOptimization(scene.emphasis);
}

let scheduleTimer = null;
let lastScheduleKey = '';
let scheduleSimulationMinute = null;
let scheduleSimulationActive = false;
const SCHEDULE_SIMULATION_STEP_MINUTES = 30;
const SCHEDULE_SIMULATION_INTERVAL_MS = 180;
const scheduleSolutionCache = new Map();

function scheduleStagesFromUi() {
    return CIRCADIAN_SCHEDULE.DEFAULT_STAGES.map(stage => {
        const input = document.querySelector(`.schedule-stage-time[data-stage-id="${stage.id}"]`);
        return { ...stage, time: input?.value || stage.time };
    });
}

function setScheduleActiveRow(stageId) {
    document.querySelectorAll('.schedule-stage-row').forEach(row => {
        row.classList.toggle('is-active', row.dataset.stageId === stageId);
    });
}

function applyScheduledTarget(target, fullQuality = false) {
    stopCctJourney();
    runRealtimeOptimizerDebounced.cancel();
    targetCCT = Math.round(target.cctK / 100) * 100;
    targetDuv = target.duv || 0;
    eyeIlluminance = Math.round(target.illuminanceLux);
    syncCctAndDuvControls();
    if (eyeIlluminanceSlider) {
        eyeIlluminanceSlider.value = eyeIlluminance;
        eyeIlluminanceVal.textContent = `${eyeIlluminance} lux`;
        syncTargetSliderFill(eyeIlluminanceSlider);
    }
    if (fullQuality) {
        applyTargetOptimization(target.emphasis);
        return;
    }

    const channels = getActiveChannels();
    if (!channels.length) return;
    const cacheKey = `${channels.map(channel => channel.id).join(',')}|${targetCCT}|${targetDuv.toFixed(4)}|${target.emphasis || ''}`;
    let valuesById = scheduleSolutionCache.get(cacheKey);
    if (!valuesById) {
        const solved = optimizeValuesForScene(
            channels,
            targetCCT,
            targetDuv,
            target.emphasis,
            { skipColourQuality: true }
        );
        valuesById = solutionValuesById(channels, solved);
        scheduleSolutionCache.set(cacheKey, valuesById);
    }
    applyValuesImmediate(valuesById);
}

function scheduleSimulationRange() {
    const ordered = CIRCADIAN_SCHEDULE.normalizeStages(scheduleStagesFromUi());
    if (!ordered.length) return { start: 0, end: 0 };
    return {
        start: ordered[0].minute,
        end: Math.min(1440, ordered[ordered.length - 1].minute + 30)
    };
}

function updateScheduleSimulationNote() {
    const note = document.getElementById('schedule-note');
    if (!note) return;
    const range = scheduleSimulationRange();
    note.textContent = `快速模拟 ${CIRCADIAN_SCHEDULE.formatMinuteOfDay(range.start)}–${CIRCADIAN_SCHEDULE.formatMinuteOfDay(range.end)}；各阶段前 30 分钟平滑过渡。`;
}

function scheduleTick(force = false, applyTarget = true, simulatedMinute = null) {
    const now = new Date();
    const usesSimulationClock = Number.isFinite(simulatedMinute);
    const minuteOfDay = usesSimulationClock
        ? simulatedMinute
        : now.getHours() * 60 + now.getMinutes();
    const state = CIRCADIAN_SCHEDULE.stateAt(scheduleStagesFromUi(), minuteOfDay, 30);
    const clock = document.getElementById('schedule-clock');
    const status = document.getElementById('schedule-current-stage');
    if (clock) clock.textContent = usesSimulationClock
        ? CIRCADIAN_SCHEDULE.formatMinuteOfDay(minuteOfDay)
        : now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
    if (!state) return;
    setScheduleActiveRow(state.active.id);
    const activeScene = CCT_JOURNEY.sceneById(state.active.sceneId);
    const previousScene = CCT_JOURNEY.sceneById(state.previous.sceneId);
    if (!activeScene || !previousScene) return;
    const transition = state.progress < 1;
    if (status) status.textContent = transition
        ? `${state.previous.labelZh} → ${state.active.labelZh} · ${Math.round(state.progress * 100)}%`
        : `${state.active.labelZh} · ${activeScene.cctK} K · ${activeScene.illuminanceLux} lux`;
    const key = `${state.active.id}:${minuteOfDay}:${Math.round(state.progress * 100)}`;
    if (!applyTarget || (!force && key === lastScheduleKey)) return;
    lastScheduleKey = key;
    applyScheduledTarget(CIRCADIAN_SCHEDULE.blendScenes(previousScene, activeScene, state.progress), false);
}

function stopSchedule() {
    const wasActive = scheduleSimulationActive;
    if (scheduleTimer !== null) clearInterval(scheduleTimer);
    scheduleTimer = null;
    scheduleSimulationMinute = null;
    scheduleSimulationActive = false;
    lastScheduleKey = '';
    if (wasActive) scheduleUpdate();
}

function startSchedule() {
    stopSchedule();
    scheduleSolutionCache.clear();
    scheduleSimulationActive = true;
    const range = scheduleSimulationRange();
    scheduleSimulationMinute = range.start;
    scheduleTick(false, true, scheduleSimulationMinute);
    scheduleTimer = setInterval(() => {
        scheduleSimulationMinute = CIRCADIAN_SCHEDULE.advanceSimulationMinute(
            scheduleSimulationMinute,
            SCHEDULE_SIMULATION_STEP_MINUTES
        );
        if (scheduleSimulationMinute >= range.end) {
            scheduleSimulationMinute = range.end;
            scheduleTick(true, true, scheduleSimulationMinute);
            const clock = document.getElementById('schedule-clock');
            const status = document.getElementById('schedule-current-stage');
            const toggle = document.getElementById('schedule-auto-toggle');
            if (clock) clock.textContent = CIRCADIAN_SCHEDULE.formatMinuteOfDay(range.end);
            if (status) status.textContent = '场景时段模拟完成';
            if (toggle) toggle.checked = false;
            stopSchedule();
            return;
        }
        scheduleTick(false, true, scheduleSimulationMinute);
    }, SCHEDULE_SIMULATION_INTERVAL_MS);
}

function renderScheduleStages() {
    const list = document.getElementById('schedule-stage-list');
    if (!list || !window.CIRCADIAN_SCHEDULE) return;
    list.replaceChildren();
    CIRCADIAN_SCHEDULE.DEFAULT_STAGES.forEach(stage => {
        const scene = CCT_JOURNEY.sceneById(stage.sceneId);
        const row = document.createElement('div');
        row.className = 'schedule-stage-row';
        row.dataset.stageId = stage.id;
        const time = document.createElement('input');
        time.type = 'time';
        time.value = stage.time;
        time.className = 'schedule-stage-time';
        time.dataset.stageId = stage.id;
        time.setAttribute('aria-label', `${stage.labelZh}开始时间`);
        time.addEventListener('change', () => {
            lastScheduleKey = '';
            updateScheduleSimulationNote();
            if (document.getElementById('schedule-auto-toggle')?.checked) {
                scheduleTick(true, true, scheduleSimulationMinute ?? 0);
            } else scheduleTick(false, false, 0);
        });
        time.hidden = true;
        const preview = document.createElement('button');
        preview.type = 'button';
        preview.className = 'schedule-preview-btn';
        preview.innerHTML = `<strong>${stage.labelZh}</strong><small>${scene?.cctK || '--'} K · ${scene?.illuminanceLux || '--'} lux</small>`;
        preview.title = `预览${stage.labelZh}`;
        preview.setAttribute('aria-label', `预览${stage.labelZh}`);
        preview.addEventListener('click', () => {
            const toggle = document.getElementById('schedule-auto-toggle');
            if (toggle) toggle.checked = false;
            stopSchedule();
            setScheduleActiveRow(stage.id);
            applyHumanCentredScene(scene);
            const status = document.getElementById('schedule-current-stage');
            if (status) status.textContent = `手动预览 · ${stage.labelZh}`;
        });
        row.append(time, preview);
        list.appendChild(row);
    });
    scheduleTick(false, false, 0);
}

function setOptimizerMode(mode) {
    const isSchedule = mode === 'schedule';
    const sceneTab = document.getElementById('scene-tab');
    const scheduleTab = document.getElementById('schedule-tab');
    const scenePanel = document.getElementById('scene-mode-panel');
    const schedulePanel = document.getElementById('schedule-mode-panel');
    sceneTab?.setAttribute('aria-selected', String(!isSchedule));
    scheduleTab?.setAttribute('aria-selected', String(isSchedule));
    const enteringPanel = isSchedule ? schedulePanel : scenePanel;
    const leavingPanel = isSchedule ? scenePanel : schedulePanel;
    if (leavingPanel) leavingPanel.hidden = true;
    if (enteringPanel) {
        enteringPanel.classList.add('is-entering');
        enteringPanel.hidden = false;
        requestAnimationFrame(() => enteringPanel.classList.remove('is-entering'));
    }
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function yieldForPaint() {
    return new Promise(resolve => requestAnimationFrame(() => setTimeout(resolve, 0)));
}

// ═══════════════════════════════════════════════
// RENDER LOOP & DEBOUNCE
// ═══════════════════════════════════════════════

function commitFastVisual(combined, version) {
    renderSPD(combined);
    updateEmitterPreviewFast(combined);
    if (window.MaterialPanel?.setUpdating) window.MaterialPanel.setUpdating(version);
    document.documentElement.dataset.spdPaintVersion = String(version);
    document.documentElement.dataset.spdPaintTime = performance.now().toFixed(1);
    if (!document.documentElement.dataset.coreVisualReady) {
        document.documentElement.dataset.coreVisualReady = 'true';
        const loadingState = document.getElementById('spd-loading-state');
        if (loadingState) loadingState.hidden = true;
        window.SpectralAppReadiness?.markReady('core', '核心光谱已显示。');
    }
    document.dispatchEvent(new CustomEvent('spectral-fast-render-complete', {
        detail: { version }
    }));
}

const APP_RENDER_PIPELINE = window.SpectralRenderPipeline.createRenderPipeline({
    onFast(payload, version) {
        commitFastVisual(payload.combined, version);
    },
    onBase(payload, version) {
        payload.base = updateMetrics(payload.combined);
        if (!cieOffscreenCanvas) generateCIEBackground();
        renderCIE();
        document.documentElement.dataset.baseMetricsVersion = String(version);
        document.documentElement.dataset.baseMetricsTime = performance.now().toFixed(1);
        document.dispatchEvent(new CustomEvent('spectral-base-render-complete', {
            detail: { version }
        }));
    },
    onDeferred(payload, version, isCurrent) {
        updateDeferredAnalysis(payload.base, version, isCurrent);
    },
    onError(error, stage) {
        console.error(`Error in ${stage} render stage:`, error);
    }
});

function scheduleUpdate() {
    return APP_RENDER_PIPELINE.schedule({
        combined: getCombinedSPD(),
        base: null,
        requestedAt: performance.now()
    });
}

function debounce(fn, delay) {
    let timer;
    function debounced(...args) {
        clearTimeout(timer);
        timer = setTimeout(() => fn.apply(this, args), delay);
    }
    debounced.cancel = () => {
        clearTimeout(timer);
        timer = null;
    };
    return debounced;
}

// ═══════════════════════════════════════════════
// INITIALIZATION
// ═══════════════════════════════════════════════

function init() {
    updateThemeState();
    
    // Watch for theme mutations to avoid querying computed styles during frame rendering
    const themeObserver = new MutationObserver(() => {
        updateThemeState();
        generateCIEBackground();
        scheduleUpdate();
    });
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'class'] });
    if (document.body) {
        themeObserver.observe(document.body, { attributes: true, attributeFilter: ['data-theme', 'class'] });
    }

    resizeCanvas({ prepareCieBackground: false });
    buildChannelSliders();

    // Set initial values for a nice demo
    const initial = { red: 98, green: 67, blue: 33, warmwhite: 0, cyan: 35, lime: 30, amber: 25 };
    for (const [id, val] of Object.entries(initial)) {
        channelValues[id] = val;
    }
    buildChannelSliders();

    // Sync target control sliders UI with JS variables on load
    if (targetCctSlider) {
        targetCctSlider.value = targetCCT;
        if (targetCctVal) targetCctVal.textContent = `${targetCCT} K`;
    }
    if (targetDuvSlider) {
        targetDuvSlider.value = targetDuv;
        if (targetDuvVal) {
            targetDuvVal.textContent = `${targetDuv >= 0 ? '+' : ''}${targetDuv.toFixed(4)}`;
        }
    }
    if (eyeIlluminanceSlider) {
        eyeIlluminanceSlider.value = eyeIlluminance;
        if (eyeIlluminanceVal) eyeIlluminanceVal.textContent = `${eyeIlluminance} lux`;
    }
    updateCircadianConditionLabels();

    document.querySelectorAll('.target-row input[type="range"]').forEach(syncTargetSliderFill);
    updateCctJourneyControls();

    // The default 4-channel values are pre-fitted to the initial 4000 K target.
    // Commit the first SPD synchronously; CIE background and analysis follow later.
    const initialCombined = getCombinedSPD();
    const initialVersion = APP_RENDER_PIPELINE.currentVersion() + 1;
    commitFastVisual(initialCombined, initialVersion);
    scheduleUpdate();

    // Handle resize
    let resizeTimer;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
            resizeCanvas();
            scheduleUpdate();
        }, 100);
    });
    updateScheduleSimulationNote();
}

async function runRealtimeOptimizer() {
    clearPastelTarget();
    const channels = getActiveChannels();
    if (!channels.length || metamerModeEnabled) return;
    const generation = ++sceneOptimizationGeneration;
    const payload = buildSceneOptimizerPayload(channels, targetCCT, targetDuv);
    try {
        const solved = await calculateSceneOptimization(payload);
        if (generation !== sceneOptimizationGeneration || metamerModeEnabled) return;
        applyValuesImmediate(solutionValuesById(channels, solved));
    } catch (error) {
        if (error && error.code === 'SCENE_OPTIMIZER_CANCELLED') return;
        console.error('Realtime scene optimization failed:', error);
    }
}

const runRealtimeOptimizerDebounced = debounce(runRealtimeOptimizer, 90);

async function applyTargetOptimization(emphasis = '') {
    clearPastelTarget();
    runRealtimeOptimizerDebounced.cancel();
    if (metamerProfile === 'saturation' && metamerModeEnabled) {
        targetDuv = 0;
        syncCctAndDuvControls();
    }

    const channels = getActiveChannels();
    if (!channels.length) return;
    const generation = ++sceneOptimizationGeneration;
    const payload = buildSceneOptimizerPayload(channels, targetCCT, targetDuv, emphasis);
    try {
        const solved = await calculateSceneOptimization(payload);
        if (generation !== sceneOptimizationGeneration) return;
        applyValuesImmediate(solutionValuesById(channels, solved));
    } catch (error) {
        if (error && error.code === 'SCENE_OPTIMIZER_CANCELLED') return;
        console.error('Target scene optimization failed:', error);
        return;
    }

    if (!metamerModeEnabled || generation !== sceneOptimizationGeneration) return;
    captureBaseline();
    compareSpectrumEnabled = true;
    updateTargetRgControl(metamerProfile === 'saturation' ? 120 : 100);
    await runMetamerOptimization();
}

const applyTargetOptimizationDebounced = debounce(() => {
    applyTargetOptimization();
}, 140);

function syncMetamerTargetPolicy() {
    if (!targetDuvSlider) return;
    const locksToPlanckian = metamerModeEnabled && metamerProfile === 'saturation';
    targetDuvSlider.disabled = locksToPlanckian;
    targetDuvSlider.title = locksToPlanckian ? '高饱和模式固定在黑体轨迹上' : '';
}

// Wire CCT, Duv, and Rg target sliders
if (targetCctSlider) {
    targetCctSlider.addEventListener('input', () => {
        targetCCT = parseInt(targetCctSlider.value);
        targetCctVal.textContent = `${targetCCT} K`;
        if (metamerModeEnabled) applyTargetOptimizationDebounced();
        else runRealtimeOptimizerDebounced();
        scheduleUpdate();
    });
}
if (targetDuvSlider) {
    targetDuvSlider.addEventListener('input', () => {
        targetDuv = parseFloat(targetDuvSlider.value);
        targetDuvVal.textContent = `${targetDuv >= 0 ? '+' : ''}${targetDuv.toFixed(4)}`;
        if (metamerModeEnabled) applyTargetOptimizationDebounced();
        else runRealtimeOptimizerDebounced();
        scheduleUpdate();
    });
}
if (eyeIlluminanceSlider) {
    eyeIlluminanceSlider.addEventListener('input', () => {
        eyeIlluminance = parseInt(eyeIlluminanceSlider.value, 10);
        eyeIlluminanceVal.textContent = `${eyeIlluminance} lux`;
        scheduleUpdate();
    });
}

if (exposureDurationSlider) {
    exposureDurationSlider.addEventListener('input', () => {
        exposureDurationHours = Math.min(3, Math.max(0.5, Number(exposureDurationSlider.value) || 1));
        syncTargetSliderFill(exposureDurationSlider);
        updateCircadianConditionLabels();
        refreshCircadianMetricOnly(true);
    });
}

if (visualFieldSelect) {
    visualFieldSelect.addEventListener('change', () => {
        const nextFieldFactor = Number(visualFieldSelect.value);
        visualFieldFactor = [0.5, 1, 2].includes(nextFieldFactor) ? nextFieldFactor : 1;
        updateCircadianConditionLabels();
        refreshCircadianMetricOnly(true);
    });
}

document.querySelectorAll('input[name="metamer-profile"]').forEach(input => {
    input.addEventListener('change', async () => {
        if (!input.checked) return;
        if (isMetamerOptimizing) cancelActiveMetamerOptimization('Metamer profile changed');
        metamerProfile = input.value;
        metamerModeEnabled = metamerProfile !== 'off';
        if (metamerProfile === 'saturation') {
            targetDuv = 0;
            syncCctAndDuvControls();
        }
        syncMetamerTargetPolicy();
        document.querySelectorAll('.metamer-profile-button').forEach(button => {
            const selected = button.dataset.metamerProfile === metamerProfile;
            button.classList.toggle('is-selected', selected);
            button.setAttribute('aria-pressed', String(selected));
        });
        if (!metamerModeEnabled) {
            normalizeChannelValuesToDisplayedPrecision();
            clearBaseline();
            clearMetamerColourDelta();
            setMetamerStatus('常规模式');
            syncChannelSliderPrecision();
            scheduleUpdate();
            return;
        }

        const metrics = calculateMetrics(getCombinedSPD());
        if (!hasValidMetamerMetrics(metrics)) {
            metamerProfile = 'off';
            metamerModeEnabled = false;
            syncMetamerTargetPolicy();
            normalizeChannelValuesToDisplayedPrecision();
            clearBaseline();
            syncChannelSliderPrecision();
            const offInput = document.querySelector('input[name="metamer-profile"][value="off"]');
            if (offInput) offInput.checked = true;
            document.querySelectorAll('.metamer-profile-button').forEach(button => {
                const selected = button.dataset.metamerProfile === 'off';
                button.classList.toggle('is-selected', selected);
                button.setAttribute('aria-pressed', String(selected));
            });
            setMetamerStatus('当前光谱无效，已返回常规模式。');
            scheduleUpdate();
            return;
        }
        updateTargetRgControl(metamerProfile === 'saturation' ? 120 : 100);
        syncChannelSliderPrecision();
        setMetamerStatus(metamerProfile === 'fidelity' ? '正在搜索高显色同色光谱…' : '正在搜索高饱和同色光谱…');
        await applyTargetOptimization();
    });
});

document.querySelectorAll('.metamer-profile-button').forEach(button => {
    button.addEventListener('click', () => {
        const requested = button.dataset.metamerProfile;
        const input = document.querySelector(`input[name="metamer-profile"][value="${requested}"]`);
        if (input) {
            input.checked = true;
            input.dispatchEvent(new Event('change', { bubbles: true }));
        }
    });
});

if (targetRgSlider) {
    targetRgSlider.addEventListener('input', debounce(() => {
        updateTargetRgControl(parseInt(targetRgSlider.value, 10));
        runMetamerOptimization();
    }, 80));
}

if (setBaselineBtn) {
    setBaselineBtn.addEventListener('click', captureBaseline);
}

if (compareSpectrumCheckbox) {
    compareSpectrumCheckbox.addEventListener('change', () => {
        if (compareSpectrumCheckbox.disabled || !baselineMatchesActiveChannels(getActiveChannels())) {
            compareSpectrumCheckbox.checked = false;
            compareSpectrumEnabled = false;
            return;
        }
        compareSpectrumEnabled = compareSpectrumCheckbox.checked;
        scheduleUpdate();
    });
}

// Wire human-centred scenes
document.querySelectorAll('.opt-preset-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const scheduleToggle = document.getElementById('schedule-auto-toggle');
        if (scheduleToggle) scheduleToggle.checked = false;
        stopSchedule();
        document.querySelectorAll('.opt-preset-btn.is-selected').forEach(item => item.classList.remove('is-selected'));
        btn.classList.add('is-selected');
        const scene = typeof CCT_JOURNEY.sceneById === 'function'
            ? CCT_JOURNEY.sceneById(btn.dataset.scene)
            : CCT_JOURNEY.HUMAN_CENTRED_SCENES.find(item => item.id === btn.dataset.scene);
        applyHumanCentredScene(scene);
    });
});

document.getElementById('scene-tab')?.addEventListener('click', () => setOptimizerMode('scene'));
document.getElementById('schedule-tab')?.addEventListener('click', () => setOptimizerMode('schedule'));
document.getElementById('schedule-auto-toggle')?.addEventListener('change', event => {
    if (event.target.checked) startSchedule();
    else stopSchedule();
});
renderScheduleStages();

if (cctJourneyPlayBtn) {
    cctJourneyPlayBtn.addEventListener('click', () => {
        if (cctAnimation.status === 'playing') pauseCctJourney();
        else playCctJourney();
    });
}

if (cctJourneyStopBtn) cctJourneyStopBtn.addEventListener('click', stopCctJourney);

document.addEventListener('visibilitychange', () => {
    if (document.hidden && cctAnimation.status !== 'stopped') stopCctJourney();
});
window.addEventListener('pagehide', stopCctJourney);
window.addEventListener('pagehide', stopSchedule);
window.addEventListener('beforeunload', stopCctJourney);

function syncTargetSliderFill(slider) {
    if (!slider) return;
    const min = Number(slider.min);
    const max = Number(slider.max);
    const value = Number(slider.value);
    const fill = max > min ? ((value - min) / (max - min)) * 100 : 0;
    slider.style.setProperty('--target-fill', `${Math.max(0, Math.min(100, fill))}%`);
}

document.querySelectorAll('.target-row input[type="range"]').forEach(slider => {
    slider.addEventListener('input', () => syncTargetSliderFill(slider));
});

if (exportRecipeBtn && typeof window.RECIPE_BATCH_EXPORT?.initialize === 'function') {
    window.RECIPE_BATCH_EXPORT.initialize({
        button: exportRecipeBtn,
        createContext: createRecipeExportContext,
        buildSingleRecipe,
        buildRegularRecipe,
        buildMetamerRecipe,
        buildPastelRecipe,
        buildSceneRecipe,
        buildBrightnessRecipe,
        cancelActive: cancelRecipeExportOptimization
    });
} else if (exportRecipeBtn) {
    exportRecipeBtn.disabled = true;
    exportRecipeBtn.title = 'XLSX导出模块未加载';
}

window.SpectralAppCharts = Object.freeze({
    refreshCie1931() {
        resizeCanvas();
        renderCIE();
    },
    setChannelPointsVisible(visible) {
        chromaticityChannelPointsVisible = Boolean(visible);
        renderCIE();
    }
});

// Start
init();
})();
