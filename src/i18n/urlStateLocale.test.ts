import assert from "node:assert/strict";
import test from "node:test";

/**
 * Serializes experiment state into a canonical URL search string.
 * Enforces: URL state serialization is strictly locale-independent.
 */
function serializeExperimentUrlState(state: {
  temperature: number;
  viscosity: number;
  seed: string;
  preset?: string;
  uiLocale: string;
}): string {
  const params = new URLSearchParams();
  // Canonical serialization: floats serialized as canonical JS numbers, seeds as decimal u64 strings
  params.set("temperature", String(state.temperature));
  params.set("viscosity", String(state.viscosity));
  params.set("seed", state.seed);
  if (state.preset) params.set("preset", state.preset);
  // Note: uiLocale is reader state, not physics world state, but even if passed, the serialized world parameters are identical
  return params.toString();
}

test("urlStateLocale: experiment state serialization is byte-identical across 'de' and 'en' locales", () => {
  const stateDe = {
    temperature: 293.15,
    viscosity: 0.4814,
    seed: "18446744073709551615", // u64 max (> 2^53)
    preset: "historical-water-room-temp",
    uiLocale: "de",
  };

  const stateEn = {
    temperature: 293.15,
    viscosity: 0.4814,
    seed: "18446744073709551615",
    preset: "historical-water-room-temp",
    uiLocale: "en",
  };

  const urlDe = serializeExperimentUrlState(stateDe);
  const urlEn = serializeExperimentUrlState(stateEn);

  assert.equal(urlDe, urlEn);
  assert.equal(urlDe.includes("0.4814"), true);
  assert.equal(urlDe.includes("0,4814"), false);
  assert.equal(urlDe.includes("18446744073709551615"), true);
});
