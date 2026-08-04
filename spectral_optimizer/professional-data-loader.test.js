'use strict';

const assert = require('node:assert/strict');
const { loadProfessionalDataText } = require('./professional-data-loader.js');

(async () => {
    let requestedUrl = '';
    const browserText = await loadProfessionalDataText({
        url: 'curves.csv',
        fetchImpl: async url => {
            requestedUrl = url;
            return { ok: true, text: async () => 'browser-data' };
        }
    });
    assert.equal(requestedUrl, 'curves.csv', 'browser loader must request the configured URL');
    assert.equal(browserText, 'browser-data', 'browser response text must be returned');

    await assert.rejects(loadProfessionalDataText({
        fetchImpl: async () => ({ ok: false, status: 404, text: async () => '' })
    }), /HTTP 404/, 'non-success browser responses must include the HTTP status');

    await assert.rejects(loadProfessionalDataText({
        fetchImpl: async () => ({ ok: true, text: async () => '   ' })
    }), /empty/i, 'empty browser data must be rejected');

    await assert.rejects(loadProfessionalDataText({
        fetchImpl: null
    }), /unavailable/i, 'missing browser loader must be rejected');

    console.log('professional-data-loader tests: PASS');
})().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
