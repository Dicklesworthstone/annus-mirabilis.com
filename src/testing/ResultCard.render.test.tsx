import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { ResultCard } from "../reader/faces/results/ResultCard.tsx";
import type { ResultCard as ResultCardData } from "../reader/faces/results/types.ts";

/**
 * am-read-results-face-uzh acceptance criterion: "A Brownian fixture results face renders cards
 * for the diffusion coefficient, the displacement law lambda_x = sqrt(2Dt) with its printed
 * checks, and the molecular-number formula. Each card has printed and modern forms, one
 * sentence, misconception links, and used-later links."
 *
 * This is a full ResultCard, real render, static markup (the no-JavaScript path this bead
 * requires) -- not a shallow render, so a missing section is caught the way a reader would see it.
 */
const brownianFixture: ResultCardData = Object.freeze({
  resultId: "bm-displacement-law",
  paper: "brownian-motion",
  sectionAnchors: ["s5"],
  printedEquationIds: ["eq-bm-05-lambda-x", "eq-bm-05-diffusion-coefficient"],
  oneSentence:
    "The mean displacement of a suspended particle grows with the square root of elapsed time.",
  decoder: [
    { symbol: "lambda_x", meaning: "the mean displacement along one axis" },
    { symbol: "D", meaning: "the diffusion coefficient" },
    { symbol: "t", meaning: "elapsed time" },
  ],
  printedChecks: [
    {
      printedValue: "about 0,8 Mikron",
      statedInputs: { T: "290.15 K", eta: "0.00135 Pa s", a: "5.0e-7 m", t: "1 s" },
      constantSetId: "scenario-einstein-1905-brownian-printed",
      scenarioId: "diffusion-einstein-1905-printed",
      reproducedValue: 7.947833e-7,
      tolerance: 0.05,
      comparisonKind: "rounds-to",
      label: "as printed",
      transcriptionPending: true,
    },
  ],
  probes: [
    {
      kind: "instrument" as const,
      instrumentId: "bm-06",
      presetOrModeId: "bm-06-einstein-1s",
      question: "Watch the spread after 1 second.",
    },
  ],
  misconceptionIds: ["misc-fixed-jump-size"],
  usedBy: [
    {
      text: "Perrin's sedimentation-equilibrium counts (1908-1909) test the same diffusion law.",
      date: "1908-1909",
    },
    {
      text: "BM-07 infers the molecular number from this same displacement law.",
      relatedResultId: "bm-molecular-number",
    },
  ],
  meanings: {
    argumentStatus: "derived",
    modelStatus: "idealized",
    evidentialRole: "theoretical-prediction",
    historicalStatus: "as-printed",
  },
  sources: [{ paper: "brownian-motion", anchor: "s5" }],
  selectionReason: "States the paper's central measurable prediction, not an intermediate step.",
  support: {
    proofRouteId: "route-bm-source-diffusion-equation",
    chainId: "chain-bm-source-diffusion-equation",
    routeKind: "source-order",
    entryAssumptions: [
      { premiseId: "premise-bm-transition-relation", edgeType: "a premise the paper builds on" },
    ],
    alternativeRoutes: [
      {
        proofRouteId: "route-bm-pedagogical-variance",
        routeKind: "pedagogical-reconstruction",
        title: "Pedagogical Reconstruction",
      },
    ],
    empiricalInputs: [],
    verificationState: {
      status: "authored-unverified" as const,
      reviewRecordId: "rr-bm-04-taylor-time",
    },
    isPublicationReady: true,
  },
  limitations: [
    {
      argumentId: "arg-bm-05-displacement-law",
      text: "Holds only where the interval is long compared with the momentum relaxation time.",
    },
  ],
  reception: [
    {
      datasetId: "perrin-1908-sedimentation",
      relation: "tested-a-prediction",
      statement: "Perrin's sedimentation-equilibrium counts test the same diffusion law.",
      date: "1908-1909",
      precision: "range" as const,
    },
  ],
});

describe("ResultCard.render: the Brownian lambda_x fixture, static markup", () => {
  test("renders both printed equations, primary first, headline vs body class", () => {
    const html = renderToStaticMarkup(<ResultCard card={brownianFixture} />);
    expect(html).toContain('data-equation-id="eq-bm-05-lambda-x"');
    expect(html).toContain('data-equation-id="eq-bm-05-diffusion-coefficient"');
    const headlineIndex = html.indexOf("result-equation-headline");
    const bodyIndex = html.indexOf('class="result-equation"');
    expect(headlineIndex).toBeGreaterThan(-1);
    expect(bodyIndex).toBeGreaterThan(headlineIndex);
  });

  test("renders the one sentence, the decoder, and the misconception link", () => {
    const html = renderToStaticMarkup(<ResultCard card={brownianFixture} />);
    expect(html).toContain(brownianFixture.oneSentence);
    expect(html).toContain("lambda_x");
    expect(html).toContain("the mean displacement along one axis");
    expect(html).toContain("misc-fixed-jump-size");
  });

  // The pending transcription is carried as data, never as "(source transcription pending review)"
  // (D-2026-09-25-no-review-status-banners), and never dropped: the cell still says it is pending.
  test("renders the printed check with its label, its pending transcription as data and no review words", () => {
    const html = renderToStaticMarkup(<ResultCard card={brownianFixture} />);
    expect(html).toContain("0,8 Mikron");
    expect(html).toContain('data-check-label="as printed"');
    expect(html).toContain('data-transcription-pending="true"');
    expect(html).not.toContain("pending review");
  });

  test("renders the support layer: selected route, entry assumptions, empty-empirical sentence, and the unverified-step marker", () => {
    const html = renderToStaticMarkup(<ResultCard card={brownianFixture} />);
    expect(html).toContain("source-order");
    expect(html).toContain("premise-bm-transition-relation");
    expect(html).toContain("No measurement enters this derivation.");
    expect(html).toContain("not yet machine-checked");
    expect(html).toContain("Pedagogical Reconstruction");
  });

  test("renders the limitation line referencing the argument node", () => {
    const html = renderToStaticMarkup(<ResultCard card={brownianFixture} />);
    expect(html).toContain('data-argument-id="arg-bm-05-displacement-law"');
    expect(html).toContain("momentum relaxation time");
  });

  test("renders the reception section when entries are present", () => {
    const html = renderToStaticMarkup(<ResultCard card={brownianFixture} />);
    expect(html).toContain("Later evidence (1908-1909)");
  });

  test("renders no reception section at all when the list is empty -- silence, not a placeholder", () => {
    const noReception: ResultCardData = { ...brownianFixture, reception: [] };
    const html = renderToStaticMarkup(<ResultCard card={noReception} />);
    expect(html).not.toContain("result-reception");
    expect(html).not.toContain("Later evidence");
  });

  test("renders used-later links, internal ones as anchors and external ones as prose", () => {
    const html = renderToStaticMarkup(<ResultCard card={brownianFixture} />);
    expect(html).toContain('href="#result-bm-molecular-number"');
    expect(html).toContain("sedimentation-equilibrium counts (1908-1909)");
  });

  test("renders the probe as a link to the laboratory that names the preset, and promises no URL preset", () => {
    // No laboratory opens a preset from its URL, so the link is the laboratory itself and the
    // preset is named for the reader to choose there (ResultCard.tsx).
    const html = renderToStaticMarkup(<ResultCard card={brownianFixture} />);
    expect(html).toContain('href="/lab/bm-06/"');
    expect(html).toContain('data-preset-id="bm-06-einstein-1s"');
    expect(html).toContain("Choose the preset \u201cbm-06-einstein-1s\u201d there.");
    expect(html).not.toContain("?preset=");
    expect(html).not.toContain("pending am-eq-live-bindings-2se");
  });

  test("renders each wrong turn as its tempting claim, linked to the explanation page", () => {
    const withClaims: ResultCardData = {
      ...brownianFixture,
      misconceptions: [
        {
          id: "misc-fixed-jump-size",
          claim: "Each jump has the same length \\(\\ell\\).",
          href: "/papers/brownian-motion/#misconception-misc-fixed-jump-size",
        },
      ],
    };
    const html = renderToStaticMarkup(<ResultCard card={withClaims} />);
    expect(html).toContain('data-result-layer="wrong-turns"');
    expect(html).toContain('href="/papers/brownian-motion/#misconception-misc-fixed-jump-size"');
    expect(html).toContain("katex");
    // The bare id line is the fallback for a card that knows only ids; it is not shown as well.
    expect(html).not.toContain("Misconceptions: misc-fixed-jump-size");
  });

  test("renders no support section when no derivation chain covers the result", () => {
    const { support: _support, ...unsupported } = brownianFixture;
    const html = renderToStaticMarkup(<ResultCard card={unsupported} />);
    expect(html).not.toContain("result-support");
    expect(html).toContain('data-argument-id="arg-bm-05-displacement-law"');
  });

  test("renders fully without JavaScript: static markup contains every layer with no client-only gaps", () => {
    const html = renderToStaticMarkup(<ResultCard card={brownianFixture} />);
    for (const marker of [
      "result-decoder",
      "result-printed-checks",
      "result-support",
      "result-limitation",
      "result-reception",
      "result-used-by",
    ]) {
      expect(html).toContain(marker);
    }
  });
});
