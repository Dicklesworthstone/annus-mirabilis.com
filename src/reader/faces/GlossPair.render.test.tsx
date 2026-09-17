import { describe, expect, test } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { GlossToken, MultiwordUnit } from "../../content/schemas/source.ts";
import { GlossPair } from "./GlossPair.tsx";

describe("GlossPair component rendering", () => {
  const modalityClasses = ["konjunktiv-i", "konjunktiv-ii", "condition", "consequence"];

  test("renders single token with german, english gloss, and correct lang attributes", () => {
    const token: GlossToken = { german: "Energie", english: "energy" };
    const html = renderToStaticMarkup(
      <GlossPair token={token} tokenIndex={0} showReasoningWords={false} />,
    );

    expect(html).toContain('lang="de"');
    expect(html).toContain("Energie");
    expect(html).toContain('lang="en"');
    expect(html).toContain("energy");
    expect(html).not.toContain("data-reasoning-word");
  });

  test("renders math token in KaTeX printed notation", () => {
    const token: GlossToken = {
      german: "$L/V^2$",
      english: "$L/V^2$",
      noteClass: "formula-phrase",
    };
    const html = renderToStaticMarkup(
      <GlossPair token={token} tokenIndex={1} showReasoningWords={false} />,
    );

    expect(html).toContain("katex");
    expect(html).toContain("inline-math");
  });

  test("renders grammar cue marker when grammarNote is present", () => {
    const token: GlossToken = {
      german: "abgeleitet",
      english: "derived",
      grammarNote: "Participle in passive periphrastic",
      noteClass: "formula-phrase",
    };
    const html = renderToStaticMarkup(
      <GlossPair token={token} tokenIndex={2} showReasoningWords={false} />,
    );

    expect(html).toContain("gloss-grammar-cue");
    expect(html).toContain('data-note-class="formula-phrase"');
    expect(html).toContain("Participle in passive periphrastic");
  });

  test("token carrying konjunktiv-i is marked when toggle is on and unmarked when off", () => {
    const token: GlossToken = {
      german: "sei",
      english: "be",
      grammarNote: "3rd person singular present subjunctive I",
      noteClass: "konjunktiv-i",
    };

    // Toggle OFF
    const htmlOff = renderToStaticMarkup(
      <GlossPair
        token={token}
        tokenIndex={0}
        showReasoningWords={false}
        modalityClasses={modalityClasses}
      />,
    );
    expect(htmlOff).not.toContain('data-reasoning-word="true"');
    expect(htmlOff).not.toContain("[supposition]");

    // Toggle ON
    const htmlOn = renderToStaticMarkup(
      <GlossPair
        token={token}
        tokenIndex={0}
        showReasoningWords={true}
        modalityClasses={modalityClasses}
      />,
    );
    expect(htmlOn).toContain('data-reasoning-word="true"');
    expect(htmlOn).toContain('data-modality-class="konjunktiv-i"');
    expect(htmlOn).toContain("[supposition]");
    expect(htmlOn).toContain("reasoning-marked-text");
  });

  test("token carrying compound is NEVER marked as reasoning word even with toggle on", () => {
    const token: GlossToken = {
      german: "Energieinhalt",
      english: "energy content",
      grammarNote: "Noun compound Energie + Inhalt",
      noteClass: "compound",
    };

    const html = renderToStaticMarkup(
      <GlossPair
        token={token}
        tokenIndex={0}
        showReasoningWords={true}
        modalityClasses={modalityClasses}
      />,
    );

    expect(html).not.toContain('data-reasoning-word="true"');
    expect(html).not.toContain("reasoning-marked-text");
  });

  test("multiword unit with non-contiguous indices (separated prefix verb) displays gloss and cues", () => {
    const mw: MultiwordUnit = {
      tokenIndices: [0, 10],
      english: "emits",
      kind: "separable-verb",
      grammarNote: "Separated verb construction gibt...ab",
      noteClass: "separable-verb",
    };

    const firstToken: GlossToken = { german: "Gibt", english: "Gives" };
    const secondToken: GlossToken = { german: "ab,", english: "off," };

    const htmlFirst = renderToStaticMarkup(
      <GlossPair
        token={firstToken}
        tokenIndex={0}
        multiwordUnit={mw}
        isMultiwordFirst={true}
        showReasoningWords={false}
      />,
    );

    const htmlSecond = renderToStaticMarkup(
      <GlossPair
        token={secondToken}
        tokenIndex={10}
        multiwordUnit={mw}
        isMultiwordFirst={false}
        showReasoningWords={false}
      />,
    );

    expect(htmlFirst).toContain("emits");
    expect(htmlFirst).toContain("is-multiword");
    expect(htmlSecond).toContain("is-multiword");
  });

  test("multiword unit with condition noteClass marks tokens with shared visible premise cue", () => {
    const mw: MultiwordUnit = {
      tokenIndices: [0, 1],
      english: "provided that",
      kind: "fixed-phrase",
      grammarNote: "Premise condition clause",
      noteClass: "condition",
    };

    const tok0: GlossToken = { german: "vorausgesetzt", english: "provided" };
    const tok1: GlossToken = { german: "daß", english: "that" };

    const html0 = renderToStaticMarkup(
      <GlossPair
        token={tok0}
        tokenIndex={0}
        multiwordUnit={mw}
        isMultiwordFirst={true}
        showReasoningWords={true}
        modalityClasses={modalityClasses}
      />,
    );

    const html1 = renderToStaticMarkup(
      <GlossPair
        token={tok1}
        tokenIndex={1}
        multiwordUnit={mw}
        isMultiwordFirst={false}
        showReasoningWords={true}
        modalityClasses={modalityClasses}
      />,
    );

    expect(html0).toContain('data-reasoning-word="true"');
    expect(html0).toContain("[premise]");
    expect(html1).toContain('data-reasoning-word="true"');
    expect(html1).toContain("[premise]");
  });
});
