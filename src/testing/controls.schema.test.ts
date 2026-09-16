import { describe, expect, test } from "bun:test";
import React, { createElement } from "react";
import { renderToString } from "react-dom/server";
import type { ParameterSpec } from "../content/schemas/experiment.ts";
import { ControlsPanel } from "../experiments/controls/ControlsPanel.tsx";
import { ParameterControl } from "../experiments/controls/ParameterControl.tsx";
import { FIXTURE_PARAMETER_SPECS } from "./e2e/fixture-apps/controls-kit/index.ts";

describe("Parameter Controls Schema & Component Generation (am-inst-parameter-controls-cmj9)", () => {
  test("generates controls for all field types (linear, log, step, enum, derived, seed)", () => {
    const values: Record<string, number | string> = {
      seed: "1905",
      T: 290.15,
      eta: 0.00135,
      a: 5e-7,
      h: 0.02,
      interval: 1.0,
      d: 1,
      D: 0.3158,
      statistic: 1,
    };

    const html = renderToString(
      createElement(ControlsPanel, {
        specs: FIXTURE_PARAMETER_SPECS,
        values,
        onChange: () => {},
      }),
    );

    expect(html).toContain('data-parameter-id="seed"');
    expect(html).toContain('data-parameter-id="T"');
    expect(html).toContain('data-parameter-id="eta"');
    expect(html).toContain('data-parameter-id="a"');
    expect(html).toContain('data-parameter-id="h"');
    expect(html).toContain('data-parameter-id="interval"');
    expect(html).toContain('data-parameter-id="d"');
    expect(html).toContain('data-parameter-id="D"');
    expect(html).toContain('data-parameter-id="statistic"');
  });

  test("derived parameters are strictly read-only and display owner value", () => {
    const derivedSpec = FIXTURE_PARAMETER_SPECS.find((s) => s.id === "D")!;
    expect(derivedSpec.role).toBe("derived");

    const html = renderToString(
      createElement(ParameterControl, {
        spec: derivedSpec,
        value: 0.3158,
      }),
    );

    expect(html).toContain('aria-readonly="true"');
    expect(html).toContain('data-testid="derived-D"');
    expect(html).toContain("0.3158");
    expect(html).toContain("um^2/s");
    expect(html).toContain("Derived");
  });

  test("advanced fields are placed in the 'Experiment settings' drawer", () => {
    const values = {
      seed: "1905",
      T: 290.15,
      eta: 0.00135,
      a: 5e-7,
      h: 0.02,
      interval: 1.0,
      d: 1,
      D: 0.3158,
      statistic: 1,
    };

    const html = renderToString(
      createElement(ControlsPanel, {
        specs: FIXTURE_PARAMETER_SPECS,
        values,
        onChange: () => {},
      }),
    );

    // estimator-change parameter 'statistic' should be inside drawer
    expect(html).toContain('class="experiment-settings-drawer"');
    expect(html).toContain("Experiment settings");
    expect(html).toContain('data-testid="advanced-controls-group"');
  });

  test("a value beyond visual range but inside model domain is marked beyond-track", () => {
    const tSpec = FIXTURE_PARAMETER_SPECS.find((s) => s.id === "T")!;
    // Visual range: [273, 330], Model domain: [270, 350]
    // Value 340 is inside model domain but outside visual range
    const html = renderToString(
      createElement(ParameterControl, {
        spec: tSpec,
        value: 340,
      }),
    );

    expect(html).toContain('data-beyond-track="true"');
    expect(html).toContain("Beyond visual track");
  });
});
