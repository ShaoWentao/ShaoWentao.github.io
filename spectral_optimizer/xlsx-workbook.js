(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    if (root) root.XLSX_WORKBOOK = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';

    const MIME_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    const XML_HEADER = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
    const encoder = typeof TextEncoder === 'function' ? new TextEncoder() : null;

    function utf8(value) {
        const text = String(value == null ? '' : value);
        if (encoder) return encoder.encode(text);
        if (typeof Buffer !== 'undefined') return Uint8Array.from(Buffer.from(text, 'utf8'));
        throw new Error('UTF-8 encoder is unavailable');
    }

    function xmlEscape(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');
    }

    function columnName(index) {
        let value = index + 1;
        let name = '';
        while (value > 0) {
            const remainder = (value - 1) % 26;
            name = String.fromCharCode(65 + remainder) + name;
            value = Math.floor((value - 1) / 26);
        }
        return name;
    }

    function sanitizeSheetNames(sheets) {
        const used = new Set();
        return sheets.map((sheet, index) => {
            let base = String(sheet && sheet.name != null ? sheet.name : `Sheet${index + 1}`)
                .replace(/[\\/?*:[\]]/g, '_')
                .replace(/^'+|'+$/g, '')
                .trim();
            if (!base) base = `Sheet${index + 1}`;
            base = base.slice(0, 31);
            let candidate = base;
            let suffixIndex = 2;
            while (used.has(candidate.toLowerCase())) {
                const suffix = ` (${suffixIndex++})`;
                candidate = `${base.slice(0, Math.max(1, 31 - suffix.length))}${suffix}`;
            }
            used.add(candidate.toLowerCase());
            return candidate;
        });
    }

    function validateWorkbookSpec(spec) {
        if (!spec || !Array.isArray(spec.sheets) || spec.sheets.length === 0) {
            throw new TypeError('Workbook requires at least one sheet');
        }
        spec.sheets.forEach((sheet, index) => {
            if (!sheet || !Array.isArray(sheet.columns) || sheet.columns.length === 0) {
                throw new TypeError(`Sheet ${index + 1} requires columns`);
            }
            sheet.columns.forEach((column, columnIndex) => {
                if (!column || typeof column.key !== 'string' || !column.key ||
                    typeof column.header !== 'string') {
                    throw new TypeError(`Sheet ${index + 1} column ${columnIndex + 1} is invalid`);
                }
            });
            if (sheet.rows != null && !Array.isArray(sheet.rows)) {
                throw new TypeError(`Sheet ${index + 1} rows must be an array`);
            }
        });
    }

    function collectNumberFormats(sheets) {
        const formats = [];
        const seen = new Set();
        for (const sheet of sheets) {
            for (const column of sheet.columns) {
                const format = typeof column.numberFormat === 'string' ? column.numberFormat.trim() : '';
                if (!format || seen.has(format)) continue;
                seen.add(format);
                formats.push(format);
            }
        }
        return formats;
    }

    function buildStyleRegistry(numberFormats) {
        const styleByFormat = new Map();
        numberFormats.forEach((format, index) => styleByFormat.set(format, index + 2));
        return styleByFormat;
    }

    function buildStylesXml(numberFormats) {
        const numFmtXml = numberFormats.map((format, index) =>
            `<numFmt numFmtId="${164 + index}" formatCode="${xmlEscape(format)}"/>`).join('');
        const dataXfs = numberFormats.map((format, index) =>
            `<xf numFmtId="${164 + index}" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>`).join('');
        return `${XML_HEADER}<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
            `<numFmts count="${numberFormats.length}">${numFmtXml}</numFmts>` +
            '<fonts count="2"><font><sz val="11"/><name val="Aptos"/><family val="2"/></font>' +
            '<font><b/><color rgb="FFFFFFFF"/><sz val="11"/><name val="Aptos"/><family val="2"/></font></fonts>' +
            '<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>' +
            '<fill><patternFill patternType="solid"><fgColor rgb="FF315E7D"/><bgColor indexed="64"/></patternFill></fill></fills>' +
            '<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border>' +
            '<border><left style="thin"><color rgb="FFD7DEE5"/></left><right style="thin"><color rgb="FFD7DEE5"/></right>' +
            '<top style="thin"><color rgb="FFD7DEE5"/></top><bottom style="thin"><color rgb="FFD7DEE5"/></bottom><diagonal/></border></borders>' +
            '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
            `<cellXfs count="${2 + numberFormats.length}">` +
            '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
            '<xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>' +
            dataXfs + '</cellXfs>' +
            '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
            '<dxfs count="0"/><tableStyles count="0" defaultTableStyle="TableStyleMedium2" defaultPivotStyle="PivotStyleLight16"/>' +
            '</styleSheet>';
    }

    function inlineStringCell(ref, value, styleIndex) {
        const text = String(value == null ? '' : value);
        const preserve = /^\s|\s$|\n/.test(text) ? ' xml:space="preserve"' : '';
        const style = Number.isInteger(styleIndex) && styleIndex > 0 ? ` s="${styleIndex}"` : '';
        return `<c r="${ref}"${style} t="inlineStr"><is><t${preserve}>${xmlEscape(text)}</t></is></c>`;
    }

    function valueCell(ref, value, styleIndex) {
        const style = Number.isInteger(styleIndex) && styleIndex > 0 ? ` s="${styleIndex}"` : '';
        if (value == null || value === '') return '';
        if (typeof value === 'number' && Number.isFinite(value)) {
            return `<c r="${ref}"${style}><v>${String(value)}</v></c>`;
        }
        if (typeof value === 'boolean') {
            return `<c r="${ref}"${style} t="b"><v>${value ? 1 : 0}</v></c>`;
        }
        if (value instanceof Date && Number.isFinite(value.getTime())) {
            return inlineStringCell(ref, value.toISOString(), styleIndex);
        }
        return inlineStringCell(ref, value, styleIndex);
    }

    function buildWorksheetXml(sheet, styleByFormat) {
        const rows = Array.isArray(sheet.rows) ? sheet.rows : [];
        const columnCount = sheet.columns.length;
        const lastColumn = columnName(columnCount - 1);
        const lastRow = rows.length + 1;
        const dimension = `A1:${lastColumn}${Math.max(1, lastRow)}`;
        const freezeRows = Math.max(0, Math.floor(Number(sheet.freezeRows) || 0));
        const sheetViews = freezeRows > 0
            ? `<sheetViews><sheetView workbookViewId="0"><pane ySplit="${freezeRows}" topLeftCell="A${freezeRows + 1}" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="A${freezeRows + 1}" sqref="A${freezeRows + 1}"/></sheetView></sheetViews>`
            : '<sheetViews><sheetView workbookViewId="0"/></sheetViews>';
        const cols = sheet.columns.map((column, index) => {
            const width = Math.max(6, Math.min(80, Number(column.width) || 14));
            return `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`;
        }).join('');
        const headerCells = sheet.columns.map((column, index) =>
            inlineStringCell(`${columnName(index)}1`, column.header, 1)).join('');
        const rowXml = [`<row r="1" ht="24" customHeight="1">${headerCells}</row>`];
        rows.forEach((row, rowIndex) => {
            const cells = sheet.columns.map((column, columnIndex) => {
                const format = typeof column.numberFormat === 'string' ? column.numberFormat.trim() : '';
                const styleIndex = format ? styleByFormat.get(format) : 0;
                return valueCell(`${columnName(columnIndex)}${rowIndex + 2}`, row && row[column.key], styleIndex);
            }).join('');
            rowXml.push(`<row r="${rowIndex + 2}">${cells}</row>`);
        });
        const autoFilter = sheet.autoFilter
            ? `<autoFilter ref="A1:${lastColumn}${Math.max(1, lastRow)}"/>`
            : '';
        return `${XML_HEADER}<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
            `<dimension ref="${dimension}"/>${sheetViews}<sheetFormatPr defaultRowHeight="15"/>` +
            `<cols>${cols}</cols><sheetData>${rowXml.join('')}</sheetData>${autoFilter}` +
            '<pageMargins left="0.7" right="0.7" top="0.75" bottom="0.75" header="0.3" footer="0.3"/>' +
            '</worksheet>';
    }

    function buildWorkbookXml(names) {
        const sheets = names.map((name, index) =>
            `<sheet name="${xmlEscape(name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`).join('');
        return `${XML_HEADER}<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ` +
            'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
            '<bookViews><workbookView xWindow="0" yWindow="0" windowWidth="24000" windowHeight="14000"/></bookViews>' +
            `<sheets>${sheets}</sheets><calcPr calcId="191029" fullCalcOnLoad="1"/></workbook>`;
    }

    function buildWorkbookRelsXml(sheetCount) {
        const sheetRels = Array.from({ length: sheetCount }, (_, index) =>
            `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`).join('');
        return `${XML_HEADER}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
            sheetRels +
            `<Relationship Id="rId${sheetCount + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>` +
            '</Relationships>';
    }

    function buildContentTypesXml(sheetCount) {
        const sheets = Array.from({ length: sheetCount }, (_, index) =>
            `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('');
        return `${XML_HEADER}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
            '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
            '<Default Extension="xml" ContentType="application/xml"/>' +
            '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
            '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
            '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>' +
            '<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>' +
            sheets + '</Types>';
    }

    function buildRootRelsXml() {
        return `${XML_HEADER}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
            '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
            '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>' +
            '<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>' +
            '</Relationships>';
    }

    function buildCoreXml() {
        const now = new Date().toISOString();
        return `${XML_HEADER}<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" ` +
            'xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">' +
            '<dc:creator>Spectral Optimizer</dc:creator><cp:lastModifiedBy>Spectral Optimizer</cp:lastModifiedBy>' +
            `<dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created>` +
            `<dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified></cp:coreProperties>`;
    }

    function buildAppXml(names) {
        const titles = names.map(name => `<vt:lpstr>${xmlEscape(name)}</vt:lpstr>`).join('');
        return `${XML_HEADER}<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" ` +
            'xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">' +
            '<Application>Spectral Optimizer</Application><DocSecurity>0</DocSecurity><ScaleCrop>false</ScaleCrop>' +
            `<HeadingPairs><vt:vector size="2" baseType="variant"><vt:variant><vt:lpstr>Worksheets</vt:lpstr></vt:variant><vt:variant><vt:i4>${names.length}</vt:i4></vt:variant></vt:vector></HeadingPairs>` +
            `<TitlesOfParts><vt:vector size="${names.length}" baseType="lpstr">${titles}</vt:vector></TitlesOfParts>` +
            '<Company></Company><LinksUpToDate>false</LinksUpToDate><SharedDoc>false</SharedDoc><HyperlinksChanged>false</HyperlinksChanged><AppVersion>16.0300</AppVersion>' +
            '</Properties>';
    }

    const CRC_TABLE = (() => {
        const table = new Uint32Array(256);
        for (let index = 0; index < 256; index++) {
            let value = index;
            for (let bit = 0; bit < 8; bit++) value = (value & 1) ? (0xedb88320 ^ (value >>> 1)) : (value >>> 1);
            table[index] = value >>> 0;
        }
        return table;
    })();

    function crc32(bytes) {
        let crc = 0xffffffff;
        for (let index = 0; index < bytes.length; index++) {
            crc = CRC_TABLE[(crc ^ bytes[index]) & 0xff] ^ (crc >>> 8);
        }
        return (crc ^ 0xffffffff) >>> 0;
    }

    function dosDateTime(date) {
        const value = date instanceof Date && Number.isFinite(date.getTime()) ? date : new Date();
        const year = Math.max(1980, value.getFullYear());
        return {
            time: ((value.getHours() & 0x1f) << 11) | ((value.getMinutes() & 0x3f) << 5) | ((value.getSeconds() / 2) & 0x1f),
            date: (((year - 1980) & 0x7f) << 9) | (((value.getMonth() + 1) & 0x0f) << 5) | (value.getDate() & 0x1f)
        };
    }

    function concatBytes(chunks) {
        const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
        const result = new Uint8Array(total);
        let offset = 0;
        for (const chunk of chunks) {
            result.set(chunk, offset);
            offset += chunk.length;
        }
        return result;
    }

    function zipStored(entries) {
        const localChunks = [];
        const centralChunks = [];
        let localOffset = 0;
        const stamp = dosDateTime(new Date());
        for (const entry of entries) {
            const nameBytes = utf8(entry.name);
            const dataBytes = entry.data instanceof Uint8Array ? entry.data : utf8(entry.data);
            const crc = crc32(dataBytes);
            const local = new Uint8Array(30 + nameBytes.length);
            const localView = new DataView(local.buffer);
            localView.setUint32(0, 0x04034b50, true);
            localView.setUint16(4, 20, true);
            localView.setUint16(6, 0x0800, true);
            localView.setUint16(8, 0, true);
            localView.setUint16(10, stamp.time, true);
            localView.setUint16(12, stamp.date, true);
            localView.setUint32(14, crc, true);
            localView.setUint32(18, dataBytes.length, true);
            localView.setUint32(22, dataBytes.length, true);
            localView.setUint16(26, nameBytes.length, true);
            localView.setUint16(28, 0, true);
            local.set(nameBytes, 30);
            localChunks.push(local, dataBytes);

            const central = new Uint8Array(46 + nameBytes.length);
            const centralView = new DataView(central.buffer);
            centralView.setUint32(0, 0x02014b50, true);
            centralView.setUint16(4, 20, true);
            centralView.setUint16(6, 20, true);
            centralView.setUint16(8, 0x0800, true);
            centralView.setUint16(10, 0, true);
            centralView.setUint16(12, stamp.time, true);
            centralView.setUint16(14, stamp.date, true);
            centralView.setUint32(16, crc, true);
            centralView.setUint32(20, dataBytes.length, true);
            centralView.setUint32(24, dataBytes.length, true);
            centralView.setUint16(28, nameBytes.length, true);
            centralView.setUint16(30, 0, true);
            centralView.setUint16(32, 0, true);
            centralView.setUint16(34, 0, true);
            centralView.setUint16(36, 0, true);
            centralView.setUint32(38, 0, true);
            centralView.setUint32(42, localOffset, true);
            central.set(nameBytes, 46);
            centralChunks.push(central);
            localOffset += local.length + dataBytes.length;
        }
        const centralDirectory = concatBytes(centralChunks);
        const end = new Uint8Array(22);
        const endView = new DataView(end.buffer);
        endView.setUint32(0, 0x06054b50, true);
        endView.setUint16(4, 0, true);
        endView.setUint16(6, 0, true);
        endView.setUint16(8, entries.length, true);
        endView.setUint16(10, entries.length, true);
        endView.setUint32(12, centralDirectory.length, true);
        endView.setUint32(16, localOffset, true);
        endView.setUint16(20, 0, true);
        return concatBytes([...localChunks, centralDirectory, end]);
    }

    function buildWorkbookBytes(spec) {
        validateWorkbookSpec(spec);
        const names = sanitizeSheetNames(spec.sheets);
        const numberFormats = collectNumberFormats(spec.sheets);
        const styleByFormat = buildStyleRegistry(numberFormats);
        const entries = [
            { name: '[Content_Types].xml', data: buildContentTypesXml(spec.sheets.length) },
            { name: '_rels/.rels', data: buildRootRelsXml() },
            { name: 'docProps/core.xml', data: buildCoreXml() },
            { name: 'docProps/app.xml', data: buildAppXml(names) },
            { name: 'xl/workbook.xml', data: buildWorkbookXml(names) },
            { name: 'xl/_rels/workbook.xml.rels', data: buildWorkbookRelsXml(spec.sheets.length) },
            { name: 'xl/styles.xml', data: buildStylesXml(numberFormats) }
        ];
        spec.sheets.forEach((sheet, index) => {
            entries.push({
                name: `xl/worksheets/sheet${index + 1}.xml`,
                data: buildWorksheetXml(sheet, styleByFormat)
            });
        });
        return zipStored(entries);
    }

    function buildWorkbookBlob(spec) {
        if (typeof Blob !== 'function') throw new Error('Blob is unavailable');
        return new Blob([buildWorkbookBytes(spec)], { type: MIME_TYPE });
    }

    function downloadWorkbook(fileName, spec) {
        if (typeof document === 'undefined' || typeof URL === 'undefined' ||
            typeof URL.createObjectURL !== 'function') {
            throw new Error('Workbook download requires a browser environment');
        }
        const safeName = String(fileName || 'spectral-recipes.xlsx').replace(/[\\/:*?"<>|]+/g, '-');
        const finalName = /\.xlsx$/i.test(safeName) ? safeName : `${safeName}.xlsx`;
        const url = URL.createObjectURL(buildWorkbookBlob(spec));
        const link = document.createElement('a');
        link.href = url;
        link.download = finalName;
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 0);
    }

    return Object.freeze({
        MIME_TYPE,
        buildWorkbookBytes,
        buildWorkbookBlob,
        downloadWorkbook,
        sanitizeSheetNames
    });
});
