(function (root) {
    'use strict';

    const DATA = root.MATERIAL_REFLECTANCE_DATA;
    const COLOR = root.MaterialColor;
    let selectedId = 'wood_warm_oak';
    let latestResults = [];
    let latestContext = null;
    let pendingFrame = 0;
    let pendingPayload = null;
    let lastKey = '';

    const categoryLabels = {
        wood: '木材',
        leather: '皮革',
        fabric: '织物',
        plant: '绿植',
        'skin-tone-sample': '肤色样本',
        neutral: '中性表面'
    };

    const texturePositions = {
        wood_warm_oak: 0,
        wood_dark_walnut: 1,
        leather_cognac: 2,
        fabric_warm_beige: 3,
        leaf_green: 4,
        skin_tone_sample: 5,
        neutral_wall_matte: 6
    };

    function element(id) {
        return document.getElementById(id);
    }

    function signed(value, digits) {
        if (!Number.isFinite(value)) return '--';
        const rounded = Math.abs(value) < 0.5 * 10 ** -digits ? 0 : value;
        return `${rounded > 0 ? '+' : ''}${rounded.toFixed(digits)}`;
    }

    function deltaLevel(deltaE) {
        if (!Number.isFinite(deltaE)) return '';
        if (deltaE <= 1) return 'low';
        if (deltaE <= 3) return 'medium';
        return 'high';
    }

    function deltaDescription(deltaE) {
        if (!Number.isFinite(deltaE)) return '等待光谱数据';
        if (deltaE <= 1) return '差异很小';
        if (deltaE <= 2) return '轻微差异';
        if (deltaE <= 3) return '可以察觉';
        return '差异明显';
    }

    function labToRgb(lab) {
        if (!Array.isArray(lab) || lab.length < 3) return 'rgb(220 220 220)';
        const [L, a, b] = lab;
        const fy = (L + 16) / 116;
        const fx = fy + a / 500;
        const fz = fy - b / 200;
        const inverse = value => {
            const cube = value ** 3;
            return cube > 216 / 24389 ? cube : (116 * value - 16) / 903.3;
        };
        let x = 0.95047 * inverse(fx);
        let y = inverse(fy);
        let z = 1.08883 * inverse(fz);
        let r = 3.2406 * x - 1.5372 * y - 0.4986 * z;
        let g = -0.9689 * x + 1.8758 * y + 0.0415 * z;
        let blue = 0.0557 * x - 0.2040 * y + 1.0570 * z;
        const encode = value => {
            const gamma = value <= 0.0031308 ? 12.92 * value : 1.055 * value ** (1 / 2.4) - 0.055;
            return Math.round(Math.max(0, Math.min(1, gamma)) * 255);
        };
        return `rgb(${encode(r)} ${encode(g)} ${encode(blue)})`;
    }

    function textureStyle(materialId) {
        const index = texturePositions[materialId] || 0;
        return `--texture-x:${index * 16.6667}%;`;
    }

    function renderSelector() {
        const selector = element('material-selector');
        if (!selector || !DATA) return;
        selector.innerHTML = '';
        DATA.listMaterials().forEach(material => {
            const result = latestResults.find(item => item.materialId === material.id);
            const button = document.createElement('button');
            button.type = 'button';
            button.dataset.materialId = material.id;
            button.classList.toggle('is-selected', material.id === selectedId);
            button.setAttribute('aria-pressed', material.id === selectedId ? 'true' : 'false');
            button.innerHTML = `
                <span class="material-thumb" style="${textureStyle(material.id)}" aria-hidden="true"></span>
                <span class="material-selector-copy">
                    <strong>${material.nameCN}</strong>
                    <small>${result ? `${deltaDescription(result.deltaE00)} · ΔE00 ${result.deltaE00.toFixed(2)}` : '等待计算'}</small>
                </span>`;
            button.addEventListener('click', () => {
                selectedId = material.id;
                renderSelector();
                renderDetail();
            });
            selector.appendChild(button);
        });
    }

    function setMetric(id, value, note, level) {
        const card = element(`material-${id}`);
        if (!card) return;
        const valueElement = card.querySelector('strong');
        const noteElement = card.querySelector('small');
        if (valueElement) valueElement.textContent = value;
        if (noteElement) noteElement.textContent = note;
        if (level) card.dataset.level = level;
        else delete card.dataset.level;
    }

    function updateAppearance(id, material, lab) {
        const appearance = element(id);
        if (!appearance) return;
        appearance.style.cssText = `${textureStyle(material.id)}--appearance-color:${labToRgb(lab)};`;
    }

    function renderDetail() {
        const material = DATA && DATA.getMaterial(selectedId);
        const result = latestResults.find(item => item.materialId === selectedId);
        if (!material) return;

        element('material-detail-title').textContent = material.nameCN;
        element('material-detail-description').textContent = material.intendedUseCN || material.intendedUse;
        element('material-detail-category').textContent = categoryLabels[material.category] || material.category;
        element('material-detail-source').textContent = material.sourceType === 'measured'
            ? `实测样本 · ${material.sourceName || '可追溯数据库'}`
            : '工程模型 · 可替换为实测数据';

        if (result) {
            updateAppearance('material-reference-appearance', material, result.reference.lab);
            updateAppearance('material-current-appearance', material, result.candidate.lab);
        } else {
            updateAppearance('material-reference-appearance', material);
            updateAppearance('material-current-appearance', material);
        }

        const deltaLNote = !result ? '±1 接近'
            : Math.abs(result.deltaL) <= 1 ? '明度接近'
                : result.deltaL > 0 ? '当前更亮' : '当前更暗';
        const deltaCNote = !result ? '正值更鲜艳'
            : Math.abs(result.deltaCPercent) <= 2 ? '彩度接近'
                : result.deltaC > 0 ? '当前更鲜艳' : '当前更柔和';
        const deltaHNote = !result ? '±1° 较稳定'
            : Math.abs(result.deltaH) <= 1 ? '色相稳定'
                : result.deltaH > 0 ? '色相顺时针偏移' : '色相逆时针偏移';

        setMetric('delta-l', result ? signed(result.deltaL, 2) : '--', deltaLNote);
        setMetric('delta-c-percent', result ? `${signed(result.deltaCPercent, 1)}%` : '--', deltaCNote);
        setMetric('delta-h', result ? `${signed(result.deltaH, 2)}°` : '--', deltaHNote);
        setMetric(
            'delta-e',
            result ? result.deltaE00.toFixed(2) : '--',
            result ? `${deltaDescription(result.deltaE00)} · ≤1 很小 / >3 明显` : '综合色差',
            result ? deltaLevel(result.deltaE00) : ''
        );
    }

    function spectrumKey(spd, cct) {
        const values = Array.from(spd || []);
        if (!values.length) return `empty:${cct}`;
        const picks = [0, 40, 80, 120, 160, 200, 240, 280, 320, 360, 400];
        return `${Math.round(cct)}:${picks.map(index => (Number(values[index]) || 0).toFixed(5)).join(':')}`;
    }

    function calculate(payload) {
        pendingFrame = 0;
        if (!payload || !COLOR || !DATA) return;
        const cct = Number(payload.metrics?.quality?.cct || payload.metrics?.cct);
        const key = spectrumKey(payload.spd, cct);
        if (key === lastKey) return;
        lastKey = key;

        if (!(cct > 0)) {
            latestResults = [];
            latestContext = null;
        } else {
            try {
                latestResults = COLOR.calculateAllMaterials(payload.spd, { cct, referenceMode: 'auto' });
                latestContext = {
                    cct,
                    reference: cct >= 5000 ? 'CIE D 系列日光参考' : '黑体参考'
                };
            } catch (error) {
                latestResults = [];
                latestContext = null;
                console.warn('Material appearance calculation unavailable:', error);
            }
        }

        const reference = element('material-reference');
        reference.textContent = latestContext
            ? `${latestContext.reference} · ${Math.round(latestContext.cct).toLocaleString()} K`
            : '等待有效光谱';
        renderSelector();
        renderDetail();
    }

    function update(spd, metrics) {
        pendingPayload = { spd: Array.from(spd || []), metrics };
        if (pendingFrame) return;
        pendingFrame = requestAnimationFrame(() => calculate(pendingPayload));
    }

    function init() {
        if (!DATA || !COLOR) {
            const panel = element('material-panel');
            if (panel) panel.hidden = true;
            return;
        }
        renderSelector();
        renderDetail();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
        init();
    }

    root.MaterialPanel = Object.freeze({ update });
})(typeof globalThis !== 'undefined' ? globalThis : window);
