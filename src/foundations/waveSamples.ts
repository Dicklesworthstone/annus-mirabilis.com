import { planeWave } from "../physics/reference/radiation/waves.ts";
import { C_SI } from "../physics/reference/waves.ts";

/** A bounded teaching view of the existing plane-wave owner, in readable space and time units. */
export const WAVE_FIELDS = [
  {
    key: "wavelengthNm",
    label: "Wavelength, in nanometres",
    min: 200,
    max: 2000,
    refusal: "Enter a wavelength from 200 to 2000 nanometres.",
  },
  {
    key: "amplitudeVpm",
    label: "Field amplitude, in volts per metre",
    min: 0,
    max: 2,
    refusal: "Enter a field amplitude from 0 to 2 volts per metre.",
  },
  {
    key: "timeFs",
    label: "Elapsed time, in femtoseconds",
    min: 0,
    max: 20,
    refusal: "Enter an elapsed time from 0 to 20 femtoseconds.",
  },
  {
    key: "probeNm",
    label: "Position to inspect, in nanometres",
    min: 0,
    max: 2000,
    refusal: "Enter a position from 0 to 2000 nanometres.",
  },
] as const;

export type WaveSettingKey = (typeof WAVE_FIELDS)[number]["key"];
export type WaveSettings = Readonly<Record<WaveSettingKey, number>>;
export type WaveInputs = Readonly<Record<WaveSettingKey, string>>;

export const DEFAULT_WAVE_SETTINGS: WaveSettings = Object.freeze({
  wavelengthNm: 500,
  amplitudeVpm: 1,
  timeFs: 0,
  probeNm: 0,
});

export const WAVE_PLOT_WIDTH_NM = 2000;

export type WaveRefusal = Readonly<{
  kind: "refused";
  field: WaveSettingKey | null;
  reason: string;
}>;

export type WavePoint = Readonly<{
  positionNm: number;
  timeFs: number;
  fieldVpm: number;
  squareVpm2: number;
}>;

export type WaveSnapshot = Readonly<{
  settings: WaveSettings;
  frequencyTHz: number;
  periodFs: number;
  probe: WavePoint;
  /** Drawing and table use the same owner and the same accepted settings. */
  spatialCurve: readonly WavePoint[];
  spatialRows: readonly WavePoint[];
  cycleRows: readonly WavePoint[];
  cycleMeanFieldVpm: number;
  cycleMeanSquareVpm2: number;
}>;

export type WaveResult = Readonly<{ kind: "accepted"; snapshot: WaveSnapshot }> | WaveRefusal;

function checkWaveSettings(settings: WaveSettings): WaveRefusal | null {
  for (const field of WAVE_FIELDS) {
    const value = settings[field.key];
    if (!Number.isFinite(value) || value < field.min || value > field.max)
      return { kind: "refused", field: field.key, reason: field.refusal };
  }
  return null;
}

export function waveInputs(settings: WaveSettings): WaveInputs {
  return {
    wavelengthNm: String(settings.wavelengthNm),
    amplitudeVpm: String(settings.amplitudeVpm),
    timeFs: String(settings.timeFs),
    probeNm: String(settings.probeNm),
  };
}

/** Empty input is not zero, and no value is silently clamped to the construction's range. */
export function readWaveInputs(
  inputs: WaveInputs,
): Readonly<{ kind: "accepted"; settings: WaveSettings }> | WaveRefusal {
  for (const field of WAVE_FIELDS) {
    if (inputs[field.key].trim() === "")
      return { kind: "refused", field: field.key, reason: field.refusal };
  }
  const settings: WaveSettings = {
    wavelengthNm: Number(inputs.wavelengthNm),
    amplitudeVpm: Number(inputs.amplitudeVpm),
    timeFs: Number(inputs.timeFs),
    probeNm: Number(inputs.probeNm),
  };
  const refusal = checkWaveSettings(settings);
  return refusal ?? { kind: "accepted", settings: Object.freeze(settings) };
}

/**
 * Freeze one instant of a travelling wave, then inspect one position over a whole cycle.
 * The reference owner computes every field value; the lesson only changes display units and
 * aggregates its samples. Eight equally spaced phases exactly integrate the mean and mean square
 * of this single sinusoid, up to floating-point rounding. This is not a rule for arbitrary waves.
 */
export function waveSamples(input: WaveSettings): WaveResult {
  const refusal = checkWaveSettings(input);
  if (refusal) return refusal;
  const settings = Object.freeze({ ...input });
  const wavelength = settings.wavelengthNm * 1e-9;
  const periodFs = (wavelength / C_SI) * 1e15;
  const params = { wavelength, amplitude: settings.amplitudeVpm };
  const sample = (positionNm: number, timeFs: number): WavePoint | null => {
    const result = planeWave(params, positionNm * 1e-9, timeFs * 1e-15);
    if (result.status !== "value" || !Number.isFinite(result.value)) return null;
    return Object.freeze({
      positionNm,
      timeFs,
      fieldVpm: result.value,
      squareVpm2: result.value * result.value,
    });
  };
  const numericalRefusal: WaveRefusal = {
    kind: "refused",
    field: null,
    reason: "The wave model could not calculate these settings. Choose another setting.",
  };
  const probe = sample(settings.probeNm, settings.timeFs);
  if (!probe) return numericalRefusal;

  const spatialCurve: WavePoint[] = [];
  for (let index = 0; index <= 256; index++) {
    const point = sample((index / 256) * WAVE_PLOT_WIDTH_NM, settings.timeFs);
    if (!point) return numericalRefusal;
    spatialCurve.push(point);
  }
  const spatialRows: WavePoint[] = [];
  for (let index = 0; index <= 4; index++) {
    const point = sample((index / 4) * settings.wavelengthNm, settings.timeFs);
    if (!point) return numericalRefusal;
    spatialRows.push(point);
  }
  const cycleRows: WavePoint[] = [];
  for (let index = 0; index < 8; index++) {
    const point = sample(settings.probeNm, settings.timeFs + (index / 8) * periodFs);
    if (!point) return numericalRefusal;
    cycleRows.push(point);
  }
  return {
    kind: "accepted",
    snapshot: Object.freeze({
      settings,
      frequencyTHz: C_SI / wavelength / 1e12,
      periodFs,
      probe,
      spatialCurve: Object.freeze(spatialCurve),
      spatialRows: Object.freeze(spatialRows),
      cycleRows: Object.freeze(cycleRows),
      cycleMeanFieldVpm:
        cycleRows.reduce((sum, point) => sum + point.fieldVpm, 0) / cycleRows.length,
      cycleMeanSquareVpm2:
        cycleRows.reduce((sum, point) => sum + point.squareVpm2, 0) / cycleRows.length,
    }),
  };
}

/** Display rounding must not turn an exact zero into a negative-zero label. */
export function waveNumber(value: number): string {
  const rounded = Number(value.toFixed(4));
  return String(Object.is(rounded, -0) ? 0 : rounded).replace("-", "−");
}
