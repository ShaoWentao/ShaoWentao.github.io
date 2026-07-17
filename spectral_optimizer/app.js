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
const COLOUR_QUALITY = window.ColourQuality || {};

// ═══════════════════════════════════════════════
// CHANNEL DEFINITIONS
// ═══════════════════════════════════════════════

// Channel data are engineering approximations, not standard LED chip data.
// To use a real LED package, add either:
// - spd: 401 values from 380nm to 780nm at 1nm spacing, or
// - spdSamples: [[wavelengthNm, relativePower], ...] measured from the chip datasheet.
// When spd/spdSamples is present, the Gaussian peak/sigma model is bypassed.
const CHANNELS_4CH = [
    { id: 'red',       name: 'Red',        nameCN: '红',   peak: 625, sigma: 15, color: '#ff3b3b', colorRGB: [255,59,59],    waveLabel: '625 nm' },
    { id: 'green',     name: 'Green',      nameCN: '绿',   peak: 525, sigma: 20, color: '#2dff6e', colorRGB: [45,255,110],   waveLabel: '525 nm' },
    { id: 'blue',      name: 'Blue',       nameCN: '蓝',   peak: 460, sigma: 15, color: '#3b7dff', colorRGB: [59,125,255],   waveLabel: '460 nm' },
    { id: 'warmwhite', name: 'Warm White', nameCN: '暖白',  peak: null, sigma: null, color: '#ffc966', colorRGB: [255,201,102], waveLabel: '3000K', isWarmWhite: true }
];

const CHANNELS_6CH = [
    { id: 'red',   name: 'Red',   nameCN: '红',   peak: 625, sigma: 15, color: '#ff3b3b', colorRGB: [255,59,59],   waveLabel: '625 nm' },
    { id: 'green', name: 'Green', nameCN: '绿',   peak: 525, sigma: 20, color: '#2dff6e', colorRGB: [45,255,110],  waveLabel: '525 nm' },
    { id: 'blue',  name: 'Blue',  nameCN: '蓝',   peak: 460, sigma: 15, color: '#3b7dff', colorRGB: [59,125,255],  waveLabel: '460 nm' },
    { id: 'cyan',  name: 'Cyan',  nameCN: '青',   peak: 490, sigma: 15, color: '#36d6e7', colorRGB: [54,214,231],  waveLabel: '490 nm' },
    { id: 'lime',  name: 'Lime',  nameCN: '黄绿', peak: 550, sigma: 18, color: '#aaff33', colorRGB: [170,255,51],  waveLabel: '550 nm' },
    { id: 'amber', name: 'Amber', nameCN: '琥珀', peak: 590, sigma: 15, color: '#ff9f33', colorRGB: [255,159,51],  waveLabel: '590 nm' }
];

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
let channelValues = {};   // id -> 0..100
let showD65 = false;
let isOptimizing = false;
let animFrameId = null;
let metamerModeEnabled = false;
let targetRg = 100;
let baselineSnapshot = null;
let compareSpectrumEnabled = false;

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
const optimizerProgress = document.getElementById('optimizer-progress');

// Metric elements
const valCCT = document.getElementById('val-cct');
const valCRI = document.getElementById('val-cri');
const valR9 = document.getElementById('val-r9');
const valRf = document.getElementById('val-rf');
const valMel = document.getElementById('val-mel');
const valCS  = document.getElementById('val-cs');
const valCAF = document.getElementById('val-caf');
const barCCT = document.getElementById('bar-cct');
const barCRI = document.getElementById('bar-cri');
const barR9 = document.getElementById('bar-r9');
const barRf = document.getElementById('bar-rf');
const barMel = document.getElementById('bar-mel');
const barCS  = document.getElementById('bar-cs');
const barCAF = document.getElementById('bar-caf');
const csStatus = document.getElementById('cs-status');

// Optimizer elements
const optimizeButtons = document.querySelectorAll('.optimize-btn');
const progressIter = document.getElementById('progress-iter');
const progressBarFill = document.getElementById('progress-bar-fill');
const progressCS = document.getElementById('progress-cs');
const progressTarget = document.getElementById('progress-target');
const progressError = document.getElementById('progress-error');

// CIE 1931 DOM References
const cieCanvas = document.getElementById('cie-canvas');
const cieCtx = cieCanvas ? cieCanvas.getContext('2d') : null;
const cieCanvasWrapper = document.getElementById('cie-canvas-wrapper');

let cieOffscreenCanvas = null;
let currentX = 0.3127;
let currentY = 0.3290;

// CCT, Duv and illuminance target controllers DOM references
const targetCctSlider = document.getElementById('target-cct-slider');
const targetCctVal = document.getElementById('target-cct-val');
const targetDuvSlider = document.getElementById('target-duv-slider');
const targetDuvVal = document.getElementById('target-duv-val');
const eyeIlluminanceSlider = document.getElementById('eye-illuminance');
const eyeIlluminanceVal = document.getElementById('eye-illuminance-val');
const runOptimizeBtn = document.getElementById('run-optimize-btn');
const metamerModeCheckbox = document.getElementById('metamer-mode-checkbox');
const metamerDependentControls = document.getElementById('metamer-dependent-controls');
const targetRgSlider = document.getElementById('target-rg-slider');
const targetRgVal = document.getElementById('target-rg-val');
const setBaselineBtn = document.getElementById('set-baseline-btn');
const compareSpectrumCheckbox = document.getElementById('compare-spectrum-checkbox');
const metamerStatus = document.getElementById('metamer-status');

// Metric card elements for Rg
const valRg = document.getElementById('val-rg');
const barRg = document.getElementById('bar-rg');

// Target parameters state
let targetCCT = 4000;
let targetDuv = 0.0;
let eyeIlluminance = 300;

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

function projectXY(x, y, w, h, pad = 35) {
    const scaleX = (w - 2 * pad) / 0.85;
    const scaleY = (h - 2 * pad) / 0.85;
    return {
        x: pad + x * scaleX,
        y: h - pad - y * scaleY
    };
}

function generateCIEBackground() {
    if (!cieCanvas || !cieCtx) return;
    const w = cieCanvas._logicalWidth || 300;
    const h = cieCanvas._logicalHeight || 300;
    const dpr = window.devicePixelRatio || 1;
    const pad = 35;
    const scaleX = (w - 2 * pad) / 0.85;
    const scaleY = (h - 2 * pad) / 0.85;

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
    const step = 0.0035;
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
        
        cieCtx.fillText(gx.toFixed(1), pt1.x - 7, h - 18);
    }

    // Horizontal grid lines (y)
    for (let gy = 0.1; gy <= 0.8; gy += 0.1) {
        const pt1 = projectXY(0.0, gy, w, h, pad);
        const pt2 = projectXY(0.85, gy, w, h, pad);
        cieCtx.beginPath();
        cieCtx.moveTo(pt1.x, pt1.y);
        cieCtx.lineTo(pt2.x, pt2.y);
        cieCtx.stroke();
        
        cieCtx.fillText(gy.toFixed(1), 12, pt1.y + 3);
    }
    cieCtx.setLineDash([]); // Reset line dash

    // Grid labels
    cieCtx.fillText('x', w - 16, h - 22);
    cieCtx.fillText('y', 14, 18);

    // 3. Draw Planckian locus (黑体轨迹)
    cieCtx.strokeStyle = isLightTheme ? 'rgba(33, 29, 23, 0.7)' : 'rgba(255, 255, 255, 0.8)';
    cieCtx.lineWidth = 2;
    cieCtx.beginPath();
    
    let first = true;
    for (let t = 1700; t <= 15000; t += 100) {
        const xy = planckianXY(t);
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
    const ticks = [2000, 3000, 4000, 6500, 10000];
    cieCtx.fillStyle = isLightTheme ? '#221e18' : '#ffffff';
    cieCtx.font = '8px "JetBrains Mono", monospace';
    cieCtx.lineWidth = 1;

    for (const t of ticks) {
        const xy = planckianXY(t);
        const pt = projectXY(xy.x, xy.y, w, h, pad);
        cieCtx.beginPath();
        cieCtx.arc(pt.x, pt.y, 2, 0, 2 * Math.PI);
        cieCtx.fill();
        
        // Offset text label
        cieCtx.fillText(`${t}K`, pt.x + 4, pt.y - 4);
    }

    // 4. Draw active channels' gamut boundary
    const activeCh = getActiveChannels();
    // Filter broadband/WW channels for polygon, sort by peak to form convex hull
    const polyCh = activeCh
        .filter(ch => !ch.isWarmWhite && ch.peak)
        .sort((a, b) => a.peak - b.peak);
    
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
            const labelStr = `${ch.isWarmWhite ? 'WW' : (ch.waveLabel.replace(' nm', ''))} (${pct}%)`;
            cieCtx.fillText(labelStr, pt.x + 6, pt.y + 11);
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

    // 6. Draw current mixed color point (Target)
    
    // Outer blinking halo
    const pulse = 6 + 3 * Math.sin(Date.now() / 150);
    cieCtx.strokeStyle = accentColor;
    cieCtx.lineWidth = 1.5;
    cieCtx.beginPath();
    cieCtx.arc(mPt.x, mPt.y, pulse, 0, 2 * Math.PI);
    cieCtx.stroke();

    // Center dot
    cieCtx.fillStyle = '#ffffff';
    cieCtx.beginPath();
    cieCtx.arc(mPt.x, mPt.y, 4, 0, 2 * Math.PI);
    cieCtx.fill();
    cieCtx.strokeStyle = '#000000';
    cieCtx.lineWidth = 1;
    cieCtx.stroke();

    // Floating text metadata
    cieCtx.fillStyle = textColor;
    cieCtx.font = 'bold 9px "JetBrains Mono", monospace';
    const cctVal = Number(valCCT.textContent.replace(/,/g, '')) || 0;
    cieCtx.fillText(`${cctVal}K (${currentX.toFixed(3)}, ${currentY.toFixed(3)})`, mPt.x + 10, mPt.y + 3);
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
    if (lambda <= samples[0][0]) return samples[0][1];
    if (lambda >= samples[samples.length - 1][0]) return samples[samples.length - 1][1];
    for (let i = 0; i < samples.length - 1; i++) {
        const a = samples[i];
        const b = samples[i + 1];
        if (lambda >= a[0] && lambda <= b[0]) {
            const t = (lambda - a[0]) / (b[0] - a[0]);
            return a[1] + (b[1] - a[1]) * t;
        }
    }
    return 0;
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

function simplifiedCSFromDER(melanopicDER) {
    const CLA = eyeIlluminance * Math.max(melanopicDER, 0);
    const CS = 0.7 * (1 - 1 / (1 + Math.pow(CLA / 355.7, 1.1026)));
    return { CLA, CS };
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
        return { cct: 0, ra: 0, r9: 0, rf: 0, rg: 0, melanopicEDI: 0, cs: 0, caf: 0, cla: 0 };
    }

    const sum = X + Y + Z;
    currentX = sum > 0 ? X / sum : 0.3127;
    currentY = sum > 0 ? Y / sum : 0.3290;

    const cct = estimateCCTFromXYZ(X, Y, Z);
    const qualitySpd = [];
    for (let i = 0; i < NUM_POINTS; i += 5) qualitySpd.push(combinedSPD[i]);
    const quality = COLOUR_QUALITY.calculateColourQuality
        ? COLOUR_QUALITY.calculateColourQuality(qualitySpd)
        : { ra: estimateCRI(combinedSPD), r9: 0, rf: 0, rg: estimateRg(combinedSPD, cct) };
    const melanopicDER = melanopicDERFromSums(melSum, vSum);
    const { CLA, CS } = simplifiedCSFromDER(melanopicDER);
    const caf = vSum > 1e-10 ? melSum / vSum : 0;
    return {
        cct: Math.round(cct),
        ra: quality.ra,
        r9: quality.r9,
        rf: quality.rf,
        rg: quality.rg,
        melanopicEDI: melanopicDER,
        cs: CS,
        caf,
        cla: CLA
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

// Compute CS from arbitrary channel values (for optimizer)
function computeCSFromValues(channels, values) {
    let melSum = 0, vSum = 0;
    for (let i = 0; i < NUM_POINTS; i++) {
        let total = 0;
        for (let c = 0; c < channels.length; c++) {
            total += (values[c] / 100) * getChannelSPDValue(channels[c], wavelengths[i]);
        }
        melSum += total * preMel[i] * LAMBDA_STEP;
        vSum += total * preV[i] * LAMBDA_STEP;
    }
    const melanopicDER = melanopicDERFromSums(melSum, vSum);
    return simplifiedCSFromDER(melanopicDER).CS;
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
    if (!compareSpectrumEnabled || !baselineMatchesActiveChannels(channels)) return null;

    const snapshot = baselineSnapshot;
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

    if (hasValidMetrics && !Number.isFinite(targetRg)) updateTargetRgControl(metrics.rg);
    if (targetRgSlider) targetRgSlider.disabled = !hasValidMetrics;
    if (setBaselineBtn) setBaselineBtn.disabled = !hasValidMetrics;
    if (compareSpectrumCheckbox) {
        compareSpectrumCheckbox.disabled = !hasBaseline;
        if (!hasBaseline) compareSpectrumCheckbox.checked = false;
    }
    if (!hasBaseline) compareSpectrumEnabled = false;
    if (runOptimizeBtn) runOptimizeBtn.disabled = metamerModeEnabled && !hasValidMetrics;

    if (!hasValidMetrics && metamerModeEnabled) {
        updateTargetRgControl(NaN);
        setMetamerStatus('Valid spectral data is required to optimize Rg.');
    }

    return hasValidMetrics;
}

function channelDisplayValue(value) {
    return metamerModeEnabled && !Number.isInteger(value)
        ? value.toFixed(1)
        : String(Math.round(value));
}

function syncChannelSliderPrecision() {
    const step = metamerModeEnabled ? '0.5' : '1';
    for (const channel of getActiveChannels()) {
        const value = channelValues[channel.id] || 0;
        const slider = document.getElementById(`ch-slider-${channel.id}`);
        const label = document.getElementById(`ch-val-${channel.id}`);
        const uiValue = metamerModeEnabled ? value : Math.round(value);
        if (slider) {
            slider.step = step;
            slider.value = uiValue;
            slider.style.setProperty('--slider-fill', `${uiValue}%`);
        }
        if (label) label.textContent = `${channelDisplayValue(value)}%`;
    }
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
    setMetamerStatus(`Baseline set: Rg ${Math.round(baselineSnapshot.metrics.rg)}.`);
    scheduleUpdate();
}

function clearBaseline(message = '') {
    baselineSnapshot = null;
    compareSpectrumEnabled = false;
    if (compareSpectrumCheckbox) {
        compareSpectrumCheckbox.checked = false;
        compareSpectrumCheckbox.disabled = true;
    }
    if (message && metamerModeEnabled) setMetamerStatus(message);
}

function metamerOptimizerChannels(channels) {
    return channels.map(channel => {
        const spd = new Array(NUM_POINTS);
        for (let index = 0; index < NUM_POINTS; index++) {
            spd[index] = getChannelSPDValue(channel, wavelengths[index]);
        }
        return { id: channel.id, spd };
    });
}

function runMetamerOptimization() {
    if (!metamerModeEnabled) return;
    if (!window.METAMER_OPTIMIZER || typeof window.METAMER_OPTIMIZER.optimizeMetamer !== 'function') {
        setMetamerStatus('Metamer optimizer is unavailable.');
        return;
    }

    const metrics = calculateMetrics(getCombinedSPD());
    if (!syncMetamerControls(metrics)) return;

    const channels = getActiveChannels();
    if (!baselineMatchesActiveChannels(channels)) {
        setMetamerStatus('Set a baseline before changing Rg.');
        return;
    }

    const result = window.METAMER_OPTIMIZER.optimizeMetamer({
        channels: metamerOptimizerChannels(channels),
        baselineValues: baselineSnapshot.values.slice(),
        targetXy: getTargetXY(targetCCT, targetDuv),
        targetRg,
        evaluateSpd(spd) {
            const xy = xyFromSPD(spd);
            return { ...calculateMetrics(spd), xy };
        },
        xyToUv
    });

    if (!result.feasible || !result.values) {
        setMetamerStatus('No feasible Rg result found for the active colour point.');
        scheduleUpdate();
        return;
    }

    const valuesById = {};
    for (let index = 0; index < channels.length; index++) {
        valuesById[channels[index].id] = result.values[index];
    }
    applyValuesImmediate(valuesById);
    setMetamerStatus(result.exact
        ? `Target achieved: ${Math.round(result.achievedRg)}`
        : `Closest Rg found in current search: ${Math.round(result.achievedRg)}`);
}

// ═══════════════════════════════════════════════
// CANVAS RENDERING
// ═══════════════════════════════════════════════

const PLOT_PADDING = { top: 30, right: 30, bottom: 55, left: 55 };

function resizeCanvas() {
    const dpr = window.devicePixelRatio || 1;
    if (canvasWrapper && canvas) {
        const rect = canvasWrapper.getBoundingClientRect();
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        canvas._logicalWidth = rect.width;
        canvas._logicalHeight = rect.height;
    }
    if (cieCanvasWrapper && cieCanvas && cieCtx) {
        const rect = cieCanvasWrapper.getBoundingClientRect();
        cieCanvas.width = rect.width * dpr;
        cieCanvas.height = rect.height * dpr;
        cieCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
        cieCanvas._logicalWidth = rect.width;
        cieCanvas._logicalHeight = rect.height;
        generateCIEBackground();
    }
}

function renderSPD() {
    const W = canvas._logicalWidth || 800;
    const H = canvas._logicalHeight || 400;
    const plotX = PLOT_PADDING.left;
    const plotY = PLOT_PADDING.top;
    const plotW = W - PLOT_PADDING.left - PLOT_PADDING.right;
    const plotH = H - PLOT_PADDING.top - PLOT_PADDING.bottom;

    ctx.clearRect(0, 0, W, H);

    // ── Background ──
    const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
    bgGrad.addColorStop(0, '#fffaf0');
    bgGrad.addColorStop(1, '#f1eadf');
    ctx.fillStyle = bgGrad;
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
    ctx.fillText('Wavelength λ (nm) | 波长', plotX + plotW / 2, H - 4);

    ctx.save();
    ctx.translate(12, plotY + plotH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('Relative Power | 相对功率', 0, 0);
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

    // ── Compute combined SPD & find max ──
    const channels = getActiveChannels();
    const combined = getCombinedSPD();
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
        ctx.strokeStyle = ch.color + 'cc';
        ctx.lineWidth = 2.1;

        for (let i = 0; i < NUM_POINTS; i++) {
            const val = duty * getChannelSPDValue(ch, wavelengths[i]) * scale;
            const x = plotX + (i / (NUM_POINTS - 1)) * plotW;
            const y = plotY + plotH - val * plotH;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.stroke();

        // Filled area with gradient
        const fillGrad = ctx.createLinearGradient(0, plotY, 0, plotY + plotH);
        fillGrad.addColorStop(0, ch.color + '16');
        fillGrad.addColorStop(1, ch.color + '00');
        ctx.lineTo(plotX + plotW, plotY + plotH);
        ctx.lineTo(plotX, plotY + plotH);
        ctx.closePath();
        ctx.fillStyle = fillGrad;
        ctx.fill();
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
        // Contrast halo
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.88)';
        ctx.lineWidth = 8;
        ctx.lineJoin = 'round';
        for (let i = 0; i < NUM_POINTS; i++) {
            const val = combined[i] * scale;
            const x = plotX + (i / (NUM_POINTS - 1)) * plotW;
            const y = plotY + plotH - val * plotH;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.stroke();

        // Main line
        ctx.beginPath();
        ctx.strokeStyle = '#8a5a10';
        ctx.lineWidth = 3.2;
        ctx.shadowColor = 'rgba(138, 90, 16, 0.22)';
        ctx.shadowBlur = 8;
        for (let i = 0; i < NUM_POINTS; i++) {
            const val = combined[i] * scale;
            const x = plotX + (i / (NUM_POINTS - 1)) * plotW;
            const y = plotY + plotH - val * plotH;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.shadowBlur = 0;

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
        const combinedGrad = ctx.createLinearGradient(0, plotY, 0, plotY + plotH);
        combinedGrad.addColorStop(0, 'rgba(201, 148, 45, 0.18)');
        combinedGrad.addColorStop(0.55, 'rgba(201, 148, 45, 0.06)');
        combinedGrad.addColorStop(1, 'rgba(201, 148, 45, 0)');
        ctx.fillStyle = combinedGrad;
        ctx.fill();
    }

    // ── Plot border ──
    ctx.strokeStyle = 'rgba(42, 37, 30, 0.18)';
    ctx.lineWidth = 1.2;
    ctx.strokeRect(plotX, plotY, plotW, plotH);
}

// ═══════════════════════════════════════════════
// METRICS DISPLAY
// ═══════════════════════════════════════════════

let prevMetrics = { cct: 0, ra: 0, r9: 0, rf: 0, rg: 0, melanopicEDI: 0, cs: 0, caf: 0 };

function updateMetrics() {
    const combined = getCombinedSPD();
    const m = calculateMetrics(combined);
    if (metamerModeEnabled) syncMetamerControls(m);

    // CCT
    updateMetricCard('cct', valCCT, barCCT, m.cct, prevMetrics.cct, {
        format: v => v > 0 ? Math.round(v).toLocaleString() : '--',
        barFill: Math.min(100, (m.cct / 10000) * 100),
        barColor: m.cct < 3500 ? '#ffb347' : m.cct < 5000 ? '#e4b85b' : '#f6f1e8'
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
    updateMetricCard('mel', valMel, barMel, m.melanopicEDI, prevMetrics.melanopicEDI, {
        format: v => v > 0 ? v.toFixed(2) : '--',
        barFill: Math.min(100, m.melanopicEDI * 50),
        barColor: '#e4b85b'
    });

    // CS
    updateMetricCard('cs', valCS, barCS, m.cs, prevMetrics.cs, {
        format: v => v > 0 ? v.toFixed(3) : '--',
        barFill: (m.cs / 0.7) * 100,
        barColor: m.cs > 0.3 ? '#a6e96b' : m.cs > 0.1 ? '#e4b85b' : '#ff6b25'
    });

    // CS status badge
    if (m.cs > 0.3) {
        csStatus.textContent = '唤醒';
        csStatus.className = 'cs-status alerting';
    } else if (m.cs > 0.1) {
        csStatus.textContent = '过渡';
        csStatus.className = 'cs-status moderate';
    } else {
        csStatus.textContent = '助眠';
        csStatus.className = 'cs-status sleep';
    }

    // CAF
    updateMetricCard('caf', valCAF, barCAF, m.caf, prevMetrics.caf, {
        format: v => v > 0 ? v.toFixed(3) : '--',
        barFill: Math.min(100, m.caf * 50),
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

    prevMetrics = { cct: m.cct, ra: m.ra, r9: m.r9, rf: m.rf, melanopicEDI: m.melanopicEDI, cs: m.cs, caf: m.caf, rg: m.rg };
}

function updateMetricCard(id, valueEl, barEl, newVal, oldVal, opts) {
    valueEl.textContent = opts.format(newVal);
    barEl.style.setProperty('--bar-fill', `${opts.barFill}%`);
    barEl.style.setProperty('--bar-color', opts.barColor);

    // Pulse on change
    if (Math.abs(newVal - oldVal) > 0.001) {
        const card = document.getElementById(`card-${id}`);
        card.classList.remove('pulse');
        void card.offsetWidth; // trigger reflow
        card.classList.add('pulse');
    }
}

function updateMetricDelta(valueEl, value, baselineValue) {
    if (!Number.isFinite(value) || !Number.isFinite(baselineValue)) return;

    const delta = Math.round(value - baselineValue);
    const deltaEl = document.createElement('span');
    deltaEl.className = `metric-delta metric-delta-${delta > 0 ? 'positive' : delta < 0 ? 'negative' : 'neutral'}`;
    deltaEl.textContent = `(${delta >= 0 ? '+' : ''}${delta})`;
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
        const uiValue = metamerModeEnabled ? value : Math.round(value);
        row.className = 'channel-row fade-in';
        row.id = `ch-row-${ch.id}`;
        row.innerHTML = `
            <div class="channel-header">
                <span class="channel-label">
                    <span class="channel-dot" style="color: ${ch.color}; background: ${ch.color};"></span>
                    <span>${ch.nameCN} ${ch.name}</span>
                    <span class="channel-wavelength">${ch.waveLabel}</span>
                </span>
                <span class="channel-value" id="ch-val-${ch.id}" style="color: ${ch.color};">${channelDisplayValue(value)}%</span>
            </div>
            <input type="range" class="channel-slider" id="ch-slider-${ch.id}"
                   min="0" max="100" step="${metamerModeEnabled ? '0.5' : '1'}" value="${uiValue}"
                   style="--ch-color: ${ch.color}; --slider-fill: ${uiValue}%;"
                   aria-label="${ch.name} channel duty cycle">
        `;
        channelsContainer.appendChild(row);

        // Slider event
        const slider = row.querySelector('.channel-slider');
        slider.addEventListener('input', debounce(() => {
            const val = metamerModeEnabled ? parseFloat(slider.value) : parseInt(slider.value, 10);
            channelValues[ch.id] = val;
            document.getElementById(`ch-val-${ch.id}`).textContent = `${channelDisplayValue(val)}%`;
            slider.style.setProperty('--slider-fill', `${val}%`);
            scheduleUpdate();
        }, 8));
    }
}

function updateModeLabels() {
    if (importedChannels) {
        modeLabel4.textContent = `${importedChannels.length}-Channel SPD`;
        modeLabel6.textContent = 'Imported';
        modeLabel4.classList.add('active');
        modeLabel6.classList.remove('active');
        return;
    }
    modeLabel4.textContent = '4-Channel';
    modeLabel6.textContent = '6-Ch RGBCLA';
    modeLabel4.classList.toggle('active', currentMode === 4);
    modeLabel6.classList.toggle('active', currentMode === 6);
}

function setImportStatus(text, isError = false) {
    if (!spdImportStatus) return;
    spdImportStatus.textContent = text;
    spdImportStatus.style.color = isError ? '#ff7b7b' : '';
}

function detectDelimiter(line) {
    if (line.includes('\t')) return /\t+/;
    if (line.includes(',')) return /\s*,\s*/;
    if (line.includes(';')) return /\s*;\s*/;
    return /\s+/;
}

function parseNumberCell(value) {
    if (value === undefined || value === null) return NaN;
    return Number(String(value).trim().replace('%', '').replace(',', '.'));
}

function parseSPDText(text, fileName = 'Imported SPD') {
    const rawLines = text.split(/\r?\n/)
        .map(line => line.trim())
        .filter(line => line && !line.startsWith('#') && !line.startsWith('//'));

    if (rawLines.length < 2) {
        throw new Error('文件内容太少，无法读取 SPD。');
    }

    const firstParts = rawLines[0].split(detectDelimiter(rawLines[0])).filter(Boolean);
    const hasHeader = !Number.isFinite(parseNumberCell(firstParts[0]));
    const headers = hasHeader ? firstParts : [];
    const dataLines = hasHeader ? rawLines.slice(1) : rawLines;

    const rows = [];
    let channelCount = 0;
    for (const line of dataLines) {
        const parts = line.split(detectDelimiter(line)).filter(Boolean);
        const wavelength = parseNumberCell(parts[0]);
        if (!Number.isFinite(wavelength)) continue;
        const values = parts.slice(1).map(parseNumberCell);
        if (!channelCount) channelCount = values.length;
        if (values.length < channelCount) continue;
        rows.push({ wavelength, values: values.slice(0, channelCount) });
    }

    if (channelCount < 3 || channelCount > 6) {
        throw new Error('请提供 3 到 6 个通道的数据列。');
    }
    if (rows.length < 10) {
        throw new Error('有效波长数据太少，建议至少提供 380-780nm 范围内的多行数据。');
    }

    rows.sort((a, b) => a.wavelength - b.wavelength);

    const channelSamples = [];
    for (let c = 0; c < channelCount; c++) {
        const rawSamples = rows
            .map(row => [row.wavelength, Math.max(0, row.values[c] || 0)])
            .filter(sample => sample[0] >= 300 && sample[0] <= 830 && Number.isFinite(sample[1]));

        const max = rawSamples.reduce((m, sample) => Math.max(m, sample[1]), 0);
        if (max <= 1e-9) {
            throw new Error(`第 ${c + 1} 个通道没有有效功率数据。`);
        }
        channelSamples.push(rawSamples);
    }

    const keepRelativePower = !preserveChannelPower || preserveChannelPower.checked;
    const normalizedSamples = SPECTRAL_MATH.normalizeImportedChannels
        ? SPECTRAL_MATH.normalizeImportedChannels(channelSamples, keepRelativePower)
        : channelSamples;

    const channels = [];
    for (let c = 0; c < channelCount; c++) {
        const samples = normalizedSamples[c];
        let peakSample = samples[0];
        for (const sample of samples) {
            if (sample[1] > peakSample[1]) peakSample = sample;
        }

        const headerName = headers[c + 1] && headers[c + 1].trim();
        const color = IMPORT_COLORS[c % IMPORT_COLORS.length];
        channels.push({
            id: `imported-${c + 1}`,
            name: headerName || `Channel ${c + 1}`,
            nameCN: `通道${c + 1}`,
            peak: peakSample[0],
            sigma: null,
            color,
            colorRGB: IMPORT_COLOR_RGB[c % IMPORT_COLOR_RGB.length],
            waveLabel: `${Math.round(peakSample[0])} nm`,
            spdSamples: samples,
            imported: true,
            sourceName: fileName
        });
    }
    return channels;
}

function loadImportedChannels(channels, fileName) {
    clearBaseline('Baseline cleared: imported channel set changed.');
    importedChannels = channels;
    currentMode = channels.length;
    channelValues = {};
    for (const ch of importedChannels) channelValues[ch.id] = 100;
    updateModeLabels();
    buildChannelSliders();
    const calibration = !preserveChannelPower || preserveChannelPower.checked ? '保留相对功率' : '各通道峰值归一化';
    setImportStatus(`已导入 ${channels.length} 通道：${fileName}（${calibration}）`);
    scheduleUpdate();
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
    clearBaseline('Baseline cleared: channel mode changed.');
    importedChannels = null;
    setImportStatus('已切换回内置模拟通道');
    currentMode = modeCheckbox.checked ? 6 : 4;
    updateModeLabels();
    buildChannelSliders();
    scheduleUpdate();
});

// Init mode labels
updateModeLabels();

// D65 toggle
d65Toggle.addEventListener('change', () => {
    showD65 = d65Toggle.checked;
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
    const spd = new Float64Array(NUM_POINTS);
    const c2 = 1.4387752e7; // nm*K
    for (let i = 0; i < NUM_POINTS; i++) {
        const l = wavelengths[i];
        spd[i] = 1.0 / (Math.pow(l, 5) * (Math.exp(c2 / (l * T)) - 1));
    }
    const maxVal = Math.max(...spd);
    if (maxVal > 0) {
        for (let i = 0; i < NUM_POINTS; i++) {
            spd[i] /= maxVal;
        }
    }
    return spd;
}

document.querySelectorAll('.preset-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const presetKey = btn.dataset.preset;
        if (!presetKey) return;
        
        // 1. Reset check
        if (presetKey === 'reset') {
            const values = {};
            const channels = getActiveChannels();
            for (const ch of channels) values[ch.id] = 0;
            animateToValues(values, 500);
            return;
        }

        // 2. Dynamic CCT preset check (e.g. cct-1700)
        if (presetKey.startsWith('cct-')) {
            const cct = parseInt(presetKey.replace('cct-', ''));
            if (Number.isFinite(cct)) {
                const refSpd = getPlanckianSPD(cct);
                const fitted = fitChannelsToReference(refSpd);
                animateToValues(fitted, 600);
                return;
            }
        }

        // 3. Static references check (e.g. d50, daylight)
        const preset = PRESETS[presetKey];
        if (!preset) return;
        if (preset.reference) {
            const fitted = fitChannelsToReference(CIE_DATA[preset.reference]);
            animateToValues(fitted, 600);
            return;
        }
        const values = (preset.valuesByMode ? (preset.valuesByMode[currentMode] || preset.valuesByMode[4]) : preset.values) || {};
        animateToValues(values, 500);
    });
});



function fitChannelsToReference(referenceSPD) {
    const channels = getActiveChannels();
    if (!referenceSPD || !referenceSPD.length || !channels.length) {
        return {};
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
        result[channels[c].id] = Math.round(Math.max(0, Math.min(100, bestValues[c])));
    }
    return result;
}

function animateToValues(targetValues, duration = 500) {
    if (animFrameId !== null) {
        cancelAnimationFrame(animFrameId);
        animFrameId = null;
    }
    const channels = getActiveChannels();
    const startValues = {};
    for (const ch of channels) {
        startValues[ch.id] = channelValues[ch.id] || 0;
    }

    const startTime = performance.now();

    function animate(now) {
        const t = Math.min((now - startTime) / duration, 1);
        const eased = easeInOutCubic(t);

        for (const ch of channels) {
            const target = targetValues[ch.id] !== undefined ? targetValues[ch.id] : channelValues[ch.id];
            const val = Math.round(startValues[ch.id] + (target - startValues[ch.id]) * eased);
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
        }
    }

    animFrameId = requestAnimationFrame(animate);
}

function easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

// ═══════════════════════════════════════════════
// AI OPTIMIZER
// ═══════════════════════════════════════════════

optimizeButtons.forEach(btn => {
    const target = Number(btn.dataset.targetCs || NaN);
    const targetCCT = Number(btn.dataset.targetCct || NaN);
    if (!Number.isFinite(target)) return;
    btn.dataset.targetCs = String(target);
    btn.addEventListener('click', () => runOptimizer(target, targetCCT));
});

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

function optimizeValuesForScene(channels, targetCCT, targetDuv) {
    const n = channels.length;

    // A neutral CCT target must use the same full-spectrum fit as the CCT
    // preset buttons. Matching chromaticity alone can produce a metamer with
    // very different colour-quality and circadian metrics.
    if (Math.abs(targetDuv) < 1e-9) {
        const fitted = fitChannelsToReference(getPlanckianSPD(targetCCT));
        const values = channels.map(ch => fitted[ch.id] || 0);
        const finalSpd = combinedSPDFromValues(channels, values);
        const finalXy = xyFromSPD(finalSpd);
        const targetXyLoc = getTargetXY(targetCCT, 0);
        return {
            values,
            cct: computeCCTFromValues(channels, values),
            error: Math.hypot(finalXy.x - targetXyLoc.x, finalXy.y - targetXyLoc.y)
        };
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
    let bestCS = 0;

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
            bestCS = computeCSFromValues(channels, values);
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

async function runOptimizer(tgtCCT, tgtDuv) {
    if (isOptimizing) return;
    if (animFrameId !== null) {
        cancelAnimationFrame(animFrameId);
        animFrameId = null;
    }
    isOptimizing = true;
    if (runOptimizeBtn) runOptimizeBtn.disabled = true;
    document.querySelectorAll('.opt-preset-btn').forEach(btn => btn.disabled = true);
    optimizerProgress.style.display = 'block';
    progressTarget.textContent = `${tgtCCT} K / ${tgtDuv >= 0 ? '+' : ''}${tgtDuv.toFixed(4)}`;

    const channels = getActiveChannels();
    const n = channels.length;

    const solved = optimizeValuesForScene(channels, tgtCCT, tgtDuv);
    const values = solved.values;
    progressIter.textContent = '1 / 1';
    progressBarFill.style.width = '100%';
    progressCS.textContent = solved.cct.toFixed(0) + ' K';
    progressError.textContent = solved.error.toFixed(4);

    const finalValues = {};
    for (let c = 0; c < n; c++) {
        finalValues[channels[c].id] = Math.round(values[c]);
    }
    animateToValues(finalValues, 400);

    await sleep(500);

    isOptimizing = false;
    if (runOptimizeBtn) runOptimizeBtn.disabled = false;
    document.querySelectorAll('.opt-preset-btn').forEach(btn => btn.disabled = false);

    setTimeout(() => {
        if (!isOptimizing) {
            optimizerProgress.style.display = 'none';
        }
    }, 3000);
}

function applyValuesImmediate(vals) {
    const channels = getActiveChannels();
    for (const ch of channels) {
        if (vals[ch.id] === undefined) continue;
        channelValues[ch.id] = vals[ch.id];
        const slider = document.getElementById(`ch-slider-${ch.id}`);
        const label = document.getElementById(`ch-val-${ch.id}`);
        const uiValue = metamerModeEnabled ? vals[ch.id] : Math.round(vals[ch.id]);
        if (slider) {
            slider.step = metamerModeEnabled ? '0.5' : '1';
            slider.value = uiValue;
            slider.style.setProperty('--slider-fill', `${uiValue}%`);
        }
        if (label) label.textContent = `${channelDisplayValue(vals[ch.id])}%`;
    }
    scheduleUpdate();
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// ═══════════════════════════════════════════════
// RENDER LOOP & DEBOUNCE
// ═══════════════════════════════════════════════

let updateScheduled = false;

function scheduleUpdate() {
    if (!updateScheduled) {
        updateScheduled = true;
        requestAnimationFrame(() => {
            try {
                renderSPD();
                updateMetrics();
                renderCIE();
            } catch (err) {
                console.error("Error in scheduleUpdate frame:", err);
            } finally {
                updateScheduled = false;
            }
        });
    }
}

function debounce(fn, delay) {
    let timer;
    return function(...args) {
        clearTimeout(timer);
        timer = setTimeout(() => fn.apply(this, args), delay);
    };
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

    resizeCanvas();
    buildChannelSliders();

    // Set initial values for a nice demo
    const initial = { red: 30, green: 45, blue: 55, warmwhite: 40, cyan: 35, lime: 30, amber: 25 };
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
}

function runRealtimeOptimizer() {
    const channels = getActiveChannels();
    const n = channels.length;
    if (n === 0) return;

    if (Math.abs(targetDuv) < 1e-9) {
        const fitted = fitChannelsToReference(getPlanckianSPD(targetCCT));
        applyValuesImmediate(fitted);
        return;
    }
    
    const currentVals = channels.map(ch => channelValues[ch.id] || 0);
    let bestVals = [...currentVals];
    const tXy = getTargetXY(targetCCT, targetDuv);
    
    function loss(values) {
        const spd = combinedSPDFromValues(channels, values);
        const { X, Y, Z } = xyzFromSPD(spd);
        const sum = X + Y + Z;
        if (sum <= 1e-12) return 999.0;
        
        const x = X / sum;
        const y = Y / sum;
        const cct = estimateCCTFromXYZ(X, Y, Z);
        const cctError = Number.isFinite(cct) && cct > 0 ? Math.log(cct / targetCCT) : 2;
        const xyError = (x - tXy.x) * (x - tXy.x) + (y - tXy.y) * (y - tXy.y);
        
        const avg = values.reduce((sum, v) => sum + v, 0) / n;
        const dimmingPenalty = (100.0 - avg) * 0.000005;

        return cctError * cctError * 1.5 + xyError * 980.0 + dimmingPenalty;
    }
    
    let bestLoss = loss(bestVals);
    let stepSize = 8.0;
    for (let iter = 0; iter < 3; iter++) {
        let improved = false;
        for (let i = 0; i < n; i++) {
            const original = bestVals[i];
            
            bestVals[i] = Math.max(0, Math.min(100, original + stepSize));
            let lPlus = loss(bestVals);
            
            bestVals[i] = Math.max(0, Math.min(100, original - stepSize));
            let lMinus = loss(bestVals);
            
            if (lPlus < bestLoss && lPlus < lMinus) {
                bestLoss = lPlus;
                bestVals[i] = Math.max(0, Math.min(100, original + stepSize));
                improved = true;
            } else if (lMinus < bestLoss) {
                bestLoss = lMinus;
                bestVals[i] = Math.max(0, Math.min(100, original - stepSize));
                improved = true;
            } else {
                bestVals[i] = original;
            }
        }
        stepSize *= 0.5;
        if (!improved && stepSize < 0.5) break;
    }
    
    for (let i = 0; i < n; i++) {
        channelValues[channels[i].id] = Math.round(bestVals[i]);
    }
    
    channels.forEach(ch => {
        const val = channelValues[ch.id];
        const input = document.getElementById(`ch-slider-${ch.id}`);
        const valDisp = document.getElementById(`ch-val-${ch.id}`);
        if (input) {
            input.value = val;
            input.style.setProperty('--slider-fill', `${val}%`);
        }
        if (valDisp) {
            valDisp.textContent = `${val}%`;
        }
    });
}

// Wire CCT, Duv, and Rg target sliders
if (targetCctSlider) {
    targetCctSlider.addEventListener('input', () => {
        targetCCT = parseInt(targetCctSlider.value);
        targetCctVal.textContent = `${targetCCT} K`;
        if (metamerModeEnabled) runMetamerOptimization();
        else runRealtimeOptimizer();
        scheduleUpdate();
    });
}
if (targetDuvSlider) {
    targetDuvSlider.addEventListener('input', () => {
        targetDuv = parseFloat(targetDuvSlider.value);
        targetDuvVal.textContent = `${targetDuv >= 0 ? '+' : ''}${targetDuv.toFixed(4)}`;
        if (metamerModeEnabled) runMetamerOptimization();
        else runRealtimeOptimizer();
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

if (metamerModeCheckbox) {
    metamerModeCheckbox.addEventListener('change', () => {
        metamerModeEnabled = metamerModeCheckbox.checked;
        if (metamerDependentControls) metamerDependentControls.hidden = !metamerModeEnabled;
        if (!metamerModeEnabled) {
            if (runOptimizeBtn) runOptimizeBtn.disabled = false;
            syncChannelSliderPrecision();
            scheduleUpdate();
            return;
        }

        const metrics = calculateMetrics(getCombinedSPD());
        if (!syncMetamerControls(metrics)) {
            syncChannelSliderPrecision();
            scheduleUpdate();
            return;
        }
        updateTargetRgControl(metrics.rg);
        setMetamerStatus(baselineSnapshot
            ? 'Choose a target Rg.'
            : 'Set a baseline before changing Rg.');
        syncChannelSliderPrecision();
        scheduleUpdate();
    });
}

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

// Wire optimizer presets
document.querySelectorAll('.opt-preset-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const cct = parseInt(btn.dataset.cct);
        const duv = parseFloat(btn.dataset.duv || "0.0");
        targetCCT = cct;
        targetDuv = duv;
        
        if (targetCctSlider) {
            targetCctSlider.value = cct;
            targetCctVal.textContent = `${cct} K`;
        }
        if (targetDuvSlider) {
            targetDuvSlider.value = duv;
            targetDuvVal.textContent = `${duv >= 0 ? '+' : ''}${duv.toFixed(4)}`;
        }
        if (metamerModeEnabled) runMetamerOptimization();
        else runRealtimeOptimizer();
        scheduleUpdate();
    });
});

// Wire Optimize Now action button
if (runOptimizeBtn) {
    runOptimizeBtn.addEventListener('click', () => {
        if (metamerModeEnabled) runMetamerOptimization();
        else runOptimizer(targetCCT, targetDuv);
    });
}

// Start
init();

})();
