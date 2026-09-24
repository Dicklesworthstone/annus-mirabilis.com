/**
 * The bridge's closed schemas, checked against golden fixtures that the Swift
 * router must also pass with identical verdicts (bead am-app-bridge-protocol-ai2g).
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { MAX_PERMALINK_URL_LENGTH } from "../../experiments/permalink/codec.ts";
import {
  createRateLimiter,
  EDITION_MESSAGE_TYPES,
  isCanonicalSiteURL,
  isExternalURL,
  MAX_MESSAGE_BYTES,
  MAX_SHARE_URL_LENGTH,
  validateEditionMessage,
} from "./schemas.ts";

type Fixture = { name: string; message: unknown; verdict: string };

const HERE = dirname(fileURLToPath(import.meta.url));
const golden = JSON.parse(readFileSync(join(HERE, "fixtures", "messages.json"), "utf8")) as {
  oversizedMarker: string;
  cases: Fixture[];
};

/** The one fixture too large to store is rebuilt here from its marker. */
function materialize(message: unknown): unknown {
  const text = JSON.stringify(message);
  return JSON.parse(
    text.replace(
      JSON.stringify(golden.oversizedMarker),
      JSON.stringify("x".repeat(MAX_MESSAGE_BYTES)),
    ),
  );
}

describe("golden bridge messages", () => {
  for (const fixture of golden.cases) {
    it(`${fixture.name}: ${fixture.verdict}`, () => {
      const verdict = validateEditionMessage(materialize(fixture.message));
      assert.equal(
        verdict.ok ? "ok" : verdict.reason,
        fixture.verdict,
        verdict.ok ? "" : verdict.detail,
      );
    });
  }

  it("has at least one valid message for every v1 type, and invalid ones too", () => {
    const valid = new Set(
      golden.cases
        .filter((c) => c.verdict === "ok")
        .map((c) => (c.message as { type: string }).type),
    );
    assert.deepEqual(
      [...EDITION_MESSAGE_TYPES].filter((type) => !valid.has(type)),
      [],
    );
    assert.ok(golden.cases.some((c) => c.verdict !== "ok"));
  });
});

describe("URL rules", () => {
  it("shares only canonical pages of the website", () => {
    assert.equal(
      isCanonicalSiteURL("https://annus-mirabilis.com/papers/brownian-motion/#s4"),
      true,
    );
    assert.equal(
      isCanonicalSiteURL(`https://annus-mirabilis.com/?tape=${"a".repeat(MAX_SHARE_URL_LENGTH)}`),
      false,
    );
    assert.equal(isCanonicalSiteURL("not a url"), false);
  });

  it("opens outside only https with a host", () => {
    assert.equal(isExternalURL("https://en.wikipedia.org/"), true);
    // WHATWG parsing turns "https:///x" into host "x", so the hostless cases are these:
    assert.equal(isExternalURL("https://"), false);
    assert.equal(isExternalURL("https:"), false);
    assert.equal(isExternalURL("https://user:pw@example.com/"), false);
  });

  it("uses the edition's own permalink bound", () => {
    assert.equal(MAX_SHARE_URL_LENGTH, MAX_PERMALINK_URL_LENGTH);
  });
});

describe("rate limit", () => {
  it("allows 50 of one type in a second, refuses the 51st, and allows again after the window", () => {
    const allow = createRateLimiter(50);
    for (let i = 0; i < 50; i++) {
      assert.equal(allow("route.changed", 1000 + i), true);
    }
    assert.equal(allow("route.changed", 1060), false);
    assert.equal(allow("hello", 1060), true, "types are limited separately");
    assert.equal(allow("route.changed", 2001), true);
  });
});
