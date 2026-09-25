import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import LightQuantaInvestigationPage from "../app/discover/light-quanta/investigate/page.tsx";
import { LightQuantaInvestigation } from "../components/discover/LightQuantaInvestigation.tsx";
import { JourneyInPreparation } from "../discovery/JourneyInPreparation.tsx";
import { DISCOVERY_PAPERS } from "../discovery/journeyRegistry.ts";
import {
  evaluateLightInvestigation,
  type PreparedLightInvestigation,
} from "../discovery/lightQuanta/investigation.ts";
import { encodeResult } from "../experiments/results/codec.ts";
import prepared from "../generated/light-quanta-investigation.json";

const example = prepared as PreparedLightInvestigation;
const equations = {
  entropy: <span>entropy equation</span>,
  counting: <span>counting equation</span>,
  match: <span>matching equation</span>,
  emission: <span>emission equation</span>,
};

describe("Connected light investigation: real stores and server-rendered reading", () => {
  const html = renderToStaticMarkup(<LightQuantaInvestigationPage />);
  test("publishes a separate explanatory workbench, and says nothing of review", () => {
    expect(html).toContain('data-edition-status="explanatory-preview"');
    expect(html).toContain('data-light-investigation=""');
    // "A route you could take" stays; "Editorial and physics review remain pending" went
    // (D-2026-09-25-no-review-status-banners).
    expect(html).toContain("A route you could take");
    expect(html).not.toContain("review remain pending");
    expect(html).toContain("Modern SI constants");
    const placeholder = renderToStaticMarkup(
      <JourneyInPreparation {...DISCOVERY_PAPERS["light-quanta"]} />,
    );
    expect(placeholder).toContain("This journey is in preparation.");
    expect(placeholder).toContain('href="/discover/light-quanta/investigate/"');
  });
  test("all stages, calculated baseline and source bridges exist without JavaScript", () => {
    for (const id of ["light-entropy", "light-counting", "light-move", "light-prediction"])
      expect(html).toContain(`id="${id}"`);
    expect(html).toContain("JavaScript is off");
    expect(html).toContain('data-execution-label="static"');
    expect(html.match(/data-comparison-quantity=/g)?.length).toBe(12);
    expect(html).toContain(
      'data-quantity-id="effectiveIndependentCount" data-result-status="value"',
    );
    expect(html).toContain('href="/papers/light-quanta/view/facsimile/"');
    expect(html).toContain("hypothetical surface");
    expect(html).toContain("Share accepted investigation settings");
    expect(html).toContain("Export accepted comparison as JSON");
    expect(html).toContain("data-coefficient-handoff");
  });
  test("renders real KaTeX plus MathML and links all nine specialist instruments", () => {
    expect(html).toContain('class="katex"');
    expect(html).toContain("<math");
    for (let i = 1; i <= 9; i++) expect(html).toContain(`/lab/lq-${String(i).padStart(2, "0")}/`);
    expect(html).not.toContain('type="range"');
  });
  test("predictions are optional and interpretation changes are not computations", () => {
    expect(html).toContain("No answer is required");
    expect(html).toContain("This choice does not change any numbers");
    expect(html).toContain("Read the explanations without making a prediction");
    expect(html).toContain("outside its domain");
    expect(html).toContain("not a historical dataset");
  });
  test("outside-domain views preserve the gate and show no stale inferred count", () => {
    const parameters = { ...example.parameters, referenceTemperature: 10000 };
    const altered: PreparedLightInvestigation = {
      ...example,
      parameters,
      results: evaluateLightInvestigation(parameters).map(encodeResult),
    };
    const rendered = renderToStaticMarkup(
      <LightQuantaInvestigation example={altered} equations={equations} />,
    );
    expect(rendered).toContain("data-inference-blocked");
    expect(rendered).toContain(
      'data-quantity-id="effectiveIndependentCount" data-result-status="outside-domain"',
    );
    expect(rendered).toContain(
      'data-quantity-id="independentProbability" data-result-status="value"',
    );
  });
  test("two placements never reuse form IDs or share accepted run identities", () => {
    const rendered = renderToStaticMarkup(
      <>
        <LightQuantaInvestigation example={example} equations={equations} />
        <LightQuantaInvestigation example={example} equations={equations} />
      </>,
    );
    const ids = [...rendered.matchAll(/<(?:input|textarea)[^>]* id="([^"]+)"/g)].map((m) => m[1]);
    expect(ids.length).toBe(22);
    expect(new Set(ids).size).toBe(ids.length);
    const allIds = [...rendered.matchAll(/ id="([^"]+)"/g)].map((m) => m[1]);
    expect(new Set(allIds).size).toBe(allIds.length);
  });
});
