'use strict';

const assert = require('node:assert/strict');
const { createMetamerWorkerClient } = require('./metamer-worker-client.js');

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

    postMessage(message) {
        this.messages.push(message);
    }

    terminate() {
        this.terminated = true;
    }

    emitMessage(data) {
        if (this.onmessage) this.onmessage({ data });
    }

    emitError(message) {
        if (this.onerror) this.onerror({ message, preventDefault() {} });
    }
}

(async () => {
    const client = createMetamerWorkerClient({
        WorkerCtor: FakeWorker,
        workerUrl: 'metamer-worker.js'
    });
    assert.equal(client.isSupported(), true, 'configured worker client must report support');

    const firstPromise = client.optimize({ targetRg: 110 });
    const firstRejection = firstPromise.then(
        () => null,
        error => error
    );
    const firstWorker = FakeWorker.instances[0];
    assert.equal(firstWorker.messages[0].type, 'optimize-metamer',
        'worker request must use the metamer optimization message type');

    const secondPromise = client.optimize({ targetRg: 120 });
    const secondWorker = FakeWorker.instances[1];
    assert.equal(firstWorker.terminated, true, 'a newer request must terminate the previous worker');
    const firstError = await firstRejection;
    assert.equal(firstError.name, 'AbortError', 'superseded work must reject as an abort');
    assert.equal(firstError.code, 'METAMER_CANCELLED', 'superseded work must use a stable cancellation code');

    firstWorker.emitMessage({ requestId: 1, result: { achievedRg: 110 } });
    secondWorker.emitMessage({ requestId: 2, result: { achievedRg: 119 } });
    assert.deepEqual(await secondPromise, { achievedRg: 119 },
        'only the active worker result may resolve the request');
    assert.equal(secondWorker.terminated, true, 'completed workers must be released');

    const errorPromise = client.optimize({ targetRg: 100 });
    const errorWorker = FakeWorker.instances[2];
    errorWorker.emitMessage({ requestId: 3, error: 'worker failed' });
    await assert.rejects(errorPromise, /worker failed/,
        'worker-reported errors must reject the active request');

    const cancelledPromise = client.optimize({ targetRg: 105 });
    const cancelledWorker = FakeWorker.instances[3];
    client.cancel();
    await assert.rejects(cancelledPromise, error =>
        error && error.name === 'AbortError' && error.code === 'METAMER_CANCELLED',
    'explicit cancellation must reject with the stable cancellation error');
    assert.equal(cancelledWorker.terminated, true, 'explicit cancellation must terminate the worker');

    const unsupported = createMetamerWorkerClient({ WorkerCtor: null });
    assert.equal(unsupported.isSupported(), false, 'missing Worker support must be detectable');
    await assert.rejects(unsupported.optimize({}), /Web Worker is unavailable/,
        'unsupported clients must fail without starting work');

    console.log('metamer-worker-client tests: PASS');
})().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
