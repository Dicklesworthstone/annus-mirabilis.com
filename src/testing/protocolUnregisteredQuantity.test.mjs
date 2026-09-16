import assert from "node:assert/strict";
import test from "node:test";
import { BM06_DEFAULTS } from "../experiments/bm06/definition.ts";
import { decodeLabResponse } from "../workers/protocol/bm06.ts";

// Planted red for the decoder boundary.
//
// These three protocols each carried `const c = BM0X_OUTPUTS[output.quantityId]!`.
// I replaced the assertion with an explicit check producing a typed refusal.
//
// WHAT I VERIFIED, having first claimed more than was true: the assertion was NOT
// reachable with an unregistered id. `decodeResultBatch` runs first and already
// refuses an unknown quantity id with "Malformed calculation payload." So removing
// the `!` is defence in depth, not the repair of a live silent-failure path.
//
// What this test therefore pins is the real contract, which nothing else asserted:
// an unregistered quantity id is refused with a TYPED protocol error, never with a
// bare TypeError from reading a property off undefined. That property would break
// if the upstream status-map check were ever relaxed and the assertion restored.

const DIGEST = "source:sha256:0000000000000000000000000000000000000000000000000000000000000000";

function tokenFor() {
  return {
    experimentId: "bm-06",
    instanceId: "inst-1",
    runId: "run-1",
    actionIndex: 1,
    revisions: { input: 1, observer: 0, measurement: 0, estimator: 0 },
    parameters: { ...BM06_DEFAULTS },
  };
}

function responseWithQuantityId(quantityId) {
  const token = tokenFor();
  return {
    envelope: {
      messageKind: "result",
      protocolVersion: "bm06-host-v1",
      sourceDigest: DIGEST,
      token,
      result: {
        kind: "accepted",
        data: {
          stepIndex: 0,
          simulationTime: BM06_DEFAULTS.t,
          outputs: [
            {
              quantityId,
              ownerId: "host:brownian-reference",
              semanticKind: "scalar",
              unit: "m",
              status: "value",
              value: 1,
            },
          ],
        },
      },
    },
    token,
  };
}

test("an unregistered quantity id is refused by name, not by TypeError", () => {
  const { envelope, token } = responseWithQuantityId("notAQuantityWeEverRegistered");

  let thrown;
  try {
    decodeLabResponse(envelope, token, DIGEST);
  } catch (error) {
    thrown = error;
  }

  assert.ok(thrown, "decoding an unregistered quantity id must not succeed");
  assert.notEqual(
    thrown.constructor.name,
    "TypeError",
    "a bare TypeError means the non-null assertion is back and the refusal path was skipped",
  );
  assert.equal(
    thrown.constructor.name,
    "LabProtocolError",
    "an unregistered quantity id must surface as the protocol's own typed error",
  );
  assert.equal(
    thrown.code,
    "malformed-response",
    "the refusal must classify as malformed-response so the host reports it honestly",
  );
});
