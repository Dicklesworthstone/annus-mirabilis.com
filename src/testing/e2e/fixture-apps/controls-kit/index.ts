/**
 * Controls Kit Interactive Fixture Application.
 * Specification: am-inst-parameter-controls-cmj9 requirement 8.
 *
 * Exercises all parameter field types: linear, log, grid-stepped with dependent resolution,
 * enumerated dropdowns, derived read-only metrics, and 64-bit decimal seeds against the
 * real parameter controls kit and store DOM contract attributes.
 */

import React, { createElement, useCallback, useState } from "react";
import { createRoot } from "react-dom/client";
import type { ParameterSpec } from "../../../../content/schemas/experiment.ts";
import { ControlsPanel } from "../../../../experiments/controls/ControlsPanel.tsx";
import { generateSeed } from "../../../../experiments/controls/seed.ts";
import type { CommandClass, ResetOptions } from "../../../../experiments/controls/types.ts";

export const FIXTURE_PARAMETER_SPECS: readonly ParameterSpec[] = Object.freeze([
  {
    id: "seed",
    label: "Seed",
    accessibleName: "Random stream seed",
    accessibleDescription: "64-bit decimal seed identifying this run's random draws",
    quantityId: "streamSeed",
    displayUnit: "",
    modelDomain: {
      reason: "Any canonical unsigned 64-bit decimal string; recorded, never guessed.",
    },
    visualRange: { min: 0, max: 1 },
    default: "1905",
    mapping: { kind: "linear" },
    role: "independent",
    commandClass: "setup-change",
  },
  {
    id: "T",
    label: "Temperature",
    accessibleName: "Absolute temperature of the suspension fluid",
    accessibleDescription: "Sets fluid temperature in Kelvin",
    quantityId: "temperature",
    displayUnit: "K",
    modelDomain: {
      min: 270,
      max: 350,
      minInclusive: true,
      maxInclusive: true,
      reason: "Liquid state of water at ordinary laboratory pressure",
    },
    visualRange: { min: 273, max: 330 },
    default: 290.15,
    mapping: { kind: "linear" },
    role: "independent",
    commandClass: "setup-change",
  },
  {
    id: "eta",
    label: "Viscosity",
    accessibleName: "Dynamic viscosity of the suspension fluid",
    accessibleDescription: "Sets fluid viscosity in pascal-seconds",
    quantityId: "viscosity",
    displayUnit: "mPa s",
    modelDomain: {
      min: 0.0001,
      max: 0.05,
      minInclusive: true,
      maxInclusive: true,
      reason: "Newtonian-liquid Stokes drag regime",
    },
    visualRange: { min: 0.0005, max: 0.02 },
    default: 0.00135,
    mapping: { kind: "linear" },
    role: "independent",
    commandClass: "setup-change",
  },
  {
    id: "a",
    label: "Radius",
    accessibleName: "Radius of the suspended tracer sphere",
    accessibleDescription: "Hydrodynamic radius in meters",
    quantityId: "particleRadius",
    displayUnit: "um",
    modelDomain: {
      min: 5e-8,
      max: 1e-5,
      minInclusive: true,
      maxInclusive: true,
      reason: "Stokes hydrodynamic regime",
    },
    visualRange: { min: 1e-7, max: 5e-6 },
    default: 5e-7,
    mapping: { kind: "log", base: 10 },
    role: "independent",
    commandClass: "setup-change",
  },
  {
    id: "h",
    label: "Time resolution",
    accessibleName: "Fundamental replay-grid step",
    accessibleDescription: "The base time step of the recorded path, in seconds",
    quantityId: "timeStep",
    displayUnit: "s",
    modelDomain: {
      min: 0.01,
      max: 1.0,
      minInclusive: true,
      maxInclusive: true,
      reason: "Sampling limits",
    },
    visualRange: { min: 0.01, max: 0.1 },
    default: 0.02,
    mapping: { kind: "step", size: 0.02 },
    role: "independent",
    commandClass: "setup-change",
  },
  {
    id: "interval",
    label: "Observation interval",
    accessibleName: "Interval between position observations",
    accessibleDescription: "Delta t used for the displayed statistics, in seconds",
    quantityId: "observationInterval",
    displayUnit: "s",
    modelDomain: {
      min: 0.01,
      max: 600,
      minInclusive: true,
      maxInclusive: true,
      reason: "Must land on the replay grid (integer multiple of h) and be at least 0.01 s",
    },
    visualRange: { min: 0.02, max: 60 },
    default: 1.0,
    mapping: { kind: "step", gridParameterId: "h" },
    role: "independent",
    commandClass: "measurement-change",
  },
  {
    id: "d",
    label: "Dimension",
    accessibleName: "Number of coordinates shown in the statistics",
    accessibleDescription: "1D marginal, 2D projection, or 3D",
    quantityId: "displayedDimension",
    displayUnit: "",
    modelDomain: {
      enumerated: [1, 2, 3],
      reason: "Marginal, planar, or full three-axis statistics",
    },
    visualRange: { min: 1, max: 3 },
    default: 1,
    mapping: { kind: "linear" },
    role: "independent",
    commandClass: "measurement-change",
  },
  {
    id: "D",
    label: "Diffusivity",
    accessibleName: "Calculated Stokes-Einstein diffusion coefficient",
    accessibleDescription: "Read-only derived diffusion coefficient",
    quantityId: "diffusionCoefficient",
    displayUnit: "um^2/s",
    modelDomain: { min: 0, minInclusive: true },
    visualRange: { min: 0, max: 10 },
    default: 0.3158,
    mapping: { kind: "linear" },
    role: "derived",
    derivedFrom: ["T", "eta", "a"],
    commandClass: "presentation-change",
  },
  {
    id: "statistic",
    label: "Statistic",
    accessibleName: "Displayed summary statistic",
    accessibleDescription: "Which reduction of the sampled displacements is shown",
    quantityId: "displayedStatistic",
    displayUnit: "",
    modelDomain: {
      enumerated: [1, 2],
      reason: "Statistic selector",
    },
    visualRange: { min: 1, max: 2 },
    default: 1,
    mapping: { kind: "linear" },
    role: "independent",
    commandClass: "estimator-change",
  },
]);

export function calculateDerivedDiffusivity(T: number, eta: number, a: number): number {
  const kB = 1.380649e-23;
  // D = (k_B * T) / (6 * pi * eta * a) in m^2/s, converted to um^2/s (* 1e12)
  const D_si = (kB * T) / (6 * Math.PI * eta * a);
  return Number((D_si * 1e12).toFixed(4));
}

export function ControlsKitFixtureApp() {
  const [values, setValues] = useState<Record<string, number | string>>(() => {
    const init: Record<string, number | string> = {};
    for (const spec of FIXTURE_PARAMETER_SPECS) {
      init[spec.id] = spec.default;
    }
    init.D = calculateDerivedDiffusivity(init.T as number, init.eta as number, init.a as number);
    return init;
  });

  const [runId, setRunId] = useState<string>("run-ck-001");
  const [snapshotVersion, setSnapshotVersion] = useState<number>(1);
  const [inputRevision, setInputRevision] = useState<number>(0);
  const [acceptedInputRevision, setAcceptedInputRevision] = useState<number>(0);
  const [lastCommandClass, setLastCommandClass] = useState<CommandClass | null>(null);

  const handleChange = useCallback(
    (paramId: string, newValue: number | string, commandClass: CommandClass) => {
      setInputRevision((r) => r + 1);
      setAcceptedInputRevision((r) => r + 1);
      setSnapshotVersion((v) => v + 1);
      setLastCommandClass(commandClass);

      setValues((prev) => {
        const next = { ...prev, [paramId]: newValue };
        if (paramId === "T" || paramId === "eta" || paramId === "a") {
          next.D = calculateDerivedDiffusivity(
            next.T as number,
            next.eta as number,
            next.a as number,
          );
        }
        return next;
      });

      if (commandClass === "setup-change") {
        setRunId(`run-ck-${Date.now()}`);
      }
    },
    [],
  );

  const handleReset = useCallback((options: ResetOptions) => {
    setInputRevision((r) => r + 1);
    setAcceptedInputRevision((r) => r + 1);
    setSnapshotVersion((v) => v + 1);
    setLastCommandClass("setup-change");

    setValues((prev) => {
      const next: Record<string, number | string> = {};
      for (const spec of FIXTURE_PARAMETER_SPECS) {
        next[spec.id] = spec.default;
      }
      if (options.mode === "same-seed") {
        next.seed = prev.seed ?? "1905";
      } else {
        next.seed = generateSeed();
      }
      next.D = calculateDerivedDiffusivity(next.T as number, next.eta as number, next.a as number);
      return next;
    });
    setRunId(`run-ck-reset-${Date.now()}`);
  }, []);

  return createElement(
    "div",
    {
      id: "controls-kit-fixture-root",
      "data-testid": "controls-kit-root",
      "data-instrument-id": "controls-kit",
      "data-instance-id": "instance-controls-kit-1",
      "data-run-id": runId,
      "data-snapshot-version": String(snapshotVersion),
      "data-input-revision": String(inputRevision),
      "data-accepted-input-revision": String(acceptedInputRevision),
      "data-pending": "false",
      "data-execution-label": "Controls Kit Fixture",
      "data-last-command-class": lastCommandClass ?? "none",
    },
    createElement(ControlsPanel, {
      specs: FIXTURE_PARAMETER_SPECS,
      values,
      onChange: handleChange,
      onReset: handleReset,
    }),
  );
}

// Auto-mount in browser environments
if (typeof document !== "undefined") {
  const container =
    document.getElementById("app") || document.body.appendChild(document.createElement("div"));
  container.id = "app";
  const root = createRoot(container);
  root.render(createElement(ControlsKitFixtureApp));
}
