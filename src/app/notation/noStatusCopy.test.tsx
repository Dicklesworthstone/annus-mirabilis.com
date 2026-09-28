/**
 * /notation/ shows no review, verification or provenance status (dispatch 246; the owner's
 * D-2026-09-25-no-review-status-banners).
 *
 * Live on 2026-09-25 a boxed paragraph under the page's lead read "193 of 197 entries have been
 * checked symbol by symbol against the printed pages. The other 4 entries were taken from
 * transcriptions of the papers and have not yet been checked against the scans. 167 of those
 * checks were made by an agent reading the page images." Every entry card ended "Read from the
 * printed page by an agent on 24 September 2026." under a "Notes and checking" summary, and a
 * dozen notes carried their own history ("Corrected 2026-09-24 from the plate:", "approved on
 * am-…", "not yet confirmed by a reviewer"). Each entry's `verification` record, and each moved
 * note in a YAML comment, stays in content/notation/ as the audit trail; only the reader copy goes.
 *
 * The check is an allowlist, not a list of banned sentences: every visible status word on the page
 * must sit in a phrase named below, so a status line in new words fails too. The markup scanned is
 * the page as a browser without JavaScript parses it, <noscript> content included, which is a
 * superset of what a browser with JavaScript shows.
 */
import { describe, expect, test } from "bun:test";
import { exportMarkup } from "../../testing/exportMarkup.ts";
import NotationPage from "./page.tsx";

const STATUS_WORD =
  /\b(?:un)?check\w*|\bverif\w*|\bpending\b|\bawaiting\b|\breview\w*|\bagents?\b|\bdispatch\w*|\bapproved\b|\bprovenance\b|\btranscri\w*|\bpage images?\b|\bfrom the plate\b|\bnot yet\b/gi;
/** Phrases that carry a status word and are not status copy, each with its reason. */
const ALLOWED: readonly Readonly<{ phrase: RegExp; why: string }>[] = [
  {
    phrase: /In the printed check/,
    why: "the light-quanta paper's own numerical check of the stopping potential, 4.3 V (§8)",
  },
  {
    phrase: /fail a dimension check/,
    why: "a statement about the units of a printed inequality, not about who checked what",
  },
];

/** The page's visible text: no script, style or MathML annotation, tags as spaces. */
function visibleText(html: string): string {
  return html
    .replace(/<(script|style)\b[\s\S]*?<\/\1>/g, " ")
    .replace(/<annotation\b[\s\S]*?<\/annotation>/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z]+;|&#x?[0-9a-f]+;/gi, " ")
    .replace(/\s+/g, " ");
}

/** Each status word in the text that no allowed phrase accounts for, with its context. */
function statusCopy(text: string): string[] {
  const covered: [number, number][] = [];
  for (const { phrase } of ALLOWED)
    for (const m of text.matchAll(new RegExp(phrase.source, "g")))
      covered.push([m.index ?? 0, (m.index ?? 0) + m[0].length]);
  const found: string[] = [];
  for (const m of text.matchAll(STATUS_WORD)) {
    const at = m.index ?? 0;
    if (covered.some(([a, b]) => at >= a && at < b)) continue;
    found.push(`…${text.slice(Math.max(0, at - 60), at + 60).trim()}…`);
  }
  return found;
}

describe("the status-copy scan reads what it is pointed at", () => {
  test("it finds the box, the per-entry lines and the notes the page carried", () => {
    // The box as it was live on 2026-09-25: "checked" twice, "transcriptions", "not yet",
    // "checks", "agent" and "page images".
    expect(
      statusCopy(
        "193 of 197 entries have been checked symbol by symbol against the printed pages. The other 4 entries were taken from transcriptions of the papers and have not yet been checked against the scans. 167 of those checks were made by an agent reading the page images.",
      ),
    ).toHaveLength(7);
    expect(statusCopy("Notes and checking")).toHaveLength(1);
    expect(statusCopy("Read from the printed page by an agent on 24 September 2026.")).toHaveLength(
      1,
    );
    expect(statusCopy("Checked against the printed page on 19 September 2026.")).toHaveLength(1);
    expect(
      statusCopy("Not yet checked against the printed page; taken from a transcription."),
    ).toHaveLength(3);
    expect(statusCopy("Corrected 2026-09-24 from the plate: printed b")).toHaveLength(1);
    expect(
      statusCopy("The modern symbol shown here is not yet confirmed by a reviewer."),
    ).toHaveLength(2);
    expect(
      statusCopy("(agent:SapphireCastle, approved on am-read-perspective-toggle-abd)"),
    ).toHaveLength(2);
  });

  test("it passes the allowed phrases, and a word inside another word", () => {
    expect(statusCopy("In the printed check Π is in abvolts")).toEqual([]);
    expect(statusCopy("makes the printed inequality fail a dimension check.")).toEqual([]);
    // \b keeps a word that merely contains one out: a reagent is not an agent.
    expect(statusCopy("a reagent")).toEqual([]);
  });
});

describe("/notation/ carries no review, verification or provenance status", async () => {
  const html = await exportMarkup(await NotationPage());
  const text = visibleText(html);

  test("the scan has the whole page to read", () => {
    // Non-vacuity: a page that failed to render would pass the scan below with nothing in it.
    const cards = html.match(/<article class="notation-entry[^"]*"/g) ?? [];
    expect(cards.length).toBeGreaterThan(100);
    expect(text).toContain("One letter, several meanings");
  });

  test("no visible status word outside an allowed phrase", () => {
    expect(statusCopy(text)).toEqual([]);
  });

  /**
   * A reader never meets a content id, and this guard is here rather than beside the records
   * because the SAME symptom has two unrelated causes and only the rendered page sees both.
   *
   *   9ee1ab6a: `formatScopeToken` had no branch for `sr-s10-p10-s2-m2`, so the FORMATTER printed
   *             the id because it could not say the scope in words.
   *   5d7070a5: me.phi.propagationAngleStationary's note read "Scoped strictly to citation anchor
   *             me-s0-p1. Distinct from emission angle in me-s0-p2..p6." An AUTHOR typed ids into
   *             prose, where no formatter ever looks.
   *
   * A check over the YAML would have caught the second and not the first; a unit test of
   * formatScopeToken catches the first and not the second. A reader cannot tell them apart, so the
   * guard is placed where the reader is.
   *
   * Added while the family is clean: a sweep of all 292 notation entries' `notes`, `meaning`,
   * `definition` and `collision` prose found exactly one offender, now fixed. This is the cheapest
   * moment to close it, not a campaign against a widespread habit.
   *
   * Attributes are not visible text, so `<option value="me-s0-p5">Mass and energy, paragraph 5` is
   * correct and passes: `visibleText` drops tags, and the id is in the tag.
   */
  /**
   * THE PAPER PREFIX IS OPTIONAL, and requiring it is how the first version of this guard shipped
   * with a hole. `docs/CONTENT_IDS.md` defines a sentence id as `s3-p2-s1`, with NO prefix; the
   * `sr-` in `sr-s10-p10-s2-m2` belongs to a scope TOKEN, which is a different thing that happens
   * to embed one. Written as `[a-z]{2}-s\d+…` this scan matched the token form only, so it passed a
   * live page that was serving "The entry for s10-p4 does the same work…" in the very file family I
   * had just audited. The probe I measured "1 offender across 292 entries" with carried the same
   * regex, so the measurement was wrong too: there were two, and the guard and the census agreed
   * with each other because they shared the mistake.
   *
   * `eq-` and `arg-` record ids are here for the same reason: they are content ids a reader has no
   * use for, and the sweep that found s10-p4 found them by asking for all three shapes at once.
   */
  const CONTENT_ID =
    /\b(?:[a-z]{2}-)?s\d+-p\d+(?:-s\d+)?(?:-m\d+)?\b|\beq-[a-z0-9]+(?:-[a-z0-9]+)+\b|\barg-[a-z0-9]+(?:-[a-z0-9]+)+\b/g;

  test("the content-id scan can actually fail, on both of its causes", () => {
    // The author's slip, verbatim from the record before 5d7070a5.
    expect(
      "Scoped strictly to citation anchor me-s0-p1. Distinct from emission angle in me-s0-p2..p6.".match(
        CONTENT_ID,
      )?.length,
    ).toBe(2);
    // The formatter's slip, verbatim from the token 9ee1ab6a repaired.
    expect("sr-s10-p10-s2-m2".match(CONTENT_ID)?.length).toBe(1);
    // And it does not fire on the prose those ids were replaced BY, which is what the page says now.
    expect(
      "in paragraph 1, and distinct from the emission angle φ of paragraphs 2 to 6".match(
        CONTENT_ID,
      ),
    ).toBeNull();
    expect("§10, paragraph 10, sentence 2, formula 2".match(CONTENT_ID)).toBeNull();

    // THE HOLE THE FIRST VERSION SHIPPED WITH, asserted so the prefix cannot creep back in as
    // required. Verbatim from special-relativity.yaml before it was repaired: a bare id, which the
    // live page was serving while this guard was green.
    expect(
      "The entry for s10-p4 does the same work for a paragraph where the letter only names the axis.".match(
        CONTENT_ID,
      )?.length,
    ).toBe(1);
    expect("s0-p2-s1".match(CONTENT_ID)?.length).toBe(1);
    expect("eq-s0-d1".match(CONTENT_ID)?.length).toBe(1);
    expect("arg-bm-introduction".match(CONTENT_ID)?.length).toBe(1);
    // …and the prose it was replaced by is still clean.
    expect("The entry for §10, paragraph 4 does the same work".match(CONTENT_ID)).toBeNull();

    // NOT every hyphenated token is an id. A guard that fired on ordinary prose would be worse than
    // the leak, because the cheapest way out of a false positive is to weaken the rule.
    expect("mass-energy".match(CONTENT_ID)).toBeNull();
    expect("light-quanta".match(CONTENT_ID)).toBeNull();
    expect("Stokes-Einstein".match(CONTENT_ID)).toBeNull();
  });

  test("no content id reaches a reader anywhere on the page", () => {
    const found = [...new Set(text.match(CONTENT_ID) ?? [])];
    expect(found, `content ids in the page's visible text: ${found.join(", ")}`).toEqual([]);
  });
});
