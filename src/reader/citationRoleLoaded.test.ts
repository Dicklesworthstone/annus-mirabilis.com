/**
 * THE CITATION ROLE REACHES THE READER PATH, AND A RECORD WITHOUT ONE IS REFUSED (am-wfuc).
 *
 * `validateBibEntry` in `schemas/source.ts`, named `validateCitation` then, had required a role
 * since the schema was written and was called by nothing but its own tests, while the loader a
 * reader's page actually goes through, `marginRecords.ts`, used a second record type that had
 * no role at all. Measured 2026-10-09 at fa3c3aff over the 23 shipped records: the strict
 * validator passed 0 and failed 23, all `invalid-role`; the live one passed 23. AGENTS.md's
 * entity table requires the role, so it was required by the plan, implemented in a validator,
 * and read by nothing.
 *
 * These tests drive the LIVE loader, because that is the half that was unwired. The plants are
 * fixture trees rather than edits to shipped records, so a plant can never be left behind in
 * `content/`:
 *
 *   __fixtures__/margins/citation-no-role        the field is absent
 *   __fixtures__/margins/citation-unknown-role   the field says "comparison", the short spelling
 *                                                the enum has never had
 *
 * The second plant is chosen deliberately. "comparison" is the form am-wfuc believed AGENTS.md
 * used, and the belief was wrong -- the file has read "comparison witness" since the initial
 * commit 30f6957b7 -- so the spelling was never in dispute. The plant keeps the wrong form
 * refused by name rather than by an agreement nobody wrote down.
 */

import { describe, expect, test } from "bun:test";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { ContentError } from "../content/compiler/json.ts";
import { CITATION_ROLES } from "../content/schemas/reading.ts";
import { loadPaperMargins } from "./marginRecords.ts";

const FIXTURES = join(process.cwd(), "src", "reader", "__fixtures__", "margins");
const root = (name: string) => join(FIXTURES, name);
const BIBLIOGRAPHY = join(process.cwd(), "content", "bibliography");

describe("the citation role on the reader path (am-wfuc)", () => {
  test("a role survives the loader, so the field is not validated and then dropped", () => {
    const margins = loadPaperMargins("demo-paper", root("ok"));
    const cited = margins.citations.get("cit-demo");
    expect(cited).toBeDefined();
    expect(cited?.role).toBe("primary");
  });

  test("PLANTED: a bibliography record with no role is refused, naming its path", () => {
    let caught: unknown;
    try {
      loadPaperMargins("demo-paper", root("citation-no-role"));
    } catch (err) {
      caught = err;
    }
    // The field is named by the error's `path`, never by its message: every message from this
    // validator is a fixed sentence ("Missing field.", "Unsupported value."), so asserting on
    // the text would pass for a refusal about any other field of any other record.
    expect(caught).toBeInstanceOf(ContentError);
    expect((caught as ContentError).path).toContain("citation-no-role");
    expect((caught as ContentError).path).toMatch(/cit-demo\.json\.role$/);
    expect((caught as ContentError).message).toBe("Missing field.");
  });

  test("PLANTED: a record whose role is the short spelling is refused", () => {
    let caught: unknown;
    try {
      loadPaperMargins("demo-paper", root("citation-unknown-role"));
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(ContentError);
    expect((caught as ContentError).path).toMatch(/cit-demo\.json\.role$/);
    expect((caught as ContentError).message).toBe("Unsupported value.");
  });

  /**
   * The control in the other direction. Two refusals above establish nothing on their own: a
   * loader that threw on every fixture would satisfy both. The `ok` tree differs from the two
   * plants in exactly the citation's role field, and it loads.
   */
  test("the same tree with a valid role loads, so the loader is not refusing everything", () => {
    const margins = loadPaperMargins("demo-paper", root("ok"));
    expect(margins.notes.map((n) => n.id)).toEqual(["note-demo-a"]);
    expect(margins.citations.size).toBeGreaterThan(0);
  });

  /**
   * The population, which the bead asks for by name: an empty directory read would satisfy every
   * assertion about "each record" above without examining one. Reported with its count, floored
   * at a number the corpus has long exceeded rather than frozen at today's 23, because a
   * bibliography that grows is correct work and `am-margin-citations-7jet` is about to add 17.
   */
  test("every shipped bibliography record carries one of the four roles", () => {
    expect(existsSync(BIBLIOGRAPHY)).toBe(true);
    const files = readdirSync(BIBLIOGRAPHY).filter((f) => f.endsWith(".json"));
    expect(files.length).toBeGreaterThanOrEqual(20);

    const byRole = new Map<string, string[]>();
    const missing: string[] = [];
    for (const file of files) {
      const rec = JSON.parse(readFileSync(join(BIBLIOGRAPHY, file), "utf8")) as {
        kind?: string;
        role?: string;
      };
      if (rec.kind !== "citation") continue;
      if (!rec.role || !(CITATION_ROLES as readonly string[]).includes(rec.role)) {
        missing.push(file);
        continue;
      }
      byRole.set(rec.role, [...(byRole.get(rec.role) ?? []), file]);
    }
    expect(missing).toEqual([]);

    const counted = [...byRole.values()].reduce((n, ids) => n + ids.length, 0);
    console.log(
      `[census] bibliography roles: ${counted} citation record(s) of ${files.length} file(s) ` +
        CITATION_ROLES.map((r) => `| ${r} ${byRole.get(r)?.length ?? 0}`).join(" "),
    );
    // Not an equality: the point is that the loop ran over the records, not that there are 23.
    expect(counted).toBeGreaterThanOrEqual(20);
  });
});
