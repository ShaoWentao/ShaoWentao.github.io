'use strict';

const assert = require('node:assert/strict');
const { createSceneOptimizerWorkerClient } = require('./scene-optimizer-worker-client.js');

class FakeWorker {
    static instances = [];
    constructor(url) {
        this.url = url;
        this.messages = [];
        this.terminated = false;
        this.onmessage = null;
        this.onerror = null;
        FakeWorker.instances.push(this);
    }
    postMessage(message) { this.messages.push(message); }
    terminate() { this.terminated = true; }
    emitMessage(data) { if (this.onmessage) this.onmessage({ data }); }
}

(async () => {
    const client = createSceneOptimizerWorkerClient({
        WorkerCtor: FakeWorker,
        workerUrl: 'scene-optimizer-worker.js'
    });
    const first = client.optimize({ targetCct: 3500 });
    const firstErrorPromise = first.then(() => null, error => error);
    const firstWorker = FakeWorker.instances[0];
    assert.equal(firstWorker.messages[0].type, 'optimize-scene');

    const second = client.optimize({ targetCct: 4000 });
    const secondWorker = FakeWorker.instances[1];
    assert.equal(firstWorker.terminated, true);
    const firstError = await firstErrorPromise;
    assert.equal(firstError.code, 'SCENE_OPTIMIZER_CANCELLED');

    secondWorker.emitMessage({ requestId: 2, result: { values: [10, 20] } });
    assert.deepEqual(await second, { values: [10, 20] });
    assert.equal(secondWorker.terminated, true);

    const cancelled = client.optimize({ targetCct: 5000 });
    const cancelledWorker = FakeWorker.instances[2];
    client.cancel('stopped');
    await assert.rejects(cancelled, error => error && error.code === 'SCENE_OPTIMIZER_CANCELLED');
    assert.equal(cancelledWorker.terminated, true);

    const unsupported = createSceneOptimizerWorkerClient({ WorkerCtor: null });
    assert.equal(unsupported.isSupported(), false);
    await assert.rejects(unsupported.optimize({}), /Web Worker is unavailable/);

    console.log('scene optimizer worker client tests passed');
})().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
