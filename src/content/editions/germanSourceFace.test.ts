/**
 * The German source face loads from the receipt, not from a filename (am-dl4n criterion 2).
 *
 * This suite was written while am-wisq was renaming the ledgers off `-reviewed.txt`. The
 * rename landed at 16:12 during the work, files and receipts together, and this module
 * needed no change at all - which is the property the tests below pin rather than a happy
 * accident to be remembered in a commit message.
 */

import assert from "node:assert/strict";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { GermanSourceFaceError, loadGermanSourceFace } from "./germanSourceFace.ts";

const REPO = process.cwd();

/**
 * A throwaway root holding one paper's receipt and, optionally, its ledger at a path the
 * caller chooses. The receipt is the SHIPPED one with its ledgerPath rewritten, so the
 * fixture stays realistic in every respect except the one under test.
 */
function fixtureRoot(options: {
  readonly ledgerRelative: string | null;
  readonly copyLedgerFrom?: string;
  readonly ledgerStatus?: string;
}): string {
  const root = mkdtempSync(join(tmpdir(), "german-face-"));
  const receipt = readFileSync(join(REPO, "docs", "provenance", "ap-18-639.md"), "utf8");
  let rewritten = receipt.replace(
    /^(\s*)ledgerPath:.*$/m,
    options.ledgerRelative === null
      ? '$1ledgerPath: ""'
      : `$1ledgerPath: "${options.ledgerRelative}"`,
  );
  if (options.ledgerStatus) {
    rewritten = rewritten.replace(
      /^(\s*)ledgerStatus:.*$/m,
      `$1ledgerStatus: ${options.ledgerStatus}`,
    );
  }
  mkdirSync(join(root, "docs", "provenance"), { recursive: true });
  writeFileSync(join(root, "docs", "provenance", "ap-18-639.md"), rewritten);
  if (options.ledgerRelative && options.copyLedgerFrom) {
    const dest = join(root, options.ledgerRelative);
    mkdirSync(dirname(dest), { recursive: true });
    cpSync(join(REPO, options.copyLedgerFrom), dest);
  }
  return root;
}

/** Whatever the shipped receipt currently points at, read from the receipt itself. */
function shippedLedgerRelative(): string {
  const receipt = readFileSync(join(REPO, "docs", "provenance", "ap-18-639.md"), "utf8");
  const match = receipt.match(/^\s*ledgerPath:\s*"?([^"\n]+)"?\s*$/m);
  assert.ok(match?.[1], "the shipped receipt must record a ledgerPath");
  return match[1].trim();
}

test("the shipped mass-energy receipt yields a labelled German face with real text", () => {
  const face = loadGermanSourceFace("mass-energy", REPO);
  assert.ok(face, "mass-energy has a ledger and must load");
  assert.equal(face.bibKey, "ap-18-639");
  assert.ok(face.blocks.length > 10, `expected real content, got ${face.blocks.length} blocks`);
  // The German is actually there, not an empty shell that happens to have blocks.
  const text = face.blocks.map((b) => b.text).join(" ");
  assert.ok(text.length > 500, `expected substantial text, got ${text.length} characters`);
  // And it is labelled, because the receipt says draft.
  assert.equal(face.notice.state, "machine-draft");
  assert.notEqual(face.notice.label, "");
});

test("DISCRIMINATING: the ledger is found at a path NO convention would guess", () => {
  // The arm that separates "reads the receipt" from "happens to match the convention".
  // Every other test here passes against a module that reconstructs
  // public/papers/transcripts/<key>-<something>.txt, because the shipped layout is
  // exactly what such a module would build. This one puts the ledger somewhere no
  // convention would look and asserts it is still found.
  //
  // Learned the hard way an hour earlier: seven tests of the notice all passed against a
  // hardcoded sentence because the fixture used the realistic value. A realistic fixture
  // is the enemy of a discriminating test.
  const odd = "sources/attic/box-7/an-unlikely-place-for-a-ledger.txt";
  const root = fixtureRoot({ ledgerRelative: odd, copyLedgerFrom: shippedLedgerRelative() });
  const face = loadGermanSourceFace("mass-energy", root);
  assert.ok(face, "the receipt names the ledger and the module must follow it");
  assert.ok(face.blocks.length > 10);
});

test("a receipt naming a ledger that is not there REFUSES, and does not report absence", () => {
  // The failure the rename could actually produce: a ledger moved and a receipt left
  // behind. It must not degrade into "this paper has no source text", because a reader
  // would believe that sentence and it would be false.
  const root = fixtureRoot({ ledgerRelative: "public/papers/transcripts/gone.txt" });
  assert.throws(
    () => loadGermanSourceFace("mass-energy", root),
    (error: unknown) => {
      assert.ok(error instanceof GermanSourceFaceError, String(error));
      assert.equal(error.code, "ledger-path-missing");
      assert.match(error.message, /gone\.txt/);
      return true;
    },
  );
});

test("a paper whose ledger has not been started reports absence, and does NOT refuse", () => {
  // The other side of the pair, and the reason the status is checked before the path.
  // ap-17-891 and ap-19-289 both record an aspirational ledgerPath alongside
  // ledgerStatus: not-started. Refusing there would fire on a correct state, and a
  // refusal that fires on a correct state trains a reader to route around the one that
  // matters.
  const root = fixtureRoot({
    ledgerRelative: "public/papers/transcripts/never-written.txt",
    ledgerStatus: "not-started",
  });
  assert.equal(loadGermanSourceFace("mass-energy", root), null);

  // And the two shipped papers in exactly that state load as null rather than throwing.
  assert.equal(loadGermanSourceFace("special-relativity", REPO), null);
  assert.equal(loadGermanSourceFace("molecular-dimensions", REPO), null);
});

test("REQUIREMENT 3, IN THE TYPE: text and notice are one value and cannot be separated", () => {
  // `notice` is not optional on GermanSourceFace, so no caller can obtain the German text
  // without also holding the sentence that qualifies it. This asserts the runtime half of
  // that - the type half is checked by tsc - because a loader that returned blocks and
  // left the notice undefined would satisfy the compiler through a cast and nothing else
  // would notice.
  for (const slug of ["mass-energy", "brownian-motion", "light-quanta"] as const) {
    const face = loadGermanSourceFace(slug, REPO);
    assert.ok(face, `${slug} must load`);
    assert.ok(face.notice, `${slug} produced text with no notice`);
    assert.equal(typeof face.notice.state, "string");
    assert.ok(
      face.notice.state !== "machine-draft" || face.notice.label !== "",
      `${slug} is a draft and its label is empty`,
    );
  }
});

test("scan-page furniture does not reach the face, whatever the header says", () => {
  // AGENTS.md: furniture belongs in the ledger and the receipt, never in the continuous
  // edition. Matched by grammar rather than by the status word, because am-wisq changed
  // that word from REVIEWED to MACHINE DRAFT while this was being written and a check
  // keyed on either spelling would go blind exactly when it mattered.
  const grammar = /---\s*[A-Z][A-Z \t]*TRANSCRIPTION\s+PAGE\s+\d+\s+OF\s+\d+\s*---/;
  for (const slug of ["mass-energy", "brownian-motion", "light-quanta"] as const) {
    const face = loadGermanSourceFace(slug, REPO);
    assert.ok(face);
    const joined = face.blocks.map((b) => b.text).join("\n");
    assert.ok(!grammar.test(joined), `${slug} leaked a page marker into the edition`);
    assert.ok(!joined.includes("[[ANNALEN-PAGE"), `${slug} leaked a page anchor`);
  }
});
