/**
 * A PARAGRAPH BROKEN BY A PAGE IS ONE PARAGRAPH ON THE GERMAN FACE (TanElk's ruling, 2026-09-24:
 * "the splitting code is ours... change only how our code cuts it into paragraphs").
 *
 * The ledger ends a page's text with `[[CONTINUES]]` when its last paragraph runs on to the next
 * page (validateLedger.ts), usually at the end of the last line: "…wobei $\varphi$ eine Funktion
 * der Variabeln $\varrho$ und $\nu$[[CONTINUES]]". segmentLedger recognises the marker only on a
 * line of its own, and even then a footnote at the foot of the page flushes the paragraph, so the
 * next page's first line started a paragraph of its own. On the German face the reader saw
 * "bedeutet. Es kann…" open a new paragraph mid-sentence: measured on the segmenter's output, 9
 * such breaks in light quanta, 5 in Brownian motion, 1 in mass-energy and 13 in special
 * relativity. This joins them.
 *
 * NO ID MOVES. The join runs after segmentation, so every paragraph keeps the id it has today.
 * The continuation's id is retired, never reused, and listed on the joined paragraph as
 * `joinedIds`, which is the manifests' own rule for a merge (mass-energy: "s0-p8, s0-p9 and
 * s0-p10 retired (merged into s0-p7); ids are never reused and survivors keep their numbers").
 * The face renders each retired id as an anchor where the page turned, so a link to it still
 * lands on its words.
 *
 * The joined text carries `[[JOINED]]` where the retired paragraph's words begin, one per joined
 * id and in the same order: the face puts each retired id's anchor there and the page map finds
 * its page from the words after it. The ledger's own `[[CONTINUES]]` is not reused for this,
 * because a paragraph can end in one that joins nothing (the next page opens with an equation).
 *
 * Only footnotes, and the continuation's own display equations (the segmenter emits a paragraph's
 * equations just before it), may stand between the two halves. A heading, a standalone equation
 * or a closing ends the chance to join, and the paragraph keeps its marker unjoined.
 */

import type { ProposedBlock, ProposedSentence } from "./segmentLedger.ts";
import {
  extractSentenceInlineMathIds,
  findDisplayMathRegions,
  proposeSentences,
} from "./segmentSentences.ts";

export const CONTINUES = "[[CONTINUES]]";
/** Where a retired paragraph's words begin inside the paragraph it was joined to. */
export const JOINED = "[[JOINED]]";

export type JoinedBlock = ProposedBlock & Readonly<{ joinedIds?: readonly string[] | undefined }>;

function sentencesFor(id: string, text: string): readonly ProposedSentence[] {
  return Object.freeze(
    proposeSentences(text).map((s, k) => {
      const sentenceId = `${id}-s${k + 1}`;
      const mathIds = extractSentenceInlineMathIds(s.text, sentenceId);
      return {
        id: sentenceId,
        text: s.text,
        ...(mathIds.length > 0 ? { inlineMathIds: mathIds } : {}),
      };
    }),
  );
}

/** The index of the paragraph that continues `blocks[at]`, or -1 when nothing may join it. */
function continuationOf(blocks: readonly ProposedBlock[], at: number): number {
  for (let i = at + 1; i < blocks.length; i++) {
    const block = blocks[i];
    if (!block || block.kind === "footnote") continue;
    if (block.kind === "paragraph") {
      const claimed = new Set(block.displayEquationIds ?? []);
      const between = blocks.slice(at + 1, i);
      return between.every((b) => b.kind === "footnote" || claimed.has(b.id)) ? i : -1;
    }
    if (block.kind === "equation") continue;
    return -1;
  }
  return -1;
}

export function joinPageContinuations(blocks: readonly ProposedBlock[]): readonly JoinedBlock[] {
  const out: JoinedBlock[] = [...blocks];
  for (let at = 0; at < out.length; at++) {
    let block = out[at];
    while (
      block?.kind === "paragraph" &&
      block.text.trimEnd().endsWith(CONTINUES) &&
      continuationOf(out, at) >= 0
    ) {
      const next = continuationOf(out, at);
      const continuation = out[next] as JoinedBlock;
      const head = block.text.trimEnd().slice(0, -CONTINUES.length);
      const text = `${head}${JOINED} ${continuation.text}`;
      const equations = [
        ...(block.displayEquationIds ?? []),
        ...(continuation.displayEquationIds ?? []),
      ];
      block = {
        ...block,
        text,
        sentences: sentencesFor(block.id, text),
        ...(equations.length > 0 ? { displayEquationIds: Object.freeze(equations) } : {}),
        joinedIds: Object.freeze([
          ...((block as JoinedBlock).joinedIds ?? []),
          continuation.id,
          ...(continuation.joinedIds ?? []),
        ]),
      };
      out[at] = block;
      out.splice(next, 1);
    }
  }
  return Object.freeze(out);
}

/**
 * TEXT AFTER A DISPLAY EQUATION, WHEN THE PRINT RUNS IT ON (TanElk's dispatch 119: "each printed
 * paragraph is one paragraph on the face").
 *
 * The ledger sets a blank line after every display equation, so the segmenter starts a paragraph
 * after each one. In print, text after a display either continues its paragraph, flush left
 * ("wobei $N$ die Anzahl…", "also…", "Man erkennt, daß diese Formel…"), or starts a new one,
 * indented. Only the plate shows which, and the ledger does not record the indent. The frozen
 * manifest does: its paragraph and display-equation ids stand in printed order, read from the
 * plates and boundary-audited (content/source-blocks/<paper>/manifest.yaml).
 *
 * The two are aligned section by section on their display equations. Between two consecutive
 * displays of a section the face and the manifest each start some number of paragraphs. Where
 * the face starts exactly one more, and its first paragraph there directly follows the display,
 * that paragraph is text the print runs on, and it is joined to the paragraph before. Nothing is
 * joined in a section whose displays the two count differently, or in any gap where they differ
 * otherwise, or at all when they have different numbers of sections; the face then keeps the
 * segmenter's paragraphs there. A standalone display between
 * the two halves moves into the joined paragraph, at its place, under its own id and label.
 *
 * Ids are kept as the page join keeps them: survivors keep theirs, the continuation's is retired
 * and anchored where its words begin.
 */
/**
 * A manifest unit, as much as the alignments need: a display names the unit that prints it, and
 * `page` is the first printed page its locators give (blockPages.ts storedDisplayPages).
 */
export type ManifestUnit = Readonly<{
  id: string;
  kind: string;
  containedIn?: string | undefined;
  section?: string | undefined;
  page?: number | undefined;
}>;

type Token = Readonly<{ kind: "P" | "E" | "H"; block?: number }>;

const HEADING_KINDS = new Set(["heading", "part-heading", "section-heading"]);
const EQUATION_KINDS = new Set(["equation", "display-equation"]);

function faceTokens(blocks: readonly JoinedBlock[]): Token[] {
  const claimed = new Set(blocks.flatMap((b) => b.displayEquationIds ?? []));
  const tokens: Token[] = [];
  blocks.forEach((block, index) => {
    if (HEADING_KINDS.has(block.kind)) tokens.push({ kind: "H" });
    else if (block.kind === "equation" && !claimed.has(block.id))
      tokens.push({ kind: "E", block: index });
    else if (block.kind === "paragraph") {
      tokens.push({ kind: "P", block: index });
      for (const _ of findDisplayMathRegions(block.text)) tokens.push({ kind: "E" });
    }
    // A footnote's displays are not counted: the alignment is on the body's displays, and the
    // manifest's footnote displays are left out the same way (manifestTokens).
  });
  return tokens;
}

function manifestTokens(units: readonly ManifestUnit[]): Token[] {
  // A display a footnote prints ("containedIn": "s5-fn1") is not one of the body's.
  const footnotes = new Set(units.filter((u) => u.kind === "footnote").map((u) => u.id));
  return units.flatMap((unit): Token[] =>
    unit.kind === "paragraph"
      ? [{ kind: "P" }]
      : EQUATION_KINDS.has(unit.kind)
        ? unit.containedIn !== undefined && footnotes.has(unit.containedIn)
          ? []
          : [{ kind: "E" }]
        : HEADING_KINDS.has(unit.kind)
          ? [{ kind: "H" }]
          : [],
  );
}

/**
 * Section by section (a heading starts one), the number of displays, and for each gap between
 * them (0 = before the first) the positions of its paragraph tokens. Gaps are keyed
 * "section:gap".
 */
function sectionsOf(tokens: readonly Token[]) {
  const displays: number[] = [0];
  const gaps = new Map<string, number[]>();
  tokens.forEach((token, at) => {
    const section = displays.length - 1;
    if (token.kind === "H") displays.push(0);
    else if (token.kind === "E") displays[section] = (displays[section] ?? 0) + 1;
    else {
      const key = `${section}:${displays[section] ?? 0}`;
      gaps.set(key, [...(gaps.get(key) ?? []), at]);
    }
  });
  return { displays, gaps };
}

export type DisplayJoinReport = Readonly<{
  /** False when the face and the manifest have different numbers of sections: nothing joined. */
  aligned: boolean;
  joined: readonly string[];
  /** Sections left as segmented because the two count their displays differently. */
  unalignedSections: readonly number[];
  /** Gaps where the two disagree in a way this does not resolve, as [gap, face, manifest]. */
  unresolved: readonly (readonly [string, number, number])[];
}>;

const ENDS_IN_DISPLAY = /\$\$(?:\s*\[\[EQ-LABEL\s+[^\]]+\]\])?\s*$/;

function displayMarkup(block: ProposedBlock): string {
  const label = block.label === undefined ? "" : ` [[EQ-LABEL ${block.label}]]`;
  return ` $$ ${block.text} $$${label}`;
}

export function joinAfterDisplays(
  blocks: readonly JoinedBlock[],
  manifest: readonly ManifestUnit[],
): Readonly<{ blocks: readonly JoinedBlock[]; report: DisplayJoinReport }> {
  const face = sectionsOf(faceTokens(blocks));
  const printed = sectionsOf(manifestTokens(manifest));
  const faceTokenList = faceTokens(blocks);
  if (face.displays.length !== printed.displays.length || manifest.length === 0)
    return {
      blocks,
      report: { aligned: false, joined: [], unalignedSections: [], unresolved: [] },
    };
  /*
    A section is aligned only when both count the same displays in it. Measured on light quanta,
    §5 and §6 did not while a footnote's displays on p. 142 stood in the body (foldFootnoteRuns),
    and aligning across them joined "Es ist bemerkenswert…", which the plate indents.
  */
  const unalignedSections = face.displays.flatMap((n, section) =>
    n === printed.displays[section] ? [] : [section],
  );
  const candidates = new Map<number, number>();
  const unresolved: (readonly [string, number, number])[] = [];
  for (const key of new Set([...face.gaps.keys(), ...printed.gaps.keys()])) {
    const [section, gap] = key.split(":").map(Number) as [number, number];
    if (unalignedSections.includes(section)) continue;
    const here = face.gaps.get(key) ?? [];
    const there = printed.gaps.get(key) ?? [];
    if (here.length === there.length) continue;
    const first = here[0];
    const block = first === undefined ? undefined : faceTokenList[first]?.block;
    if (
      gap > 0 &&
      here.length === there.length + 1 &&
      first !== undefined &&
      faceTokenList[first - 1]?.kind === "E" &&
      block !== undefined
    )
      candidates.set(block, section);
    else unresolved.push([key, here.length, there.length]);
  }
  /*
    A section with any gap left unresolved joins nothing. Its displays counted alike but stood in
    different places, so its gaps do not correspond: measured on light quanta §8, the alignment
    otherwise joined "Setzt man E = 9,6·10³…", which the plate (p. 146) indents.
  */
  const doubtful = new Set(unresolved.map(([key]) => Number(key.split(":")[0])));
  const continuations = new Set(
    [...candidates].flatMap(([block, section]) => (doubtful.has(section) ? [] : [block])),
  );

  const out: JoinedBlock[] = [];
  const joined: string[] = [];
  blocks.forEach((block, index) => {
    let previous = -1;
    if (continuations.has(index))
      for (let i = out.length - 1; i >= 0 && previous < 0; i--)
        if (out[i]?.kind === "paragraph") previous = i;
    const between = previous >= 0 ? out.slice(previous + 1) : [];
    if (previous < 0 || between.some((b) => HEADING_KINDS.has(b.kind))) {
      out.push(block);
      return;
    }
    const head = out[previous] as JoinedBlock;
    // The continuation's own displays stand just before it (the segmenter emits a paragraph's
    // displays first) and are already in its text; only a display nobody claims moves in.
    const claimed = new Set([...out, block].flatMap((b) => b.displayEquationIds ?? []));
    const moved = between.filter((b) => b.kind === "equation" && !claimed.has(b.id));
    // The text must run on from a display: the paragraph before ends at one, or one stands
    // between them. A paragraph whose last display is followed by more of its own words ("wobei
    // $E$ die Ladung… bedeutet.") is not what the print continues from.
    if (moved.length === 0 && !ENDS_IN_DISPLAY.test(head.text)) {
      out.push(block);
      return;
    }
    const text = `${head.text.trimEnd()}${moved.map(displayMarkup).join("")} ${JOINED} ${block.text}`;
    const equations = [
      ...(head.displayEquationIds ?? []),
      ...moved.map((b) => b.id),
      ...(block.displayEquationIds ?? []),
    ];
    out[previous] = {
      ...head,
      text,
      sentences: sentencesFor(head.id, text),
      ...(equations.length > 0 ? { displayEquationIds: Object.freeze(equations) } : {}),
      joinedIds: Object.freeze([...(head.joinedIds ?? []), block.id, ...(block.joinedIds ?? [])]),
    };
    joined.push(block.id);
  });
  return {
    blocks: Object.freeze(out),
    report: { aligned: true, joined, unalignedSections, unresolved },
  };
}

/**
 * A FOOTNOTE'S OWN DISPLAYS AND WORDS STAY IN THE FOOTNOTE.
 *
 * The ledger writes a footnote as its `[[FN n)]]` line and, when it runs on, the lines after it up
 * to the next blank line: displays and more text ("…Fouriersche Reihe $$ Z = … $$ wobei
 * $A_\nu \geq 0$ …"). segmentLedger keeps only the first line as the footnote and sets the rest
 * in the body, so on the German face a footnote's formulas and words stood between Einstein's
 * paragraphs. Measured on light quanta: two footnotes, p. 135 (§1) and p. 142, and the alignment
 * below then took one of those words for a run-on paragraph and joined it to the body.
 *
 * The blocks the segmenter made from those lines follow the footnote block, and each one's text
 * is found, in order, in the lines that follow its `[[FN` line. They are folded back into the
 * footnote. No id moves: a display keeps its id, now inside the footnote, and a paragraph's id is
 * retired and anchored where its words begin, as a join does.
 */
function footnoteRuns(ledgerText: string): string[] {
  const runs: string[] = [];
  const lines = ledgerText.split(/\n/);
  lines.forEach((line, at) => {
    if (!/^\[\[FN [^\]]+\]\]/.test(line.trim())) return;
    const run: string[] = [];
    for (let next = at + 1; next < lines.length; next++) {
      const text = (lines[next] ?? "").trim();
      if (text === "" || text.startsWith("[[FN") || text.startsWith("---")) break;
      run.push(text);
    }
    runs.push(run.join(" "));
  });
  return runs;
}

const squash = (text: string) => text.replace(/\s+/g, " ").trim();

export function foldFootnoteRuns(
  blocks: readonly JoinedBlock[],
  ledgerText: string,
): readonly JoinedBlock[] {
  const runs = footnoteRuns(ledgerText);
  // A paragraph's own displays come as blocks just before it and are already in its text.
  const inParagraph = new Set(
    blocks.flatMap((b) => (b.kind === "paragraph" ? (b.displayEquationIds ?? []) : [])),
  );
  const out: JoinedBlock[] = [];
  let footnote = -1;
  let run = "";
  let cursor = 0;
  let nth = 0;
  for (const block of blocks) {
    if (block.kind === "footnote") {
      out.push(block);
      footnote = out.length - 1;
      run = squash(runs[nth] ?? "");
      nth += 1;
      cursor = 0;
      continue;
    }
    if (footnote >= 0 && block.kind === "equation" && inParagraph.has(block.id)) {
      out.push(block);
      continue;
    }
    const at = run === "" ? -1 : run.indexOf(squash(block.text), cursor);
    if (footnote < 0 || at < 0 || (block.kind !== "paragraph" && block.kind !== "equation")) {
      out.push(block);
      footnote = -1;
      run = "";
      continue;
    }
    cursor = at + squash(block.text).length;
    const note = out[footnote] as JoinedBlock;
    if (block.kind === "equation") {
      // The display stays a block, under its id, claimed by the footnote that prints it.
      out.push(block);
      out[footnote] = {
        ...note,
        text: `${note.text}${displayMarkup(block)}`,
        displayEquationIds: Object.freeze([...(note.displayEquationIds ?? []), block.id]),
      };
    } else {
      const equations = [...(note.displayEquationIds ?? []), ...(block.displayEquationIds ?? [])];
      out[footnote] = {
        ...note,
        text: `${note.text} ${JOINED} ${block.text}`,
        ...(equations.length > 0 ? { displayEquationIds: Object.freeze(equations) } : {}),
        joinedIds: Object.freeze([...(note.joinedIds ?? []), block.id]),
      };
    }
  }
  return Object.freeze(out);
}
