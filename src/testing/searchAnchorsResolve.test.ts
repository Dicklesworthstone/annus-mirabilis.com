/**
 * EVERY SEARCH RESULT LANDS WHERE IT SAYS IT WILL.
 *
 * THE FOURTH LINK QUESTION, and no existing gate can ask it. The three that exist read links in
 * built HTML:
 *
 *   routeReachability.test.ts   every built route has an inbound LINK, and cross-page fragments
 *   linkTargetsResolve.test.ts  every emitted link points at a built route
 *   trimmedUrlParents.test.ts   every PARENT of a built route resolves
 *
 * A search document is not a link in any page. It is a row in a generated shard, and the reader
 * follows it from the palette, so a document naming a route that is not built, or an anchor the
 * page does not carry, is invisible to all three. It is also invisible to the reader as a DEFECT:
 * a missing anchor does not error, it silently lands them at the top of a long paper page, which
 * looks like a page rather than like a broken result. A reader who searched one wrong turn and got
 * a list of ten has no way to know the site meant to do better.
 *
 * THIS IS WORTH A GATE BECAUSE THE ANCHOR SPELLINGS ARE AGREED BETWEEN TWO FILES THAT NEVER MEET.
 * `misconception-<id>` is written in MisconceptionCallout.tsx and again in documents.ts; `arg-<id>`
 * and the section ids likewise. Nothing compared them until this file: measured 2026-10-22 over
 * 1,231 documents against the built out/, every route resolves and every anchor is present.
 *
 * WHAT IT DOES NOT ASK: whether the anchor is the most useful one, whether the page scrolls to it
 * (a hidden element is a different defect, recorded under a-hidden-element-cannot-be-a-fragment-
 * target), or whether the result deserves to rank where it does.
 */
import { describe, expect, test } from "bun:test";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { type SearchDocument, validateSearchDocument } from "../search/core.ts";

const ROOT = process.cwd();
const OUT = resolve(ROOT, "out");
const INDEX = resolve(ROOT, "generated/search");

function builtPage(route: string): string | null {
  // `/papers/x/` is out/papers/x/index.html; `/` is out/index.html.
  const trimmed = route.replace(/^\/|\/$/g, "");
  const candidates = [
    join(OUT, trimmed, "index.html"),
    join(OUT, `${trimmed}.html`),
    join(OUT, "index.html"),
  ];
  const path = trimmed === "" ? candidates[2] : candidates.slice(0, 2).find((p) => existsSync(p));
  return path && existsSync(path) ? readFileSync(path, "utf8") : null;
}

function documents(): readonly SearchDocument[] {
  const manifestPath = join(INDEX, "index-manifest.json");
  if (!existsSync(manifestPath)) return [];
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
    shards: readonly { path: string }[];
  };
  const rows: SearchDocument[] = [];
  for (const shard of manifest.shards) {
    const file = join(INDEX, basename(shard.path));
    if (!existsSync(file)) continue;
    const payload = JSON.parse(readFileSync(file, "utf8")) as { documents: unknown[] };
    for (const value of payload.documents) rows.push(validateSearchDocument(value));
  }
  return rows;
}

const DOCUMENTS = documents();

/** Documents whose anchor no built page carries, named. One function so the plant below runs it. */
function unresolvedAnchors(rows: readonly SearchDocument[]): string[] {
  const missing: string[] = [];
  const pages = new Map<string, string>();
  for (const document of rows) {
    if (document.anchor === "") continue;
    let html = pages.get(document.route);
    if (html === undefined) {
      html = builtPage(document.route) ?? "";
      pages.set(document.route, html);
    }
    // The id as the server rendered it. Searching the whole file rather than the static half on
    // purpose: an anchor an island mounts still works for a reader with scripting on, and the
    // stricter no-script question belongs to the no-JavaScript lane.
    if (!html.includes(`id="${document.anchor}"`))
      missing.push(`${document.id}: ${document.route}#${document.anchor}`);
  }
  return missing;
}
const OUT_BUILT = existsSync(OUT) && readdirSync(OUT).length > 0 && statSync(OUT).isDirectory();

describe("every search document lands where it says", () => {
  test("the index and the build are both present, so nothing below is vacuous", () => {
    // Both halves of the population, named: a missing index or a missing out/ would make every
    // loop here iterate nothing and pass. Measured 2026-10-22: 1,231 documents.
    expect(
      DOCUMENTS.length,
      "no search documents. Run `bun scripts/build-search-index.ts`.",
    ).toBeGreaterThanOrEqual(900);
    expect(OUT_BUILT, "no out/. Run `bun run build`; this gate reads the build.").toBe(true);
    const withAnchor = DOCUMENTS.filter((d) => d.anchor !== "");
    console.log(
      `[search-anchors] ${DOCUMENTS.length} document(s); ${withAnchor.length} carry an anchor; ${new Set(DOCUMENTS.map((d) => d.route)).size} distinct route(s)`,
    );
    expect(withAnchor.length).toBeGreaterThan(100);
  });

  test("every document's route is a built page", () => {
    const missing = [
      ...new Set(DOCUMENTS.filter((d) => builtPage(d.route) === null).map((d) => d.route)),
    ].sort();
    expect(missing, `routes with no built page:\n${missing.join("\n")}`).toEqual([]);
  });

  test("every document's anchor is an id the built page carries", () => {
    const missing = unresolvedAnchors(DOCUMENTS);
    expect(
      missing,
      `anchors that no built page carries (${missing.length}):\n${missing.slice(0, 40).join("\n")}`,
    ).toEqual([]);
  });

  test("PLANTED: the anchor loop reports a bad anchor on a real document", () => {
    /*
     * The assertion above is a zero over 907 anchors, and the helpers being correct is not the same
     * as the LOOP being correct: an early `continue`, a wrong key into the page cache or a
     * swallowed read would each produce the same clean zero. So the same function is run over a
     * real document with its anchor changed, and must report exactly that one.
     */
    const real = DOCUMENTS.find((d) => d.anchor !== "");
    expect(real, "no anchored document to plant on").toBeDefined();
    const planted = unresolvedAnchors([
      { ...(real as SearchDocument), anchor: "not-an-id-any-page-carries" },
    ]);
    expect(planted.length, planted.join("\n")).toBe(1);
    expect(planted[0]).toContain("not-an-id-any-page-carries");
    // And the unchanged document still passes, so the plant is the only difference.
    expect(unresolvedAnchors([real as SearchDocument])).toEqual([]);
  });

  test("PLANTED: the page reader and the id check both discriminate", () => {
    /*
     * Two zeros above, and a zero from a check that cannot fail is worth nothing. Both halves are
     * controlled here: that an absent page reads as absent rather than as an empty string that
     * contains no ids (which would make the anchor check vacuous instead of red), and that a real
     * page is found and does NOT contain an invented id.
     */
    expect(builtPage("/papers/mass-energy/")).not.toBeNull();
    expect(builtPage("/papers/not-a-paper/")).toBeNull();
    expect(builtPage("/equations/mass-energy/")).not.toBeNull();
    const page = builtPage("/papers/mass-energy/") ?? "";
    expect(page.length).toBeGreaterThan(1000);
    expect(page.includes('id="misconception-misc-me-first"')).toBe(true);
    expect(page.includes('id="misconception-not-a-record"')).toBe(false);
  });
});
