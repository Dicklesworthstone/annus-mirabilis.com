import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatToolLinkReference,
  normalizeReadingDetail,
  shouldPrintDerivationRoute,
  shouldPrintFoundationDrawer,
  shouldPrintMisconception,
  shouldPrintReading,
} from "./printPolicy.ts";

describe("printPolicy: normalizeReadingDetail", () => {
  it("normalizes numbers and string levels", () => {
    assert.equal(normalizeReadingDetail(0), 0);
    assert.equal(normalizeReadingDetail(1), 1);
    assert.equal(normalizeReadingDetail(2), 2);
    assert.equal(normalizeReadingDetail(3), 3);
    assert.equal(normalizeReadingDetail("R0"), 0);
    assert.equal(normalizeReadingDetail("r2"), 2);
    assert.equal(normalizeReadingDetail("3"), 3);
    assert.equal(normalizeReadingDetail("invalid"), 1);
  });
});

describe("printPolicy: Defaults and Carrier Overrides", () => {
  // Carrier 1: ReadingSet record
  it("Carrier 1: ReadingSet whose deeper reading detail default drops prints when essentialForPrint: true", () => {
    // Reader chose Detail R1
    const options = { detail: 1 as const };

    // Standard R2 record without essentialForPrint: false
    const standardR2Record = { id: "read-r2-item", essentialForPrint: false };
    assert.equal(shouldPrintReading("R2", options, standardR2Record), false);

    // Record with essentialForPrint: true
    const essentialR2Record = { id: "read-r2-essential", essentialForPrint: true };
    assert.equal(shouldPrintReading("R2", options, essentialR2Record), true);

    // Active detail R1 prints by default even without the flag
    assert.equal(shouldPrintReading("R1", options, standardR2Record), true);
  });

  // Carrier 2: Misconception record
  it("Carrier 2: Misconception callout is omitted by default and prints when essentialForPrint: true", () => {
    const standardMisconception = {
      id: "misc-01",
      temptingClaims: ["Particles move in straight lines between frames"],
      essentialForPrint: false,
    };
    assert.equal(shouldPrintMisconception(standardMisconception), false);
    assert.equal(shouldPrintMisconception(null), false);

    const essentialMisconception = {
      id: "misc-02",
      temptingClaims: ["Apparent velocity is true velocity"],
      essentialForPrint: true,
    };
    assert.equal(shouldPrintMisconception(essentialMisconception), true);
  });

  // Carrier 3: DerivationChain / route record
  it("Carrier 3: Side-door derivation chain collapses by default and expands when essentialForPrint: true", () => {
    // Source order expands by default
    const sourceOrderRoute = { id: "route-so", kind: "source-order" };
    assert.deepEqual(shouldPrintDerivationRoute("source-order", sourceOrderRoute), {
      expanded: true,
      showSummary: false,
    });

    // Side-door route collapses to summary by default
    const discoveryRoute = { id: "route-disc", kind: "discovery" };
    assert.deepEqual(shouldPrintDerivationRoute("discovery", discoveryRoute), {
      expanded: false,
      showSummary: true,
    });

    const reconRoute = { id: "route-recon", kind: "pedagogical-reconstruction" };
    assert.deepEqual(shouldPrintDerivationRoute("pedagogical-reconstruction", reconRoute), {
      expanded: false,
      showSummary: true,
    });

    // Side-door route with essentialForPrint: true expands
    const essentialDiscoveryRoute = {
      id: "route-disc-essential",
      kind: "discovery",
      essentialForPrint: true,
    };
    assert.deepEqual(shouldPrintDerivationRoute("discovery", essentialDiscoveryRoute), {
      expanded: true,
      showSummary: false,
    });
  });

  it("Foundation drawers are omitted by default and print when essentialForPrint: true", () => {
    assert.equal(shouldPrintFoundationDrawer({ essentialForPrint: false }), false);
    assert.equal(shouldPrintFoundationDrawer(null), false);
    assert.equal(shouldPrintFoundationDrawer({ essentialForPrint: true }), true);
  });

  it("Tool links inside printed derivation steps emit a reference line naming foundation and URL", () => {
    const refLine = formatToolLinkReference(
      "Partial Derivatives and Held-Fixed Quantities",
      "partial-derivatives",
    );
    assert.equal(
      refLine,
      "Foundation: Partial Derivatives and Held-Fixed Quantities (https://annus-mirabilis.com/foundations/partial-derivatives)",
    );

    const customBaseRef = formatToolLinkReference(
      "Diffusion Equation",
      "diffusion-equation",
      "https://custom.example.org",
    );
    assert.equal(
      customBaseRef,
      "Foundation: Diffusion Equation (https://custom.example.org/foundations/diffusion-equation)",
    );
  });
});
