/*
 * material-upload.js
 * User material management for the spectral optimizer.
 *
 * Handles importing CSV reflectance curves and material photos, persisting
 * user materials to localStorage, and injecting them into the built-in
 * material list at runtime.
 */
(function (root) {
    'use strict';

    var STORAGE_KEY = 'spectral_optimizer_user_materials';
    var PHOTO_MAX_BYTES = 2 * 1024 * 1024; // 2 MB per photo
    var WAVELENGTH_COUNT = 81;
    var WL_START = 380;
    var WL_STEP = 5;

    /* ---- Helpers ---- */

    function clampReflectance(v) {
        return Math.max(0, Math.min(1, Number.isFinite(v) ? v : 0));
    }

    function interpolateToGrid(pairs) {
        var sorted = pairs
            .map(function (p) { return [Number(p[0]), Number(p[1])]; })
            .filter(function (p) { return Number.isFinite(p[0]) && Number.isFinite(p[1]); })
            .sort(function (a, b) { return a[0] - b[0]; });
        if (sorted.length === 0) return null;
        var result = [];
        for (var i = 0; i < WAVELENGTH_COUNT; i++) {
            var wl = WL_START + i * WL_STEP;
            if (wl <= sorted[0][0]) { result.push(clampReflectance(sorted[0][1])); continue; }
            if (wl >= sorted[sorted.length - 1][0]) { result.push(clampReflectance(sorted[sorted.length - 1][1])); continue; }
            for (var j = 1; j < sorted.length; j++) {
                if (wl <= sorted[j][0]) {
                    var left = sorted[j - 1], right = sorted[j];
                    var ratio = (wl - left[0]) / (right[0] - left[0]);
                    result.push(clampReflectance(left[1] + (right[1] - left[1]) * ratio));
                    break;
                }
            }
        }
        return result;
    }

    function likelyHasWavelengthColumn(lines) {
        // If first numeric column of first data row is between 300 and 850, it's probably wavelength
        for (var i = 0; i < Math.min(lines.length, 5); i++) {
            var nums = lines[i].split(/[,\t\s]+/).map(Number).filter(function (v) { return Number.isFinite(v); });
            if (nums.length >= 2 && nums[0] >= 300 && nums[0] <= 850) return true;
        }
        return false;
    }

    function isHeaderLine(line) {
        var trimmed = line.trim();
        if (!trimmed || trimmed[0] === '#') return true;
        // Heuristic: if line starts with non-numeric, it's a header
        var firstChar = trimmed[0];
        if (firstChar !== '-' && firstChar !== '.' && firstChar !== '+' && (firstChar < '0' || firstChar > '9')) return true;
        return false;
    }

    /* ---- CSV Parsing ---- */

    function parseReflectanceCSV(text) {
        if (!text || typeof text !== 'string') return { error: '文件内容为空' };

        var lines = text.split(/\r?\n/).filter(function (line) {
            return line.trim() && !isHeaderLine(line);
        });

        if (lines.length < 5) return { error: '数据行不足（需 ≥5 行有效数据），请检查文件格式：第一列波长nm，第二列反射率0–1' };

        var hasWL = likelyHasWavelengthColumn(lines);

        var pairs = [];
        for (var i = 0; i < lines.length; i++) {
            var nums = lines[i].split(/[,\t\s]+/).map(Number).filter(function (v) { return Number.isFinite(v); });
            if (nums.length < 2 && hasWL) continue;
            if (hasWL) {
                pairs.push([nums[0], nums[1]]);
            } else {
                // Assume 1nm steps starting from some wavelength — just use index + value
                pairs.push([WL_START + i * WL_STEP, nums[0]]);
            }
        }

        if (pairs.length < 5) return { error: '未能解析到足够的波长-反射率数据对（需 ≥5 对）' };

        // Detect if values are percentages (max > 1.5)
        var maxVal = pairs.reduce(function (m, p) { return Math.max(m, p[1]); }, 0);
        if (maxVal > 1.5) {
            pairs = pairs.map(function (p) { return [p[0], p[1] / 100]; });
        }

        var values = interpolateToGrid(pairs);
        if (!values || values.length !== WAVELENGTH_COUNT) {
            return { error: '插值失败：波长范围需覆盖 380–780 nm' };
        }

        return { values: values, originalPairs: pairs.length, hasWL: hasWL };
    }

    /* ---- Photo Upload ---- */

    function readPhotoFile(file) {
        return new Promise(function (resolve, reject) {
            if (!file) return resolve(null);
            if (!file.type.match(/^image\/(png|jpeg|webp)$/)) return reject(new Error('仅支持 PNG / JPEG / WebP 格式'));
            if (file.size > PHOTO_MAX_BYTES) return reject(new Error('照片大小不能超过 2 MB'));
            var reader = new FileReader();
            reader.onload = function () { resolve(reader.result); };
            reader.onerror = function () { reject(new Error('照片读取失败')); };
            reader.readAsDataURL(file);
        });
    }

    /* ---- localStorage Persistence ---- */

    function loadUserMaterials() {
        try {
            var raw = localStorage.getItem(STORAGE_KEY);
            return raw ? JSON.parse(raw) : [];
        } catch (e) { return []; }
    }

    function saveUserMaterials(materials) {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(materials));
            return true;
        } catch (e) {
            console.warn('Failed to save user materials to localStorage:', e);
            return false;
        }
    }

    /* ---- Material Object Factory ---- */

    function createUserMaterial(nameCN, values, photoDataUrl, category) {
        var id = 'user_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
        return {
            id: id,
            name: nameCN + ' (用户)',
            nameCN: nameCN,
            category: category || 'user',
            targetHueZone: 'unknown',
            intendedUse: '用户自定义材质',
            intendedUseCN: '用户导入的自定义材质',
            // Dual-source
            appearanceSource: {
                type: photoDataUrl ? 'photo' : 'none',
                label: photoDataUrl ? '用户上传照片' : '无照片',
                origin: 'user_upload',
                file: null,
                dataUrl: photoDataUrl || null
            },
            spectralSource: {
                type: 'user_csv',
                label: '用户 CSV 导入',
                url: null,
                sampleId: null,
                notes: '用户提供的反射率数据（' + values.length + ' 个波长点，380–780 nm / 5 nm）',
                dataQualification: '用户提供的反射率数据；未经独立验证'
            },
            // Legacy
            dataQualification: '用户提供的反射率数据',
            sourceType: 'user_csv',
            sourceName: '用户 CSV 导入',
            sourceUrl: '',
            sourceSample: '',
            // Reflectance
            reflectance: Object.freeze(values.slice()),
            anchors: Object.freeze([]),
            // Metadata
            isUserMaterial: true,
            createdAt: Date.now()
        };
    }

    function addUserMaterial(material) {
        var all = loadUserMaterials();
        all.push(material);
        var ok = saveUserMaterials(all);
        if (!ok) return { error: 'localStorage 存储失败：可能空间不足' };
        return { success: true, material: material };
    }

    function removeUserMaterial(id) {
        var all = loadUserMaterials();
        var filtered = all.filter(function (m) { return m.id !== id; });
        saveUserMaterials(filtered);
    }

    /*
     * Merge user materials into the built-in list.
     * Returns a combined array: built-in first, then user materials.
     * If a user material already appears in the combined set (by id), it's skipped.
     */
    function getCombinedMaterials(builtinMaterials) {
        var userMats = loadUserMaterials();
        var seen = {};
        var combined = [];

        // Built-in first
        (builtinMaterials || []).forEach(function (m) {
            seen[m.id] = true;
            combined.push(m);
        });

        // User materials appended
        userMats.forEach(function (m) {
            if (!seen[m.id]) {
                seen[m.id] = true;
                // Ensure reflectance is an array (re-hydrate from JSON)
                if (!Array.isArray(m.reflectance)) {
                    m.reflectance = [];
                }
                combined.push(m);
            }
        });

        return combined;
    }

    /* ---- Public API ---- */

    root.MaterialUpload = Object.freeze({
        parseReflectanceCSV: parseReflectanceCSV,
        readPhotoFile: readPhotoFile,
        loadUserMaterials: loadUserMaterials,
        saveUserMaterials: saveUserMaterials,
        createUserMaterial: createUserMaterial,
        addUserMaterial: addUserMaterial,
        removeUserMaterial: removeUserMaterial,
        getCombinedMaterials: getCombinedMaterials
    });

})(typeof globalThis !== 'undefined' ? globalThis : window);
