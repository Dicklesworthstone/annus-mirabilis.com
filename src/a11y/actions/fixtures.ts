/**
 * Action Contract Fixtures for all Six Action Families (am-a11y-action-contracts-k75g).
 *
 * Provides:
 * 1. Interval family fixture (proven on BM-06 before slice freeze)
 * 2. Planted contract fixtures for the 5 later families (event-table, ratio, axis-component, object-inclusion, subexpression)
 * 3. Adversarial / invalid planted contract fixtures for audit validation
 */

import type { ActionContract } from "./types.ts";

export const fixtureIntervalContract: ActionContract = Object.freeze({
  actionId: "bm06-select-interval",
  family: "interval",
  question: "Select spatial interval [a, b] to compute diffusion probability and particle count.",
  inputs: ["interval_lower", "interval_upper", "confidence_level"],
  commandClass: "measurement-change",
  acceptedResult: {
    outputs: ["interval_probability", "expected_particles", "sample_variance"],
    allowedStatuses: ["value", "outside-domain", "analytic-limit"],
  },
  visualAffordance:
    "Drag lower and upper boundary handles on the 1D diffusion distribution slider.",
  equivalentAffordance:
    "Type lower and upper limit values into numeric stepper fields and select interval comparison.",
  announcement:
    "Interval set to [{interval_lower}, {interval_upper}] µm: Probability {interval_probability}%, expected {expected_particles} particles.",
  modalities: ["keyboard", "direct-entry", "screen-reader", "switch-control"] as const,
});

export const fixtureEventTableContract: ActionContract = Object.freeze({
  actionId: "sr03-select-clock-event",
  family: "event-table",
  question:
    "Select spacetime event to evaluate simultaneity and coordinate transformation across frames.",
  inputs: ["event_id", "reference_frame"],
  commandClass: "observer-change",
  acceptedResult: {
    outputs: ["t_prime", "x_prime", "simultaneity_gap"],
    allowedStatuses: ["value", "outside-domain"],
  },
  visualAffordance: "Click event point on Minkowski spacetime diagram.",
  equivalentAffordance:
    "Select event row from the accessible events table and choose observer frame from dropdown.",
  announcement: "Event {event_id} in frame {reference_frame}: t' = {t_prime} s, x' = {x_prime} m.",
  modalities: ["keyboard", "screen-reader"] as const,
});

export const fixtureRatioContract: ActionContract = Object.freeze({
  actionId: "lq02-set-frequency-ratio",
  family: "ratio",
  question: "Set frequency ratio to compare blackbody radiation energy density.",
  inputs: ["frequency_ratio", "spectral_band"],
  commandClass: "physical-intervention",
  acceptedResult: {
    outputs: ["energy_density_ratio", "wien_displacement_shift"],
    allowedStatuses: ["value", "analytic-limit"],
  },
  visualAffordance: "Adjust continuous frequency ratio slider with logarithmic curve.",
  equivalentAffordance:
    "Choose ratio from predefined buttons (half, same, double) or type exact numeric ratio.",
  announcement:
    "Frequency ratio set to {frequency_ratio} in band {spectral_band}: Energy density ratio is {energy_density_ratio}.",
  modalities: ["keyboard", "direct-entry", "screen-reader"] as const,
});

export const fixtureAxisComponentContract: ActionContract = Object.freeze({
  actionId: "sr06-select-field-component",
  family: "axis-component",
  question:
    "Select electromagnetic field vector component to evaluate Lorentz field transformation.",
  inputs: ["field_axis", "component_magnitude", "frame_velocity"],
  commandClass: "setup-change",
  acceptedResult: {
    outputs: ["transformed_e_field", "transformed_b_field"],
    allowedStatuses: ["value", "outside-domain"],
  },
  visualAffordance: "Rotate 3D field vector arrow in spatial coordinates.",
  equivalentAffordance:
    "Select axis component (X, Y, Z) via radio group and type signed field magnitude.",
  announcement:
    "Component {field_axis} magnitude {component_magnitude} V/m at v={frame_velocity}c: E'={transformed_e_field}, B'={transformed_b_field}.",
  modalities: ["keyboard", "direct-entry", "screen-reader"] as const,
});

export const fixtureObjectInclusionContract: ActionContract = Object.freeze({
  actionId: "me03-toggle-emitter-boundary",
  family: "object-inclusion",
  question:
    "Include or exclude radiating emitter from system control volume to compute mass-energy transfer.",
  inputs: ["object_id", "included_in_boundary"],
  commandClass: "estimator-change",
  acceptedResult: {
    outputs: ["total_system_energy", "net_mass_change"],
    allowedStatuses: ["value", "analytic-limit"],
  },
  visualAffordance: "Draw or resize system boundary polygon around radiation source.",
  equivalentAffordance: "Toggle object inclusion checkbox in the system boundary checklist table.",
  announcement:
    "Object {object_id} {included_in_boundary}: Total system energy is {total_system_energy} J, mass change Δm is {net_mass_change} kg.",
  modalities: ["keyboard", "screen-reader"] as const,
});

export const fixtureSubexpressionContract: ActionContract = Object.freeze({
  actionId: "eq01-step-derivation-term",
  family: "subexpression",
  question: "Select algebraic subexpression to apply substitution and advance derivation.",
  inputs: ["subexpression_id", "rule_id"],
  commandClass: "presentation-change",
  acceptedResult: {
    outputs: ["resulting_expression", "step_validity"],
    allowedStatuses: ["value", "refused"],
  },
  visualAffordance: "Click or highlight subexpression token in mathematical formula visual.",
  equivalentAffordance:
    "Select subexpression from ordered list with role description and press step advance button.",
  announcement:
    "Applied rule {rule_id} to subexpression {subexpression_id}: New expression {resulting_expression}.",
  modalities: ["keyboard", "screen-reader"] as const,
});

export const ALL_FIXTURE_ACTION_CONTRACTS = Object.freeze([
  fixtureIntervalContract,
  fixtureEventTableContract,
  fixtureRatioContract,
  fixtureAxisComponentContract,
  fixtureObjectInclusionContract,
  fixtureSubexpressionContract,
]);

// Planted adversarial fixtures for testing audit rejections
export const fixtureDragOnlyForbiddenContract: ActionContract = Object.freeze({
  actionId: "drag-only-test",
  family: "interval",
  question: "Drag-only test question.",
  inputs: ["val"],
  commandClass: "physical-intervention",
  acceptedResult: { outputs: ["out"], allowedStatuses: ["value"] },
  visualAffordance: "Drag slider",
  equivalentAffordance: "Drag slider with mouse", // FORBIDDEN!
  announcement: "Announce",
});

export const fixtureMissingAnnouncementContract: ActionContract = Object.freeze({
  actionId: "missing-announcement-test",
  family: "interval",
  question: "Missing announcement test question.",
  inputs: ["val"],
  commandClass: "physical-intervention",
  acceptedResult: { outputs: ["out"], allowedStatuses: ["value"] },
  visualAffordance: "Click button",
  equivalentAffordance: "Type in input",
  announcement: "", // MISSING!
});
