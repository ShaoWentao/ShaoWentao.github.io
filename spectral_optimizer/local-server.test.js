'use strict';

const assert = require('node:assert/strict');
const http = require('node:http');
const { createLocalServer } = require('./local-server.js');

(async () => {
    const server = createLocalServer();
    await new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(0, '127.0.0.1', resolve);
    });
    try {
        const port = server.address().port;
        const html = await new Promise((resolve, reject) => {
            http.get(`http://127.0.0.1:${port}/`, response => {
                let body = '';
                response.setEncoding('utf8');
                response.on('data', chunk => { body += chunk; });
                response.on('end', () => resolve({ response, body }));
            }).on('error', reject);
        });
        assert.equal(html.response.statusCode, 200);
        assert.match(html.response.headers['content-type'], /^text\/html/);
        assert.equal(html.response.headers['cache-control'], 'no-store');
        assert.doesNotMatch(html.body, /id="app-loading-overlay"/);
        assert.match(html.body, /id="spd-loading-state"/);
        assert.match(html.body, /id="material-loading-state"/);

        const missing = await new Promise((resolve, reject) => {
            http.get(`http://127.0.0.1:${port}/missing.js`, response => {
                response.resume();
                response.on('end', () => resolve(response));
            }).on('error', reject);
        });
        assert.equal(missing.statusCode, 404);
        console.log('local server tests passed');
    } finally {
        await new Promise(resolve => server.close(resolve));
    }
})().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
