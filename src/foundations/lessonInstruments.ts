/**
 * Laboratories a lesson's construction refers to, by id and preset (am-found-transport-thermo-smv3:
 * "Embedded instruments are referenced by id and preset, never reimplemented here").
 *
 * A laboratory opens at its defaults, so a reference to a preset is honest only while the two
 * agree; foundTransport.entropyTemperature.test.ts pins each preset's values to the laboratory's
 * defaults and fails if either moves.
 */

export type LessonInstrument = Readonly<{
  instrumentId: string;
  presetId: string;
  /** The state the preset names, as the construction prints it. */
  frequencyTHz: number;
  temperatureK: number;
}>;

export const ENTROPY_TEMPERATURE_CHECK: LessonInstrument = {
  instrumentId: "lq-04",
  presetId: "lq-04-derived-temperature",
  frequencyTHz: 600,
  temperatureK: 3000,
};
