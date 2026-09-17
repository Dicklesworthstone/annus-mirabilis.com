import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { gzipSync } from "node:zlib";
import { packageSearchIndex } from "./build.ts";
import { createSearchEngine, SEARCH_LIMITS } from "./core.ts";
import {
  aliasesForDocuments,
  assertSearchCoverage,
  documentsFromCompiled,
  searchProfile,
} from "./documents.ts";

const paragraph = (text) => ({ kind: "paragraph", text });
function corpus() {
  const argument = {
    id: "arg-bm-observable",
    section: "s5",
    title: "A measurable displacement",
    question: "How far does it wander?",
    recap: "Four times the time gives twice the coordinate RMS.",
    review: "draft",
    premises: ["Independent steps"],
    limitations: ["No molecular collisions"],
    experiments: ["bm-01"],
    readings: {
      overview: [paragraph("Particles spread")],
      full: [paragraph("Look at the mean square displacement")],
      steps: [
        { kind: "formula", spoken: "lambda x equals square root of two D t", latex: "lambda_x" },
      ],
      margin: [paragraph("A modern lens")],
    },
  };
  return {
    papers: [
      {
        schemaVersion: 1,
        paper: {
          id: "brownian-motion",
          title: "Brownian motion",
          germanTitle: "Bewegung von Teilchen",
          description: "An explanation, not a reviewed transcription.",
          status: "explanation-preview",
          sections: [{ id: "s5", title: "The observable", arguments: [argument.id] }],
        },
        arguments: [argument],
        equations: [
          {
            id: "eq-model-spread",
            argument: argument.id,
            title: "RMS displacement",
            spoken: "Root mean square",
            explanation: "What a coordinate spread measures",
            review: "draft",
            notation: "modern-pedagogical",
            tree: {},
            assumptions: ["Positive diffusion coefficient"],
            notes: [{ title: "Observation time", explanation: "A fixed interval" }],
          },
        ],
      },
    ],
    foundations: [
      {
        id: "mean-square",
        title: "Mean squares",
        question: "Why square?",
        summary: "Left and right do not cancel",
        review: "draft",
        explanation: [paragraph("Squaring displacement")],
        example: [{ kind: "steps", items: ["Take two steps", "Square them"] }],
        stoppingPoint: "Return to the argument",
      },
    ],
    instruments: [
      {
        id: "bm-01",
        title: "Tracer ensemble",
        question: "Follow the particles",
        status: "registered",
      },
      { id: "sr-01", title: "Synchronize clocks", status: "registered" },
      { id: "lq-08", title: "Photoelectric effect", status: "registered" },
      { id: "me-01", title: "Energy ledgers", status: "registered" },
      { id: "avogadro-lab", title: "Not built", status: "in-preparation" },
    ],
  };
}
const documents = () => {
  const c = corpus();
  return documentsFromCompiled(c.papers, c.foundations, c.instruments, "scaffold", {
    "eq-model-spread": "λ_x = sqrt(2 D t)",
  });
};
const digest = "a".repeat(64);

test("current compiler kinds have coverage and new kinds fail instead of vanishing", () => {
  assert.doesNotThrow(() => assertSearchCoverage(["paper", "foundation"]));
  assert.throws(() => assertSearchCoverage(["paper", "essay"]), /essay/u);
  assert.throws(() => assertSearchCoverage(["constructor"]), /constructor/u);
});
test("compiled records create complete local documents, not placeholders", () => {
  const docs = documents();
  assert.equal(docs.length, 10);
  assert.equal(docs.filter((d) => d.type === "instrument").length, 4);
  assert.ok(docs.every((d) => d.title && d.scopeLabel && d.lang));
  assert.ok(!docs.some((d) => d.id.includes("avogadro")));
  assert.ok(docs.every((d) => !["sentence-de", "sentence-en"].includes(d.type)));
});
test("actual anchors and explicit reading faces survive the projection", () => {
  const docs = documents();
  assert.equal(docs.find((d) => d.type === "equation").anchor, "arg-bm-observable");
  assert.match(docs.find((d) => d.type === "equation").scopeLabel, /not printed/u);
  assert.equal(docs.find((d) => d.type === "result").face, "results");
  assert.match(docs.find((d) => d.type === "result").scopeLabel, /not a printed result/u);
  assert.equal(docs.find((d) => d.type === "foundation").route, "/foundations/mean-square/");
});
test("compiled equation spellings and instrument argument links are searchable", () => {
  const docs = documents(),
    engine = createSearchEngine(docs, aliasesForDocuments(docs));
  assert.equal(
    engine.search("λₓ", { type: "equation" })[0].document.id,
    "equation:eq-model-spread",
  );
  assert.equal(
    engine.search("measurable displacement", { type: "instrument" })[0].document.id,
    "instrument:bm-01",
  );
  assert.equal(
    engine.search("how far does it wander")[0].document.id,
    "argument:arg-bm-observable",
  );
  assert.equal(engine.search("clocks disagree")[0].document.id, "instrument:sr-01");
  assert.equal(engine.search("photon")[0].aliasLabel, "modern term");
});
test("aliases never create imaginary results when their targets do not exist", () => {
  assert.deepEqual(aliasesForDocuments([]), []);
  assert.ok(!aliasesForDocuments(documents()).some((a) => a.target === "instrument:sr-04"));
});
test("draft v1 content cannot leak in preview or launch, including foundations and labs", () => {
  const c = corpus();
  for (const profile of ["preview", "launch"]) {
    const docs = documentsFromCompiled(c.papers, c.foundations, c.instruments, profile);
    assert.deepEqual(docs, []);
    const packaged = packageSearchIndex(docs, aliasesForDocuments(docs), digest, profile);
    assert.equal(packaged.manifest.totalDocuments, 0);
    assert.ok(packaged.files.every((file) => !file.text.includes("Particles spread")));
  }
});
test("unknown release profiles and future publication schemas fail closed", () => {
  assert.equal(searchProfile(undefined), "scaffold");
  assert.throws(() => searchProfile("preveiw"));
  const c = corpus();
  c.papers[0].schemaVersion = 2;
  assert.throws(() => documentsFromCompiled(c.papers, [], [], "preview"), /publication schema/u);
});
test("dangling argument/equation anchors and unknown registered instrument mappings fail", () => {
  const c = corpus();
  c.papers[0].arguments[0].section = "missing";
  assert.throws(() => documentsFromCompiled(c.papers, [], [], "scaffold"), /rendered section/u);
  const d = corpus();
  d.papers[0].equations[0].argument = "missing";
  assert.throws(() => documentsFromCompiled(d.papers, [], [], "scaffold"), /rendered argument/u);
  assert.throws(() =>
    documentsFromCompiled(
      [],
      [],
      [{ id: "new-instrument", title: "New", status: "registered" }],
      "scaffold",
    ),
  );
});
test("shard hashes, canonical byte counts, gzip measurements and totals agree", () => {
  const docs = documents(),
    bundle = packageSearchIndex(docs, aliasesForDocuments(docs), digest, "scaffold");
  assert.equal(bundle.manifest.totalDocuments, docs.length);
  let total = 0;
  for (const { descriptor: d, text } of bundle.files) {
    assert.equal(d.sha256, createHash("sha256").update(text).digest("hex"));
    assert.equal(d.path, `/search/s-${d.sha256}.json`);
    assert.equal(d.bytes, Buffer.byteLength(text));
    assert.equal(d.gzipBytes, gzipSync(text, { level: 9 }).length);
    assert.ok(d.gzipBytes <= SEARCH_LIMITS.gzipShardBytes);
    const shard = JSON.parse(text);
    assert.equal(shard.documents.length, d.documents);
    assert.ok(shard.aliases.every((a) => shard.documents.some((doc) => doc.id === a.target)));
    total += d.documents;
  }
  assert.equal(total, docs.length);
});
test("identical compiled input produces identical bytes despite object/list insertion order", () => {
  const docs = documents(),
    aliases = aliasesForDocuments(docs);
  const first = packageSearchIndex(docs, aliases, digest, "scaffold");
  const shuffled = docs.map((doc) => Object.fromEntries(Object.entries(doc).reverse())).reverse();
  const second = packageSearchIndex(shuffled, [...aliases].reverse(), digest, "scaffold");
  assert.deepEqual(first, second);
});
function noise(length) {
  let x = 1905,
    text = "";
  const alphabet = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  for (let i = 0; i < length; i++) {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    text += alphabet[(x >>> 0) % alphabet.length];
  }
  return text;
}
test("oversized paper shards split by type and then size without losing documents", () => {
  const base = documents()[0];
  const many = Array.from({ length: 5 }, (_, i) => ({
    ...base,
    id: `record-${i}`,
    type: i < 3 ? "argument" : "equation",
    text: noise(95000).split("").reverse().join("") + i,
  }));
  const bundle = packageSearchIndex(many, [], digest, "scaffold");
  assert.ok(bundle.files.length > 1);
  assert.equal(
    bundle.files.reduce((n, f) => n + f.descriptor.documents, 0),
    many.length,
  );
  assert.ok(
    bundle.files.every((file) => file.descriptor.gzipBytes <= SEARCH_LIMITS.gzipShardBytes),
  );
});
test("invalid content digests and duplicate documents refuse publication", () => {
  assert.throws(() => packageSearchIndex([], [], "not-a-build", "scaffold"));
  const doc = documents()[0];
  assert.throws(() => packageSearchIndex([doc, doc], [], digest, "scaffold"), /Duplicate/u);
});
test("empty publication sets still yield a real static-export shard with no draft text", () => {
  const bundle = packageSearchIndex([], [], digest, "preview");
  assert.equal(bundle.files.length, 1);
  assert.deepEqual(JSON.parse(bundle.files[0].text).documents, []);
});
