import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import assert from "node:assert/strict";
import { deflateRawSync } from "node:zlib";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import {
  createContainer,
  installDom,
  removeContainer,
  uninstallDom,
} from "../../testing/reactDom.ts";
import { ME01_TAPE } from "../me01/tape.ts";
import { SR05_TAPE } from "../sr05/tape.ts";
import { checkpointJson } from "../store/instanceCheckpoint.ts";
import { bytesToBase64Url, decodeTapePermalink, encodeTapePermalink } from "./codec.ts";
import { FIXTURE_TEACHING_TAPE_EINSTEIN_08 } from "./fixture.ts";
import { ShareControl } from "./ShareControl.tsx";
import { tapeForSettings } from "./sessionTape.ts";
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

  test("canonical settings preserve recorded actions and predictions and read older links", () => {
    const original: TapeV2 = {
      ...FIXTURE_TEACHING_TAPE_EINSTEIN_08,
      predictions: [
        { promptId: "bm-01-first", form: "candidate", payload: { candidateId: "wider" } },
        { promptId: "bm-01-second", form: "candidate", payload: { candidateId: "narrower" } },
      ],
    };
    const reordered: TapeV2 = {
      ...original,
      initialConditions: Object.fromEntries(Object.entries(original.initialConditions).reverse()),
    };
    expect(Object.keys(reordered.initialConditions)).not.toEqual(
      Object.keys(original.initialConditions),
    );
    expect(encodeTapePermalink(reordered)).toBe(encodeTapePermalink(original));

    // This is the old wire format, deliberately bypassing the canonical payload writer.
    const legacy = bytesToBase64Url(
      deflateRawSync(new TextEncoder().encode(JSON.stringify(original))),
    );
    for (const encoded of [legacy, encodeTapePermalink(reordered)]) {
      const decoded = decodeTapePermalink(encoded);
      assert.ok(decoded.kind === "success");
      expect(decoded.tape.initialConditions).toEqual(original.initialConditions);
      expect(decoded.tape.events).toEqual(original.events);
      expect(decoded.tape.predictions).toEqual(original.predictions);
      expect(decoded.tape.acceptedCheckpoint).toEqual(original.acceptedCheckpoint);
    }
  });

  describe("in a page", () => {
    beforeEach(async () => {
      await installDom();
    });
    afterEach(async () => {
      await uninstallDom();
    });

    test("restored settings keep one share URL; changed physics gets another", async () => {
      const settings = { ...SR05_TAPE.defaults, speed: 0.0001, worldlinePreset: "inertial" };
      const restoredSettings = JSON.parse(checkpointJson(settings));
      expect(Object.keys(restoredSettings)).not.toEqual(Object.keys(settings));
      const first = tapeForSettings(SR05_TAPE, settings);
      const restored = tapeForSettings(SR05_TAPE, restoredSettings);
      const changed = tapeForSettings(SR05_TAPE, { ...restoredSettings, speed: 0.5 });
      assert.ok(first && restored && changed, "The clock owner must accept all three settings.");
      const container = createContainer();
      const root = createRoot(container);
      try {
        await act(async () => {
          root.render(
            <>
              <ShareControl tape={first} baseUrl="http://localhost/lab/sr-05/" />
              <ShareControl tape={restored} baseUrl="http://localhost/lab/sr-05/" />
              <ShareControl tape={changed} baseUrl="http://localhost/lab/sr-05/" />
            </>,
          );
        });
        const inputs = [
          ...container.querySelectorAll<HTMLInputElement>('[data-testid="selectable-url"]'),
        ];
        expect(inputs).toHaveLength(3);
        const deadline = Date.now() + 2000;
        while (inputs.some((input) => !input.value)) {
          assert.ok(Date.now() < deadline, "All real tape links must finish encoding.");
          await act(async () => {
            await new Promise<void>((resolve) => setTimeout(resolve, 5));
          });
        }
        expect(inputs[0]?.value).toBe(inputs[1]?.value);
        expect(inputs[2]?.value).not.toBe(inputs[0]?.value);
        for (const [index, tape] of [first, restored, changed].entries()) {
          const decoded = decodeTapePermalink(inputs[index]?.value);
          assert.ok(decoded.kind === "success");
          expect(decoded.tape).toEqual(tape);
        }
      } finally {
        await act(async () => root.unmount());
        removeContainer(container);
      }
    });

    test("two independent controls label their own accepted experiment links", async () => {
      const first = tapeForSettings(ME01_TAPE, { ...ME01_TAPE.defaults, frameSpeed: 0.2 });
      const second = tapeForSettings(ME01_TAPE, { ...ME01_TAPE.defaults, frameSpeed: 0.7 });
      assert.ok(first && second, "Both real laboratory states must be recordable.");
      const container = createContainer();
      const root = createRoot(container);
      try {
        await act(async () => {
          root.render(
            <>
              <ShareControl tape={first} baseUrl="http://localhost/lab/me-01/" />
              <ShareControl tape={second} baseUrl="http://localhost/lab/me-01/" />
            </>,
          );
        });
        const controls = [...container.querySelectorAll(".share-control")];
        expect(controls).toHaveLength(2);
        const inputs = controls.map((control) => {
          const input = control.querySelector<HTMLInputElement>('[data-testid="selectable-url"]');
          const label = control.querySelector<HTMLLabelElement>(".share-control-url-label");
          assert.ok(input && label);
          expect(label.htmlFor).toBe(input.id);
          expect(document.getElementById(label.htmlFor)).toBe(input);
          return input;
        });
        expect(new Set(inputs.map((input) => input.id)).size).toBe(2);
        const deadline = Date.now() + 2000;
        while (inputs.some((input) => !input.value)) {
          assert.ok(Date.now() < deadline, "Both actual tape links must finish encoding.");
          await act(async () => {
            await new Promise<void>((resolve) => setTimeout(resolve, 5));
          });
        }
        const tapes = inputs.map((input) => {
          const decoded = decodeTapePermalink(input.value);
          assert.ok(decoded.kind === "success");
          return decoded.tape;
        });
        expect(tapes).toEqual([first, second]);
      } finally {
        await act(async () => root.unmount());
        removeContainer(container);
      }
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
