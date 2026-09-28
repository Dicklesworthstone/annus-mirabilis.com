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
import { Window } from "happy-dom";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  buildMisconceptionLinks,
  presetNamedBy,
  QUERY_BINDINGS,
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
    let byQuery = 0;
    for (const [id, link] of Object.entries(built.links)) {
      expect(link.href.length, `${id} is over the permalink bound`).toBeLessThanOrEqual(
        MAX_PERMALINK_URL_LENGTH,
      );
      // A LABORATORY THAT READS ITS OWN FORMAT IS FOLLOWED THE WAY IT WILL READ IT (dispatch 335).
      // SR-01 and BM-06 honour a settings link of their own and ignore a ?tape=, so decoding these
      // with the tape codec would report a broken link for one that works, and asserting a ?tape=
      // prefix for all would have refused the two links that are correct.
      if (link.via === "lab-query") {
        const binding = QUERY_BINDINGS[link.experimentId];
        expect(
          binding,
          `${id} is minted as a lab query but ${link.experimentId} has no binding`,
        ).toBeDefined();
        const search = link.href.slice(link.href.indexOf("?"));
        const decoded = binding?.decode(search) as
          | Readonly<{ kind: string; parameters?: Record<string, unknown> }>
          | undefined;
        if (decoded?.kind !== "settings") {
          failures.push(
            `${id}: ${link.experimentId} does not read its own link (${decoded?.kind})`,
          );
          continue;
        }
        const preset = presets.get(link.presetId);
        for (const [key, value] of Object.entries(preset?.parameterValues ?? {})) {
          // The one spelling the content layer cannot write: a preset says 0 or 1 where the
          // laboratory's default is a boolean, so the value that arrives is that boolean.
          const wanted =
            typeof binding?.defaults[key] === "boolean" && (value === 0 || value === 1)
              ? String(value === 1)
              : String(value);
          const carried = String(decoded.parameters?.[key]);
          if (carried !== wanted)
            failures.push(
              `${id}: ${key} is ${wanted} in ${link.presetId}, link carries ${carried}`,
            );
        }
        byQuery += 1;
        restored += 1;
        continue;
      }
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
    // Both arms must have run, or one of them is asserting nothing: 2 links are minted in a
    // laboratory's own query format and the rest as ?tape= permalinks.
    expect(byQuery).toBeGreaterThan(0);
    expect(restored - byQuery).toBeGreaterThan(0);
  });

  test("the rendered callout carries the settings link, and a record with none keeps the plain path", () => {
    // The reader-facing half, because a generated map nothing renders is not a fix. Brownian's page
    // carries both mechanisms: misc-bm-velocity reaches BM-01 through a ?tape= permalink, and
    // misc-bm-radial-gaussian reaches BM-06 through the settings link BM-06 reads itself.
    //
    // THIS TEST NAMED BM-06 AS THE PLAIN-PATH CASE until dispatch 335 bound it, and it failed the
    // moment that landed, which is the assertion doing its job. The negative control moved to light
    // quanta rather than being dropped: misc-lq-ultraviolet-catastrophe names LQ-02 and no registered
    // preset, so its callout must still carry the plain lab path and no invented query.
    // The hrefs are read from the parsed attributes, not matched as substrings of the markup: a
    // laboratory's own settings link carries several parameters, and React escapes the & between them
    // to &amp; in the attribute, which is correct HTML and does not appear in the string being sought.
    const hrefs = (paper: string): string[] => {
      const { document } = new Window();
      document.body.innerHTML = renderToStaticMarkup(
        createElement(PaperMargins, { margins: loadPaperMargins(paper) }),
      );
      return [...document.querySelectorAll("a")].map((a) => a.getAttribute("href") ?? "");
    };
    const brownian = hrefs("brownian-motion");
    const velocity = built.links["misc-bm-velocity"];
    expect(velocity, "misc-bm-velocity is not linked, so this test proves nothing").toBeDefined();
    expect(velocity?.via).toBe("tape");
    expect(brownian).toContain(velocity?.href);
    const radial = built.links["misc-bm-radial-gaussian"];
    expect(radial?.via, "BM-06 reads its own settings link, not a tape").toBe("lab-query");
    expect(brownian).toContain(radial?.href);
    // And neither callout is left on the bare path it used to carry.
    expect(brownian).not.toContain("/lab/bm-01/");
    expect(brownian).not.toContain("/lab/bm-06/");

    expect(built.notLinked["misc-lq-ultraviolet-catastrophe"]?.cause).toBe("names-no-preset");
    expect(hrefs("light-quanta")).toContain("/lab/lq-02/");
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
