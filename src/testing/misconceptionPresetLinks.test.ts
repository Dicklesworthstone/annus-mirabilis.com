/**
 * "SEE IT IN THE INSTRUMENT" OPENS THE SETTING THAT SHOWS THE POINT (dispatch 331).
 *
 * scripts/generate-misconception-links.ts writes one `/lab/<id>/?tape=...` link per misconception
 * record that names a registered preset whose laboratory accepts its settings. The callout renders
 * the link and can say nothing about whether it works, so this is where that is answered, and the
 * strong case is the third test: the link is decoded and handed to the LABORATORY'S OWN restore path,
 * the same function useLabTapeLink and useDraftTapeLink call on mount, and the settings that come
 * back are compared with the preset's own parameterValues. A link that restores here is a link that
 * arrives at the setting rather than at the default view, which is the whole difference between this
 * and the defect it replaces.
 *
 * WHAT IT DOES NOT CLAIM. Not that a browser applies it: the restore runs in an effect after
 * hydration, so a reader with no JavaScript gets the laboratory's worked example. Not that a form
 * laboratory computes on arrival: bm-01 and sr-03 are draft bindings, so their links put the settings
 * in the form and the reader applies them, which the generated `kind` records.
 *
 * THE POPULATION IS DERIVED FROM THE RECORDS, not from a list here, because the failure worth
 * catching is a record silently missing from the generated map: a missing entry and a laboratory with
 * no binding look identical in the output until the cause is read.
 */
import { describe, expect, test } from "bun:test";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  buildMisconceptionLinks,
  presetNamedBy,
  registeredPresets,
} from "../../scripts/generate-misconception-links.ts";
import { DRAFT_BINDINGS, SESSION_BINDINGS } from "../../scripts/generate-tape-links.ts";
import { decodeTapePermalink } from "../experiments/permalink/codec.ts";
import { MAX_PERMALINK_URL_LENGTH } from "../experiments/permalink/codecCore.ts";
import { loadDraftTape } from "../experiments/permalink/draftTape.ts";
import { restoreTape } from "../experiments/permalink/sessionTape.ts";
import { loadPaperMargins } from "../reader/marginRecords.ts";
import { PaperMargins } from "../reader/PaperMargins.tsx";

const built = buildMisconceptionLinks();
const presets = registeredPresets();
const records = readdirSync(join(process.cwd(), "content", "misconceptions")).flatMap(
  (paper) => loadPaperMargins(paper).misconceptions,
);

describe("a misconception's link into its instrument", () => {
  test("every record is either linked or has a reason, and there are records of both", () => {
    expect(records.length).toBeGreaterThan(20);
    const unaccounted = records
      .map((r) => r.id)
      .filter((id) => !built.links[id] && !built.notLinked[id]);
    expect(unaccounted).toEqual([]);
    for (const id of Object.keys(built.links))
      expect(Boolean(built.notLinked[id]), `${id} is both linked and not`).toBe(false);
    // Non-vacuity on purpose: an empty link map would pass every other assertion in this file.
    expect(Object.keys(built.links).length).toBeGreaterThan(8);
    expect(Object.keys(built.notLinked).length).toBeGreaterThan(0);
    for (const [id, gap] of Object.entries(built.notLinked))
      expect(gap.reason.trim().length, `${id} has no reason`).toBeGreaterThan(20);
    console.log(
      `[misconception links] ${Object.keys(built.links).length} of ${records.length} callouts open the instrument at the setting that shows the point; ${Object.keys(built.notLinked).length} do not, by cause: ${Object.entries(
        Object.entries(built.notLinked).reduce<Record<string, number>>((acc, [, gap]) => {
          acc[gap.cause] = (acc[gap.cause] ?? 0) + 1;
          return acc;
        }, {}),
      )
        .map(([cause, n]) => `${cause} ${n}`)
        .join(", ")}`,
    );
  });

  test("a record that names a registered preset is linked unless its laboratory cannot carry one", () => {
    const missing: string[] = [];
    for (const record of records) {
      const named = presetNamedBy(record, presets);
      const lab = record.intervention.instrumentId ?? record.instrumentIds?.[0];
      if (!named || !lab) {
        // A record with no preset must not be linked: that would be a link to settings nobody chose.
        if (built.links[record.id]) missing.push(`${record.id} is linked but names no preset`);
        continue;
      }
      if (built.links[record.id]) continue;
      // The cause is read rather than the sentence, so a record dropped from the generator is
      // distinguishable from a laboratory that genuinely cannot carry settings in a link.
      const cause = built.notLinked[record.id]?.cause;
      const bound =
        SESSION_BINDINGS[named.preset.experimentId] ?? DRAFT_BINDINGS[named.preset.experimentId];
      if (bound && cause !== "refused" && cause !== "not-recordable" && cause !== "too-long")
        missing.push(
          `${record.id} names ${named.preset.presetId} and ${named.preset.experimentId} has a binding, but the cause is ${cause ?? "absent"}`,
        );
      if (!bound && cause !== "no-binding")
        missing.push(
          `${record.id}: ${named.preset.experimentId} has no binding, cause says ${cause}`,
        );
    }
    expect(missing).toEqual([]);
  });

  test("every generated link is restored by the laboratory it addresses, at the preset's settings", () => {
    const failures: string[] = [];
    let restored = 0;
    for (const [id, link] of Object.entries(built.links)) {
      expect(link.href.length, `${id} is over the permalink bound`).toBeLessThanOrEqual(
        MAX_PERMALINK_URL_LENGTH,
      );
      expect(link.href.startsWith(`/lab/${link.experimentId}/?tape=`)).toBe(true);
      const decoded = decodeTapePermalink(new URL(`https://annus-mirabilis.com${link.href}`));
      if (decoded.kind !== "success") {
        failures.push(`${id}: the link does not decode (${decoded.kind})`);
        continue;
      }
      // THE SETTINGS ARE THE PRESET'S, value by value. Without this the link could restore the
      // laboratory's defaults and every other assertion here would still pass, which is the defect.
      const preset = presets.get(link.presetId);
      expect(preset, `${id} names ${link.presetId}, which is not registered`).toBeDefined();
      for (const [key, value] of Object.entries(preset?.parameterValues ?? {})) {
        const carried = decoded.tape.initialConditions[key];
        if (String(carried) !== String(value))
          failures.push(
            `${id}: ${key} is ${String(value)} in ${link.presetId}, link carries ${String(carried)}`,
          );
      }
      const session = SESSION_BINDINGS[link.experimentId];
      const draft = DRAFT_BINDINGS[link.experimentId];
      if (session) {
        const out = restoreTape(session, session.createSession(`${id}-test`), decoded.tape);
        if (out.kind !== "restored")
          failures.push(`${id}: ${out.kind} ${"notice" in out ? out.notice : ""}`);
        else restored += 1;
      } else if (draft) {
        const out = loadDraftTape(draft, decoded.tape);
        if (out.kind !== "loaded")
          failures.push(`${id}: ${out.kind} ${"notice" in out ? out.notice : ""}`);
        else restored += 1;
      } else failures.push(`${id}: no binding for ${link.experimentId}`);
    }
    expect(failures).toEqual([]);
    expect(restored).toBe(Object.keys(built.links).length);
  });

  test("the rendered callout carries the settings link, and a record with none keeps the plain path", () => {
    // The reader-facing half, because a generated map nothing renders is not a fix. One page carries
    // both halves: Brownian's callouts include misc-bm-velocity, which names bm-01-velocity-trap and
    // whose laboratory has a binding, and misc-bm-radial-gaussian, which names bm-06-modern-one-second
    // and whose laboratory has none, so the first must carry settings and the second must not pretend to.
    const html = renderToStaticMarkup(
      createElement(PaperMargins, { margins: loadPaperMargins("brownian-motion") }),
    );
    const velocity = built.links["misc-bm-velocity"];
    expect(velocity, "misc-bm-velocity is not linked, so this test proves nothing").toBeDefined();
    expect(html).toContain(`href="${velocity?.href}"`);
    expect(html).toContain("?tape=");
    // The plain path for the one whose laboratory cannot carry settings, and no invented query.
    expect(built.notLinked["misc-bm-radial-gaussian"]?.cause).toBe("no-binding");
    expect(html).toContain('href="/lab/bm-06/"');
  });

  test("a preset id is read against the registry, so a truncated id cannot become a link", () => {
    // The trap this guards, and it cost two measurements before this file existed: a preset id may
    // contain a dot (sr-03-sphere-0.6c), and a pattern like [a-z0-9-]+ truncates it to
    // sr-03-sphere-0. A truncated id must resolve to nothing rather than to a neighbouring preset.
    expect(presets.has("sr-03-sphere-0.6c")).toBe(true);
    expect(presets.has("sr-03-sphere-0")).toBe(false);
    const dotted = Object.values(built.links).filter((l) => l.presetId.includes("."));
    expect(
      dotted.length,
      "no dotted preset id is linked, so this guard proves nothing",
    ).toBeGreaterThan(0);

    // And the prose reader finds a preset only where the prose says "preset <a registered id>".
    const invented = presetNamedBy(
      {
        intervention: {
          defaultsReviewed: {
            defaultControls: "Described from the manifest: preset not-a-real-preset",
          },
        },
      },
      presets,
    );
    expect(invented).toBeUndefined();
  });
});
