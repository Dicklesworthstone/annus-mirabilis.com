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
});
