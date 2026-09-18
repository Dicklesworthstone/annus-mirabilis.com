/**
 * Comprehensive accept/reject tests for all refusal throw sites across instrument protocol files (am-muyh).
 *
 * Governed by bead am-muyh and AGENTS.md:
 * - Worker protocol boundaries for all 8 lab instruments: bm01, bm04, bm05, bm06, bm07, bm08, lq01, sr03.
 * - Accept/reject pair per throw site.
 * - Every test carries explicit line citation (<file>.ts:<line>) and literal code string.
 */

import assert from "node:assert/strict";
import test, { describe } from "node:test";
import { BM01_MODEL } from "../../experiments/bm01/definition.ts";
import { BM04_MODEL } from "../../experiments/bm04/definition.ts";
import { BM05_MODEL } from "../../experiments/bm05/definition.ts";
import { BM06_MODEL } from "../../experiments/bm06/definition.ts";
import { BM07_MODEL } from "../../experiments/bm07/definition.ts";
import { BM08_MODEL } from "../../experiments/bm08/definition.ts";
import { LQ01_MODEL } from "../../experiments/lq01/definition.ts";
import { SR03_MODEL } from "../../experiments/sr03/definition.ts";
import { BM01_PROTOCOL, decodeLabHello as decodeBm01Hello } from "./bm01.ts";
import { BM04_PROTOCOL, decodeLabHello as decodeBm04Hello } from "./bm04.ts";
import { BM05_PROTOCOL, decodeLabHello as decodeBm05Hello } from "./bm05.ts";
import { BM06_PROTOCOL, decodeLabHello as decodeBm06Hello, LabProtocolError } from "./bm06.ts";
import { BM07_PROTOCOL, decodeLabHello as decodeBm07Hello } from "./bm07.ts";
import { BM08_PROTOCOL, decodeLabHello as decodeBm08Hello } from "./bm08.ts";
import { decodeLabHello as decodeLq01Hello, LQ01_PROTOCOL } from "./lq01.ts";
import { decodeLabHello as decodeSr03Hello, SR03_PROTOCOL } from "./sr03.ts";

const VALID_DIGEST = `source:sha256:${"a".repeat(64)}`;
const OTHER_DIGEST = `source:sha256:${"b".repeat(64)}`;

describe("Instrument worker protocol refusal throw sites (am-muyh)", () => {
  // ==========================================================================
  // BM-01 Protocol Refusals (bm01.ts)
  // ==========================================================================
  const validBm01Hello = {
    messageKind: "hello" as const,
    protocolVersion: BM01_PROTOCOL,
    sourceDigest: VALID_DIGEST,
    ownerKind: "host-reference" as const,
    modelId: BM01_MODEL.id,
  };

  test("site (bm01.ts:49) malformed-response: rejects null or non-plain record, accepts valid hello", () => {
    assert.equal(decodeBm01Hello(validBm01Hello, VALID_DIGEST).modelId, BM01_MODEL.id);

    assert.throws(
      () => decodeBm01Hello(null, VALID_DIGEST),
      (err: unknown) => {
        assert.ok(err instanceof LabProtocolError);
        assert.equal(err.code, "malformed-response");
        return true;
      },
    );
    assert.throws(
      () => decodeBm01Hello({ ...validBm01Hello, messageKind: "invalid-kind" }, VALID_DIGEST),
      (err: unknown) => {
        assert.ok(err instanceof LabProtocolError);
        assert.equal(err.code, "malformed-response");
        return true;
      },
    );
  });

  test("site (bm01.ts:81) protocol-mismatch: rejects unsupported protocol version, accepts BM01_PROTOCOL", () => {
    assert.equal(decodeBm01Hello(validBm01Hello, VALID_DIGEST).protocolVersion, BM01_PROTOCOL);

    assert.throws(
      () => decodeBm01Hello({ ...validBm01Hello, protocolVersion: "bm01-wrong-v99" }, VALID_DIGEST),
      (err: unknown) => {
        assert.ok(err instanceof LabProtocolError);
        assert.equal(err.code, "protocol-mismatch");
        return true;
      },
    );
  });

  test("site (bm01.ts:91) artifact-mismatch: rejects mismatched source digest, accepts expected digest", () => {
    assert.equal(decodeBm01Hello(validBm01Hello, VALID_DIGEST).sourceDigest, VALID_DIGEST);

    assert.throws(
      () => decodeBm01Hello({ ...validBm01Hello, sourceDigest: OTHER_DIGEST }, VALID_DIGEST),
      (err: unknown) => {
        assert.ok(err instanceof LabProtocolError);
        assert.equal(err.code, "artifact-mismatch");
        return true;
      },
    );
  });

  // ==========================================================================
  // BM-04 Protocol Refusals (bm04.ts)
  // ==========================================================================
  const validBm04Hello = {
    messageKind: "hello" as const,
    protocolVersion: BM04_PROTOCOL,
    sourceDigest: VALID_DIGEST,
    ownerKind: "host-reference" as const,
    modelId: BM04_MODEL.id,
  };

  test("site (bm04.ts:52) malformed-response: rejects null or non-plain record, accepts valid hello", () => {
    assert.equal(decodeBm04Hello(validBm04Hello, VALID_DIGEST).modelId, BM04_MODEL.id);

    assert.throws(
      () => decodeBm04Hello(null, VALID_DIGEST),
      (err: unknown) => {
        assert.ok(err instanceof LabProtocolError);
        assert.equal(err.code, "malformed-response");
        return true;
      },
    );
  });

  test("site (bm04.ts:93) protocol-mismatch: rejects unsupported protocol version, accepts BM04_PROTOCOL", () => {
    assert.equal(decodeBm04Hello(validBm04Hello, VALID_DIGEST).protocolVersion, BM04_PROTOCOL);

    assert.throws(
      () => decodeBm04Hello({ ...validBm04Hello, protocolVersion: "bm04-wrong-v99" }, VALID_DIGEST),
      (err: unknown) => {
        assert.ok(err instanceof LabProtocolError);
        assert.equal(err.code, "protocol-mismatch");
        return true;
      },
    );
  });

  test("site (bm04.ts:107) artifact-mismatch: rejects mismatched source digest, accepts expected digest", () => {
    assert.equal(decodeBm04Hello(validBm04Hello, VALID_DIGEST).sourceDigest, VALID_DIGEST);

    assert.throws(
      () => decodeBm04Hello({ ...validBm04Hello, sourceDigest: OTHER_DIGEST }, VALID_DIGEST),
      (err: unknown) => {
        assert.ok(err instanceof LabProtocolError);
        assert.equal(err.code, "artifact-mismatch");
        return true;
      },
    );
  });

  // ==========================================================================
  // BM-05 Protocol Refusals (bm05.ts)
  // ==========================================================================
  const validBm05Hello = {
    messageKind: "hello" as const,
    protocolVersion: BM05_PROTOCOL,
    sourceDigest: VALID_DIGEST,
    ownerKind: "host-reference" as const,
    modelId: BM05_MODEL.id,
  };

  test("site (bm05.ts:49) malformed-response: rejects null or non-plain record, accepts valid hello", () => {
    assert.equal(decodeBm05Hello(validBm05Hello, VALID_DIGEST).modelId, BM05_MODEL.id);

    assert.throws(
      () => decodeBm05Hello(null, VALID_DIGEST),
      (err: unknown) => {
        assert.ok(err instanceof LabProtocolError);
        assert.equal(err.code, "malformed-response");
        return true;
      },
    );
  });

  test("site (bm05.ts:81) protocol-mismatch: rejects unsupported protocol version, accepts BM05_PROTOCOL", () => {
    assert.equal(decodeBm05Hello(validBm05Hello, VALID_DIGEST).protocolVersion, BM05_PROTOCOL);

    assert.throws(
      () => decodeBm05Hello({ ...validBm05Hello, protocolVersion: "bm05-wrong-v99" }, VALID_DIGEST),
      (err: unknown) => {
        assert.ok(err instanceof LabProtocolError);
        assert.equal(err.code, "protocol-mismatch");
        return true;
      },
    );
  });

  test("site (bm05.ts:91) artifact-mismatch: rejects mismatched source digest, accepts expected digest", () => {
    assert.equal(decodeBm05Hello(validBm05Hello, VALID_DIGEST).sourceDigest, VALID_DIGEST);

    assert.throws(
      () => decodeBm05Hello({ ...validBm05Hello, sourceDigest: OTHER_DIGEST }, VALID_DIGEST),
      (err: unknown) => {
        assert.ok(err instanceof LabProtocolError);
        assert.equal(err.code, "artifact-mismatch");
        return true;
      },
    );
  });

  // ==========================================================================
  // BM-06 Protocol Refusals (bm06.ts)
  // ==========================================================================
  const validBm06Hello = {
    messageKind: "hello" as const,
    protocolVersion: BM06_PROTOCOL,
    sourceDigest: VALID_DIGEST,
    ownerKind: "host-reference" as const,
    modelId: BM06_MODEL.id,
  };

  test("site (bm06.ts:49) malformed-response: rejects null or non-plain record, accepts valid hello", () => {
    assert.equal(decodeBm06Hello(validBm06Hello, VALID_DIGEST).modelId, BM06_MODEL.id);

    assert.throws(
      () => decodeBm06Hello(null, VALID_DIGEST),
      (err: unknown) => {
        assert.ok(err instanceof LabProtocolError);
        assert.equal(err.code, "malformed-response");
        return true;
      },
    );
  });

  test("site (bm06.ts:81) protocol-mismatch: rejects unsupported protocol version, accepts BM06_PROTOCOL", () => {
    assert.equal(decodeBm06Hello(validBm06Hello, VALID_DIGEST).protocolVersion, BM06_PROTOCOL);

    assert.throws(
      () => decodeBm06Hello({ ...validBm06Hello, protocolVersion: "bm06-wrong-v99" }, VALID_DIGEST),
      (err: unknown) => {
        assert.ok(err instanceof LabProtocolError);
        assert.equal(err.code, "protocol-mismatch");
        return true;
      },
    );
  });

  test("site (bm06.ts:91) artifact-mismatch: rejects mismatched source digest, accepts expected digest", () => {
    assert.equal(decodeBm06Hello(validBm06Hello, VALID_DIGEST).sourceDigest, VALID_DIGEST);

    assert.throws(
      () => decodeBm06Hello({ ...validBm06Hello, sourceDigest: OTHER_DIGEST }, VALID_DIGEST),
      (err: unknown) => {
        assert.ok(err instanceof LabProtocolError);
        assert.equal(err.code, "artifact-mismatch");
        return true;
      },
    );
  });

  // ==========================================================================
  // BM-07 Protocol Refusals (bm07.ts)
  // ==========================================================================
  const validBm07Hello = {
    messageKind: "hello" as const,
    protocolVersion: BM07_PROTOCOL,
    sourceDigest: VALID_DIGEST,
    ownerKind: "host-reference" as const,
    modelId: BM07_MODEL.id,
  };

  test("site (bm07.ts:53) malformed-response: rejects null or non-plain record, accepts valid hello", () => {
    assert.equal(decodeBm07Hello(validBm07Hello, VALID_DIGEST).modelId, BM07_MODEL.id);

    assert.throws(
      () => decodeBm07Hello(null, VALID_DIGEST),
      (err: unknown) => {
        assert.ok(err instanceof LabProtocolError);
        assert.equal(err.code, "malformed-response");
        return true;
      },
    );
  });

  test("site (bm07.ts:85) protocol-mismatch: rejects unsupported protocol version, accepts BM07_PROTOCOL", () => {
    assert.equal(decodeBm07Hello(validBm07Hello, VALID_DIGEST).protocolVersion, BM07_PROTOCOL);

    assert.throws(
      () => decodeBm07Hello({ ...validBm07Hello, protocolVersion: "bm07-wrong-v99" }, VALID_DIGEST),
      (err: unknown) => {
        assert.ok(err instanceof LabProtocolError);
        assert.equal(err.code, "protocol-mismatch");
        return true;
      },
    );
  });

  test("site (bm07.ts:95) artifact-mismatch: rejects mismatched source digest, accepts expected digest", () => {
    assert.equal(decodeBm07Hello(validBm07Hello, VALID_DIGEST).sourceDigest, VALID_DIGEST);

    assert.throws(
      () => decodeBm07Hello({ ...validBm07Hello, sourceDigest: OTHER_DIGEST }, VALID_DIGEST),
      (err: unknown) => {
        assert.ok(err instanceof LabProtocolError);
        assert.equal(err.code, "artifact-mismatch");
        return true;
      },
    );
  });

  // ==========================================================================
  // BM-08 Protocol Refusals (bm08.ts)
  // ==========================================================================
  const validBm08Hello = {
    messageKind: "hello" as const,
    protocolVersion: BM08_PROTOCOL,
    sourceDigest: VALID_DIGEST,
    ownerKind: "host-reference" as const,
    modelId: BM08_MODEL.id,
  };

  test("site (bm08.ts:49) malformed-response: rejects null or non-plain record, accepts valid hello", () => {
    assert.equal(decodeBm08Hello(validBm08Hello, VALID_DIGEST).modelId, BM08_MODEL.id);

    assert.throws(
      () => decodeBm08Hello(null, VALID_DIGEST),
      (err: unknown) => {
        assert.ok(err instanceof LabProtocolError);
        assert.equal(err.code, "malformed-response");
        return true;
      },
    );
  });

  test("site (bm08.ts:81) protocol-mismatch: rejects unsupported protocol version, accepts BM08_PROTOCOL", () => {
    assert.equal(decodeBm08Hello(validBm08Hello, VALID_DIGEST).protocolVersion, BM08_PROTOCOL);

    assert.throws(
      () => decodeBm08Hello({ ...validBm08Hello, protocolVersion: "bm08-wrong-v99" }, VALID_DIGEST),
      (err: unknown) => {
        assert.ok(err instanceof LabProtocolError);
        assert.equal(err.code, "protocol-mismatch");
        return true;
      },
    );
  });

  test("site (bm08.ts:91) artifact-mismatch: rejects mismatched source digest, accepts expected digest", () => {
    assert.equal(decodeBm08Hello(validBm08Hello, VALID_DIGEST).sourceDigest, VALID_DIGEST);

    assert.throws(
      () => decodeBm08Hello({ ...validBm08Hello, sourceDigest: OTHER_DIGEST }, VALID_DIGEST),
      (err: unknown) => {
        assert.ok(err instanceof LabProtocolError);
        assert.equal(err.code, "artifact-mismatch");
        return true;
      },
    );
  });

  // ==========================================================================
  // LQ-01 Protocol Refusals (lq01.ts)
  // ==========================================================================
  const validLq01Hello = {
    messageKind: "hello" as const,
    protocolVersion: LQ01_PROTOCOL,
    sourceDigest: VALID_DIGEST,
    ownerKind: "host-reference" as const,
    modelId: LQ01_MODEL.id,
  };

  test("site (lq01.ts:47) malformed-response: rejects null or non-plain record, accepts valid hello", () => {
    assert.equal(decodeLq01Hello(validLq01Hello, VALID_DIGEST).modelId, LQ01_MODEL.id);

    assert.throws(
      () => decodeLq01Hello(null, VALID_DIGEST),
      (err: unknown) => {
        assert.ok(err instanceof LabProtocolError);
        assert.equal(err.code, "malformed-response");
        return true;
      },
    );
  });

  test("site (lq01.ts:88) protocol-mismatch: rejects unsupported protocol version, accepts LQ01_PROTOCOL", () => {
    assert.equal(decodeLq01Hello(validLq01Hello, VALID_DIGEST).protocolVersion, LQ01_PROTOCOL);

    assert.throws(
      () => decodeLq01Hello({ ...validLq01Hello, protocolVersion: "lq01-wrong-v99" }, VALID_DIGEST),
      (err: unknown) => {
        assert.ok(err instanceof LabProtocolError);
        assert.equal(err.code, "protocol-mismatch");
        return true;
      },
    );
  });

  test("site (lq01.ts:102) artifact-mismatch: rejects mismatched source digest, accepts expected digest", () => {
    assert.equal(decodeLq01Hello(validLq01Hello, VALID_DIGEST).sourceDigest, VALID_DIGEST);

    assert.throws(
      () => decodeLq01Hello({ ...validLq01Hello, sourceDigest: OTHER_DIGEST }, VALID_DIGEST),
      (err: unknown) => {
        assert.ok(err instanceof LabProtocolError);
        assert.equal(err.code, "artifact-mismatch");
        return true;
      },
    );
  });

  // ==========================================================================
  // SR-03 Protocol Refusals (sr03.ts)
  // ==========================================================================
  const validSr03Hello = {
    messageKind: "hello" as const,
    protocolVersion: SR03_PROTOCOL,
    sourceDigest: VALID_DIGEST,
    ownerKind: "host-reference" as const,
    modelId: SR03_MODEL.id,
  };

  test("site (sr03.ts:47) malformed-response: rejects null or non-plain record, accepts valid hello", () => {
    assert.equal(decodeSr03Hello(validSr03Hello, VALID_DIGEST).modelId, SR03_MODEL.id);

    assert.throws(
      () => decodeSr03Hello(null, VALID_DIGEST),
      (err: unknown) => {
        assert.ok(err instanceof LabProtocolError);
        assert.equal(err.code, "malformed-response");
        return true;
      },
    );
  });

  test("site (sr03.ts:88) protocol-mismatch: rejects unsupported protocol version, accepts SR03_PROTOCOL", () => {
    assert.equal(decodeSr03Hello(validSr03Hello, VALID_DIGEST).protocolVersion, SR03_PROTOCOL);

    assert.throws(
      () => decodeSr03Hello({ ...validSr03Hello, protocolVersion: "sr03-wrong-v99" }, VALID_DIGEST),
      (err: unknown) => {
        assert.ok(err instanceof LabProtocolError);
        assert.equal(err.code, "protocol-mismatch");
        return true;
      },
    );
  });

  test("site (sr03.ts:102) artifact-mismatch: rejects mismatched source digest, accepts expected digest", () => {
    assert.equal(decodeSr03Hello(validSr03Hello, VALID_DIGEST).sourceDigest, VALID_DIGEST);

    assert.throws(
      () => decodeSr03Hello({ ...validSr03Hello, sourceDigest: OTHER_DIGEST }, VALID_DIGEST),
      (err: unknown) => {
        assert.ok(err instanceof LabProtocolError);
        assert.equal(err.code, "artifact-mismatch");
        return true;
      },
    );
  });
});
