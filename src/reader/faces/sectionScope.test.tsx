/**
 * A SECTION'S FACE CARRIES ITS OWN SECTION (dispatches 480 and 484).
 *
 * Both defects were found by size rather than by a test, because nothing asserted what a section's
 * page contains. The English face rendered every unit in the paper whatever the URL said: eleven of
 * relativity's section English faces measured 343.5 to 343.7 kB gzipped, within 200 bytes of each
 * other and of the WHOLE paper's face. The parallel face scoped its German half by filtering blocks
 * and left its English half unscoped, so parallelRows, which by design gives an English group whose
 * German block a page does not print a row of its own, printed the other nine sections as
 * German-less rows: all eleven section parallel faces rendered 95 translation paragraphs, the same
 * 95 the whole paper renders.
 *
 * THE PROBE IS KEYED ON THE ID GRAMMAR, NOT ON THE INDEX THE FACES USE. A sentence id is
 * `s<n>-p<m>-s<k>` (docs/CONTENT_IDS.md), so a unit's own id says which section it belongs to
 * without asking unitSections.ts, which is the thing under test. A test that classified units with
 * the same index the component uses would agree with the component by construction.
 *
 * THE WHOLE-PAPER FACE IS THE POSITIVE CONTROL and it defines the population: a probe string counts
 * only once that face is shown to contain it. Without that control a probe that no page could match
 * (an inline tag splitting the sentence, an escaped character) would read as a clean absence from
 * the section face, which is the failure this repository keeps paying for. The control doubles as
 * the assertion that the whole-paper face is NOT narrowed by either scoping change.
 */
import { describe, expect, test } from "bun:test";
import { plainText } from "../../content/schemas/inlines.ts";
import type { TranslationUnit } from "../../content/schemas/source.ts";
import { exportMarkup } from "../../testing/exportMarkup.ts";
import { PaperPage } from "../PaperPage.tsx";
import { loadBilingualEdition } from "./bilingualLoader.ts";

const PAPER = "special-relativity";
const HOME = "s3";
const AWAY = "s10";

const squash = (s: string) => s.replace(/\s+/g, "");
/** A page's text with every tag and all whitespace removed, so an inline tag cannot split a run. */
const pageText = (html: string) =>
  squash(html.replace(/<script[\s\S]*?<\/script>/g, " ").replace(/<[^>]+>/g, ""));

/**
 * A run of one unit's English long enough to identify it, taken from between the characters HTML
 * escapes. Undefined when the unit has no such run: a sentence built around inline mathematics has
 * no long plain run, and the control below drops it rather than counting it as an absence.
 */
function probeOf(unit: TranslationUnit): string | undefined {
  const runs = plainText(unit.inlines)
    .split(/[&<>"'‘’“”]/)
    .map(squash)
    .filter((r) => r.length >= 40);
  return runs.sort((a, b) => b.length - a.length)[0]?.slice(0, 40);
}

const render = async (section: string | undefined, face: "english" | "parallel") =>
  await exportMarkup(
    await PaperPage({
      paperId: PAPER,
      ...(section ? { section } : {}),
      face,
    } as never),
  );

describe("a section's reading face", () => {
  test("carries its own section's sentences and none of another section's, on both faces", async () => {
    const edition = await loadBilingualEdition(PAPER);
    if (!edition) throw new Error(`no edition for ${PAPER}`);
    const probes = (prefix: string) =>
      edition.units
        .filter((u) => u.id.startsWith(`${prefix}-`))
        .map(probeOf)
        .filter((p): p is string => p !== undefined);
    const home = probes(HOME);
    const away = probes(AWAY);

    for (const face of ["english", "parallel"] as const) {
      const whole = pageText(await render(undefined, face));
      // The control: only sentences the whole-paper face is shown to contain are asked about.
      const homeReal = home.filter((p) => whole.includes(p));
      const awayReal = away.filter((p) => whole.includes(p));
      // Measured 2026-09-28 on both faces: 19 of s3's 40 probes and 27 of s10's 30. The floors are
      // named rather than the counts asserted, because a probe stops being usable when a sentence
      // is re-translated around an inline, which is correct work and must not turn this red.
      expect(homeReal.length).toBeGreaterThan(14);
      expect(awayReal.length).toBeGreaterThan(19);

      const page = pageText(await render(HOME, face));
      expect(homeReal.filter((p) => page.includes(p)).length).toBe(homeReal.length);
      expect(awayReal.filter((p) => page.includes(p))).toEqual([]);
    }
  }, 240000);
});
