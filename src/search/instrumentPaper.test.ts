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

  test("an instrument nobody declared still stops the build, loudly and by name", () => {
    // The property that caught the original defect. Filing an unknown instrument under
    // a guessed paper would be the worse failure, so this must keep throwing.
    assert.throws(
      () => papersFor(["not-a-declared-instrument"]),
      /Registered instrument needs a search paper mapping: not-a-declared-instrument/,
    );
  });
});
