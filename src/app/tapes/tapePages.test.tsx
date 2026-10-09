/**
 * The teaching-tape pages render what the records hold (am-2rl9).
 *
 * The point of these pages is that a reader can reach a tape at all: measured 2026-09-27, all 21
 * authored tapes reached no reader by any route. So the assertions here are about reachability and
 * about honesty, not about layout.
 *
 * WHAT IT DOES NOT CLAIM. Rendering here is not the built page. An island's placement and what a
 * reader without JavaScript sees are answered by a built page and a browser; these pages carry no
 * island and no script, which is why a server render is close to the whole story for them, but it is
 * not the whole story.
 */
import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Window } from "happy-dom";
import { renderToStaticMarkup } from "react-dom/server";
import { parseYaml } from "../../content/provenance/yaml.ts";
import { loadTeachingTapes } from "../../content/teachingTapes.ts";
import tapeLinks from "../../generated/tape-links.json";
import { tapePath } from "../../reader/sitePaths.ts";
import TapePage from "./[tape]/page.tsx";
import TapesIndex from "./page.tsx";

const { tapes } = loadTeachingTapes();

function dom(html: string) {
  const { document } = new Window();
  document.body.innerHTML = html;
  return document;
}

describe("the teaching-tape pages", () => {
  test("the index lists every tape, and links each to its instrument", () => {
    const document = dom(renderToStaticMarkup(TapesIndex()));
    const hrefs = [...document.querySelectorAll("a")].map((a) => a.getAttribute("href") ?? "");
    expect(tapes.length).toBeGreaterThan(15);
    const missing = tapes.filter((t) => !hrefs.includes(tapePath(t.tapeId))).map((t) => t.tapeId);
    expect(missing).toEqual([]);
    for (const experimentId of new Set(tapes.map((t) => t.experimentId)))
      expect(hrefs, `no link to ${experimentId}`).toContain(`/lab/${experimentId}/`);
  });

  test("every tape's own page renders its title, its steps and its recorded numbers", async () => {
    let stepsSeen = 0;
    let numbersSeen = 0;
    let longValuesSeen = 0;
    for (const tape of tapes) {
      const html = renderToStaticMarkup(
        await TapePage({ params: Promise.resolve({ tape: tape.tapeId }) }),
      );
      const document = dom(html);
      expect(document.querySelector("h1")?.textContent, tape.tapeId).toBe(tape.title);
      const items = document.querySelectorAll(".tape-steps > li");
      expect(items.length, `${tape.tapeId} rendered no step`).toBe(tape.steps.length);
      stepsSeen += items.length;
      const text = document.body.textContent ?? "";
      // The LINK, not the id in the prose. The page used to print the raw "sr-03" beside the
      // instrument's name and this read it out of the body text; it now shows "SR-03" and the
      // lowercase id lives only in the address. Reading the anchor is the stronger form of the
      // same question, and it is the one the assertion's message was always asking.
      const labHrefs = [...document.querySelectorAll("a")].map((a) => a.getAttribute("href") ?? "");
      expect(
        labHrefs.some((href) => href.startsWith(`/lab/${tape.experimentId}/`)),
        `${tape.tapeId} does not link its instrument`,
      ).toBe(true);
      // Dispatch 325 separated the two: the recorded double stays on the page in a <data value>,
      // where it remains verifiable, and what a reader READS is the formatted form. Asserting only
      // "the body text contains String(value)" would now pass on a page that prints
      // 0.4042339787513938 again, so both halves are asserted, and the second one names the defect.
      const recorded = [...document.querySelectorAll("data")].map(
        (element) => element.getAttribute("value") ?? "",
      );
      for (const step of tape.steps)
        for (const value of step.expected) {
          numbersSeen += 1;
          expect(text, `${tape.tapeId} drops ${value.label}`).toContain(value.label);
          expect(recorded, `${tape.tapeId} drops the recorded value of ${value.label}`).toContain(
            String(value.value),
          );
        }
      // THE READER IS NOT SHOWN A FULL-PRECISION DOUBLE. /tapes/the-two-pulses/ showed
      // "0.4042339787513938 1" until dispatch 325: sixteen significant figures from a model whose
      // inputs are rough, with a bare "1" for a unit.
      for (const value of tape.steps.flatMap((step) => step.expected)) {
        const asRecorded = String(value.value);
        if (asRecorded.replace(/\D/g, "").length <= 9) continue;
        longValuesSeen += 1;
        expect(
          text,
          `${tape.tapeId} prints the full-precision ${asRecorded} for ${value.label}`,
        ).not.toContain(asRecorded);
      }
    }
    // The check above is worthless if no tape records a long value: twelve recorded values across
    // seven tapes do, measured with this same predicate.
    expect(longValuesSeen).toBeGreaterThan(0);
    // Both loops must have run: 34 steps and 16 carrying numbers on 2026-09-27.
    expect(stepsSeen).toBeGreaterThan(20);
    expect(numbersSeen).toBeGreaterThan(0);
  });

  test("the index's count of settings links is the records' count, not a number someone typed", () => {
    // The sentence here read "None of them runs the instrument for you: you set the values and
    // compare" for four commits after b5abbea3 made that false for 20 of the 22. The replacement
    // is derived, and this is what keeps it that way: a literal creeping back in is the failure
    // mode, and comparing the rendered number with the generated map catches it.
    const document = dom(renderToStaticMarkup(TapesIndex()));
    const sentence = document.querySelector(".tape-honesty")?.textContent ?? "";
    const stated = sentence.match(/(\d+)\s+of them open their instrument/);
    expect(
      stated,
      `the index does not state how many open their instrument: "${sentence}"`,
    ).not.toBeNull();
    const links = Object.keys((tapeLinks as { links: Record<string, unknown> }).links).length;
    expect(Number(stated?.[1])).toBe(links);
    // Non-vacuity: a page that stated zero, and a records file with no links, would agree.
    expect(links).toBeGreaterThan(10);
    // And the remainder it names is the rest of the corpus, not a second typed number.
    const remainder = sentence.match(/on the other (\d+) you set them/);
    if (remainder) expect(Number(remainder[1])).toBe(tapes.length - links);
  });

  test("every walkthrough leads back to the passage its instrument interrogates", async () => {
    // The link is generated from the instrument's manifest `sourceRefs`, so this asserts two
    // separate things and says which is which: that every declared reference names a section
    // that EXISTS, read from the paper records here rather than through the tape loader, and
    // that the page renders a link for each one.
    const papers = new Map<string, Set<string>>();
    for (const file of readdirSync(join(process.cwd(), "content", "papers"))) {
      if (!file.endsWith(".json")) continue;
      const record = JSON.parse(
        readFileSync(join(process.cwd(), "content", "papers", file), "utf8"),
      ) as { id?: string; sections?: { id?: string }[] };
      const slug = file.replace(/\.json$/, "");
      papers.set(slug, new Set((record.sections ?? []).map((x) => String(x.id))));
    }
    expect(papers.size).toBeGreaterThan(3);

    // THE MANIFESTS, NOT THE LOADER'S OUTPUT. The first version of this read `tape.passages`,
    // which is what the loader has already resolved: a reference to a section that does not exist
    // is DROPPED there, so the check could only ever see references that resolve. Planting
    // `id: s99` in sr-03's manifest left it green at 24 links instead of 25. Reading the manifests
    // here is what makes a dangling reference visible.
    const dangling: string[] = [];
    for (const file of readdirSync(join(process.cwd(), "content", "experiments"))) {
      if (!file.endsWith(".yaml")) continue;
      const manifest = parseYaml(
        readFileSync(join(process.cwd(), "content", "experiments", file), "utf8"),
      ) as { sourceRefs?: { paper?: string; id?: string }[] };
      for (const ref of manifest.sourceRefs ?? []) {
        const sections = papers.get(String(ref.paper));
        if (!sections) dangling.push(`${file}: no paper ${String(ref.paper)}`);
        else if (!sections.has(String(ref.id)))
          dangling.push(`${file}: ${String(ref.paper)} has no section ${String(ref.id)}`);
      }
    }

    let links = 0;
    for (const tape of tapes) {
      for (const passage of tape.passages) {
        expect(passage.href).toBe(`/papers/${passage.paper}/${passage.sectionId}/`);
        links += 1;
      }
      if (tape.passages.length === 0) continue;
      const html = renderToStaticMarkup(
        await TapePage({ params: Promise.resolve({ tape: tape.tapeId }) }),
      );
      const hrefs = [...dom(html).querySelectorAll("nav.tape-onward a")].map((a) =>
        a.getAttribute("href"),
      );
      expect(hrefs, `${tape.tapeId} does not link its passages`).toEqual(
        tape.passages.map((x) => x.href),
      );
    }
    expect(dangling).toEqual([]);
    console.log(`[tape passages] ${links} links from ${tapes.length} walkthroughs into the papers`);
    // Non-vacuity: a resolver that returned nothing would satisfy every assertion above.
    expect(links).toBeGreaterThan(15);
  });

  test("a tape page says the numbers are recorded, not computed", async () => {
    const first = tapes[0];
    expect(first).toBeDefined();
    if (!first) return;
    const html = renderToStaticMarkup(
      await TapePage({ params: Promise.resolve({ tape: first.tapeId }) }),
    );
    const text = dom(html).body.textContent ?? "";
    // The honesty line is the reason this page may show numbers at all: without it the page would
    // read as an instrument's output, which it is not.
    expect(text).toContain("not a result this page computed");
    expect(text).toContain("Nothing here runs the instrument");
  });

  test("every page says what its numbers were recorded under, from the record", async () => {
    // The honesty line asks a reader to compare their own run with the recorded values. These are
    // the identities that decide whether a difference is a disagreement: a run under another seed
    // or a later model version is a different run. Every value is read from the record here, so a
    // page that printed a number of its own would fail rather than look tidy.
    let checked = 0;
    for (const tape of tapes) {
      const html = renderToStaticMarkup(
        await TapePage({ params: Promise.resolve({ tape: tape.tapeId }) }),
      );
      const raw = parseYaml(
        readFileSync(join("content/experiments/tapes", `${tape.tapeId}.yaml`), "utf8"),
      ) as Record<string, unknown>;
      const identity = (raw.modelIdentity ?? {}) as Record<string, unknown>;
      const document = dom(html);
      const text = document.body.textContent ?? "";
      const section = document.querySelector('section[aria-labelledby="tape-recorded-under"]');
      expect([tape.tapeId, section === null]).toEqual([tape.tapeId, false]);
      const recorded = section?.textContent ?? "";
      expect([tape.tapeId, recorded.includes("What these numbers were recorded under")]).toEqual([
        tape.tapeId,
        true,
      ]);
      for (const value of [identity.modelId, identity.modelVersion, raw.seed, raw.streamVersion])
        expect([tape.tapeId, String(value), recorded.includes(String(value))]).toEqual([
          tape.tapeId,
          String(value),
          true,
        ]);
      // THE ARTIFACT DIGEST MUST NOT REACH A READER: 0 of the 22 records carry a real hex digest
      // and all 22 carry a placeholder, so printing one would be printing a fabricated identity.
      expect([tape.tapeId, text.includes(String(identity.artifactDigest))]).toEqual([
        tape.tapeId,
        false,
      ]);
      // THE CONSTANT SET IS NOT REPEATED HERE. It is already in the caption of "Where it starts",
      // and each recorded expectation names its own in the "Under" column, which is why a
      // page-wide count is 1 + one per expectation and not a useful assertion. What must stay true
      // is that this section does not add another copy: on coin-to-bell that copy doubled a
      // status-name leak, its record carrying `constantSetId: not-applicable`.
      if (typeof raw.constantSetId === "string")
        expect([tape.tapeId, recorded.includes(raw.constantSetId)]).toEqual([tape.tapeId, false]);
      checked++;
    }
    // Non-vacuity: a loop over no tapes would satisfy every assertion above.
    expect(checked).toBe(tapes.length);
    expect(checked).toBeGreaterThan(15);
  });

  test("a prediction step asks its question, and keeps the answer behind a closed drawer", async () => {
    // Two of the records carry a prediction event, and it reached this page as the bare words
    // "Step 1". The question and the candidates come from the instrument's prompt record and the
    // recorded answer from the event's payload, so this asserts against those rather than strings.
    const withPrediction = tapes.filter((t) => t.steps.some((s) => s.prediction));
    expect(withPrediction.map((t) => t.tapeId).sort()).toEqual([
      "the-boost-to-0.6c",
      "the-locked-positions",
    ]);
    for (const tape of withPrediction) {
      const html = renderToStaticMarkup(
        await TapePage({ params: Promise.resolve({ tape: tape.tapeId }) }),
      );
      const document = dom(html);
      const text = document.body.textContent ?? "";
      for (const step of tape.steps) {
        if (!step.prediction) continue;
        expect([tape.tapeId, text.includes(step.prediction.question)]).toEqual([tape.tapeId, true]);
        for (const candidate of step.prediction.candidates)
          expect([tape.tapeId, candidate.label, text.includes(candidate.label)]).toEqual([
            tape.tapeId,
            candidate.label,
            true,
          ]);
        // The answer is inside a details that is NOT open, so a reader meets the question first.
        const drawer = document.querySelector("details[data-tape-prediction]");
        expect([tape.tapeId, drawer === null]).toEqual([tape.tapeId, false]);
        expect([tape.tapeId, drawer?.hasAttribute("open")]).toEqual([tape.tapeId, false]);
        if (step.prediction.recorded)
          expect([tape.tapeId, drawer?.textContent?.includes(step.prediction.recorded)]).toEqual([
            tape.tapeId,
            true,
          ]);
      }
      // And the step no longer reads as a bare "Step 1".
      expect([tape.tapeId, text.includes("A question to answer before the next change")]).toEqual([
        tape.tapeId,
        true,
      ]);
    }
    // A tape with no prediction event grows no drawer.
    const plain = tapes.find((t) => !t.steps.some((s) => s.prediction));
    expect(plain).toBeDefined();
    if (plain) {
      const html = renderToStaticMarkup(
        await TapePage({ params: Promise.resolve({ tape: plain.tapeId }) }),
      );
      expect(dom(html).querySelectorAll("details[data-tape-prediction]").length).toBe(0);
    }
  });

  test("every page is reachable with no script: no button, and every control is an anchor", async () => {
    const pages = [renderToStaticMarkup(TapesIndex())];
    for (const tape of tapes.slice(0, 4))
      pages.push(
        renderToStaticMarkup(await TapePage({ params: Promise.resolve({ tape: tape.tapeId }) })),
      );
    for (const html of pages) {
      const document = dom(html);
      // noScriptControls.ts hides every enabled button when scripts do not run, so a page whose way
      // onward is a button has no way onward. These pages have none by construction; this keeps it so.
      expect(document.querySelectorAll("button").length).toBe(0);
      expect(document.querySelectorAll("a").length).toBeGreaterThan(0);
    }
  });
});

describe("what a reader is shown a quantity called (am-f0wi)", () => {
  /**
   * CRITERION 5 OF am-f0wi ASKS FOR A COUNT THAT IS REPORTED RATHER THAN FROZEN, and until now it
   * lived only in this page's docblock, which is prose and drifts. This renders every tape and
   * counts what the page actually produced, so the figure cannot go stale while reading as
   * considered.
   *
   * THREE KINDS OF ROW, and the distinction is the bead's own:
   *   resolved     the registry named the quantity, and the field id stays in a parenthetical
   *                `.tape-raw-id` span so the record remains verifiable from the page.
   *   id-shaped    a bare camelCase field id, which is the defect the bead is about.
   *   prose        an authored phrase ("lambda_x at 1 s") or a metadata row ("Model", "Seed").
   *                These are NOT defects and must not be counted as ones: they are already what a
   *                reader should see, and the docblock says so.
   *
   * The id-shaped count is a CEILING that only comes down. Freezing it at today's figure would go
   * red the day somebody declares one of the seven in a manifest, which is the brittleness this
   * repository keeps paying for.
   */
  test("the census of label rows, with its denominator", async () => {
    let resolved = 0;
    const idShaped = new Set<string>();
    let idRows = 0;
    let proseRows = 0;
    for (const tape of tapes) {
      const document = dom(
        renderToStaticMarkup(await TapePage({ params: Promise.resolve({ tape: tape.tapeId }) })),
      );
      resolved += document.querySelectorAll(".tape-raw-id").length;
      for (const th of document.querySelectorAll('th[scope="row"]')) {
        // A resolved row carries the provenance span; the rest are raw.
        if (th.querySelector(".tape-raw-id")) continue;
        const text = (th.textContent ?? "").trim();
        if (/^[a-z][A-Za-z0-9]*$/.test(text)) {
          idRows += 1;
          idShaped.add(text);
        } else proseRows += 1;
      }
    }
    const total = resolved + idRows + proseRows;
    console.log(
      `[census] tape label rows examined ${total} across ${tapes.length} tapes (minimum 150): ` +
        `${resolved} resolved through the registry, ${idRows} left as an id ` +
        `(${idShaped.size} distinct: ${[...idShaped].sort().join(", ")}), ${proseRows} authored prose`,
    );
    expect(tapes.length).toBeGreaterThan(15);
    expect(total).toBeGreaterThanOrEqual(150);
    // Non-vacuity: the registry path must be carrying the great majority, or "resolved" would be
    // a word for a mechanism that never fires.
    expect(resolved).toBeGreaterThan(100);
    // The ceiling. 9 rows, 7 distinct, on 2026-10-09. Lower it as they are declared; never raise.
    expect(idRows).toBeLessThanOrEqual(9);
    expect(idShaped.size).toBeLessThanOrEqual(7);
  });

  test("no row prints a bare 1 as a unit, and none prints sixteen figures", async () => {
    // The two display defects the bead names, asserted on the rendered page rather than on the
    // formatter, because the formatter was never the thing a reader met.
    for (const tape of tapes) {
      const document = dom(
        renderToStaticMarkup(await TapePage({ params: Promise.resolve({ tape: tape.tapeId }) })),
      );
      for (const cell of document.querySelectorAll("td")) {
        const text = (cell.textContent ?? "").trim();
        expect(text, `${tape.tapeId}: a dimensionless unit printed as "1"`).not.toMatch(
          /^-?[\d.]+ 1$/,
        );
        // Six significant figures is what the laboratories' writer gives; a raw double shows ten
        // or more digits after the point.
        expect(text, `${tape.tapeId}: full-precision double on the page`).not.toMatch(
          /\d\.\d{10,}/,
        );
      }
    }
  });

  test("the full-precision value survives in the data element, not on the page", async () => {
    // The separation AGENTS.md asks for: the formatted value is read, the stored one stays
    // verifiable. Without this the test above could be satisfied by throwing precision away.
    let withValue = 0;
    for (const tape of tapes) {
      const document = dom(
        renderToStaticMarkup(await TapePage({ params: Promise.resolve({ tape: tape.tapeId }) })),
      );
      for (const data of document.querySelectorAll("data[value]")) {
        const stored = data.getAttribute("value") ?? "";
        const shown = (data.textContent ?? "").trim();
        if (stored.replace(/[^\d]/g, "").length > shown.replace(/[^\d]/g, "").length)
          withValue += 1;
      }
    }
    console.log(`[census] ${withValue} value(s) keep more precision in data[value] than they show`);
    expect(withValue).toBeGreaterThan(0);
  });
});
