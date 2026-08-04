'use strict';

const assert = require('node:assert/strict');
const { createRenderPipeline } = require('./render-pipeline.js');

function createManualScheduler() {
    let nextId = 1;
    const frames = [];
    const idles = [];
    const cancelledFrames = new Set();
    const cancelledIdles = new Set();

    return {
        requestFrame(callback) {
            const id = nextId++;
            frames.push({ id, callback });
            return id;
        },
        cancelFrame(id) {
            cancelledFrames.add(id);
        },
        requestIdle(callback) {
            const id = nextId++;
            idles.push({ id, callback });
            return id;
        },
        cancelIdle(id) {
            cancelledIdles.add(id);
        },
        runFrame() {
            while (frames.length) {
                const task = frames.shift();
                if (!cancelledFrames.has(task.id)) {
                    task.callback(0);
                    return true;
                }
            }
            return false;
        },
        runIdle() {
            while (idles.length) {
                const task = idles.shift();
                if (!cancelledIdles.has(task.id)) {
                    task.callback({ didTimeout: false, timeRemaining: () => 10 });
                    return true;
                }
            }
            return false;
        }
    };
}

{
    const scheduler = createManualScheduler();
    const calls = [];
    const pipeline = createRenderPipeline({
        ...scheduler,
        onFast: (payload, version) => calls.push(['fast', payload.id, version]),
        onBase: (payload, version) => calls.push(['base', payload.id, version]),
        onDeferred: (payload, version) => calls.push(['deferred', payload.id, version])
    });

    const version = pipeline.schedule({ id: 'A' });
    assert.equal(version, 1);
    assert.equal(pipeline.currentVersion(), 1);
    assert.equal(pipeline.isCurrent(1), true);
    assert.deepEqual(calls, []);

    assert.equal(scheduler.runFrame(), true);
    assert.deepEqual(calls, [['fast', 'A', 1]]);
    assert.equal(scheduler.runFrame(), true);
    assert.deepEqual(calls, [['fast', 'A', 1], ['base', 'A', 1]]);
    assert.equal(scheduler.runIdle(), true);
    assert.deepEqual(calls, [
        ['fast', 'A', 1],
        ['base', 'A', 1],
        ['deferred', 'A', 1]
    ]);
}

{
    const scheduler = createManualScheduler();
    const calls = [];
    const pipeline = createRenderPipeline({
        ...scheduler,
        onFast: payload => calls.push(`fast:${payload.id}`),
        onBase: payload => calls.push(`base:${payload.id}`),
        onDeferred: payload => calls.push(`deferred:${payload.id}`)
    });

    pipeline.schedule({ id: 'old' });
    scheduler.runFrame();
    pipeline.schedule({ id: 'new' });

    while (scheduler.runFrame()) { /* drain */ }
    while (scheduler.runIdle()) { /* drain */ }

    assert.deepEqual(calls, ['fast:old', 'fast:new', 'base:new', 'deferred:new'],
        'a newer schedule must cancel the old base and deferred stages');
}

{
    const scheduler = createManualScheduler();
    const errors = [];
    const calls = [];
    const pipeline = createRenderPipeline({
        ...scheduler,
        onFast(payload) {
            calls.push(`fast:${payload.id}`);
            if (payload.id === 'bad') throw new Error('expected failure');
        },
        onBase: payload => calls.push(`base:${payload.id}`),
        onDeferred: payload => calls.push(`deferred:${payload.id}`),
        onError: (error, stage) => errors.push(`${stage}:${error.message}`)
    });

    pipeline.schedule({ id: 'bad' });
    scheduler.runFrame();
    pipeline.schedule({ id: 'good' });
    while (scheduler.runFrame()) { /* drain */ }
    while (scheduler.runIdle()) { /* drain */ }

    assert.deepEqual(errors, ['fast:expected failure']);
    assert.deepEqual(calls, ['fast:bad', 'fast:good', 'base:good', 'deferred:good']);
}

console.log('render pipeline tests passed');
