'use strict';

const assert = require('node:assert/strict');

const memory = new Map();
global.localStorage = {
    getItem(key) { return memory.has(key) ? memory.get(key) : null; },
    setItem(key, value) { memory.set(key, String(value)); },
    removeItem(key) { memory.delete(key); }
};

const PROFILES = require('./material-preference-profiles.js');
global.MaterialPreferenceProfiles = PROFILES;
require('./material-upload.js');
const UPLOAD = global.MaterialUpload;

const oneColumn5nm = Array.from({ length: 81 }, (_, index) => (20 + index / 10).toFixed(2)).join('\n');
const parsed5nm = UPLOAD.parseReflectanceCSV(oneColumn5nm);
assert.equal(parsed5nm.error, undefined);
assert.equal(parsed5nm.hasWL, false);
assert.equal(parsed5nm.values.length, 81);
assert.ok(Math.abs(parsed5nm.values[0] - 0.2) < 1e-9);

const oneColumn1nm = Array.from({ length: 401 }, () => '0.35').join('\n');
const parsed1nm = UPLOAD.parseReflectanceCSV(oneColumn1nm);
assert.equal(parsed1nm.error, undefined);
assert.equal(parsed1nm.values.length, 81);
assert.ok(parsed1nm.values.every(value => Math.abs(value - 0.35) < 1e-9));

const badGrid = Array.from({ length: 80 }, () => '0.35').join('\n');
assert.match(UPLOAD.parseReflectanceCSV(badGrid).error, /81|401/);
assert.match(UPLOAD.parseReflectanceCSV('380,0.2\n380,0.3\n780,0.2\n500,0.2\n600,0.2').error, /duplicate/);

const values = Array.from({ length: 81 }, (_, index) => 0.2 + index / 500);
const material = UPLOAD.createUserMaterial('用户丝绒', values, null, 'fabric');
assert.equal(material.category, 'fabric');
assert.equal(material.isUserMaterial, true);
assert.equal(UPLOAD.addUserMaterial(material).success, true);
assert.equal(UPLOAD.loadUserMaterials().length, 1);

const inherited = PROFILES.resolveMaterialPreference(material, 'recommended', null);
assert.equal(inherited.source, 'category');
assert.equal(inherited.targetDeltaC, PROFILES.categoryDefaults.fabric.levels.recommended.targetDeltaC);

const saved = PROFILES.saveOverride(material.id, {
    importance: 1.4,
    levels: { recommended: { targetDeltaC: 6.2 } }
}, global.localStorage);
assert.equal(saved.ok, true);
assert.equal(PROFILES.loadOverrides(global.localStorage)[material.id].levels.recommended.targetDeltaC, 6.2);

UPLOAD.removeUserMaterial(material.id);
assert.equal(UPLOAD.loadUserMaterials().length, 0);
assert.equal(PROFILES.loadOverrides(global.localStorage)[material.id], undefined,
    'deleting a user material must remove its stored preference override');

delete global.MaterialUpload;
delete global.MaterialPreferenceProfiles;
delete global.localStorage;

console.log('material upload tests passed', { materialId: material.id });
