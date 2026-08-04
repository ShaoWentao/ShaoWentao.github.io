'use strict';

const childProcess = require('node:child_process');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');

const ROOT = __dirname;
const MIME_TYPES = Object.freeze({
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.csv': 'text/csv; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.webp': 'image/webp'
});

function resolveRequestPath(requestUrl) {
    const pathname = decodeURIComponent(new URL(requestUrl, 'http://127.0.0.1').pathname);
    const relative = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
    const filePath = path.resolve(ROOT, relative);
    return filePath.startsWith(ROOT + path.sep) || filePath === path.join(ROOT, 'index.html')
        ? filePath
        : null;
}

function createLocalServer() {
    return http.createServer((request, response) => {
        const filePath = resolveRequestPath(request.url || '/');
        if (!filePath) {
            response.writeHead(403, { 'Cache-Control': 'no-store' });
            response.end('forbidden');
            return;
        }
        fs.readFile(filePath, (error, data) => {
            if (error) {
                response.writeHead(error.code === 'ENOENT' ? 404 : 500, {
                    'Content-Type': 'text/plain; charset=utf-8',
                    'Cache-Control': 'no-store'
                });
                response.end(error.code === 'ENOENT' ? 'not found' : 'read error');
                return;
            }
            response.writeHead(200, {
                'Content-Type': MIME_TYPES[path.extname(filePath).toLowerCase()] || 'application/octet-stream',
                'Cache-Control': 'no-store',
                'X-Content-Type-Options': 'nosniff'
            });
            response.end(data);
        });
    });
}

function openBrowser(url) {
    if (process.platform !== 'win32') return;
    const child = childProcess.spawn('cmd.exe', ['/c', 'start', '', url], {
        detached: true,
        stdio: 'ignore',
        windowsHide: true
    });
    child.unref();
}

if (require.main === module) {
    const requestedPort = Number(process.env.PORT || 4173);
    const port = Number.isInteger(requestedPort) && requestedPort > 0 ? requestedPort : 4173;
    const server = createLocalServer();
    server.listen(port, '127.0.0.1', () => {
        const url = `http://127.0.0.1:${port}/`;
        console.log(`光谱优化器本地测试地址：${url}`);
        console.log('关闭此窗口即可停止本地服务。');
        if (!process.argv.includes('--no-open')) openBrowser(url);
    });
    server.on('error', error => {
        console.error(`本地服务启动失败：${error.message}`);
        process.exitCode = 1;
    });
}

module.exports = { createLocalServer, resolveRequestPath };
