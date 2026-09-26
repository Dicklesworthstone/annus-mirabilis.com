/**
 * Page turns (dispatch 247): where a source block's text crosses onto its next printed page. Each
 * refusal is exercised by the case that must trip it, and each case says which rule it breaks.
 */
import { describe, expect, test } from "bun:test";
import {
  PageTurnValidationError,
  spanPages,
  unbackedDisplaysOnlyTurns,
  validatePageTurns,
} from "./pageTurns.ts";
import { validateSourceBlock } from "./source.ts";
import { spanTextDigest } from "./spans.ts";

const TWO = [{ printedPage: 905 }, { printedPage: 906 }];
const THREE = [{ printedPage: 900 }, { printedPage: 901 }, { printedPage: 902 }];
// The page turns inside the second sentence, after "gilt".
const TEXT =
  "Gesucht ist die Bewegung. Das Gesetz gilt also nur in erster Annäherung. Es ist bemerkenswert.";

function refusal(raw: unknown, locators = TWO, text = TEXT): string {
  try {
    validatePageTurns(raw, locators, text);
  } catch (e) {
    if (e instanceof PageTurnValidationError) return e.code;
    throw e;
  }
  return "accepted";
}

describe("validatePageTurns", () => {
  test("a turn inside a sentence is found by its words, at a code-point offset", () => {
    const turns = validatePageTurns([{ printedPage: 906, startsWith: "also nur" }], TWO, TEXT);
    expect(turns).toEqual([
      { printedPage: 906, startsWith: "also nur", at: TEXT.indexOf("also nur") },
    ]);
  });

  test("the offset counts code points, as sentence spans do, not UTF-16 units", () => {
    const text = "Die Größe 𝑥 wächst. Dann folgt der Satz.";
    const [turn] = validatePageTurns([{ printedPage: 906, startsWith: "Dann folgt" }], TWO, text);
    // 𝑥 is two UTF-16 units and one code point.
    expect(turn?.at).toBe(text.indexOf("Dann folgt") - 1);
  });

  test("absent turns are allowed; a present list must be complete and in order", () => {
    expect(validatePageTurns(undefined, TWO, TEXT)).toEqual([]);
    const turns = validatePageTurns(
      [
        { printedPage: 901, startsWith: "Gesetz gilt" },
        { printedPage: 902, startsWith: "bemerkenswert." },
      ],
      THREE,
      TEXT,
    );
    expect(turns.map((t) => t.printedPage)).toEqual([901, 902]);
  });

  test("a page holding only the block's displays turns at the end of its text", () => {
    // s8-p7's shape: its text ends on p. 914, and only its displays stand on p. 915.
    expect(validatePageTurns([{ printedPage: 906, displaysOnly: true }], TWO, TEXT)).toEqual([
      { printedPage: 906, displaysOnly: true, at: Array.from(TEXT).length },
    ]);
    const after = validatePageTurns(
      [
        { printedPage: 901, startsWith: "Gesetz gilt" },
        { printedPage: 902, displaysOnly: true },
      ],
      THREE,
      TEXT,
    );
    expect(after.map((t) => t.at)).toEqual([TEXT.indexOf("Gesetz gilt"), Array.from(TEXT).length]);
  });

  test("each broken rule is refused with its own code", () => {
    const cases: [string, unknown, typeof TWO?, string?][] = [
      ["invalid-page-turns", { printedPage: 906, startsWith: "also" }],
      ["page-turns-mismatch-locators", []],
      ["page-turns-mismatch-locators", [{ printedPage: 906, startsWith: "also nur" }], THREE],
      ["invalid-page-turn", [null]],
      // The next locator is p. 906.
      ["page-turn-page-mismatch", [{ printedPage: 907, startsWith: "also nur" }]],
      // Locators 905 and 907: the text cannot turn across a missing page.
      [
        "page-turn-not-consecutive",
        [{ printedPage: 907, startsWith: "also nur" }],
        [{ printedPage: 905 }, { printedPage: 907 }],
      ],
      ["invalid-page-turn-words", [{ printedPage: 906, startsWith: " also nur" }]],
      ["invalid-page-turn-words", [{ printedPage: 906, startsWith: "" }]],
      ["page-turn-words-not-found", [{ printedPage: 906, startsWith: "also bloß" }]],
      // "ist" occurs twice: in "Gesucht ist" and "Es ist".
      ["page-turn-words-ambiguous", [{ printedPage: 906, startsWith: "ist" }]],
      ["page-turn-at-start", [{ printedPage: 906, startsWith: "Gesucht ist" }]],
      // "setz gilt" begins inside "Gesetz".
      ["page-turn-mid-word", [{ printedPage: 906, startsWith: "setz gilt" }]],
      [
        "page-turns-not-ordered",
        [
          { printedPage: 901, startsWith: "bemerkenswert." },
          { printedPage: 902, startsWith: "Gesetz gilt" },
        ],
        THREE,
      ],
      ["invalid-displays-only-turn", [{ printedPage: 906, displaysOnly: false }]],
      [
        "invalid-displays-only-turn",
        [{ printedPage: 906, displaysOnly: true, startsWith: "also nur" }],
      ],
      // The text ended on p. 901, so it cannot turn again onto p. 902.
      [
        "page-turn-after-displays-only",
        [
          { printedPage: 901, displaysOnly: true },
          { printedPage: 902, startsWith: "bemerkenswert." },
        ],
        THREE,
      ],
    ];
    const seen = cases.map(([, raw, locators, text]) => refusal(raw, locators, text));
    expect(seen).toEqual(cases.map(([code]) => code));
  });
});

describe("spanPages", () => {
  const turns = validatePageTurns([{ printedPage: 906, startsWith: "also nur" }], TWO, TEXT);
  const span = (sentence: string) => {
    const start = TEXT.indexOf(sentence);
    return { start, end: start + sentence.length };
  };

  test("a sentence before the turn, one across it, and one after it", () => {
    expect(spanPages(TWO, turns, span("Gesucht ist die Bewegung."))).toEqual({
      first: 905,
      last: 905,
    });
    expect(spanPages(TWO, turns, span("Das Gesetz gilt also nur in erster Annäherung."))).toEqual({
      first: 905,
      last: 906,
    });
    expect(spanPages(TWO, turns, span("Es ist bemerkenswert."))).toEqual({ first: 906, last: 906 });
  });

  test("no sentence reaches a page that holds only displays", () => {
    const displays = validatePageTurns([{ printedPage: 906, displaysOnly: true }], TWO, TEXT);
    expect(spanPages(TWO, displays, span("Es ist bemerkenswert."))).toEqual({
      first: 905,
      last: 905,
    });
  });

  test("without turns, every span of a multi-page block gets its first page, as before", () => {
    expect(spanPages(TWO, [], span("Es ist bemerkenswert."))).toEqual({ first: 905, last: 905 });
  });
});

describe("validateSourceBlock carries the turns", () => {
  const block = (pageTurns?: unknown) => ({
    id: "s5-p2",
    kind: "paragraph",
    paper: "special-relativity",
    order: 1,
    locators: [
      { pdfPageIndex: 15, printedPage: 905 },
      { pdfPageIndex: 16, printedPage: 906 },
    ],
    inlines: [{ kind: "text", text: TEXT }],
    sentenceSpans: [
      {
        id: "s5-p2-s1",
        span: { start: 0, end: 25, blockRevision: 1, textDigest: spanTextDigest(TEXT) },
      },
    ],
    revision: 1,
    status: {
      transcription: "draft",
      mathTranscription: "draft",
      translation: "draft",
      review: "draft",
    },
    ...(pageTurns === undefined ? {} : { pageTurns }),
  });

  test("valid turns come back with their offsets; a block without them has none", () => {
    expect(
      validateSourceBlock(block([{ printedPage: 906, startsWith: "also nur" }])).pageTurns,
    ).toEqual([{ printedPage: 906, startsWith: "also nur", at: TEXT.indexOf("also nur") }]);
    expect("pageTurns" in validateSourceBlock(block())).toBe(false);
  });

  test("an invalid turn refuses the block", () => {
    expect(() =>
      validateSourceBlock(block([{ printedPage: 906, startsWith: "Gesetz gilt nie" }])),
    ).toThrow(PageTurnValidationError);
  });
});

describe("unbackedDisplaysOnlyTurns", () => {
  const paragraph = {
    id: "s8-p7",
    locators: [{ printedPage: 914 }, { printedPage: 915 }],
    pageTurns: [{ printedPage: 915, displaysOnly: true }],
  };
  const display = (page: number, containedIn = "s8-p7") => ({
    id: `eq-${page}`,
    containedIn,
    locators: [{ printedPage: page }],
  });

  test("a display the block contains, printed on the page, backs the turn", () => {
    expect(unbackedDisplaysOnlyTurns([paragraph, display(914), display(915)])).toEqual([]);
  });

  test("no contained display on that page leaves it unbacked, and so does another block's display", () => {
    expect(unbackedDisplaysOnlyTurns([paragraph, display(914)])).toHaveLength(1);
    expect(unbackedDisplaysOnlyTurns([paragraph, display(915, "s8-p10")])).toHaveLength(1);
  });
});
