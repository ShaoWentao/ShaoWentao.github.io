'use strict';

const assert = require('node:assert/strict');
const api = require('./xlsx-workbook.js');

function readStoredZipEntries(bytes) {
    const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    const decoder = new TextDecoder();
    const entries = new Map();
    let offset = 0;
    while (offset + 30 <= data.length && view.getUint32(offset, true) === 0x04034b50) {
        const method = view.getUint16(offset + 8, true);
        const size = view.getUint32(offset + 18, true);
        const nameLength = view.getUint16(offset + 26, true);
        const extraLength = view.getUint16(offset + 28, true);
        assert.equal(method, 0, 'test reader expects stored ZIP entries');
        const nameStart = offset + 30;
        const dataStart = nameStart + nameLength + extraLength;
        const name = decoder.decode(data.slice(nameStart, nameStart + nameLength));
        entries.set(name, decoder.decode(data.slice(dataStart, dataStart + size)));
        offset = dataStart + size;
    }
    return entries;
}

const spec = {
    sheets: [
        {
            name: '说明',
            columns: [
                { key: 'item', header: '项目', width: 18 },
                { key: 'value', header: '内容', width: 36 }
            ],
            rows: [
                { item: '范围', value: '1600–12000 K' },
                { item: '数量', value: 105 }
            ],
            freezeRows: 1,
            autoFilter: true
        },
        {
            name: '常规/非法名',
            columns: [
                { key: 'id', header: '配方ID', width: 18 },
                { key: 'cct', header: '目标CCT', width: 12, numberFormat: '0' },
                { key: 'duv', header: '目标Duv', width: 12, numberFormat: '0.0000' }
            ],
            rows: [
                { id: 'STD-1600', cct: 1600, duv: 0 },
                { id: 'STD-1700', cct: 1700, duv: -0.0002 }
            ],
            freezeRows: 1,
            autoFilter: true
        },
        {
            name: '常规/非法名',
            columns: [{ key: 'value', header: '值', width: 10 }],
            rows: [{ value: true }]
        }
    ]
};

const bytes = api.buildWorkbookBytes(spec);
assert.ok(bytes instanceof Uint8Array);
assert.ok(bytes.length > 1000);

const entries = readStoredZipEntries(bytes);
[
    '[Content_Types].xml',
    '_rels/.rels',
    'xl/workbook.xml',
    'xl/_rels/workbook.xml.rels',
    'xl/styles.xml',
    'xl/worksheets/sheet1.xml',
    'xl/worksheets/sheet2.xml',
    'xl/worksheets/sheet3.xml'
].forEach(name => assert.ok(entries.has(name), `missing ${name}`));

const workbookXml = entries.get('xl/workbook.xml');
assert.match(workbookXml, /name="说明"/);
assert.match(workbookXml, /name="常规_非法名"/);
assert.match(workbookXml, /name="常规_非法名 \(2\)"/);

const sheet1 = entries.get('xl/worksheets/sheet1.xml');
assert.match(sheet1, /<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"\/>/);
assert.match(sheet1, /<autoFilter ref="A1:B3"\/>/);
assert.match(sheet1, /<col min="1" max="1" width="18" customWidth="1"\/>/);
assert.match(sheet1, /<t>1600–12000 K<\/t>/);
assert.match(sheet1, /<v>105<\/v>/);

const sheet2 = entries.get('xl/worksheets/sheet2.xml');
assert.match(sheet2, /<t>配方ID<\/t>/);
assert.match(sheet2, /<v>1600<\/v>/);
assert.match(sheet2, /<v>-0.0002<\/v>/);
assert.match(sheet2, /s="2"/);

const blob = api.buildWorkbookBlob(spec);
assert.equal(blob.type, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
assert.equal(blob.size, bytes.length);

assert.throws(() => api.buildWorkbookBytes({ sheets: [] }), /at least one sheet/i);
assert.throws(() => api.buildWorkbookBytes({ sheets: [{ name: '', columns: [], rows: [] }] }), /columns/i);

console.log('xlsx workbook tests passed', { bytes: bytes.length, entries: entries.size });
