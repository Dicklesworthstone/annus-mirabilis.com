import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import {
  createContainer,
  installDom,
  removeContainer,
  uninstallDom,
} from "../../testing/reactDom.ts";
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
    // The link is encoded in the browser, after the first render; until then there is nothing to copy.
    expect(html).not.toContain("?tape=");
    expect(html).toMatch(/data-testid="copy-button"[^>]*disabled=""/);

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

  describe("in a page", () => {
    beforeEach(async () => {
      await installDom();
    });
    afterEach(async () => {
      await uninstallDom();
    });

    test("the link it shows, once encoded, decodes to the tape it was given", async () => {
      const container = createContainer();
      const root = createRoot(container);
      try {
        await act(async () => {
          root.render(
            createElement(ShareControl, {
              tape: FIXTURE_TEACHING_TAPE_EINSTEIN_08,
              baseUrl: "https://annus-mirabilis.com/lab/bm-01/",
            }),
          );
        });
        let url = "";
        for (let i = 0; i < 50 && !url; i++) {
          await act(async () => {
            await new Promise((resolve) => setTimeout(resolve, 10));
          });
          url =
            container.querySelector<HTMLInputElement>('[data-testid="selectable-url"]')?.value ??
            "";
        }
        expect(url.startsWith("https://annus-mirabilis.com/lab/bm-01/?tape=")).toBe(true);
        const button = container.querySelector<HTMLButtonElement>('[data-testid="copy-button"]');
        expect(button?.disabled).toBe(false);
        const decoded = decodeTapePermalink(url);
        expect(decoded.kind).toBe("success");
        if (decoded.kind === "success")
          expect(decoded.tape).toEqual(FIXTURE_TEACHING_TAPE_EINSTEIN_08);
      } finally {
        await act(async () => {
          root.unmount();
        });
        removeContainer(container);
      }
    });
  });
});
