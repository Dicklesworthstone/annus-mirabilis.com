import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { extractStringsFromTsx } from "./componentText.ts";
import { checkVoice } from "./index.ts";

describe("componentText: TSX String & Attribute Extraction", () => {
  it("extracts JSX text nodes and accessible-name attributes with exact line and column", () => {
    const tsxCode = `
import React from "react";

export function ReaderControl() {
  return (
    <div className="flex">
      <button aria-label="Unlock the derivation" title="Pivotal control">
        It is easy to see
      </button>
      <img src="/img.png" alt="A pivotal diagram" />
    </div>
  );
}
`;

    const extracted = extractStringsFromTsx("src/components/ReaderControl.tsx", tsxCode);
    assert.ok(extracted.length >= 4);

    // Check JSX text "It is easy to see"
    const textNode = extracted.find((e) => e.text === "It is easy to see");
    assert.ok(textNode, "Must extract JSX text node");
    assert.equal(textNode?.file, "src/components/ReaderControl.tsx");
    assert.equal(textNode?.line, 8);
    assert.ok(textNode?.column > 0);

    // Check aria-label
    const ariaLabel = extracted.find((e) => e.attributeName === "aria-label");
    assert.ok(ariaLabel, "Must extract aria-label");
    assert.equal(ariaLabel?.text, "Unlock the derivation");
    assert.equal(ariaLabel?.context, "ui-label");
    assert.equal(ariaLabel?.line, 7);

    // Check title
    const titleAttr = extracted.find((e) => e.attributeName === "title");
    assert.ok(titleAttr, "Must extract title");
    assert.equal(titleAttr?.text, "Pivotal control");
    assert.equal(titleAttr?.context, "ui-label");

    // Check alt
    const altAttr = extracted.find((e) => e.attributeName === "alt");
    assert.ok(altAttr, "Must extract alt");
    assert.equal(altAttr?.text, "A pivotal diagram");
    assert.equal(altAttr?.context, "ui-label");
  });

  it("fails when scanned through checkVoice with file, line, and column", () => {
    const tsxCode = `
export function BadComponent() {
  return <span>It is easy to see</span>;
}
`;
    const extracted = extractStringsFromTsx("src/components/BadComponent.tsx", tsxCode);
    assert.equal(extracted.length, 1);

    const item = extracted[0];
    assert.ok(item, "Must extract at least one item");
    const findings = checkVoice(item.text, { context: item.context });
    assert.equal(findings.length, 1);
    assert.equal(findings[0]?.rule, "condescension");
    assert.equal(findings[0]?.severity, "error");
    assert.equal(item.file, "src/components/BadComponent.tsx");
    assert.equal(item.line, 3);
  });

  // am-dbpk: the extractor used to emit one string per JSX text node, so a sentence broken by an
  // inline element reached the rules as fragments no reader ever sees. The markup in the first
  // test is copied from src/reader/entrances/MassEnergyFirstEncounter.tsx:68-71, which is where
  // the defect was measured: it was one of the seven voice-lint errors at d4e9d096.
  it("am-dbpk: a sentence split by an inline element is scanned whole, not as fragments", () => {
    const tsxCode = `
export function MassEnergyFirstEncounter() {
  return (
    <li>
      Without the unchanged-offset premise, the change in energy of motion is{" "}
      <strong>underdetermined</strong>. The algebraic difference above is still known; an
      unknown change in the offset could contribute to it.
    </li>
  );
}
`;
    const extracted = extractStringsFromTsx("src/reader/entrances/X.tsx", tsxCode);
    const prose = extracted.filter((e) => e.context === "prose");
    assert.equal(prose.length, 1, "the <li> is one sentence, not three fragments");
    assert.equal(
      prose[0]?.text,
      "Without the unchanged-offset premise, the change in energy of motion is underdetermined. " +
        "The algebraic difference above is still known; an unknown change in the offset could " +
        "contribute to it.",
    );

    // The word is now judged in its sentence. status-enum-leak reports it, but at the severity
    // singleWordProseSeverity exists for: an ordinary English word in prose, not a leaked
    // identifier. Before the reassembly the bare fragment "underdetermined" satisfied
    // isSingleWordStandalone and this was an ERROR.
    const sentence = prose[0];
    assert.ok(sentence);
    const leak = checkVoice(sentence.text, { context: sentence.context }).filter(
      (f) => f.rule === "status-enum-leak",
    );
    assert.equal(leak.length, 1);
    assert.equal(leak[0]?.severity, "flag");
  });

  it("am-dbpk planted negative: a genuinely standalone status token still errors", () => {
    // Without this the fix would be indistinguishable from blinding isSingleWordStandalone.
    // Here there is no sentence: the identifier IS the visitor-facing string, which is the leak
    // the rule exists to catch.
    const tsxCode = `
export function StatusChip() {
  return <span className="chip">underdetermined</span>;
}
`;
    const extracted = extractStringsFromTsx("src/components/StatusChip.tsx", tsxCode);
    const prose = extracted.filter((e) => e.context === "prose");
    assert.equal(prose.length, 1);
    const token = prose[0];
    assert.ok(token);
    assert.equal(token.text, "underdetermined");
    const leak = checkVoice(token.text, { context: token.context }).filter(
      (f) => f.rule === "status-enum-leak",
    );
    assert.equal(leak.length, 1);
    assert.equal(leak[0]?.severity, "error", "a bare status token is still an error");
  });

  it("am-dbpk planted negative: reassembly loses no finding, and reports each one once", () => {
    // An em dash on one side of an inline element and a condescension phrase on the other. Both
    // must still be found, and neither may be reported twice now that the inline child's words
    // also appear inside the parent's string.
    const tsxCode = `
export function Split() {
  return (
    <p>
      It is easy to see \u2014 as <strong>every reader</strong> will notice at once.
    </p>
  );
}
`;
    const extracted = extractStringsFromTsx("src/components/Split.tsx", tsxCode);
    const prose = extracted.filter((e) => e.context === "prose");
    assert.equal(prose.length, 1, "one <p> is one string; the <strong> is not emitted again");
    const split = prose[0];
    assert.ok(split);
    assert.ok(split.text.includes("every reader"), "the inline child's words are in the sentence");
    const findings = checkVoice(split.text, { context: split.context });
    assert.equal(findings.filter((f) => f.rule === "em-dash").length, 1);
    assert.equal(findings.filter((f) => f.rule === "condescension").length, 1);
  });

  it("am-dbpk: a block child is a boundary, so two paragraphs stay two sentences", () => {
    const tsxCode = `
export function TwoParagraphs() {
  return (
    <div>
      <p>The first claim stands alone.</p>
      <p>The second claim stands alone.</p>
    </div>
  );
}
`;
    const extracted = extractStringsFromTsx("src/components/TwoParagraphs.tsx", tsxCode);
    const prose = extracted.filter((e) => e.context === "prose");
    assert.deepEqual(
      prose.map((e) => e.text).sort(),
      ["The first claim stands alone.", "The second claim stands alone."],
      "reassembly must not fuse sentences a reader sees apart",
    );
  });

  it("am-dbpk: a quotation element inside a paragraph keeps its own layer", () => {
    // <q> is inline in HTML but is deliberately NOT in INLINE_TAGS: folding it into the parent
    // would drop the layer that exempts overclaim, and the quotation would be linted as the
    // site's own prose.
    const tsxCode = `
export function Quoted() {
  return (
    <p>
      Perrin summarised the result: <q>Einstein proved the molecular hypothesis.</q>
    </p>
  );
}
`;
    const extracted = extractStringsFromTsx("src/components/Quoted.tsx", tsxCode);
    const quoted = extracted.find((e) => e.text.includes("Einstein proved"));
    assert.ok(quoted, "the quotation is its own string");
    assert.equal(quoted.source?.layer, "quotation");
    assert.equal(
      checkVoice(quoted.text, { context: quoted.context, source: quoted.source }).filter(
        (f) => f.rule === "overclaim",
      ).length,
      0,
      "the quotation exemption survives reassembly",
    );
  });

  it("attaches quotation source layer to strings inside blockquote or q elements", () => {
    const tsxCode = `
export function QuoteComponent() {
  return (
    <blockquote>
      Einstein proved the light quantum here.
    </blockquote>
  );
}
`;
    const extracted = extractStringsFromTsx("src/components/QuoteComponent.tsx", tsxCode);
    assert.equal(extracted.length, 1);
    const item = extracted[0]!;
    assert.equal(item.source?.layer, "quotation");

    // Scanned through checkVoice with quotation layer, overclaim "proved" is exempt
    const findings = checkVoice(item.text, { context: item.context, source: item.source });
    const overclaimFindings = findings.filter((f) => f.rule === "overclaim");
    assert.equal(overclaimFindings.length, 0, "Quotation layer must exempt overclaim");
  });

  /**
   * Module-level route metadata (am-edit-voice-lint-trmf).
   *
   * These two arms are written from a plant that was run against the real tree rather than
   * imagined. Before this extraction existed, the identical slopped string in three positions
   * gave: JSX text 2 errors, `export const alt` 0, `export const metadata` 0. The gap had
   * already shipped a live defect - layout.tsx's default <title> carried an em dash on every
   * route of the deployed site and was found by a person, not by this gate.
   *
   * Both arms are here because an extractor that REACHES a declaration but never evaluates it
   * looks exactly like one that works. The first arm proves the words arrive at checkVoice; the
   * second proves a clean constant does not manufacture a finding on the way.
   */
  const METADATA_TSX = `
import type { Metadata } from "next";

export const alt = "SLOPPED_ALT";

export const metadata: Metadata = {
  metadataBase: new URL("https://annus-mirabilis.com"),
  title: { default: "SLOPPED_TITLE", template: "%s \u00b7 Annus Mirabilis" },
  description: "SLOPPED_DESCRIPTION",
  alternates: { canonical: "https://annus-mirabilis.com/" },
  other: { "route-theme": "kramgasse-night" },
};
`;

  function metadataStrings(alt: string, title: string, description: string) {
    const code = METADATA_TSX.replace("SLOPPED_ALT", alt)
      .replace("SLOPPED_TITLE", title)
      .replace("SLOPPED_DESCRIPTION", description);
    return extractStringsFromTsx("src/app/layout.tsx", code);
  }

  /**
   * The bare-string title form, which is 53 of the 54 titles in this tree; the nested
   * `title: { default }` above is the remaining 1, in src/app/layout.tsx. The two forms are
   * separate branches of visitMetadataObject, and a fixture that exercised only the rarer one
   * would leave the common one untested - which is how the first plant against these arms came
   * back green and told me so.
   */
  const PAGE_METADATA_TSX = `
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "SLOPPED_TITLE",
  description: "SLOPPED_DESCRIPTION",
};
`;

  function pageMetadataStrings(title: string, description: string) {
    const code = PAGE_METADATA_TSX.replace("SLOPPED_TITLE", title).replace(
      "SLOPPED_DESCRIPTION",
      description,
    );
    return extractStringsFromTsx("src/app/lab/lq-05/page.tsx", code);
  }

  it("the bare-string title form is extracted and evaluated, not only the nested one", () => {
    const extracted = pageMetadataStrings(
      "LQ-05 \u2014 a pivotal laboratory",
      "A clean description of the laboratory.",
    );
    const title = extracted.find((e) => e.attributeName === "title");
    assert.ok(title, "must extract a bare-string metadata title");
    assert.equal(title?.context, "ui-label");
    assert.ok(
      checkVoice(title?.text ?? "", { context: "ui-label" }).some((f) => f.rule === "em-dash"),
      "a bare-string title must be EVALUATED",
    );

    // Not "independent configurations": that phrase fires independence-claim at info severity,
    // which is the rule doing its job and would make this arm assert the wrong thing.
    const clean = pageMetadataStrings("LQ-05: counting arrangements", "A clean description.");
    for (const item of clean) {
      assert.deepEqual(
        checkVoice(item.text, { context: item.context }).map((f) => f.rule),
        [],
      );
    }
  });

  it("a slopped metadata constant reaches checkVoice and goes red", () => {
    const extracted = metadataStrings(
      "Annus Mirabilis \u2014 a pivotal tapestry",
      "Annus Mirabilis \u2014 four papers",
      "A pivotal edition that will unlock the 1905 papers.",
    );

    for (const field of ["alt", "title.default", "description"]) {
      const item = extracted.find((e) => e.attributeName === field);
      assert.ok(item, `must extract ${field}`);
      assert.equal(item?.context, "ui-label", `${field} carries the same context as its JSX twin`);
      const rules = checkVoice(item.text, {
        context: item.context,
        ...(item.source ? { source: item.source } : {}),
      }).map((f) => f.rule);
      assert.ok(rules.length > 0, `${field} must be EVALUATED, not merely extracted`);
    }

    const altItem = extracted.find((e) => e.attributeName === "alt");
    const titleItem = extracted.find((e) => e.attributeName === "title.default");
    const descriptionItem = extracted.find((e) => e.attributeName === "description");
    assert.ok(
      checkVoice(altItem?.text ?? "", { context: "ui-label" }).some((f) => f.rule === "em-dash"),
    );
    assert.ok(
      checkVoice(titleItem?.text ?? "", { context: "ui-label" }).some((f) => f.rule === "em-dash"),
    );
    assert.ok(
      checkVoice(descriptionItem?.text ?? "", { context: "ui-label" }).some(
        (f) => f.rule === "hype-word",
      ),
    );
  });

  it("a clean metadata constant stays silent, and the non-prose fields are never scanned", () => {
    const extracted = metadataStrings(
      "Annus Mirabilis: a critical edition of Einstein's four papers of 1905",
      "Annus Mirabilis: four papers, one year",
      "The German, a translation, and instruments for the four 1905 papers.",
    );

    for (const item of extracted) {
      const options = {
        context: item.context,
        ...(item.source ? { source: item.source } : {}),
      };
      assert.deepEqual(
        checkVoice(item.text, options).map((f) => f.rule),
        [],
        `clean constant ${item.attributeName} must produce no finding, got text ${item.text}`,
      );
    }

    // The allowlist is of WHOLE PATHS. A canonical URL, a route-theme token and the "%s" title
    // template are not sentences, and scanning them would report findings against machinery.
    const scanned = extracted.map((e) => e.attributeName);
    assert.deepEqual(scanned.sort(), ["alt", "description", "title.default"]);
  });

  it("a Title Cased page title is not a heading, so the title-case rule leaves it alone", () => {
    // 54 page titles in this tree are Title Case. A <title> is a browser tab and a search
    // result, where Title Case is ordinary typography, so `source.element` is deliberately not
    // set for metadata and the heading backlog does not swallow the whole app.
    const extracted = metadataStrings(
      "Annus Mirabilis",
      "LQ-05: Independent Configurations and Boltzmann Entropy",
      "A clean description.",
    );
    const title = extracted.find((e) => e.attributeName === "title.default");
    assert.ok(title);
    assert.equal(title?.source, undefined, "metadata carries no heading marker");
    // `source` is omitted rather than passed as undefined: exactOptionalPropertyTypes is on, and
    // the assertion above is what establishes that metadata carries no source at all.
    const rules = checkVoice(title?.text ?? "", { context: "ui-label" }).map((f) => f.rule);
    assert.ok(!rules.includes("title-case-heading"), "a page title is not a heading");
    // This exact title is in the tree, and widening the extractor moved the repository run from
    // Info 549 to Info 551 for it and one other: `independence-claim` is an info-severity prompt
    // for a human, firing here on "Independent Configurations", which is the name of Einstein's
    // counting argument. Recorded rather than tuned away, so the +2 is not mistaken for noise.
    assert.deepEqual(rules, ["independence-claim"]);
  });
});
