/**
 * LQ-02's ?tape= binding for a form laboratory (am-inst-permalink-tape-s677):
 * content/experiments/lq-02.yaml's tapeModel (lq-02, version 1). A shared link puts its settings in
 * the form and calculates nothing; the reader applies them, the same contract BM-05's binding states.
 *
 * WHY THIS ONE WAS MISSING, measured 2026-10-12. LQ-02 and BM-02 were the only two laboratories a
 * reader can set up whose component rendered no `<LabTapeLink>` and used no tape-link hook, against
 * 27 that do. A reader could set this laboratory's eighteen controls, reach a temperature and a
 * cutoff worth showing someone, and have no way to keep or share it.
 *
 * `Lq02Inputs` carries a temperature, a cutoff frequency, a probe frequency and the constant set,
 * and no seed: the allocation is a deterministic sum over modes rather than a sampled one, so the
 * deterministic stream and allocation below are the honest values rather than placeholders.
 */
import type { DraftTapeBinding } from "../permalink/draftTape.ts";
import { LQ02_DEFAULTS, validateLq02Parameters } from "./parameters.ts";

export const LQ02_DRAFT_TAPE: DraftTapeBinding = Object.freeze({
  environment: Object.freeze({
    experimentId: "lq-02",
    mode: "lq-02:default",
    modelId: "lq-02",
    modelVersion: 1,
    constantSetId: "modern-si-2019",
    streamVersion: "deterministic",
    allocationId: "deterministic",
  }),
  defaults: LQ02_DEFAULTS,
  validate: validateLq02Parameters,
});
