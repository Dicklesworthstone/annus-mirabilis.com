import { describe, expect, test } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { navigationTree } from "../navigation.ts";
import { createSelectionStore } from "../selectionStore.ts";
import { EINSTEIN_RELATION_FIXTURE } from "../spoken/fixtures.ts";
import { TermExplorer } from "./TermExplorer.tsx";

describe("am-eq-spoken-forms-w4f: TermExplorer tests", () => {
  const sampleNavigation = [
    {
      id: "D",
      parent: null,
      children: [],
      kind: "term" as const,
      quantityId: "diffusionCoefficient",
    },
    {
      id: "op-divide",
      parent: null,
      children: ["kB", "T", "op-stokes-drag"],
      kind: "operation" as const,
      quantityId: null,
    },
    {
      id: "kB",
      parent: "op-divide",
      children: [],
      kind: "term" as const,
      quantityId: "boltzmannConstant",
    },
    {
      id: "T",
      parent: "op-divide",
      children: [],
      kind: "term" as const,
      quantityId: "absoluteTemperature",
    },
    {
      id: "op-stokes-drag",
      parent: "op-divide",
      children: ["eta", "a"],
      kind: "operation" as const,
      quantityId: null,
    },
    {
      id: "eta",
      parent: "op-stokes-drag",
      children: [],
      kind: "term" as const,
      quantityId: "viscosity",
    },
    {
      id: "a",
      parent: "op-stokes-drag",
      children: [],
      kind: "term" as const,
      quantityId: "particleRadius",
    },
  ];

  test("Renders TermExplorer with roving tabindex structure", () => {
    const markup = renderToStaticMarkup(
      <TermExplorer
        equationId={EINSTEIN_RELATION_FIXTURE.id}
        title={EINSTEIN_RELATION_FIXTURE.title}
        navigation={sampleNavigation}
        terms={EINSTEIN_RELATION_FIXTURE.terms}
      />,
    );

    expect(markup).toContain('class="am-term-explorer"');
    expect(markup).toContain('data-term-explorer="eq-bm-einstein-relation"');
    expect(markup).toContain('role="region"');
    expect(markup).toContain(
      'aria-label="Terms and operations in Einstein Relation for the Diffusion Coefficient"',
    );

    // First item has tabIndex="0", others have tabIndex="-1"
    expect(markup).toContain('data-node-id="D"');
    expect(markup).toContain('data-quantity-id="diffusionCoefficient"');
    expect(markup).toContain('data-selected="true"');
    expect(markup).toContain('class="am-chip am-chip-term selected" tabindex="0"');
    expect(markup).toContain('data-node-id="op-divide"');
    expect(markup).toContain('class="am-chip am-chip-operation " tabindex="-1"');
  });

  test("Renders live polite status region for assistive technology announcements", () => {
    const markup = renderToStaticMarkup(
      <TermExplorer
        equationId={EINSTEIN_RELATION_FIXTURE.id}
        title={EINSTEIN_RELATION_FIXTURE.title}
        navigation={sampleNavigation}
        terms={EINSTEIN_RELATION_FIXTURE.terms}
      />,
    );

    expect(markup).toContain(
      'role="status" aria-live="polite" aria-atomic="true" data-a11y-live-status="true"',
    );
  });

  test("Renders inspector panel with term role, unit, and value details", () => {
    const markup = renderToStaticMarkup(
      <TermExplorer
        equationId={EINSTEIN_RELATION_FIXTURE.id}
        title={EINSTEIN_RELATION_FIXTURE.title}
        navigation={sampleNavigation}
        terms={EINSTEIN_RELATION_FIXTURE.terms}
      />,
    );

    expect(markup).toContain('class="am-term-inspector"');
    expect(markup).toContain('data-active-term="D"');
    expect(markup).toContain("Diffusion coefficient");
    expect(markup).toContain('class="badge badge-model-result"');
    expect(markup).toContain("meters squared per second");
  });

  test("Renders typed non-numeric status when present on a term", () => {
    const customTerms = [
      {
        nodeId: "custom-term",
        name: "Unmeasured Viscosity Ratio",
        role: "parameter" as const,
        status: "unmeasured" as const,
        speechText: "Unmeasured ratio of viscosities under non-equilibrium flow.",
      },
    ];

    const markup = renderToStaticMarkup(
      <TermExplorer
        equationId="eq-custom"
        title="Custom Equation"
        navigation={[
          { id: "custom-term", parent: null, children: [], kind: "term", quantityId: null },
        ]}
        terms={customTerms}
      />,
    );

    expect(markup).toContain('class="meta-item badge-status"');
    expect(markup).toContain("unmeasured");
  });

  test("Shares selection with the selection store", () => {
    const store = createSelectionStore();
    expect(store.getSnapshot()).toBeNull();

    store.select({
      nodeId: "eq-bm-einstein-relation.kB",
      quantityId: "boltzmannConstant",
      kind: "term",
    });

    const snapshot = store.getSnapshot();
    expect(snapshot).not.toBeNull();
    expect(snapshot?.nodeId).toBe("eq-bm-einstein-relation.kB");
    expect(snapshot?.quantityId).toBe("boltzmannConstant");
    expect(snapshot?.kind).toBe("term");
  });
});
