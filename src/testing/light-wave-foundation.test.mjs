import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DEFAULT_WAVE_SETTINGS,
  readWaveInputs,
  WAVE_FIELDS,
  WAVE_PLOT_WIDTH_NM,
  waveDisplayValue,
  waveInputs,
  waveNumber,
  waveSamples,
} from "../foundations/waveSamples.ts";
import { planeWave } from "../physics/reference/radiation/waves.ts";
import { C_SI } from "../physics/reference/waves.ts";

function accepted(settings = DEFAULT_WAVE_SETTINGS) {
  const result = waveSamples(settings);
  assert.equal(result.kind, "accepted", JSON.stringify(result));
  return result.snapshot;
}

function close(actual, expected, label) {
  const tolerance = 1e-11 * Math.max(1, Math.abs(actual), Math.abs(expected));
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    label + ": " + actual + " versus " + expected,
  );
}

describe("the fields-and-waves foundation samples one physical wave", () => {
  it("keeps SI physics while presenting nanometres, terahertz and femtoseconds", () => {
    const state = accepted();
    close(state.frequencyTHz, 599.584916, "500 nm frequency");
    close(state.periodFs, 1.6678204759907602, "500 nm period");
    close(state.frequencyTHz * 1e12 * state.settings.wavelengthNm * 1e-9, C_SI, "wave speed");
    close(state.frequencyTHz * 1e12 * state.periodFs * 1e-15, 1, "cycles per period");
    close(state.probe.fieldVpm, 1, "initial crest");
    assert.equal(state.spatialCurve[0].positionNm, 0);
    assert.equal(state.spatialCurve.at(-1).positionNm, WAVE_PLOT_WIDTH_NM);
  });

  it("moves a crest by a quarter wavelength in a quarter period without changing its height", () => {
    const base = accepted();
    const later = accepted({
      ...DEFAULT_WAVE_SETTINGS,
      timeFs: base.periodFs / 4,
      probeNm: DEFAULT_WAVE_SETTINGS.wavelengthNm / 4,
    });
    close(later.probe.fieldVpm, base.probe.fieldVpm, "travelling crest");
    close(
      later.probe.positionNm * 1e-9 / (later.probe.timeFs * 1e-15),
      C_SI,
      "crest speed",
    );
    const fixedPlace = accepted({ ...DEFAULT_WAVE_SETTINGS, timeFs: base.periodFs / 4 });
    close(fixedPlace.probe.fieldVpm, 0, "the same place after a quarter period");
    const halfPeriod = accepted({ ...DEFAULT_WAVE_SETTINGS, timeFs: base.periodFs / 2 });
    close(halfPeriod.probe.fieldVpm, -1, "the same place after half a period");
    const fullPeriod = accepted({ ...DEFAULT_WAVE_SETTINGS, timeFs: base.periodFs });
    close(fullPeriod.probe.fieldVpm, 1, "one whole cycle");
  });

  it("changes wavelength and amplitude in distinct ways with the axes held fixed", () => {
    const base = accepted();
    const longer = accepted({ ...DEFAULT_WAVE_SETTINGS, wavelengthNm: 1000 });
    close(longer.periodFs, 2 * base.periodFs, "longer period");
    close(longer.frequencyTHz, base.frequencyTHz / 2, "lower frequency");
    close(longer.probe.fieldVpm, base.probe.fieldVpm, "unchanged field amplitude");
    const stronger = accepted({ ...DEFAULT_WAVE_SETTINGS, amplitudeVpm: 2 });
    close(stronger.probe.fieldVpm, 2 * base.probe.fieldVpm, "doubled amplitude");
    close(stronger.cycleMeanSquareVpm2, 4 * base.cycleMeanSquareVpm2, "squared response");
    close(stronger.frequencyTHz, base.frequencyTHz, "unchanged frequency");
    assert.deepEqual(
      longer.spatialCurve.map((point) => point.positionNm),
      base.spatialCurve.map((point) => point.positionNm),
    );
  });

  it("conserves the cycle means for different phases, wavelengths, positions and amplitudes", () => {
    for (const wavelengthNm of [200, 500, 1000, 2000]) {
      for (const amplitudeVpm of [0, 0.5, 1, 2]) {
        for (const timeFs of [0, 0.3, 19]) {
          for (const probeNm of [0, 137, 2000]) {
            const state = accepted({ wavelengthNm, amplitudeVpm, timeFs, probeNm });
            close(state.cycleMeanFieldVpm, 0, "zero cycle mean");
            close(state.cycleMeanSquareVpm2, amplitudeVpm ** 2 / 2, "nonzero mean square");
            close(
              state.spatialRows[0].fieldVpm,
              state.spatialRows.at(-1).fieldVpm,
              "one spatial period",
            );
            assert.ok(state.spatialCurve.length > 0);
            assert.ok(state.cycleRows.length > 0);
            assert.ok(state.spatialCurve.every((point) => point.timeFs === timeFs));
            assert.ok(state.cycleRows.every((point) => point.positionNm === probeNm));
            assert.ok(state.cycleRows.every((point) => point.squareVpm2 >= 0));
          }
        }
      }
    }
  });

  it("draws and tabulates the reference owner's values, including the inspected position", () => {
    const state = accepted({
      wavelengthNm: 700,
      amplitudeVpm: 1.25,
      timeFs: 3.1,
      probeNm: 137,
    });
    const points = [
      state.probe,
      ...state.spatialCurve,
      ...state.spatialRows,
      ...state.cycleRows,
    ];
    for (const point of points) {
      const owner = planeWave(
        { amplitude: state.settings.amplitudeVpm, wavelength: state.settings.wavelengthNm * 1e-9 },
        point.positionNm * 1e-9,
        point.timeFs * 1e-15,
      );
      assert.equal(owner.status, "value");
      assert.equal(point.fieldVpm, owner.value);
      assert.equal(point.squareVpm2, owner.value * owner.value);
    }
    assert.ok(Object.isFrozen(state));
    assert.ok(Object.isFrozen(state.settings));
    assert.ok(Object.isFrozen(state.spatialCurve));
    assert.ok(points.every(Object.isFrozen));
  });

  it("admits zero amplitude without dividing by it or inventing a nonzero response", () => {
    const state = accepted({ ...DEFAULT_WAVE_SETTINGS, amplitudeVpm: 0 });
    assert.equal(state.cycleMeanFieldVpm, 0);
    assert.equal(state.cycleMeanSquareVpm2, 0);
    assert.ok(state.spatialCurve.every((point) => point.fieldVpm === 0));
    assert.ok(state.cycleRows.every((point) => point.squareVpm2 === 0));
  });
});

describe("wave settings preserve an applied picture until legal input is supplied", () => {
  it("rejects empty, nonfinite and out-of-range drafts instead of converting or clamping them", () => {
    for (const field of WAVE_FIELDS) {
      for (const raw of [
        "",
        " ",
        "NaN",
        "Infinity",
        "1e309",
        String(field.min - 1),
        String(field.max + 1),
      ]) {
        const result = readWaveInputs({
          ...waveInputs(DEFAULT_WAVE_SETTINGS),
          [field.key]: raw,
        });
        assert.equal(result.kind, "refused", field.key + " " + raw);
        assert.equal(result.field, field.key);
        assert.equal(result.reason, field.refusal);
      }
      for (const bad of [NaN, Infinity, -Infinity, field.min - 1, field.max + 1]) {
        const result = waveSamples({ ...DEFAULT_WAVE_SETTINGS, [field.key]: bad });
        assert.equal(result.kind, "refused");
        assert.equal(result.field, field.key);
      }
      for (const legal of [field.min, field.max]) {
        const settings = { ...DEFAULT_WAVE_SETTINGS, [field.key]: legal };
        assert.equal(readWaveInputs(waveInputs(settings)).kind, "accepted");
        assert.equal(waveSamples(settings).kind, "accepted");
      }
    }
  });

  it("copies the accepted settings, leaves the defaults intact, and formats zero honestly", () => {
    const settings = { ...DEFAULT_WAVE_SETTINGS };
    const state = accepted(settings);
    settings.timeFs = 10;
    assert.equal(state.settings.timeFs, 0);
    assert.equal(DEFAULT_WAVE_SETTINGS.timeFs, 0);
    assert.deepEqual(readWaveInputs(waveInputs(DEFAULT_WAVE_SETTINGS)), {
      kind: "accepted",
      settings: DEFAULT_WAVE_SETTINGS,
    });
    assert.equal(waveNumber(-0), "0");
    assert.equal(waveNumber(-1e-15), "minus 1.0000 times 10 to the power minus 15");
    assert.equal(waveNumber(-0.5), "−0.5");
  });

  it("preserves a weak wave while suppressing only roundoff relative to its amplitude", () => {
    assert.equal(waveDisplayValue(-1e-15), -1e-15);
    assert.equal(waveDisplayValue(-1e-15, 1), 0);
    assert.equal(waveNumber(-1e-15, 1), "0");
    assert.equal(waveDisplayValue(-1e-15, 0.001), -1e-15);

    const weak = accepted({ ...DEFAULT_WAVE_SETTINGS, amplitudeVpm: 0.001 });
    const squaredAmplitude = weak.settings.amplitudeVpm ** 2;
    assert.ok(Math.abs(weak.cycleMeanSquareVpm2 - 5e-7) <= 5e-19);
    assert.equal(
      waveDisplayValue(weak.cycleMeanSquareVpm2, squaredAmplitude),
      weak.cycleMeanSquareVpm2,
    );
    assert.equal(
      waveNumber(weak.cycleMeanSquareVpm2, squaredAmplitude),
      "5.0000 times 10 to the power minus 7",
    );
    assert.equal(waveNumber(weak.probe.fieldVpm, weak.settings.amplitudeVpm), "0.001");

    const quarter = accepted({ ...weak.settings, timeFs: weak.periodFs / 4 });
    assert.equal(waveDisplayValue(quarter.probe.fieldVpm, weak.settings.amplitudeVpm), 0);
    assert.equal(waveNumber(quarter.probe.fieldVpm, weak.settings.amplitudeVpm), "0");
  });
});
