import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { PhotoelectricLab } from "../../components/lab/lq08/PhotoelectricLab.tsx";
import { PREDICT_PROMPTS } from "../../generated/predict-prompts.ts";

/**
 * LQ-08 under predict mode (am-inst-predict-mode-ti7m, dispatch 156 option c). The three drawings'
 * titles, axes and levels stay in view; the parts the three prompts ask about wait for an answer
 * or a skip. PredictGate.test.tsx covers the waiting and the reveal for the lab as a whole; this
 * file names the parts inside each drawing, and the second laboratory, which does not ask.
 */
describe("LQ-08 asks before it shows what its prompts ask about", () => {
  const html = renderToStaticMarkup(<PhotoelectricLab />);

  test("it asks the manifest's three prompts, and each drawing keeps its title in view", () => {
    for (const prompt of PREDICT_PROMPTS["lq-08"] ?? [])
      expect(html).toContain(`data-predict-prompt="${prompt.promptId}"`);
    expect(PREDICT_PROMPTS["lq-08"]?.length).toBe(3);
    for (const title of [
      "Where one quantum’s energy goes",
      "Stopping potential against frequency",
      "Current against collector potential",
    ])
      expect(html).toMatch(new RegExp(`<div data-view-id="lq-08-[^"]+"[^>]*><h3[^>]*>${title}`));
  });

  test("the fastest electrons' energy, the slope, the lines and the counts wait", () => {
    // Energy ladder: K_max, or "no electron escapes", in one waiting group.
    expect(html).toMatch(/<g data-predict-response="awaiting"><line[^>]*><\/line><circle/);
    // Stopping potential: the sentence naming one slope for every metal, and the line itself.
    expect(html).toMatch(/<p data-predict-response="awaiting"[^>]*>In the model the slope is h\/e/);
    expect(html).toMatch(/<line data-predict-response="awaiting"[^>]*stroke="var\(--plot\)"/);
    // Current against potential: the saturation current and the curve.
    expect(html).toMatch(/<p data-predict-response="awaiting"[^>]*>Saturation current/);
    // The quanta arriving each second, which the second prompt asks about.
    expect(html).toMatch(/lab-slider-readout" data-predict-response="awaiting"/);
    expect(html).toMatch(/class="lab-values" data-predict-response="awaiting"/);
    expect(html).not.toContain('data-predict-response="shown"');
  });

  test("the energy ladder's name says quantum, not photon", () => {
    expect(html).toContain('aria-label="Energy ladder diagram showing quantum energy');
    // Only the names: the word stays where it is history (R3 dates it to Lewis, 1926) or a
    // disclaimer (the not-modelled list), and in the arrow marker's internal id.
    const names = [...html.matchAll(/aria-label="([^"]*)"/g)].map((m) => m[1] ?? "");
    expect(names.length).toBeGreaterThan(3);
    expect(names.filter((n) => /\bphotons?\b/i.test(n))).toEqual([]);
  });

  test("the optional second laboratory asks nothing and shows its result", () => {
    const second = renderToStaticMarkup(
      <PhotoelectricLab readings={false} linked={false} predict={false} />,
    );
    expect(second).not.toContain("data-predict-gate");
    expect(second).not.toContain('data-predict-response="awaiting"');
    expect(second).toContain('data-predict-response="shown"');
  });
});
