/**
 * THE COVERAGE LOADERS, AND THE PROOF THAT EACH ONE CAN STILL GO RED (am-igdv).
 *
 * Half of this file is positive -- the four dimensions read the real tree and find what is in it.
 * The other half is the half that matters, and it is why the floors exist at all: a loader pointed
 * at the wrong root returns an empty map, the report prints a tidy zero, and nothing in the output
 * says "I examined nothing". That failure is indistinguishable from a complete measurement unless
 * something refuses on the population, so every floor here is driven from BOTH sides: over the real
 * corpus it must be satisfied, and over an empty root the same floor must fire.
 *
 * The lane: this is the bun lane, and the gate these loaders feed (`coverage-report`) is in the
 * nightly fast family, so the proof does not live downstream of the thing it proves.
 */

import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { formatInputsLine } from "./ledger.ts";
import {
  COVERAGE_FLOORS,
  deriveInstrumentProvenance,
  loadArgumentNodes,
  loadCoverageFromContent,
  loadInstruments,
  loadSourceManifests,
  loadTranslationUnits,
} from "./loaders.ts";

const here = dirname(new URL(import.meta.url).pathname);
const ROOT = join(here, "../../..");

const freshRoot = (): string => mkdtempSync(join(tmpdir(), "am-coverage-loaders-"));

function write(root: string, relativePath: string, body: string): string {
  const path = join(root, relativePath);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, body, "utf8");
  return path;
}

describe("the coverage loaders over the real corpus", () => {
  it("reads every paper's source manifest and derives a status for each unit", () => {
    const { manifests, opened } = loadSourceManifests(ROOT);
    assert.ok(
      manifests.size >= COVERAGE_FLOORS.sourceManifests,
      `${manifests.size} manifests, floor ${COVERAGE_FLOORS.sourceManifests}`,
    );
    assert.equal(opened.length, manifests.size, "one opened file per manifest read");
    for (const [paper, m] of manifests) {
      // A manifest with no units would satisfy a count of manifests while measuring nothing, so the
      // unit population is asserted per paper rather than only in total.
      assert.ok(m.totalUnits > 0, `${paper} manifest derived no units`);
      const tallied = Object.values(m.byStatus).reduce((a, b) => a + b, 0);
      assert.equal(tallied, m.totalUnits, `${paper}: byStatus must partition the units exactly`);
      for (const status of Object.keys(m.byStatus)) {
        // The vocabulary is UnitStatus's. `unspecified` is the specific value that appeared 544
        // times when a loader read a hand-written field no manifest fills (am-rc1001-bridge-plan-pcjk.13).
        assert.ok(
          [
            "not-transcribed",
            "not-translated",
            "not-explained",
            "covered",
            "covered-declared",
          ].includes(status),
          `${paper} reported an unknown unit status ${status}`,
        );
      }
    }
  });

  it("gives every translation unit its own entry, with no id collapsing two papers", () => {
    const { units, opened } = loadTranslationUnits(ROOT);
    assert.ok(
      units.size >= COVERAGE_FLOORS.translationUnits,
      `${units.size} units, floor ${COVERAGE_FLOORS.translationUnits}`,
    );
    /*
      THE PROPERTY, NOT THE CENSUS: one entry per opened file. Asserted this way because it holds at
      any corpus size, and because the equality is exactly what failed -- keyed by the bare `id` this
      loader reported 619 entries over 821 files, since 143 sentence ids occur in more than one paper
      and a Map keeps the last writer. 619 was never implausible next to a dimension that had been
      reporting 0, which is the whole danger.
    */
    assert.equal(units.size, opened.length, "a key collapsed two units into one");
    const papers = new Set([...units.values()].map((u) => u.paper));
    assert.ok(papers.size >= 4, `translation units found in only ${papers.size} papers`);
  });

  it("reads every instrument manifest and derives its provenance with evidence", () => {
    const { instruments, knownExperiments, acceptanceCases, actionContracts, opened } =
      loadInstruments(ROOT);
    assert.ok(
      instruments.size >= COVERAGE_FLOORS.instruments,
      `${instruments.size} instruments, floor ${COVERAGE_FLOORS.instruments}`,
    );
    assert.equal(opened.length, instruments.size);
    assert.equal(knownExperiments.size, instruments.size);
    for (const inst of instruments.values()) {
      assert.ok(inst.evidence.length > 0, `${inst.id} derived a state with no evidence`);
      // The two states a static read of the tree cannot establish must never be returned. Asserted
      // as a negative because the enum permits them and a future rule could reach for one.
      assert.ok(
        inst.provenance !== "accepted-frankensim-result-demonstrated" &&
          inst.provenance !== "typed-refusal-boundary-present",
        `${inst.id} claims ${inst.provenance}, which no read of the tree can establish`,
      );
      assert.ok(acceptanceCases.has(inst.id) && actionContracts.has(inst.id));
    }
    // At least one lab loads the pinned bundle and at least one does not: a derivation with only one
    // outcome over 33 records is not a derivation, it is a constant.
    const states = new Set([...instruments.values()].map((i) => i.provenance));
    assert.ok(states.size >= 2, `all ${instruments.size} instruments derived the same state`);
  });

  it("reads every argument node's readings, treatment and derived equivalents", () => {
    const instruments = loadInstruments(ROOT);
    const { nodes, opened } = loadArgumentNodes(ROOT, instruments);
    assert.ok(
      nodes.length >= COVERAGE_FLOORS.argumentNodes,
      `${nodes.length} nodes, floor ${COVERAGE_FLOORS.argumentNodes}`,
    );
    assert.equal(opened.length, nodes.length);
    assert.equal(new Set(nodes.map((n) => n.id)).size, nodes.length, "two nodes share an id");
    for (const node of nodes) {
      assert.ok(node.paper.length > 0, `${node.id} has no paper`);
      // Every reading level reported must be one of AGENTS.md's four, and the list must not hold a
      // duplicate: a node reporting ["R1","R1"] would read as better covered than one reporting ["R1"].
      for (const level of node.readingsPresent) {
        assert.ok(["R0", "R1", "R2", "R3"].includes(level), `${node.id}: ${level}`);
      }
      assert.equal(new Set(node.readingsPresent).size, node.readingsPresent.length);
      if (node.treatment.kind === "instrument") {
        assert.ok(node.treatment.experimentIds.length > 0);
        for (const id of node.treatment.experimentIds) {
          assert.ok(
            instruments.knownExperiments.has(id),
            `${node.id} names ${id}, which no manifest declares`,
          );
        }
      }
    }
  });

  it("opens every file as a repo-relative path with a full digest", () => {
    const loaded = loadCoverageFromContent(ROOT);
    assert.deepEqual(loaded.shortfalls, [], "the real corpus must satisfy every floor");
    assert.ok(loaded.opened.length > 500, `${loaded.opened.length} files opened`);
    for (const input of loaded.opened) {
      assert.match(input.sha256, /^[0-9a-f]{64}$/, `${input.path} has no sha256`);
      // Absolute paths make the written artifact incomparable between two checkouts, and this
      // artifact exists to be compared.
      assert.ok(!input.path.startsWith("/"), `${input.path} is absolute`);
      assert.ok(input.path.startsWith("content/"), `${input.path} is outside content/`);
    }
    assert.equal(
      new Set(loaded.opened.map((i) => i.path)).size,
      loaded.opened.length,
      "a file was opened twice, so the census double-counts it",
    );
  });
});

describe("the planted negatives: every floor must be able to fire", () => {
  it("an empty root measures nothing, and says so on every dimension", () => {
    const root = freshRoot();
    const loaded = loadCoverageFromContent(root);
    assert.equal(loaded.opened.length, 0);
    assert.equal(loaded.sourceManifests.size, 0);
    assert.equal(loaded.translationUnits.size, 0);
    assert.equal(loaded.instruments.size, 0);
    assert.equal(loaded.argumentNodes.length, 0);
    // FOUR shortfalls, one per dimension. A single combined refusal would let three dimensions go
    // empty while the fourth carried the census, which is the failure the per-dimension floors exist
    // for and the reason the gate's own `minimum: 1` is not the real check.
    assert.equal(loaded.shortfalls.length, 4, loaded.shortfalls.join("; "));
    for (const noun of [
      "source manifests",
      "translation units",
      "instrument manifests",
      "argument nodes",
    ]) {
      assert.ok(
        loaded.shortfalls.some((s) => s.startsWith(noun)),
        `no shortfall named ${noun}: ${loaded.shortfalls.join("; ")}`,
      );
    }
  });

  it("one dimension going empty is refused even while the others are full", () => {
    // The population that the gate's single `minimum: 1` cannot see: plenty of files, one dimension
    // at zero. Built by giving a root everything except an arguments tree.
    const root = freshRoot();
    for (let i = 0; i < COVERAGE_FLOORS.instruments; i++) {
      const id = `xx-${String(i).padStart(2, "0")}`;
      write(root, `content/experiments/${id}.yaml`, `id: ${id}\nowner:\n  kind: static\n`);
    }
    const loaded = loadCoverageFromContent(root);
    assert.ok(loaded.opened.length >= COVERAGE_FLOORS.instruments, "files were opened");
    assert.ok(
      loaded.shortfalls.some((s) => s.startsWith("argument nodes")),
      `an empty arguments tree was not refused: ${loaded.shortfalls.join("; ")}`,
    );
  });

  it("a manifest directory with no manifest.yaml is skipped, not counted", () => {
    const root = freshRoot();
    mkdirSync(join(root, "content/source-blocks/light-quanta"), { recursive: true });
    write(root, "content/source-blocks/light-quanta/s0-p1.yaml", "id: s0-p1\n");
    const { manifests, opened } = loadSourceManifests(root);
    assert.equal(manifests.size, 0, "a directory without a manifest became a measured paper");
    assert.equal(opened.length, 0, "a file was recorded for a paper with no manifest");
  });

  it("a non-arg- file in the arguments tree is not a node", () => {
    const root = freshRoot();
    write(root, "content/arguments/light-quanta/entrance-light-quanta.json", '{"id":"entrance"}');
    write(
      root,
      "content/arguments/light-quanta/arg-lq-real.json",
      '{"id":"arg-lq-real","paper":"light-quanta","section":"s1","readings":{"full":["x"]},"experiments":[]}',
    );
    const { nodes } = loadArgumentNodes(root);
    assert.deepEqual(
      nodes.map((n) => n.id),
      ["arg-lq-real"],
      "the paper's entrance record was counted as an argument node",
    );
  });
});

describe("deriveInstrumentProvenance reads code, not the prose about it", () => {
  const evaluatorManifest = (module: string) => ({
    owner: { kind: "reference-evaluator", kernelFunctions: [{ module }] },
  });

  it("credits a worker that imports the pinned bundle", () => {
    const root = freshRoot();
    write(
      root,
      "src/workers/host/bm01Worker.ts",
      'import { loadPinnedBundle } from "../wasm/pinnedBundle.ts";\nvoid loadPinnedBundle;\n',
    );
    const derived = deriveInstrumentProvenance(root, "bm-01", {});
    assert.equal(derived.provenance, "artifact-loaded");
    assert.match(derived.evidence, /pinnedBundle\.ts/);
  });

  /*
    THE PLANT THAT MATTERS, and the one a substring sweep fails. `bm01Host.ts` and `bm06Host.ts` each
    describe the WASM boundary at length in prose while importing nothing from it, and the densest
    writing about a construct is always the documentation explaining it -- so a text match credits the
    files that explain the mechanism alongside the files that use it, in the direction that inflates
    the state. This is AGENTS.md's "a gate that forbids a construct must read code, not text", in the
    one place in this module where the distinction decides an answer.
  */
  it("does not credit a module that only MENTIONS the wasm path in a comment or a string", () => {
    const root = freshRoot();
    write(
      root,
      "src/workers/host/bm09Worker.ts",
      [
        "// The pinned module lives at ../wasm/pinnedBundle.ts and this worker deliberately does not",
        '// import it: see loadBundle.ts. A string naming "../wasm/frankensimTracerRecorder.ts":',
        'const documented = "../wasm/frankensimTracerRecorder.ts";',
        '/* import { loadPinnedBundle } from "../wasm/pinnedBundle.ts"; was removed in this commit */',
        "export const note = documented;",
      ].join("\n"),
    );
    write(root, "src/physics/reference/present.ts", "export const x = 1;\n");
    const derived = deriveInstrumentProvenance(
      root,
      "bm-09",
      evaluatorManifest("src/physics/reference/present.ts"),
    );
    assert.equal(
      derived.provenance,
      "host-calculation-available",
      `prose about the wasm boundary was credited as loading it: ${derived.evidence}`,
    );
  });

  it("refuses the host-calculation label when the declared evaluator module is absent", () => {
    const root = freshRoot();
    const derived = deriveInstrumentProvenance(
      root,
      "sr-99",
      evaluatorManifest("src/physics/reference/nothing-here.ts"),
    );
    // The honest label names the audited evaluator, so a declared-but-absent module is NOT this
    // state. Reporting it would be the label earning itself from a declaration.
    assert.equal(derived.provenance, "static-worked-example");
    assert.match(derived.evidence, /absent module/);
  });

  it("falls to the static state when a manifest declares no owner at all", () => {
    const derived = deriveInstrumentProvenance(freshRoot(), "me-99", {});
    assert.equal(derived.provenance, "static-worked-example");
    assert.match(derived.evidence, /owner\.kind is null/);
  });
});

describe("formatInputsLine", () => {
  const input = (path: string, kind: "source-manifest" | "translation-unit") => ({
    path,
    sha256: "a".repeat(64),
    kind,
  });

  it("names each file while the list is short", () => {
    const line = formatInputsLine([input("content/a.yaml", "source-manifest")]);
    assert.match(line, /content\/a\.yaml/);
  });

  it("censuses by kind above the threshold, and reports the real total", () => {
    const many = Array.from({ length: 40 }, (_, i) =>
      input(`content/translation-units/x/${i}.yaml`, "translation-unit"),
    );
    const line = formatInputsLine([input("content/m.yaml", "source-manifest"), ...many]);
    assert.match(line, /^41 files --/, line);
    assert.match(line, /40 `translation-unit`/);
    assert.match(line, /1 `source-manifest`/);
    // No path survives into the summary, so a reader cannot mistake the line for a file list.
    assert.ok(!line.includes(".yaml"), line);
  });

  it("says None rather than an empty list, which would read as a short list", () => {
    assert.equal(formatInputsLine([]), "None");
  });
});
