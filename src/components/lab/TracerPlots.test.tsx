import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import type { Bm01Parameters } from "../../experiments/bm01/definition.ts";
import { createBm01Session, type PreparedBm01Example } from "../../experiments/bm01/session.ts";
import type { AcceptedSnapshot } from "../../experiments/store/instanceStore.ts";
import exampleJson from "../../generated/bm01-example.json";
import { PLOT_KINDS, TracerHistogram, TracerScaling } from "./TracerPlots.tsx";

describe("TracerScaling refusal and plot contracts (am-a11y-action-contracts-clear-biome-debt-kdsl)", () => {
  const example = exampleJson as unknown as PreparedBm01Example;
  const dummyWorkerFactory = () => {
    return {
      postMessage: () => {},
      terminate: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
    } as unknown as ReturnType<Parameters<typeof createBm01Session>[2]>;
  };
  const session = createBm01Session("bm01-test-session", example, dummyWorkerFactory);
  const acceptedSnapshot = session.getServerSnapshot().accepted as AcceptedSnapshot;

  test("passes an unknown statistic and renders typed refusal with data-refusal-code='unknown-statistic', role='alert', naming bad value and valid choices", () => {
    const badStatistic = "harmonic-mean";
    const invalidSnapshot: AcceptedSnapshot = {
      ...acceptedSnapshot,
      parameters: {
        ...(acceptedSnapshot.parameters as Bm01Parameters),
        statistic: badStatistic,
      },
    };

    const html = renderToStaticMarkup(<TracerScaling snapshot={invalidSnapshot} />);

    // Assert refusal attribute and role
    expect(html).toContain('data-refusal-code="unknown-statistic"');
    expect(html).toContain('role="alert"');

    // Assert names the bad value
    expect(html).toContain(badStatistic);

    // Assert names all four valid choices
    for (const validChoice of Object.keys(PLOT_KINDS)) {
      expect(html).toContain(validChoice);
    }

    // Refusal must not render the plot figure or SVG curves
    expect(html).not.toContain('<figure class="plot">');
    expect(html).not.toContain('class="curve"');
  });

  test("renders plot figure and curves for known valid statistics", () => {
    for (const validChoice of Object.keys(PLOT_KINDS)) {
      const validSnapshot: AcceptedSnapshot = {
        ...acceptedSnapshot,
        parameters: {
          ...(acceptedSnapshot.parameters as Bm01Parameters),
          statistic: validChoice,
        },
      };

      const html = renderToStaticMarkup(<TracerScaling snapshot={validSnapshot} />);

      // Must not contain refusal
      expect(html).not.toContain('data-refusal-code="unknown-statistic"');
      expect(html).not.toContain('role="alert"');

      // Must render plot figure, curves, and table
      expect(html).toContain('<figure class="plot">');
      expect(html).toContain("<svg");
      expect(html).toContain('class="curve"');
      expect(html).toContain('class="comparison-curve"');
      expect(html).toContain("Read the comparison as a table");
    }
  });

  // Predict mode (am-inst-predict-mode-ti7m, dispatch 156 option c): the frame stays and the
  // spread the prompts ask about waits. Without a gate the plots are unchanged.
  test("the histogram keeps its axis in view while its bars, model line and range wait", () => {
    const awaiting = { "data-predict-response": "awaiting" } as const;
    const html = renderToStaticMarkup(
      <TracerHistogram snapshot={acceptedSnapshot} response={awaiting} />,
    );
    expect(html).toMatch(
      /<path d="M35 35V205H275" class="axis"><\/path><g data-predict-response="awaiting"><rect/,
    );
    expect(html).toMatch(/class="comparison-curve"><\/path><text[^>]*>Fraction in each bin/);
    const plain = renderToStaticMarkup(<TracerHistogram snapshot={acceptedSnapshot} />);
    expect(plain).not.toContain("data-predict-response");
  });

  test("the scaling plot keeps its axis and labels while its two curves wait", () => {
    const html = renderToStaticMarkup(
      <TracerScaling
        snapshot={acceptedSnapshot}
        response={{ "data-predict-response": "awaiting" }}
      />,
    );
    expect(html).toMatch(
      /class="axis"><\/path><g data-predict-response="awaiting"><path[^>]*class="curve"><\/path><path[^>]*class="comparison-curve"><\/path><\/g>/,
    );
  });
});
