/**
 * THE FIVE STATIC-HTML SCANS, EACH PROVED IN BOTH DIRECTIONS.
 *
 * Every scan here is a detector, and a detector that cannot fire looks exactly like a page with
 * nothing wrong on it. So each scan gets a plant that must be caught and, where the scan removes
 * part of the page before looking, a control in the removed part that must NOT be caught. The
 * second half is the one that matters: `readerVisibleText` removes five things, and a stripper
 * that removed everything would report a clean site for ever.
 *
 * This file is the fixture half, in the bun lane, which needs no build. The corpus half needs
 * `out/` and lives with the pipeline stage, because a gate's only proof must not sit inside the
 * lane that gate controls.
 */

import { describe, expect, test } from "bun:test";
import { pageMarkerLine } from "../ledger/ledgerTokenizer.ts";
import {
  anchorResolves,
  declaredIds,
  germanTextTags,
  readerVisibleText,
  scanContentLanguage,
  scanFaceHtml,
  scanLedgerFurniture,
  scanRawLatex,
  scanRetiredReviewBanners,
} from "./staticHtmlScan.ts";

/** A minimal face, so each plant below is the only unusual thing on the page. */
function face(body: string, options: { lang?: string } = {}): string {
  const lang = options.lang ?? "en";
  return `<!DOCTYPE html><html lang="${lang}"><head><title>t</title></head><body>${body}</body></html>`;
}

describe("readerVisibleText removes exactly the parts a reader does not read", () => {
  test("it removes script, style, annotation, pre and code bodies, and attribute values", () => {
    const html = face(
      [
        '<script>self.__next_f.push([1,"\\\\frac{a}{b}"])</script>',
        "<style>.x{content:'\\\\sqrt'}</style>",
        '<math><semantics><annotation encoding="application/x-tex">\\frac{1}{2}</annotation></semantics></math>',
        '<div class="formula" data-latex="\\frac{\\partial p}{\\partial t}">rendered</div>',
        // A literal placeholder is the point: the show-the-code listings print kernel source.
        // biome-ignore lint/suspicious/noTemplateCurlyInString: fixture content, not interpolation.
        "<pre><code>const s = `${nuMax} Hz`;</code></pre>",
        "<p>Einstein writes of the pressure on a mirror at rest.</p>",
      ].join(""),
    );
    const visible = readerVisibleText(html);
    expect(visible).toContain("Einstein writes of the pressure");
    expect(visible).toContain("rendered");
    // biome-ignore lint/suspicious/noTemplateCurlyInString: the placeholder is the text being searched for.
    for (const removed of ["__next_f", "\\frac", "\\sqrt", "\\partial", "${nuMax}"]) {
      expect(visible, `${removed} should not survive`).not.toContain(removed);
    }
  });

  test("it does NOT remove everything, which is the control a stripper needs", () => {
    // A stripper that returned "" would make every scan below permanently green.
    const visible = readerVisibleText(face("<p>Zur Elektrodynamik bewegter Körper</p>"));
    expect(visible).toContain("Zur Elektrodynamik bewegter Körper");
    expect(visible.trim().length).toBeGreaterThan(20);
  });

  test("it decodes the entities React writes, so a match is not hidden behind &#x27;", () => {
    const visible = readerVisibleText(face("<p>the paper&#x27;s own steps</p>"));
    expect(visible).toContain("the paper's own steps");
  });
});

describe("scan 1: ledger furniture", () => {
  test("a page marker is caught in BOTH status forms, which is the defect this scan had", () => {
    // The stage's own regex was keyed on the word REVIEWED while all four shipping ledgers are
    // machine drafts, so the form it could actually meet was the one it could not match.
    for (const status of ["reviewed", "machine-draft"] as const) {
      const marker = pageMarkerLine(status, 7, 31);
      const findings = scanLedgerFurniture(readerVisibleText(face(`<p>${marker}</p>`)));
      const codes = findings.map((f) => f.code);
      expect(codes, `${status} marker should be caught`).toContain(
        "static-html-ledger-page-marker",
      );
    }
  });

  test("a status word nobody has invented yet is still caught", () => {
    const findings = scanLedgerFurniture(
      readerVisibleText(face("<p>--- PROOFREAD TRANSCRIPTION PAGE 3 OF 31 ---</p>")),
    );
    expect(findings.map((f) => f.code)).toContain("static-html-ledger-page-marker");
  });

  test("a running head and a page number are caught as such, by the ledger's own tag names", () => {
    const head = scanLedgerFurniture(
      readerVisibleText(face("<p>[[RUNNING-HEAD]]A. Einstein.</p>")),
    );
    expect(head.map((f) => f.code)).toContain("static-html-running-head");
    const page = scanLedgerFurniture(readerVisibleText(face("<p>[[PAGE-NUMBER]]893</p>")));
    expect(page.map((f) => f.code)).toContain("static-html-running-head");
  });

  test("any other ledger tag is caught, and a bracketed word that is not a ledger tag is not", () => {
    const sperr = scanLedgerFurniture(
      readerVisibleText(face("<p>die Elektrodynamik [[SPERR]]Maxwell[[/SPERR]]s</p>")),
    );
    expect(sperr.map((f) => f.code)).toContain("static-html-ledger-tag");
    // Editorial prose may legitimately bracket a word. Only the ledger's vocabulary is furniture.
    const prose = scanLedgerFurniture(
      readerVisibleText(face("<p>a conjecture [[Poincaré]] had also reached</p>")),
    );
    expect(prose).toEqual([]);
  });

  test("the printed author line is not mistaken for a running head", () => {
    // "von A. Einstein." is the masthead of every paper. The untagged running head is the same
    // words, which is why this scan answers only the tagged half and says so in its comment.
    const findings = scanLedgerFurniture(
      readerVisibleText(
        face('<header class="source-masthead" lang="de">von A. Einstein.</header>'),
      ),
    );
    expect(findings).toEqual([]);
  });

  test("a clean face reports nothing, so the scan is not reporting unconditionally", () => {
    expect(
      scanLedgerFurniture(readerVisibleText(face("<p>Es sei ein Koordinatensystem</p>"))),
    ).toEqual([]);
  });
});

describe("scan 2: raw LaTeX in reader text", () => {
  test("the real defect is caught, quoted from the record that shipped it", () => {
    // content/results/special-relativity.yaml, the mirror-pressure card's model line. It reached
    // two built pages as these characters, because the four meanings were the only strings on the
    // results card not passed through InlineMathText.
    const shipped =
      "Exact within the paper's electrodynamics, for a plane wave and an ideal mirror; " +
      "the \\(\\cos^2\\varphi\\) form is a first approximation";
    const findings = scanRawLatex(readerVisibleText(face(`<dd>${shipped}</dd>`)));
    expect(findings.length).toBeGreaterThan(0);
    expect(findings.map((f) => f.code)).toEqual(
      findings.map(() => "static-html-raw-latex" as const),
    );
    expect(findings.some((f) => (f.sample ?? "").includes("cos^2"))).toBe(true);
  });

  test("each of the three forms fires", () => {
    const cases = [
      "<p>the \\(x\\) axis</p>",
      "<p>the \\frac{1}{2} factor</p>",
      "<p>the $E = mc^2$ relation</p>",
      "<p>a display $$x = 1$$ inline</p>",
    ];
    for (const body of cases) {
      expect(scanRawLatex(readerVisibleText(face(body))).length, body).toBeGreaterThan(0);
    }
  });

  test("the same TeX inside an annotation, an attribute, or a code listing is NOT a finding", () => {
    // Three negative controls, one for each place TeX legitimately lives. Without them this scan
    // would report 75 pages of `data-latex` attributes and 9 pages of kernel source.
    const controls = [
      '<math><semantics><annotation encoding="application/x-tex">\\frac{1}{2}</annotation></semantics></math>',
      '<div class="formula" data-latex="\\frac{\\partial p_\\nu}{\\partial t}"><span>p</span></div>',
      // The JavaScript template literal a kernel listing prints as reader-visible text.
      // biome-ignore lint/suspicious/noTemplateCurlyInString: fixture content, not interpolation.
      "<pre><code>const label = `${value} eV`;</code></pre>",
      '<script>self.__next_f.push([1,"\\\\cos^2\\\\varphi"])</script>',
    ];
    for (const body of controls) {
      expect(scanRawLatex(readerVisibleText(face(body))), body.slice(0, 40)).toEqual([]);
    }
  });

  test("ordinary German and English prose is not a finding", () => {
    const body =
      "<p>Die Geschwindigkeit des Lichtes im leeren Raume, daß 0,001 mm, z. B. etwa 6 μm.</p>" +
      "<p>Doubling the viscosity halves the diffusivity, so the RMS displacement changes by 1/√2.</p>";
    expect(scanRawLatex(readerVisibleText(face(body)))).toEqual([]);
  });
});

describe("scan 3: German content declares its language", () => {
  const german = (body: string) => scanContentLanguage(face(body), "german");

  test("a German block with no lang is caught", () => {
    const findings = german(
      '<p id="s1-p1" data-block-id="s1-p1" data-kind="paragraph">Es liege</p>',
    );
    expect(findings.map((f) => f.code)).toContain("static-html-german-without-lang");
  });

  test("the same block with lang=de is not", () => {
    expect(
      german('<p id="s1-p1" data-block-id="s1-p1" data-kind="paragraph" lang="de">Es liege</p>'),
    ).toEqual([]);
  });

  test("a printed display is exempt, because a formula is not German prose", () => {
    // Tagging a formula lang="de" makes a screen reader read its symbols as German words. Keying
    // this scan on data-block-id alone reddened 98 correct relativity records for exactly this.
    expect(
      german('<span id="eq-s1-d1" data-block-id="eq-s1-d1" data-kind="equation">P</span>'),
    ).toEqual([]);
  });

  test("an English control that happens to carry a block id is exempt", () => {
    expect(
      german(
        '<button type="button" data-align-sentences-control="true" data-block-id="s1-p1" ' +
          'aria-label="Align sentences">Align</button>',
      ),
    ).toEqual([]);
  });

  test("the gloss face's German spans are in the population", () => {
    const tagged = '<span class="gloss-german " lang="de" dir="ltr">Körper</span>';
    const untagged = '<span class="gloss-german " dir="ltr">Körper</span>';
    expect(germanTextTags(face(tagged))).toHaveLength(1);
    expect(scanContentLanguage(face(tagged), "gloss")).toEqual([]);
    expect(scanContentLanguage(face(untagged), "gloss").map((f) => f.code)).toContain(
      "static-html-german-without-lang",
    );
  });

  test("a document with no language at all is caught", () => {
    const html = "<!DOCTYPE html><html><body><p>text</p></body></html>";
    expect(scanContentLanguage(html, "english").map((f) => f.code)).toContain(
      "static-html-document-language",
    );
  });

  test("the English face is not asked to tag English, because the document already declares it", () => {
    const body = '<h1 id="masthead-title" data-translation-unit-id="masthead-title">On the</h1>';
    expect(scanContentLanguage(face(body), "english")).toEqual([]);
  });
});

describe("scan 4: in-scope anchors resolve", () => {
  test("a data attribute does NOT make an anchor resolve", () => {
    // The anchored pattern is the whole point: `id="x"` as a substring also matches
    // `data-block-id="x"`, and the first measurement of anchor coverage made exactly that mistake.
    const html = face('<p data-block-id="s1-p1" data-sentence-id="s1-p1-s1">text</p>');
    expect(declaredIds(html).has("s1-p1")).toBe(false);
    expect(anchorResolves("s1-p1", declaredIds(html))).toBe(false);
  });

  test("a real id resolves", () => {
    const html = face('<p id="s1-p1">text</p>');
    expect(declaredIds(html).has("s1-p1")).toBe(true);
  });

  test("a split child satisfies its base id", () => {
    // s1-fn3 is one German footnote published as four English units. The English face declares
    // the children, and the base id is addressable through them.
    const ids = new Set(["s1-fn3a", "s1-fn3b", "s1-fn3c", "s1-fn3d"]);
    expect(anchorResolves("s1-fn3", ids)).toBe(true);
    expect(anchorResolves("s1-fn4", ids)).toBe(false);
  });

  test("a missing anchor is reported with the ids, not only a count", () => {
    const html = face('<p id="s1-p1">a</p><p id="s1-p2">b</p>');
    const result = scanFaceHtml({
      html,
      face: "german",
      expectedAnchors: ["s1-p1", "s1-p2", "s1-p3", "s2-p1"],
    });
    const finding = result.findings.find((f) => f.code === "static-html-anchor-missing");
    expect(finding).toBeDefined();
    expect(finding?.sample).toContain("s1-p3");
    expect(finding?.sample).toContain("s2-p1");
    expect(result.examined.anchorsExpected).toBe(4);
    expect(result.examined.anchorsResolved).toBe(2);
  });

  test("asserting no anchors says so, rather than passing", () => {
    const result = scanFaceHtml({ html: face('<p id="s1-p1">a</p>'), face: "german" });
    expect(result.findings).toEqual([]);
    expect(result.examined.anchorsExpected).toBe(0);
    expect(result.notes.join(" ")).toContain("proves nothing");
  });
});

describe("scan 5: the review banners the owner removed stay removed", () => {
  test("each retired notice is caught", () => {
    // D-2026-09-25-no-review-status-banners. Section G asks for a draft marker to be PRESENT;
    // this is the inverse, because that decision names "the German face's draft label" among
    // what it supersedes, and a gate written to section G's words would demand removed copy.
    for (const banner of [
      "Machine draft, not reviewed",
      "Translated and checked by AI agents",
      "Machine-drafted gloss, not yet reviewed",
      "No person has reviewed it",
    ]) {
      const findings = scanRetiredReviewBanners(readerVisibleText(face(`<p>${banner}.</p>`)));
      expect(
        findings.map((f) => f.code),
        banner,
      ).toContain("static-html-retired-review-banner");
    }
  });

  test("a notice about what is MISSING is not a review banner", () => {
    // The decision keeps these: they are navigation, not provenance.
    const kept = "<p>Not yet glossed: §§ 2 to 9.</p><p>Ideal model, host calculation.</p>";
    expect(scanRetiredReviewBanners(readerVisibleText(face(kept)))).toEqual([]);
  });
});

describe("scanFaceHtml reports what it examined", () => {
  test("the census counts the page, not the findings", () => {
    const html = face(
      '<p id="s1-p1" data-block-id="s1-p1" data-kind="paragraph" lang="de">Es liege ein ' +
        'Koordinatensystem</p><span id="s1-p1-s1">Es liege</span>',
    );
    const result = scanFaceHtml({ html, face: "german", expectedAnchors: ["s1-p1", "s1-p1-s1"] });
    expect(result.findings).toEqual([]);
    expect(result.examined.declaredIds).toBe(2);
    expect(result.examined.germanTextElements).toBe(1);
    expect(result.examined.anchorsResolved).toBe(2);
    expect(result.examined.bytes).toBeGreaterThan(result.examined.readerVisibleBytes);
  });

  test("a face carrying all five defects reports all five", () => {
    const html = face(
      [
        `<p>${pageMarkerLine("machine-draft", 1, 31)}</p>`,
        "<p>[[RUNNING-HEAD]]A. Einstein.</p>",
        "<dd>the \\(\\cos^2\\varphi\\) form</dd>",
        '<p id="s1-p1" data-block-id="s1-p1" data-kind="paragraph">Es liege</p>',
        "<p>Machine draft, not reviewed</p>",
      ].join(""),
    );
    const codes = new Set(
      scanFaceHtml({ html, face: "german", expectedAnchors: ["s1-p1", "s9-p9"] }).findings.map(
        (f) => f.code,
      ),
    );
    expect(codes.has("static-html-ledger-page-marker")).toBe(true);
    expect(codes.has("static-html-running-head")).toBe(true);
    expect(codes.has("static-html-raw-latex")).toBe(true);
    expect(codes.has("static-html-german-without-lang")).toBe(true);
    expect(codes.has("static-html-anchor-missing")).toBe(true);
    expect(codes.has("static-html-retired-review-banner")).toBe(true);
  });
});
