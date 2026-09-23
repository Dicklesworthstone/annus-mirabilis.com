/**
 * Every registered instrument must resolve to a search paper, checked in a second
 * rather than in a four-minute build.
 *
 * On 2026-09-20 the `light-thread` instrument registered and `bun run build` stopped
 * working outright: prepare:content threw "Registered instrument needs a search paper
 * mapping: light-thread" and out/ could not be regenerated at all, so every measurement
 * of the built site was measuring a pre-outage artefact until it was repaired.
 *
 * The throw was correct and is still there. An instrument filed under a plausible wrong
 * paper would be worse than a stopped build. What was missing is a check that answers
 * the same question before the build does, and against the DECLARED list rather than a
 * sample - so a newly declared instrument cannot take the pipeline down again.
 *
 * Owning bead: am-ecuf's successor outage; see documentsFromCompiled in ./documents.ts.
 */

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { CORE_INSTRUMENT_PATTERN, NON_CORE_INSTRUMENT_IDS } from "../content/ids.ts";
import { CATALOGUE_IDS } from "../experiments/catalogue.ts";
import { documentsFromCompiled } from "./documents.ts";

/** One registered instrument projection, the shape build-search-index feeds in. */
function instrument(id: string) {
  return { id, status: "registered", title: `Instrument ${id}`, question: "why" };
}

function papersFor(ids: readonly string[]): Map<string, string> {
  const documents = documentsFromCompiled([], [], ids.map(instrument), "scaffold");
  const byId = new Map<string, string>();
  for (const document of documents) {
    if (document.type === "instrument") byId.set(document.id, document.paper);
  }
  return byId;
}

/** The ids that resolve to no search paper, each tried on its own so one throw cannot hide another. */
function unresolved(ids: readonly string[]): string[] {
  return ids.filter((id) => {
    try {
      return !papersFor([id]).has(`instrument:${id}`);
    } catch {
      return true;
    }
  });
}

describe("every registered instrument resolves to a search paper", () => {
  test("every DECLARED non-core instrument files under cross-paper", () => {
    // The declared list, not a sample: avogadro-lab was one registration away from the
    // same outage light-thread caused, and this is what makes that statement checkable.
    const ids = NON_CORE_INSTRUMENT_IDS.map((descriptor) => descriptor.id);
    assert.ok(ids.length > 0, "no non-core instruments are declared, so this proves nothing");

    const papers = papersFor(ids);
    for (const id of ids) {
      assert.equal(
        papers.get(`instrument:${id}`),
        "cross-paper",
        `${id} is declared in NON_CORE_INSTRUMENT_IDS and belongs to no single paper`,
      );
    }
  });

  test("a core instrument still files under its own paper", () => {
    // Without this half, "everything is cross-paper" would pass the test above.
    const papers = papersFor(["bm-01", "lq-02", "sr-03", "me-01"]);
    assert.deepEqual(
      [
        papers.get("instrument:bm-01"),
        papers.get("instrument:lq-02"),
        papers.get("instrument:sr-03"),
        papers.get("instrument:me-01"),
      ],
      ["brownian-motion", "light-quanta", "special-relativity", "mass-energy"],
    );
    for (const id of ["bm-01", "lq-02", "sr-03", "me-01"]) {
      assert.ok(CORE_INSTRUMENT_PATTERN.test(id), `${id} should be a core id`);
    }
  });

  test("every id in the CATALOGUE resolves to a search paper, enumerated from the catalogue itself", () => {
    // scripts/build-search-index.ts enumerates CATALOGUE_IDS, so this does too (am-60vs). The two
    // tests above enumerate the taxonomy in ids.ts, which agreed with the catalogue on 2026-09-20
    // with nothing to keep it agreeing: an id added to catalogue.ts alone, matching neither the core
    // pattern nor the declared non-core list, stopped the build and passed them.
    const ids = [...CATALOGUE_IDS];
    assert.ok(
      ids.length > 0,
      "the instrument catalogue is empty, so 'every id resolves' would be true of nothing",
    );
    const missing = unresolved(ids);
    assert.deepEqual(
      missing,
      [],
      `${missing.length} of ${ids.length} catalogue ids resolve to no search paper: ${missing.join(", ")}`,
    );
    // The planted negative, kept: the same enumeration with one id the taxonomy does not know
    // reports exactly that id, so the check above can fail, and fails for this reason.
    assert.deepEqual(unresolved([...ids, "not-in-the-taxonomy"]), ["not-in-the-taxonomy"]);
  });

  test("an instrument nobody declared still stops the build, loudly and by name", () => {
    // The property that caught the original defect. Filing an unknown instrument under
    // a guessed paper would be the worse failure, so this must keep throwing.
    assert.throws(
      () => papersFor(["not-a-declared-instrument"]),
      /Registered instrument needs a search paper mapping: not-a-declared-instrument/,
    );
  });
});
