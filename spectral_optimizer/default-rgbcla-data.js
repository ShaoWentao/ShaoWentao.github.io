/*
 * Default RGBCLA channel spectra derived from the ams OSRAM LZ7-04M2PD.
 *
 * Source anchors:
 * - Typical dominant wavelengths: Red 623 nm, True Green 520 nm,
 *   Blue 451 nm and Cyan/Verde 500 nm.
 * - PC Amber typical chromaticity: CIE 1931 x=0.565, y=0.420.
 * - PC Lime typical chromaticity: CIE 1931 x=0.41, y=0.54.
 * - Broad phosphor-converted curve shapes follow the manufacturer's
 *   typical relative spectral power distribution graph.
 *
 * These are peak-normalized, datasheet-derived engineering spectra for
 * algorithm development. They are not raw spectroradiometer measurements
 * and do not preserve absolute radiant-flux differences between channels.
 */
(function (root, factory) {
    const channels = factory();
    if (typeof module === 'object' && module.exports) module.exports = channels;
    if (root) root.DEFAULT_RGBCLA_CHANNELS = channels;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';

    const SOURCE_NAME = 'ams OSRAM LZ7-04M2PD datasheet-derived RGBCLA SPD';
    const SOURCE_URL = 'https://look.ams-osram.com/m/770184fced9855a3/original/LZ7-04M2PD.pdf';
    const DATA_QUALIFICATION = 'datasheet-derived typical SPD model; peak-normalized; not raw measured data';

    function gaussian(wavelength, centre, sigma) {
        const offset = (wavelength - centre) / sigma;
        return Math.exp(-0.5 * offset * offset);
    }

    function buildSamples(components) {
        const values = [];
        let peak = 0;
        for (let wavelength = 380; wavelength <= 780; wavelength++) {
            let power = 0;
            for (const component of components) {
                power += component.amplitude * gaussian(wavelength, component.centre, component.sigma);
            }
            values.push([wavelength, power]);
            if (power > peak) peak = power;
        }
        return Object.freeze(values.map(function (sample) {
            return Object.freeze([sample[0], Number((sample[1] / peak).toFixed(8))]);
        }));
    }

    function channel(definition) {
        return Object.freeze({
            id: definition.id,
            name: definition.name,
            nameCN: definition.nameCN,
            peak: definition.peak,
            sigma: null,
            color: definition.color,
            colorRGB: Object.freeze(definition.colorRGB.slice()),
            waveLabel: definition.waveLabel,
            spdSamples: buildSamples(definition.components),
            isWhiteChannel: false,
            sourceName: SOURCE_NAME,
            sourceUrl: SOURCE_URL,
            dataQualification: DATA_QUALIFICATION
        });
    }

    function installLegacyChannelInjection(defaultChannels) {
        const originalSlice = Array.prototype.slice;
        if (originalSlice.__rgbclaCompatibilityHook) return;

        const expectedIds = ['red', 'green', 'blue', 'cyan', 'lime', 'amber'];
        function isLegacyRgbclaArray(value) {
            return Array.isArray(value) && value.length === expectedIds.length &&
                expectedIds.every(function (id, index) {
                    return value[index] && value[index].id === id && !value[index].spdSamples;
                });
        }

        function restore() {
            if (Array.prototype.slice === patchedSlice) Array.prototype.slice = originalSlice;
        }

        function patchedSlice() {
            if (isLegacyRgbclaArray(this)) {
                for (let index = 0; index < defaultChannels.length; index++) {
                    const source = defaultChannels[index];
                    Object.assign(this[index], {
                        name: source.name,
                        nameCN: source.nameCN,
                        peak: source.peak,
                        sigma: source.sigma,
                        waveLabel: source.waveLabel,
                        spdSamples: source.spdSamples,
                        sourceName: source.sourceName,
                        sourceUrl: source.sourceUrl,
                        dataQualification: source.dataQualification
                    });
                }
                restore();
            }
            return originalSlice.apply(this, arguments);
        }

        patchedSlice.__rgbclaCompatibilityHook = true;
        Array.prototype.slice = patchedSlice;
        if (typeof setTimeout === 'function') setTimeout(restore, 0);
    }

    const channels = Object.freeze([
        channel({
            id: 'red', name: 'Red', nameCN: '红', peak: 623,
            color: '#ff3b3b', colorRGB: [255, 59, 59], waveLabel: '623 nm',
            components: [{ amplitude: 1, centre: 623, sigma: 10 }]
        }),
        channel({
            id: 'green', name: 'True Green', nameCN: '绿', peak: 520,
            color: '#2dff6e', colorRGB: [45, 255, 110], waveLabel: '520 nm',
            components: [{ amplitude: 1, centre: 520, sigma: 13 }]
        }),
        channel({
            id: 'blue', name: 'Blue', nameCN: '蓝', peak: 451,
            color: '#3b7dff', colorRGB: [59, 125, 255], waveLabel: '451 nm',
            components: [{ amplitude: 1, centre: 451, sigma: 9 }]
        }),
        channel({
            id: 'cyan', name: 'Cyan', nameCN: '青', peak: 500,
            color: '#36d6e7', colorRGB: [54, 214, 231], waveLabel: '500 nm',
            components: [{ amplitude: 1, centre: 500, sigma: 16 }]
        }),
        channel({
            id: 'lime', name: 'PC Lime', nameCN: '荧光粉黄绿', peak: 560,
            color: '#aaff33', colorRGB: [170, 255, 51], waveLabel: 'PC Lime',
            components: [
                { amplitude: 0.1234, centre: 448.74, sigma: 7.02 },
                { amplitude: 1, centre: 557.47, sigma: 30.08 },
                { amplitude: 0.2135, centre: 602.26, sigma: 45.54 }
            ]
        }),
        channel({
            id: 'amber', name: 'PC Amber', nameCN: '荧光粉琥珀', peak: 601,
            color: '#ff9f33', colorRGB: [255, 159, 51], waveLabel: 'PC Amber',
            components: [
                { amplitude: 0.03229, centre: 446.23, sigma: 10.56 },
                { amplitude: 1, centre: 601.30, sigma: 28.87 },
                { amplitude: 0.23977, centre: 637.37, sigma: 59.12 }
            ]
        })
    ]);

    installLegacyChannelInjection(channels);
    return channels;
});