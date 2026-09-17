import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { DerivationChain } from "./DerivationChain.tsx";
import {
  fixtureBrownianPedagogicalReconstruction,
  fixtureBrownianSourceOrder,
  fixtureLorentzMapConstruction,
  fixturePaper4TwoLedgers,
} from "./fixtures.ts";

describe("am-eq-derivation-renderer-9gd7: DerivationChain static rendering", () => {
  test("renders static markup with <details> and <ol> structure", () => {
    const html = renderToStaticMarkup(
      <DerivationChain chains={[fixtureBrownianPedagogicalReconstruction]} />,
    );

    expect(html).toContain('<details class="derivation-disclosure" open=""');
    expect(html).toContain("<summary>Show the derivation</summary>");
    expect(html).toContain('<ol class="derivation-steps-list" role="list">');
    expect(html).toContain('data-step-id="bm-ped-step-1"');
    expect(html).toContain('data-step-id="bm-ped-step-2"');
  });

  test("renders the marked move with visible box and label text", () => {
    const html = renderToStaticMarkup(
      <DerivationChain chains={[fixtureBrownianPedagogicalReconstruction]} />,
    );

    expect(html).toContain('data-is-move="true"');
    expect(html).toContain('class="the-move-box"');
    expect(html).toContain("The move:");
    expect(html).toContain(
      "Cross terms average away because distinct displacements are independent",
    );
  });

  test("renders all three reason readings with data-detail attributes", () => {
    const html = renderToStaticMarkup(
      <DerivationChain chains={[fixtureBrownianPedagogicalReconstruction]} activeDetail="1" />,
    );

    // R0, R1, and R2 are all present in the static markup
    expect(html).toContain('data-detail="0"');
    expect(html).toContain('data-detail="1"');
    expect(html).toContain('data-detail="2"');

    // R1 is visible, R0 and R2 carry hidden
    expect(html).toContain('data-detail="0" hidden=""');
    expect(html).not.toMatch(/data-detail="1" hidden=""/);
    expect(html).toContain('data-detail="2" hidden=""');

    // Content of reasons is preserved
    expect(html).toContain("Total displacement is the sum of steps.");
    expect(html).toContain(
      "Express total displacement x as the sum of n individual independent steps Delta_i.",
    );
  });

  test("renders subexpression highlight IDs matching record", () => {
    const html = renderToStaticMarkup(
      <DerivationChain chains={[fixtureBrownianPedagogicalReconstruction]} />,
    );

    const step1 = fixtureBrownianPedagogicalReconstruction.steps[0]!;
    expect(html).toContain(`data-highlight-ids="${step1.changedSubexpressionIds.join(",")}"`);
  });

  test("renders approximation text and scope change when present in step", () => {
    const html = renderToStaticMarkup(<DerivationChain chains={[fixturePaper4TwoLedgers]} />);

    expect(html).toContain('data-approximation="true"');
    expect(html).toContain("Approximation:");
  });

  test("renders route choices with stable labels when multiple routes are supplied", () => {
    const chains = [fixtureBrownianSourceOrder, fixtureBrownianPedagogicalReconstruction];
    const html = renderToStaticMarkup(<DerivationChain chains={chains} />);

    expect(html).toContain('class="derivation-routes"');
    expect(html).toContain("Original 1905 Derivation");
    expect(html).toContain("A route you could take (Reconstruction)");
  });
});
