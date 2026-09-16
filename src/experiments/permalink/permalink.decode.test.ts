import assert from "node:assert/strict";
import test from "node:test";
import { deflateRawSync } from "node:zlib";
import { getLogger, newRunIdentity } from "../../testing/log/logger.ts";
import { decodeTapePermalink, encodeTapePermalink } from "./codec.ts";
import { FIXTURE_TEACHING_TAPE_EINSTEIN_08 } from "./fixture.ts";
import type { TapeControlEvent, TapeV2 } from "./types.ts";

const logRunId = newRunIdentity();
const logger = getLogger("permalink", logRunId);

test("permalink.decode: successfully decodes a valid tape permalink from URL or query string", () => {
  const encoded = encodeTapePermalink(FIXTURE_TEACHING_TAPE_EINSTEIN_08);
  const fromUrl = decodeTapePermalink(`https://annus-mirabilis.com/lab/bm-01?tape=${encoded}`);
  assert.equal(fromUrl.kind, "success");
  if (fromUrl.kind === "success") {
    assert.equal(fromUrl.tape.experimentId, FIXTURE_TEACHING_TAPE_EINSTEIN_08.experimentId);
    assert.equal(fromUrl.tape.tapeVersion, 2);
    assert.equal(fromUrl.tape.seed, FIXTURE_TEACHING_TAPE_EINSTEIN_08.seed);
  }

  const fromQuery = decodeTapePermalink(`?tape=${encoded}`);
  assert.equal(fromQuery.kind, "success");

  const fromDirect = decodeTapePermalink(encoded);
  assert.equal(fromDirect.kind, "success");
});

test("permalink.decode: returns absent for empty or missing tape parameter", () => {
  assert.equal(decodeTapePermalink(null).kind, "absent");
  assert.equal(decodeTapePermalink("").kind, "absent");
  assert.equal(decodeTapePermalink("?view=parallel").kind, "absent");
});

test("permalink.decode: rejects JSON-number seed with explicit precision notice", () => {
  // Construct raw payload with a JSON number instead of a decimal string
  const rawWithNumberSeed = {
    ...FIXTURE_TEACHING_TAPE_EINSTEIN_08,
    seed: 1905, // JSON number
  };
  const json = JSON.stringify(rawWithNumberSeed);
  const base64url = Buffer.from(json).toString("base64url");

  const result = decodeTapePermalink(base64url);
  assert.equal(result.kind, "invalid");
  if (result.kind === "invalid") {
    assert.equal(result.reason, "u64-not-string");
    assert.ok(result.notice.includes("string"));
  }

  logger.log({
    testId: "permalink-decode-json-number-seed-rejected",
    beadId: "am-inst-permalink-tape-s677",
    outcome: "passed",
    message: "JSON number seed rejected to prevent precision loss above 2^53-1",
  });
});

test("permalink.decode: rejects truncated base64url with clear notice", () => {
  const encoded = encodeTapePermalink(FIXTURE_TEACHING_TAPE_EINSTEIN_08);
  const truncated = encoded.slice(0, 20); // Severely truncated base64url

  const result = decodeTapePermalink(truncated);
  assert.equal(result.kind, "invalid");
  if (result.kind === "invalid") {
    assert.ok(
      result.reason === "tape-malformed-encoding" ||
        result.reason === "tape-malformed-json" ||
        result.reason === "tape-validation-error",
    );
    assert.ok(result.notice.includes("could not be restored"));
  }

  logger.log({
    testId: "permalink-decode-truncated-base64url-rejected",
    beadId: "am-inst-permalink-tape-s677",
    outcome: "passed",
    message: "Truncated base64url link handled safely without unhandled exceptions",
  });
});

test("permalink.decode: rejects preset id in the mode field", () => {
  const rawWithPresetInMode = {
    ...FIXTURE_TEACHING_TAPE_EINSTEIN_08,
    mode: "bm-01-einstein-08-preset", // Preset ID in mode field
  };
  const json = JSON.stringify(rawWithPresetInMode);
  const base64url = Buffer.from(json).toString("base64url");

  const result = decodeTapePermalink(base64url);
  assert.equal(result.kind, "invalid");
  if (result.kind === "invalid") {
    assert.equal(result.reason, "tape-mode-is-preset-id");
    assert.ok(result.notice.includes("preset id"));
  }

  logger.log({
    testId: "permalink-decode-preset-in-mode-rejected",
    beadId: "am-inst-permalink-tape-s677",
    outcome: "passed",
    message: "Preset ID placed in mode field is rejected by schema",
  });
});

test("permalink.decode: 256 events are accepted and 257 events are rejected", () => {
  // 1. Build 256 events -> must pass
  const events256: TapeControlEvent[] = [];
  for (let i = 0; i < 256; i++) {
    events256.push({
      actionIndex: i,
      commandClass: "physical-intervention",
      paramId: "temperatureK",
      value: 293.15 + (i % 10),
    });
  }

  const tape256: TapeV2 = {
    ...FIXTURE_TEACHING_TAPE_EINSTEIN_08,
    events: events256,
  };
  const encoded256 = encodeTapePermalink(tape256);
  const result256 = decodeTapePermalink(encoded256);
  assert.equal(result256.kind, "success");
  if (result256.kind === "success") {
    assert.equal(result256.tape.events.length, 256);
  }

  // 2. Build 257 events -> must be rejected with tape-events-exceeded
  const events257 = [
    ...events256,
    {
      actionIndex: 256,
      commandClass: "physical-intervention" as const,
      paramId: "temperatureK",
      value: 310,
    },
  ];
  const raw257 = {
    ...FIXTURE_TEACHING_TAPE_EINSTEIN_08,
    events: events257,
  };
  const json257 = JSON.stringify(raw257);
  const compressed257 = Buffer.from(deflateRawSync(Buffer.from(json257))).toString("base64url");

  const result257 = decodeTapePermalink(compressed257);
  assert.equal(result257.kind, "invalid");
  if (result257.kind === "invalid") {
    assert.equal(result257.reason, "tape-events-exceeded");
    assert.ok(result257.notice.includes("256"));
  }

  logger.log({
    testId: "permalink-decode-event-count-boundary",
    beadId: "am-inst-permalink-tape-s677",
    outcome: "passed",
    message: "Exact event boundary verified: 256 accepted, 257 rejected",
  });
});

test("permalink.decode: rejects oversized tape (> 2048 characters)", () => {
  const hugePadding = "A".repeat(2050);
  const result = decodeTapePermalink(hugePadding);
  assert.equal(result.kind, "invalid");
  if (result.kind === "invalid") {
    assert.equal(result.reason, "tape-oversize");
    assert.ok(result.notice.includes("size limit"));
  }
});
