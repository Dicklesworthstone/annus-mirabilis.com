import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { decodeTapePermalink } from "./codec.ts";
import { FIXTURE_TEACHING_TAPE_EINSTEIN_08 } from "./fixture.ts";
import { ShareControl } from "./ShareControl.tsx";
import { SHARE_FORMS } from "./shareForms.ts";
import type { TapeV2 } from "./types.ts";

describe("ShareControl (am-inst-permalink-tape-s677)", () => {
  test("names the form it produces and labels the copy action correctly", () => {
    const html = renderToStaticMarkup(<ShareControl tape={FIXTURE_TEACHING_TAPE_EINSTEIN_08} />);

    // Names the form it produces: "Experiment preset"
    expect(html).toContain(SHARE_FORMS["experiment-preset"].name);
    expect(html).toContain('data-testid="form-name"');

    // Button carries exact action label
    expect(html).toContain(SHARE_FORMS["experiment-preset"].label);
    expect(html).toContain('data-testid="copy-button"');

    // Exposes URL in selectable read-only input
    expect(html).toContain('data-testid="selectable-url"');
    expect(html).toContain("readOnly");
    expect(html).toContain("https://annus-mirabilis.com/lab/bm-01?tape=");

    // Accessible aria-live status container exists
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-live="polite"');
  });

  test("when tape carries predictions, states inclusion and provides toggle", () => {
    const tapeWithPredictions: TapeV2 = {
      ...FIXTURE_TEACHING_TAPE_EINSTEIN_08,
      predictions: [
        {
          promptId: "bm-01-displacement-predict",
          form: "candidate",
          payload: {
            candidateId: "einstein-diffusion-match",
          },
        },
      ],
    };

    const html = renderToStaticMarkup(<ShareControl tape={tapeWithPredictions} />);

    expect(html).toContain('data-testid="predictions-toggle"');
    expect(html).toContain("Include your prediction in the shared link");
    expect(html).toContain('data-testid="predictions-notice"');
    expect(html).toContain("Your prediction parameters will be encoded into the permalink.");
  });

  test("when tape has no predictions, prediction toggle is omitted", () => {
    const tapeNoPredictions: TapeV2 = {
      ...FIXTURE_TEACHING_TAPE_EINSTEIN_08,
      predictions: [],
    };

    const html = renderToStaticMarkup(<ShareControl tape={tapeNoPredictions} />);

    expect(html).not.toContain('data-testid="predictions-toggle"');
  });

  test("the emitted URL in the selectable field decodes to a valid TapeV2", () => {
    const html = renderToStaticMarkup(<ShareControl tape={FIXTURE_TEACHING_TAPE_EINSTEIN_08} />);

    const match = html.match(/value="([^"]+)"/);
    expect(match).not.toBeNull();
    const url = match![1];

    const decoded = decodeTapePermalink(url);
    expect(decoded.kind).toBe("success");
    if (decoded.kind === "success") {
      expect(decoded.tape.experimentId).toBe("bm-01");
      expect(decoded.tape.seed).toBe("1905");
      expect(decoded.tape.events.length).toBe(3);
    }
  });
});
