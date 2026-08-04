(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    if (root) root.SpdImport = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';

    function detectDelimiter(line) {
        if (line.includes('\t')) return 'tab';
        if (line.includes(',')) return 'comma';
        if (line.includes(';')) return 'semicolon';
        return 'whitespace';
    }

    function splitCells(line, delimiter) {
        if (delimiter === 'tab') return line.split('\t').map(cell => cell.trim());
        if (delimiter === 'comma') return line.split(',').map(cell => cell.trim());
        if (delimiter === 'semicolon') return line.split(';').map(cell => cell.trim());
        return line.trim().split(/\s+/).map(cell => cell.trim());
    }

    function parseNumberCell(value, delimiter) {
        if (value === undefined || value === null) return NaN;
        let text = String(value).trim().replace(/%$/, '').trim();
        if (delimiter !== 'comma' && /^[-+]?\d+,\d+(?:[eE][-+]?\d+)?$/.test(text)) {
            text = text.replace(',', '.');
        }
        return Number(text);
    }

    function parseSpdText(text, options) {
        const config = options || {};
        const minChannels = Number.isInteger(config.minChannels) ? config.minChannels : 3;
        const maxChannels = Number.isInteger(config.maxChannels) ? config.maxChannels : 6;
        const sourceLines = String(text || '').split(/\r?\n/);
        const records = [];
        sourceLines.forEach(function (source, index) {
            const trimmed = source.trim();
            if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('//')) return;
            records.push({ source, trimmed, lineNumber: index + 1 });
        });
        if (records.length < 2) throw new Error('文件内容太少，无法读取 SPD。');

        const delimiter = detectDelimiter(records[0].trimmed);
        const firstCells = splitCells(records[0].trimmed, delimiter);
        const hasHeader = !Number.isFinite(parseNumberCell(firstCells[0], delimiter));
        const headers = hasHeader ? firstCells.slice() : [];
        const dataRecords = hasHeader ? records.slice(1) : records;
        if (!dataRecords.length) throw new Error('文件中没有 SPD 数据行。');

        const firstDataCells = splitCells(dataRecords[0].trimmed, delimiter);
        const expectedColumns = hasHeader ? headers.length : firstDataCells.length;
        const channelCount = expectedColumns - 1;
        if (channelCount < minChannels || channelCount > maxChannels) {
            throw new Error(`请提供 ${minChannels} 到 ${maxChannels} 个通道的数据列。`);
        }
        if (hasHeader && headers.some(cell => cell === '')) {
            throw new Error(`第 ${records[0].lineNumber} 行表头包含空列。`);
        }

        const rows = [];
        for (const record of dataRecords) {
            const cells = splitCells(record.trimmed, delimiter);
            if (cells.length !== expectedColumns) {
                throw new Error(`第 ${record.lineNumber} 行列数为 ${cells.length}，应为 ${expectedColumns}。`);
            }
            for (let column = 0; column < cells.length; column++) {
                if (cells[column] === '') {
                    throw new Error(`第 ${record.lineNumber} 行第 ${column + 1} 列为空值。`);
                }
            }
            const wavelength = parseNumberCell(cells[0], delimiter);
            if (!Number.isFinite(wavelength)) {
                throw new Error(`第 ${record.lineNumber} 行第 1 列波长不是有效数字。`);
            }
            if (wavelength < 300 || wavelength > 830) {
                throw new Error(`第 ${record.lineNumber} 行波长 ${wavelength} nm 超出允许范围 300–830 nm。`);
            }
            const values = [];
            for (let column = 1; column < cells.length; column++) {
                const value = parseNumberCell(cells[column], delimiter);
                if (!Number.isFinite(value)) {
                    throw new Error(`第 ${record.lineNumber} 行第 ${column + 1} 列不是有效数字。`);
                }
                if (value < 0) {
                    throw new Error(`第 ${record.lineNumber} 行第 ${column + 1} 列为负值 ${value}。`);
                }
                values.push(value);
            }
            rows.push({ wavelength, values, lineNumber: record.lineNumber });
        }

        if (rows.length < 10) {
            throw new Error('有效波长数据太少，至少需要 10 行。');
        }
        rows.sort(function (a, b) { return a.wavelength - b.wavelength; });
        for (let index = 1; index < rows.length; index++) {
            if (rows[index].wavelength === rows[index - 1].wavelength) {
                throw new Error(`检测到重复波长 ${rows[index].wavelength} nm。`);
            }
        }
        const minimumWavelength = rows[0].wavelength;
        const maximumWavelength = rows[rows.length - 1].wavelength;
        if (minimumWavelength > 380 || maximumWavelength < 780) {
            throw new Error(`测量范围需覆盖 380–780 nm；当前范围为 ${minimumWavelength}–${maximumWavelength} nm。`);
        }

        const channelSamples = Array.from({ length: channelCount }, function (_, channelIndex) {
            return rows.map(function (row) {
                return [row.wavelength, row.values[channelIndex]];
            });
        });
        return {
            headers,
            channelCount,
            channelSamples,
            minimumWavelength,
            maximumWavelength,
            rowCount: rows.length
        };
    }

    function interpolateZeroOutside(samples, wavelength) {
        if (!Array.isArray(samples) || samples.length === 0 || !Number.isFinite(wavelength)) return 0;
        if (wavelength < samples[0][0] || wavelength > samples[samples.length - 1][0]) return 0;
        if (wavelength === samples[0][0]) return samples[0][1];
        if (wavelength === samples[samples.length - 1][0]) return samples[samples.length - 1][1];
        let low = 0;
        let high = samples.length - 1;
        while (high - low > 1) {
            const middle = (low + high) >> 1;
            if (samples[middle][0] <= wavelength) low = middle;
            else high = middle;
        }
        const a = samples[low];
        const b = samples[high];
        const span = b[0] - a[0];
        if (!(span > 0)) return a[1];
        const amount = (wavelength - a[0]) / span;
        return a[1] + (b[1] - a[1]) * amount;
    }

    return {
        parseSpdText,
        interpolateZeroOutside
    };
});
