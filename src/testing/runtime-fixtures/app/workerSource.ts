/**
 * Self-contained worker script (no imports). Compiled into the fixture
 * bundle and started as a real `Worker` via a blob URL. A main-thread
 * fake channel would be unit-class evidence wearing a costume.
 */
import { RUNTIME_FIXTURE_PROTOCOL, RUNTIME_FIXTURE_SOURCE_DIGEST } from "./protocol.ts";

export const RUNTIME_WORKER_SOURCE = `"use strict";
var PROTOCOL = ${JSON.stringify(RUNTIME_FIXTURE_PROTOCOL)};
var DIGEST = ${JSON.stringify(RUNTIME_FIXTURE_SOURCE_DIGEST)};
var draws = { latent: 0, noise: 0 };
var lastSeed = null;
var lastInterval = null;
var forceMismatch = false;
var crashNext = false;
function lcg(seed) {
  var s = seed >>> 0;
  return function () {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return (s >>> 0) / 4294967296;
  };
}
function seedToU32(seed) {
  var h = 2166136261;
  var text = String(seed);
  for (var i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function evaluate(token) {
  var params = token.parameters || {};
  var seed = params.seed == null ? "1" : String(params.seed);
  var speed = typeof params.frameSpeed === "number" ? params.frameSpeed : 0;
  var interval = typeof params.observationInterval === "number" ? params.observationInterval : 0.1;
  if (lastSeed === null || seed !== lastSeed) {
    draws.latent += 1;
  } else if (lastInterval !== null && interval !== lastInterval) {
    draws.noise += 1;
  }
  lastSeed = seed;
  lastInterval = interval;
  var rng = lcg(seedToU32(seed));
  var probe = rng() * (1 + speed * speed);
  return {
    kind: "accepted",
    data: {
      stepIndex: draws.latent + draws.noise,
      simulationTime: draws.latent * 0.1,
      outputs: [
        {
          status: "value",
          quantityId: "fixtureProbe",
          unit: "1",
          semanticKind: "scalar",
          ownerId: "runtime-fixture-analytic",
          value: probe
        },
        {
          status: "value",
          quantityId: "latentDraws",
          unit: "1",
          semanticKind: "count",
          ownerId: "runtime-fixture-analytic",
          value: draws.latent
        },
        {
          status: "value",
          quantityId: "noiseDraws",
          unit: "1",
          semanticKind: "count",
          ownerId: "runtime-fixture-analytic",
          value: draws.noise
        }
      ]
    }
  };
}
self.addEventListener("message", function (event) {
  var msg = event.data;
  if (!msg || typeof msg !== "object") return;
  if (msg.messageKind === "hook") {
    if (msg.hook === "protocol-mismatch") forceMismatch = true;
    if (msg.hook === "crash") crashNext = true;
    return;
  }
  if (msg.messageKind === "cancel") return;
  if (msg.messageKind !== "request") return;
  if (crashNext) {
    crashNext = false;
    throw new Error("planted worker crash");
  }
  var version = forceMismatch ? "runtime-fixture-v0-planted" : PROTOCOL;
  self.postMessage({
    messageKind: "result",
    protocolVersion: version,
    sourceDigest: DIGEST,
    token: msg.token,
    result: evaluate(msg.token)
  });
});
self.postMessage({
  messageKind: "hello",
  protocolVersion: PROTOCOL,
  sourceDigest: DIGEST,
  ownerKind: "host-reference",
  modelId: "runtime-fixture"
});
`;
