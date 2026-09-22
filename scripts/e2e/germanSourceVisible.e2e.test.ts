/**
 * A reviewed ledger on disk must reach a reader (am-dl4n).
 *
 * THIS TEST FAILS TODAY, AND THAT IS THE DEFECT IT RECORDS. Two German transcripts
 * exist - ap-18-639 and ap-17-549, both written under the owner's page-image ruling -
 * and a reader cannot see a word of either. The correction the ruling was granted for
 * is visible in the file, "Trdgheit/Kerpers/Eimergieinhalt" now reading
 * "Trägheit/Körpers/Energieinhalt", and it renders nowhere.
 *
 * WHY IT IS NOT A GUARD AGAINST A ROUTE THAT DOES NOT EXIST, which would be vapour:
 * the route already exists and already ships.
 * out/papers/mass-energy/view/german/index.html is built today and renders "The german
 * source for this paper is not yet available." What is missing is not the page but the
 * content in it: nothing emits a payload of kind "bilingual-edition", so
 * loadBilingualEdition finds none and the face falls to its notice. This assertion
 * therefore passes unchanged the moment a compiler emits that payload - no rewrite,
 * no new selector, no guess about a route's future shape.
 *
 * WHY THE NEEDLE COMES OUT OF THE LEDGER rather than being typed here: a hard-coded
 * German sentence would drift from the transcript the moment either is edited, and
 * would then be asserting something no file says. The body text is read from the
 * ledger at run time, so the two cannot disagree.
 *
 * WHAT THIS DELIBERATELY DOES NOT ASSERT. I scoped a fourth check - that the review
 * label the page shows matches what docs/provenance/<key>.md claims - and am not
 * writing it. Whether a machine draft with hand correction may be shown at all, and
 * under what label, is an owner decision that has not been taken; any selector I chose
 * for a label that does not exist would be invented, and a guard whose passing
 * condition I made up is worse than no guard. It is recorded here as unwritten so the
 * next reader knows it was considered rather than missed. See am-wisq.
 *
 * The complementary filesystem-side check - a transcript exists and no route reads it -
 * belongs to pane31 (AmberFalcon). This is the artefact half: what the BUILT page
 * shows, not what a component returns.
 */

import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { PAPER_BIB_KEYS } from "../../src/content/editions/ledgerPresence.ts";
import { assertOutFreshness } from "../../src/testing/outFreshness.ts";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const TRANSCRIPTS = join(REPO_ROOT, "public", "papers", "transcripts");
const OUT_DIR = join(REPO_ROOT, "out");

/**
 * The page marker that must never reach a reader, matched by its GRAMMAR rather than by
 * its adjective.
 *
 * This was the literal string "REVIEWED TRANSCRIPTION" until am-wisq renamed the header to
 * "--- MACHINE DRAFT TRANSCRIPTION PAGE n OF m ---". Keyed on the word REVIEWED, this
 * guard would have gone blind at the exact moment the thing it guards against started
 * happening: segmentLedger's stripFurniture is keyed on the same word, so the marker would
 * have begun leaking into the German face and this assertion would have stopped matching
 * it, both in the same instant and in the same direction.
 *
 * The grammar is `--- <WORDS> TRANSCRIPTION PAGE n OF m ---` and only the adjective moves,
 * so the structure is what gets asserted. A future rename to any other adjective is
 * covered without anyone remembering to come back here.
 */
const FURNITURE_MARKER = /---\s*[A-Z][A-Z \t]*TRANSCRIPTION\s+PAGE\s+\d+\s+OF\s+\d+\s*---/;

interface LedgerOnDisk {
  readonly bibKey: string;
  readonly slug: string;
  readonly path: string;
}

function ledgersOnDisk(): LedgerOnDisk[] {
  // DISCOVERED THROUGH THE RECEIPTS, NOT BY GLOBBING A FILENAME.
  //
  // This globbed `*-reviewed.txt` until am-wisq renamed the transcripts to
  // `*-machine-draft.txt`. The glob then matched nothing, and this test failed on its own
  // reachability assertion rather than passing vacuously - which is the guard working,
  // and is also exactly the coupling the receipt-keyed modules were built to avoid. The
  // guard was the one place I had not applied the same rule.
  //
  // `transcription.ledgerPath` is the receipt's own record of where its ledger is, so the
  // next rename carries this with it.
  const found: LedgerOnDisk[] = [];
  for (const [slug, bibKey] of Object.entries(PAPER_BIB_KEYS)) {
    const receiptPath = join(REPO_ROOT, "docs", "provenance", `${bibKey}.md`);
    if (!existsSync(receiptPath)) continue;
    const receipt = readFileSync(receiptPath, "utf8");
    const status = /^\s*ledgerStatus:\s*(\S+)/m.exec(receipt)?.[1];
    // A paper whose ledger has not been started records an aspirational path. It has no
    // ledger to reach a reader, and asserting on it would be asserting on a plan.
    if (status === undefined || status === "not-started") continue;
    const relative = /^\s*ledgerPath:\s*"?([^"\n]+)"?\s*$/m.exec(receipt)?.[1]?.trim();
    if (!relative) continue;
    const path = join(REPO_ROOT, relative);
    if (!existsSync(path)) continue;
    found.push({ bibKey, slug, path });
  }
  return found;
}

/**
 * A sentence from the ledger's body, long enough to be unmistakable and taken from the
 * prose rather than the title. The title is not usable as the needle: a paper's German
 * title comes from its own metadata record and can appear on the page while no source
 * text does, so asserting on it would pass while the defect stood.
 */
function bodySentenceFrom(ledgerPath: string): string {
  const lines = readFileSync(ledgerPath, "utf8").split("\n");
  for (const line of lines) {
    const text = line.trim();
    if (text === "") continue;
    if (text.startsWith("---") || text.startsWith("[[")) continue;
    if (text.length < 40) continue;
    // Stop at the first sentence boundary so a reflowed paragraph does not break the
    // match; forty-plus characters of Einstein's German is already unambiguous.
    const sentence = text.split(/(?<=\.)\s/)[0] ?? text;
    return sentence.slice(0, 60);
  }
  throw new Error(`${ledgerPath} has no body prose to match against`);
}

test("every reviewed ledger on disk reaches a reader through its built German page", () => {
  const ledgers = ledgersOnDisk();

  // Reachability before the claim: with no ledgers this test would pass vacuously and
  // would keep passing after the first one landed. It must say so instead.
  assert.ok(
    ledgers.length > 0,
    `no ledger was found through any provenance receipt, so this proves nothing. ` +
      "If ledgers have moved, this test must move with them.",
  );

  // ABSENT *AND* STALE. See declaredRoutesBuilt.test.ts for the measurement: existsSync alone
  // let a build 119 commits behind HEAD satisfy this, so "what a reader meets" was being checked
  // against pages no reader would meet. Same convention as src/testing/outFreshness.ts.
  assertOutFreshness();
  if (!existsSync(join(OUT_DIR, "index.html"))) {
    assert.fail(
      "out/ is absent, so what a reader meets cannot be checked. Run bun run build. " +
        "This is not-available rather than a pass: a missing artefact is not evidence.",
    );
  }

  const unreachable: string[] = [];
  const leakedFurniture: string[] = [];

  for (const ledger of ledgers) {
    const pagePath = join(OUT_DIR, "papers", ledger.slug, "view", "german", "index.html");
    if (!existsSync(pagePath)) {
      unreachable.push(`${ledger.bibKey}: no built page at papers/${ledger.slug}/view/german/`);
      continue;
    }
    const page = readFileSync(pagePath, "utf8");
    const needle = bodySentenceFrom(ledger.path);
    if (!page.includes(needle)) {
      unreachable.push(`${ledger.bibKey}: the built page does not contain "${needle}…"`);
    }
    const furniture = FURNITURE_MARKER.exec(page);
    if (furniture) {
      leakedFurniture.push(`${ledger.bibKey}: the page shows "${furniture[0]}"`);
    }
  }

  // Page furniture reaching a reader is the worse failure of the two, and it is already
  // forbidden: AGENTS.md says scan-page furniture belongs in the ledger and the receipt,
  // never in the continuous edition. Nothing enforced that at the artefact level until
  // now, and under am-wisq the marker itself is being renamed, so this matches its
  // grammar rather than either spelling of its adjective.
  assert.deepEqual(
    leakedFurniture,
    [],
    `The ledger's page furniture is being shown to a reader:\n${leakedFurniture.join("\n")}`,
  );

  assert.deepEqual(
    unreachable,
    [],
    `A reviewed ledger exists on disk and a reader cannot see it (am-dl4n):\n${unreachable.join("\n")}\n` +
      "The route is not the missing piece - out/papers/<slug>/view/german/ is built and " +
      'renders "not yet available". Nothing emits a payload of kind "bilingual-edition", ' +
      "so loadBilingualEdition finds none. This passes unchanged once one is emitted.",
  );
});
