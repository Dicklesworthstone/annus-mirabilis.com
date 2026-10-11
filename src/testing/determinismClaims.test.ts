/**
 * NO READER IS PROMISED BITWISE IDENTITY, AND THE SENTENCES THAT SAY SO ARE NOT DELETABLE.
 *
 * AGENTS.md, under the engineering doctrine: "Bitwise identity across all architectures, compilers,
 * and browsers is not promised; every recorded comparison says whether it is bitwise or
 * tolerance-based." am-rt-determinism-fallbacks-8i4 opens with the reason it needs a gate rather
 * than a convention -- "'Deterministic' is easy to overclaim" -- and asks for a phrase scan that
 * finds no claim of cross-platform bitwise identity.
 *
 * WHY THIS SCANS THE BUILT READER-FACING TEXT AND NOTHING ELSE. A scan over the repository's prose
 * would be a bad gate, and measuring it is what showed that: 431 sentences mention `bitwise` across
 * 120 files, and of the 34 that pair it with a cross-platform word, almost every one DENIES the
 * claim -- "This lane does not claim cross-ISA bitwise identity for any new export", "Never call a
 * tolerance match 'bitwise'", "does not use an unqualified 'bitwise across browsers' sentence".
 * A gate over that population fires on the documentation explaining why the claim is forbidden,
 * which is the misfire AGENTS.md records under "A gate that forbids a construct must read code, not
 * text", and the allowlist that would silence it is the vacuous repair. The reader-facing surface is
 * where the rule actually binds and where the population is small enough to have been read in full.
 *
 * MEASURED 2026-10-11 over out/, visible text only (the RSC flight payload stripped, script and
 * style elements removed): SIX sentences mention bitwise and every one is a disclaimer.
 *
 *   out/lab/bm-01/index.html           "... not claimed bitwise identical across browser engines"
 *   out/embed/lab/bm-01/index.html     the same sentence
 *   out/discover/brownian-motion/      the same sentence
 *   out/lab/bm-05/index.html           "cross-engine bitwise parity ... are not claimed"
 *   out/embed/lab/bm-05/index.html     the same sentence
 *   out/lab/bm-08/compare/index.html   "not bitwise agreement between different computers"
 *
 * The site therefore tells a reader the honest thing in six places, which is stronger than silence.
 * NOTHING GUARDED THOSE SENTENCES. They are authored in src/components/lab/TracerLab.tsx,
 * WalkLab.tsx and CameraControlledComparison.tsx, and no test in the repository asserted any of
 * them, so all three could be deleted or softened and every lane would stay green. Hence a floor as
 * well as a ceiling: this file fails if a bare claim appears AND if the disclaimers thin out.
 *
 * WHICH HALF THIS WATCHES. The ceiling asks whether a negation sits beside the word, not whether the
 * surrounding paragraph is honest; a sentence engineered to carry a distant "not" would pass it.
 * That is the accidental-regression half, which is the half that has an owner here. Whether a
 * comparison is bitwise or tolerance-based IN FACT is a different question, answered per case in
 * docs/FRANKENSIM_BINDING.md (its line on Philox parity is the authority) and recorded per run by
 * `comparisonKind` in src/physics/reference/philox.log.ts; this file deliberately restates neither,
 * because two statements of one rule drift apart.
 */
import { describe, expect, test } from "bun:test";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = process.cwd();
const OUT = resolve(ROOT, "out");

/**
 * The floor, keyed by the surface rather than by a bare total, because a total is the thing that
 * survives deleting one disclaimer and adding another copy of a second. Each entry is a built page
 * that must carry a bitwise disclaimer, measured above.
 */
const DISCLAIMER_SURFACES = [
  "lab/bm-01/index.html",
  "embed/lab/bm-01/index.html",
  "discover/brownian-motion/index.html",
  "lab/bm-05/index.html",
  "embed/lab/bm-05/index.html",
  "lab/bm-08/compare/index.html",
] as const;

/** How far from the word a negation may sit and still be reading on it. The three authored
 * sentences put theirs at about 11 characters before, 58 after, and adjacent. */
const NEGATION_WINDOW = 80;
const NEGATION = /\b(?:not|never|no|without|nor)\b/i;

function visibleText(file: string): string {
  const raw = readFileSync(file, "utf8");
  // A statically exported route inlines its whole RSC payload, which repeats the server tree; the
  // text before it is what a reader is served with scripting off.
  const beforePayload = raw.split("<script>self.__next_f")[0] ?? raw;
  const withoutCode = beforePayload.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, " ");
  const text = withoutCode.replace(/<[^>]+>/g, " ");
  return text
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&apos;/g, "'")
    .replace(/&#x2019;|&rsquo;/g, "’");
}

function htmlFiles(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) found.push(...htmlFiles(full));
    else if (st.isFile() && entry.endsWith(".html")) found.push(full);
  }
  return found;
}

/** Every reader-visible sentence mentioning the word, with the page it came from. */
function bitwiseSentences(files: readonly string[]): { file: string; sentence: string }[] {
  const out: { file: string; sentence: string }[] = [];
  for (const file of files) {
    const text = visibleText(file);
    if (!/bitwise/i.test(text)) continue;
    for (const match of text.matchAll(/[^.!?]{0,200}bitwise[^.!?]{0,200}/gi)) {
      out.push({ file, sentence: match[0].split(/\s+/).join(" ").trim() });
    }
  }
  return out;
}

/**
 * The excerpt a failure prints, centred on the word rather than starting at the sentence.
 *
 * Written after the first plant: reader-visible text pulled out of a built page runs navigation and
 * headings together with no sentence-ending punctuation, so a 200-character lead showed a page's nav
 * menu and pushed the offending clause off the end. A failure that does not show the sentence it is
 * objecting to cannot be acted on.
 */
function excerpt(sentence: string): string {
  const at = sentence.toLowerCase().indexOf("bitwise");
  if (at < 0) return sentence.slice(0, 160);
  const from = Math.max(0, at - 70);
  const to = Math.min(sentence.length, at + 90);
  return `${from > 0 ? "..." : ""}${sentence.slice(from, to)}${to < sentence.length ? "..." : ""}`;
}

function carriesNegation(sentence: string): boolean {
  const at = sentence.toLowerCase().indexOf("bitwise");
  if (at < 0) return false;
  const from = Math.max(0, at - NEGATION_WINDOW);
  const to = Math.min(sentence.length, at + "bitwise".length + NEGATION_WINDOW);
  return NEGATION.test(sentence.slice(from, to));
}

describe("no reader is promised bitwise identity (am-rt-determinism-fallbacks-8i4)", () => {
  const built = existsSync(OUT) ? htmlFiles(OUT) : [];

  test("the built site is present, so a clean result is not an empty one", () => {
    // 0 pages reads exactly like 0 overclaims. The node lane refuses a stale out/ for the same
    // reason; here the denominator is simply asserted.
    expect(built.length).toBeGreaterThan(300);
  });

  test("every reader-visible mention of bitwise denies the claim rather than making it", () => {
    const sentences = bitwiseSentences(built);
    const bare = sentences.filter((s) => !carriesNegation(s.sentence));
    console.log(
      `[determinism-claims] ${built.length} built pages scanned; ` +
        `${sentences.length} reader-visible sentence(s) mention bitwise; ` +
        `${sentences.length - bare.length} deny the claim, ${bare.length} assert it`,
    );
    for (const s of bare) {
      console.log(`[determinism-claims] BARE CLAIM ${s.file}: ${excerpt(s.sentence)}`);
    }
    // Non-vacuity: with no sentence at all the filter is empty and this passes while asserting
    // nothing, which is also what deleting every disclaimer looks like. The surface floor below is
    // the specific guard; this is the general one.
    expect(sentences.length).toBeGreaterThan(0);
    expect(bare.map((s) => `${s.file}: ${excerpt(s.sentence)}`)).toEqual([]);
  });

  test("each surface that disclaims bitwise identity still does", () => {
    const missing: string[] = [];
    for (const surface of DISCLAIMER_SURFACES) {
      const file = join(OUT, surface);
      if (!existsSync(file)) {
        missing.push(`${surface} (page absent)`);
        continue;
      }
      const text = visibleText(file);
      if (!/bitwise/i.test(text)) missing.push(`${surface} (no bitwise disclaimer)`);
    }
    console.log(
      `[determinism-claims] ${DISCLAIMER_SURFACES.length - missing.length} of ` +
        `${DISCLAIMER_SURFACES.length} disclaimer surfaces carry their sentence`,
    );
    expect(missing).toEqual([]);
  });

  test("the negation window reads on the word, proved in both directions", () => {
    // A gate's own predicate, checked against the three authored shapes and against the overclaim
    // each of them exists to prevent. Without this, a predicate that returned true always would
    // leave the ceiling above green on any corpus.
    const honest = [
      "Gaussian conversion uses this host's math functions and is not claimed bitwise identical across browser engines.",
      "cross-engine bitwise parity and FrankenSim WASM conformance are not claimed.",
      "These checks establish reuse within this identified calculation, not bitwise agreement between different computers.",
    ];
    const overclaims = [
      "Results are bitwise identical across all browsers and architectures.",
      "Every engine reproduces these numbers bitwise.",
      "The walk is bitwise reproducible on any computer.",
    ];
    expect(honest.filter((s) => !carriesNegation(s))).toEqual([]);
    expect(overclaims.filter((s) => carriesNegation(s))).toEqual([]);
  });
});
