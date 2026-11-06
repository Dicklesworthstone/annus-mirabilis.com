/** The desk admits only these existing instruments' isolated historical adapters. */
import {
  DEFAULT_HISTORICAL_LQ02_INPUTS,
  HISTORICAL_LQ02_MODE,
  HISTORICAL_LQ02_PATH,
  HISTORICAL_LQ02_PRESET,
} from "../../experiments/lq02/historical.ts";
import { HISTORICAL_SHELF_BINDINGS } from "../../experiments/shelf/historicalExample.ts";
import {
  SR04_HISTORICAL_DEFAULTS,
  SR04_HISTORICAL_MODE,
  SR04_HISTORICAL_PATH,
  SR04_HISTORICAL_PRESET,
} from "../../experiments/sr04/historical.ts";

export const DESK_INSTRUMENT_BINDINGS = Object.freeze({
  "lq-02": {
    instrumentId: "lq-02",
    modeId: HISTORICAL_LQ02_MODE,
    presetId: HISTORICAL_LQ02_PRESET,
    standalonePath: HISTORICAL_LQ02_PATH,
  },
  "sr-04": {
    instrumentId: "sr-04",
    modeId: SR04_HISTORICAL_MODE,
    presetId: SR04_HISTORICAL_PRESET,
    standalonePath: SR04_HISTORICAL_PATH,
  },
  ...HISTORICAL_SHELF_BINDINGS,
} as const);

export const DESK_MANIFEST_DEFAULTS = {
  "lq-02": DEFAULT_HISTORICAL_LQ02_INPUTS,
  "sr-04": SR04_HISTORICAL_DEFAULTS,
} as const;
