import assert from "node:assert/strict";
import { test } from "node:test";
import { projectFacsimileDocument } from "../reader/facsimile/document.ts";
import {
  decodeFacsimileAvailability,
  FACSIMILE_WIRE_BYTES,
  facsimileMapPath,
  readFacsimileResponse,
} from "../reader/facsimile/wire.ts";

const document = projectFacsimileDocument(
  "mass-energy",
  "ap-18-639",
  {
    configVersion: 1,
    key: "ap-18-639",
    verifiedAnchor: { parentPageIndex: 233, printedPage: 639, verifiedBy: "fixture" },
    articlePages: { printedFirst: 639, printedLast: 641, parentPageIndices: [233, 234, 235] },
    rights: { publicationDecision: "publish", rightsStatus: "scan-open-terms" },
    pinned: {
      path: "public/papers/pdfs/ap-18-639.pdf",
      sha256: "a".repeat(64),
      pageCount: 3,
      mimeType: "application/pdf",
      acquisitionDate: "2026-09-18",
      originUrl: "https://archive.org/example.pdf",
    },
  },
  {
    paper: "mass-energy",
    document: "ap-18-639",
    pageCount: 3,
    pageRange: [639, 641],
    status: "in-preparation",
    units: [
      {
        id: "s0-p6",
        kind: "paragraph",
        locators: [{ page: 640 }, { page: 641 }],
        destination: { editionBlockId: "de-example" },
      },
    ],
  },
);
const envelope = () =>
  JSON.parse(JSON.stringify({ schemaVersion: 1, kind: "available", document }));
const decode = (value) => decodeFacsimileAvailability(value, "mass-energy");

test("server-projected metadata survives a versioned roundtrip without adding source claims", () => {
  const result = decode(envelope());
  assert.deepEqual(result.document, document);
  assert.equal(result.kind, "available");
  assert.ok(Object.isFrozen(result.document.units[0].pdfPages));
});
test("publication refusal crosses the same transport without leaking a source URL", () => {
  const result = decode({
    schemaVersion: 1,
    kind: "unavailable",
    code: "facsimile-not-published",
    message: "Not admitted.",
  });
  assert.equal(result.kind, "unavailable");
  assert.equal("document" in result, false);
});
test("schema, paper identity, local URL and hash cannot be substituted by a response", () => {
  const mutations = [
    (x) => (x.schemaVersion = 2),
    (x) => (x.kind = "maybe"),
    (x) => (x.document.paperId = "light-quanta"),
    (x) => (x.document.pdfUrl = "https://example.org/wrong.pdf"),
    (x) => (x.document.pdfUrl = "/private.pdf"),
    (x) => (x.document.key = "../secret"),
    (x) => (x.document.sha256 = "bad"),
    (x) => (x.document.originUrl = "javascript:alert(1)"),
    (x) => (x.document.originUrl = "https://user:secret@example.org/"),
    (x) => (x.document.inventoryStatus = {}),
    (x) => (x.document.acquisitionDate = "yesterday"),
  ];
  for (const mutate of mutations) {
    const value = envelope();
    mutate(value);
    assert.throws(() => decode(value));
  }
});
test("noncontiguous, repeated, fractional and out-of-bounds page mappings are rejected", () => {
  const mutations = [
    (x) => (x.pages = []),
    (x) => (x.pages[0].pdfPage = 0),
    (x) => (x.pages[1].printedPage = 700),
    (x) => (x.units[0].pdfPages = [0]),
    (x) => (x.units[0].pdfPages = [2, 2]),
    (x) => (x.units[0].pdfPages = [3, 2]),
    (x) => (x.units[0].pdfPages = [2.5]),
    (x) => (x.units[0].pdfPages = [4]),
    (x) => (x.units[0].pdfPages = []),
  ];
  for (const mutate of mutations) {
    const value = envelope();
    mutate(value.document);
    assert.throws(() => decode(value));
  }
});
test("invalid unit identities and aliases cannot manufacture source anchors", () => {
  const mutations = [
    (x) => (x.units[0].id = "bad id"),
    (x) => x.units.push(x.units[0]),
    (x) => (x.units[0].section = "../s0"),
    (x) => (x.units[0].aliases = ["facsimile-page-639"]),
    (x) => (x.units[0].aliases = Array(33).fill("id")),
    (x) => (x.units[0].id = "facsimile-page-640"),
  ];
  for (const mutate of mutations) {
    const value = envelope();
    mutate(value.document);
    assert.throws(() => decode(value));
  }
});
test("source-map URL construction cannot escape the paper route", () => {
  assert.equal(facsimileMapPath("mass-energy"), "/papers/mass-energy/facsimile.json");
  for (const id of ["../private", "a?b", "a#b", "https://example.org"])
    assert.throws(() => facsimileMapPath(id));
});
test("streamed JSON is decoded through the same bounded schema", async () => {
  const result = await readFacsimileResponse(Response.json(envelope()), "mass-energy");
  assert.deepEqual(result.document, document);
});
test("HTML fallbacks, failed requests and corrupt JSON remain transport failures", async () => {
  for (const response of [
    new Response("<html>404</html>"),
    new Response("{}", { status: 404 }),
    new Response("{", { headers: { "content-type": "application/json" } }),
  ]) {
    await assert.rejects(readFacsimileResponse(response, "mass-energy"));
  }
});
test("oversized streamed bodies are cancelled even without a Content-Length header", async () => {
  let cancelled = false;
  const response = new Response(
    new ReadableStream({
      start(controller) {
        controller.enqueue(new Uint8Array(FACSIMILE_WIRE_BYTES + 1));
      },
      cancel() {
        cancelled = true;
      },
    }),
    { headers: { "content-type": "application/json" } },
  );
  await assert.rejects(readFacsimileResponse(response, "mass-energy"), /byte budget/);
  assert.equal(cancelled, true);
});
test("unknown metadata is not copied into the client document", () => {
  const value = envelope();
  value.document.internalPath = "/private/path";
  value.document.units[0].untrustedMarkup = "<script>bad()</script>";
  const result = decode(value);
  assert.equal("internalPath" in result.document, false);
  assert.equal("untrustedMarkup" in result.document.units[0], false);
});
