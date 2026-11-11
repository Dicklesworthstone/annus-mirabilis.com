import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { BROWNIAN_LATER_EVIDENCE } from "../../content/brownianShelf.ts";
import { WORLD_CHECK } from "../../discovery/brownian/journeyII.ts";
import { createBm01BrowserChannel } from "../../experiments/bm01/browser.ts";
import { loadPerrinRecord } from "../../experiments/bm01/perrinRecord.ts";
import { createBm01Session } from "../../experiments/bm01/session.ts";
import example from "../../generated/bm01-example.json";
import { BrownianWorldCheck } from "./BrownianWorldCheck.tsx";
import { PerrinComparison } from "./PerrinComparison.tsx";

const perrin = loadPerrinRecord();

const render = (tracer: typeof example) =>
  renderToStaticMarkup(
    <BrownianWorldCheck
      example={tracer}
      check={WORLD_CHECK}
      laterEvidence={BROWNIAN_LATER_EVIDENCE}
      perrin={perrin}
    />,
  );
const quantity = (html: string, id: string) =>
  new RegExp(`data-world-check-quantity="${id}">([^<]*)<`).exec(html)?.[1];

/**
 * Journey II's check against the world (dispatch 136, unit 3). What a reader without JavaScript
 * receives is the ensemble's worked example: 20 °C, 1.00 mPa·s, 0.5 µm, whose accepted snapshot
 * holds lambdaX1s = 9.27e-7 m and lambdaX60s = 7.18e-6 m.
 */
describe("the check against the world reads the tracer ensemble's accepted snapshot", () => {
  test("the readout shows the snapshot's one-second and one-minute displacements", () => {
    const html = render(example);
    expect(quantity(html, "lambdaX1s")).toBe("0.93 µm");
    expect(quantity(html, "lambdaX60s")).toBe("7.2 µm");
    expect(html).toContain("a radius of 0.5 µm");
  });

  test("it reads the snapshot rather than computing from the inputs", () => {
    // The same inputs with a different accepted lambdaX1s: a readout that recomputed from T, eta
    // and a would still say 0.93 µm.
    const altered = {
      ...example,
      results: example.results.map((r) => {
        const parsed = JSON.parse(r) as { quantityId: string; value: unknown };
        return parsed.quantityId === "lambdaX1s" ? JSON.stringify({ ...parsed, value: 1.5e-6 }) : r;
      }),
    };
    expect(quantity(render(altered), "lambdaX1s")).toBe("1.5 µm");
  });

  test("Einstein's printed values stand beside it, and the later evidence is labelled later", () => {
    const html = render(example);
    expect(html).toContain("Check it against the world");
    expect(html).toContain("about 0.8 µm in one second, about 6 µm in one minute");
    expect(html).toContain('data-card-id="perrin-1909-molecular-reality"');
    expect(html).toContain("Later evidence, not on the 1904 shelf");
    // The card carries no verification status (dispatch 243, D-2026-09-25-no-review-status-banners).
    expect(html).not.toContain("Awaiting verification");
  });

  test("the embedded ensemble is the real instrument, with its radius control", () => {
    const html = render(example);
    expect(html).toContain("The tracer ensemble, for the check");
    expect(html).toMatch(/name="a"|id="[^"]*-a"|Radius/i);
    // No button that only works with JavaScript is served to a reader without it.
    expect(html).not.toContain("Use Einstein’s inputs");
  });

  test("no build-side id reaches the reader", () => {
    const text = render(example).replace(/<[^>]+>/g, " ");
    expect(text).not.toContain("World check · #");
    expect(text).not.toContain("constants: einstein-1905-brownian-printed");
  });
});

describe("with no accepted snapshot the check refuses", () => {
  test("world-check-snapshot-missing: it throws its code rather than show a readout the ensemble never produced", () => {
    // A real session whose snapshot reports nothing accepted, the state a store is in before its
    // first result is published. createBm01Session itself refuses an example it cannot publish,
    // so an embedder's session is the only route into this site.
    const real = createBm01Session("world-check-refusal", example, createBm01BrowserChannel);
    const empty = { ...real.getServerSnapshot(), accepted: null };
    const session: typeof real = {
      ...real,
      getSnapshot: () => empty,
      getServerSnapshot: () => empty,
    };
    expect(() =>
      renderToStaticMarkup(
        <BrownianWorldCheck
          example={example}
          check={WORLD_CHECK}
          laterEvidence={BROWNIAN_LATER_EVIDENCE}
          perrin={perrin}
          session={session}
        />,
      ),
    ).toThrow("world-check-snapshot-missing");
    // Positive control: the same real session, snapshot intact, renders the readout.
    expect(
      renderToStaticMarkup(
        <BrownianWorldCheck
          example={example}
          check={WORLD_CHECK}
          laterEvidence={BROWNIAN_LATER_EVIDENCE}
          perrin={perrin}
          session={real}
        />,
      ),
    ).toContain('data-world-check-quantity="lambdaX1s"');
  });
});

describe("the later measurement stays distinct from the accepted model", () => {
  test("the server page includes the four printed observations, their date and source", () => {
    const html = render(example);
    expect(html).toContain('data-historical-dataset="perrin-1909-displacements"');
    expect(html).toContain('data-comparison-kind="measured-fact"');
    expect(html).toContain("later evidence, published 1909");
    expect(html).toContain("First series, p. 77");
    expect(html.match(/data-perrin-observed/g)).toHaveLength(4);
    expect(html).toContain("50.2");
    expect(html).toContain("113.5");
    expect(html).toContain("printed rounding");
    expect(html).toContain('data-perrin-conditions="different"');
    expect(html).not.toContain("Use Perrin’s source conditions");
  });

  test("changing the accepted diffusivity changes the model but not the observed numbers", () => {
    const altered = {
      ...example,
      results: example.results.map((encoded) => {
        const output = JSON.parse(encoded) as { quantityId: string; value: number };
        return output.quantityId === "diffusionCoefficient"
          ? JSON.stringify({ ...output, value: output.value * 2 })
          : encoded;
      }),
    };
    const before = render(example);
    const after = render(altered);
    const values = (html: string, attribute: string) =>
      [...html.matchAll(new RegExp(`${attribute}="[^"]*">([^<]+)<`, "g"))].map((match) => match[1]);
    expect(values(after, "data-perrin-observed")).toEqual(values(before, "data-perrin-observed"));
    expect(values(after, "data-perrin-model")).not.toEqual(values(before, "data-perrin-model"));
  });
});

describe("the measurement comparison identifies retained results", () => {
  test("pending, refused and unavailable views never present the old prediction as a new result", () => {
    const view = createBm01Session(
      "perrin-currency",
      example,
      createBm01BrowserChannel,
    ).getServerSnapshot();
    const snapshot = view.accepted;
    expect(snapshot).not.toBeNull();
    if (!snapshot) return;
    for (const status of ["pending", "refused", "unavailable"] as const) {
      const html = renderToStaticMarkup(
        <PerrinComparison
          record={perrin}
          snapshot={snapshot}
          view={{ ...view, status, pending: status === "pending" }}
          onUseSourceConditions={() => {}}
        />,
      );
      expect(html).toContain("Accepted model");
      expect(html.match(/data-perrin-observed/g)).toHaveLength(4);
      if (status === "pending") {
        expect(html).toContain('data-currency-state="running"');
        expect(html).toContain("previous accepted inputs");
        expect(html).toContain('disabled=""');
      } else if (status === "refused") {
        expect(html).toContain('data-currency-state="refused"');
        expect(html).toContain("last accepted inputs");
      } else {
        expect(html).toContain("retains the last accepted result");
      }
    }
  });
});
