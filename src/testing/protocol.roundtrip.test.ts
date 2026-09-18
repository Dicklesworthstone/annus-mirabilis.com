/**
 * Roundtrip structured clone and buffer transfer tests.
 * Specification: am-rt-worker-protocol-gaq test plan.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { MessageChannel } from "node:worker_threads";
import { VALID_ACCEPTED, VALID_REQUEST } from "./protocol-fixtures/fixtures.ts";

describe("protocol.roundtrip", () => {
  it("valid request roundtrips through structured clone via MessageChannel", async () => {
    const { port1, port2 } = new MessageChannel();

    const receivedPromise = new Promise<any>((resolve) => {
      port2.on("message", (msg) => {
        resolve(msg);
      });
    });

    port1.postMessage(VALID_REQUEST);
    const received = await receivedPromise;

    port1.close();
    port2.close();

    assert.equal(received.messageKind, "request");
    assert.equal(received.instanceId, VALID_REQUEST.instanceId);
    assert.equal(received.runId, VALID_REQUEST.runId);
    assert.equal(received.actionIndex, VALID_REQUEST.actionIndex);
    assert.equal(received.seedPolicy.seed, VALID_REQUEST.seedPolicy.seed);
  });

  it("transferred buffer detaches on sender (byteLength becomes 0) and arrives intact on receiver", async () => {
    const { port1, port2 } = new MessageChannel();

    const floatData = new Float64Array([1.5, 2.5, 3.5, 4.5]);
    const originalBuffer = floatData.buffer;
    const initialByteLength = originalBuffer.byteLength;
    assert.equal(initialByteLength, 32);

    const receivedPromise = new Promise<any>((resolve) => {
      port2.on("message", (msg) => {
        resolve(msg);
      });
    });

    const payload = {
      ...VALID_ACCEPTED,
      data: originalBuffer,
    };

    // Transfer the buffer
    port1.postMessage(payload, [originalBuffer]);

    // In structured clone with transfer list, the transferred buffer is immediately detached on sender
    assert.equal(
      originalBuffer.byteLength,
      0,
      `Transferred buffer must be detached (byteLength === 0), got ${originalBuffer.byteLength}`,
    );

    const received = await receivedPromise;

    port1.close();
    port2.close();

    assert.ok(received.data instanceof ArrayBuffer);
    assert.equal(received.data.byteLength, 32);
    const receivedFloatData = new Float64Array(received.data);
    assert.equal(receivedFloatData[0], 1.5);
    assert.equal(receivedFloatData[1], 2.5);
    assert.equal(receivedFloatData[2], 3.5);
    assert.equal(receivedFloatData[3], 4.5);
  });
});
