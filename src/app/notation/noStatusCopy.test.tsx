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
});
