/**
 * No ledger markup token reaches a reader's eyes.
 *
 * The ledger is a diplomatic transcription and it carries typography as bracketed tokens:
 * `[[SPERR]]…[[/SPERR]]` for the letter-spaced emphasis of 1905 German typesetting, `[[EM]]`,
 * `[[FN-MARK 1)]]`, `[[EQ-LABEL (1)]]`, `[[CONTINUES]]`, `[[DATELINE]]`, `[[RECEIVED]]`. Those are
 * instructions to a renderer. A reader must never see one.
 *
 * WHY THIS EXISTS, measured rather than imagined. On the build of 2026-09-22 10:17:48 the exported
 * site served 285 of them as visible text across 15 pages, 116 on /papers/light-quanta/view/german
 * alone, in the middle of Einstein's sentences:
 *
 *     Ich legte dort die [[SPERR]]Maxwell-Hertzschen[[/SPERR]] Gleichungen für den leeren Raum
 *
 * That is the finished half of the edition - the German source face is the one face the homepage
 * says is set for three of the four papers - and nothing in the repository objected.
 *
 * WHAT IT CHECKS: the VISIBLE TEXT of every built page, with tags removed, contains no `[[…]]`
 * token. Tags are stripped first on purpose, because a token inside an attribute (a `title`, a
 * `data-` payload) is a different question from one a reader sees, and this check is about the
 * reader. `<script>` and `<style>` bodies are removed before stripping, so a token inside inlined
 * JSON or CSS is not counted as prose.
 *
 * WHAT IT DOES NOT CHECK: that the markup was rendered CORRECTLY. A renderer that silently deleted
 * every `[[SPERR]]` pair would pass this and would be wrong - Sperrsatz is emphasis Einstein's
 * compositor set deliberately, and dropping it loses meaning rather than markup. This check
 * replaces exactly one false comfort, that raw tokens are not being served, and nothing else. The
 * companion property - that emphasis survives as emphasis - is asserted in the draft face's own
 * render test, where the tokenized output can be inspected directly.
 *
 * THE PATTERN IS DELIBERATELY BROAD. It matches any `[[…]]`, not a list of the eleven forms seen
 * today, because a list would pass the first time somebody adds a twelfth token to the ledger
 * grammar - which is the moment this check is most needed. The cost of breadth is that a page
 * legitimately quoting double brackets would fail; no page does, and if one ever needs to, the
 * right answer is to escape it rather than to narrow this pattern.
 */

import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { assertOutFreshness } from "../../src/testing/outFreshness.ts";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const OUT_DIR = join(REPO_ROOT, "out");

/** Any bracketed token. Bounded length so a stray `[[` in prose cannot swallow a paragraph. */
const MARKUP_TOKEN = /\[\[[^\]\n]{1,40}\]\]/g;

const SCRIPT_OR_STYLE = /<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi;
const ANY_TAG = /<[^>]+>/g;

function visibleText(html: string): string {
  return html.replace(SCRIPT_OR_STYLE, " ").replace(ANY_TAG, " ");
}

function builtPages(dir: string, found: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) builtPages(full, found);
    else if (entry.name === "index.html") found.push(full);
  }
  return found;
}

test("no built page serves a ledger markup token as visible text", () => {
  assertOutFreshness();
  assert.ok(existsSync(join(OUT_DIR, "index.html")), "out/index.html missing; run bun run build");

  const pages = builtPages(OUT_DIR);
  // The denominator, printed beside the verdict. A sweep over zero pages reports zero leaks and
  // is indistinguishable from a clean one.
  assert.ok(pages.length > 0, "no built pages found under out/");

  const offenders: string[] = [];
  let total = 0;
  for (const page of pages) {
    const tokens = visibleText(readFileSync(page, "utf8")).match(MARKUP_TOKEN);
    if (!tokens) continue;
    total += tokens.length;
    const route = `/${relative(OUT_DIR, dirname(page))}`.replace(/\/\.$/, "/");
    const forms = [...new Set(tokens)].sort();
    offenders.push(
      `${route}: ${tokens.length} token(s), ${forms.length} form(s): ${forms.slice(0, 6).join(" ")}`,
    );
  }

  console.log(
    `[source-markup] scanned ${pages.length} built pages; ${offenders.length} serve markup tokens, ${total} tokens total`,
  );

  assert.deepEqual(
    offenders,
    [],
    `${total} ledger markup token(s) are visible to a reader on ${offenders.length} of ${pages.length} pages.\n` +
      `These are renderer instructions, not text. Fix the face that renders them; never edit the ledger or the source blocks.\n  ${offenders.join("\n  ")}`,
  );
});
