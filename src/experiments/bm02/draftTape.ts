/**
 * BM-02's ?tape= binding for a form laboratory (am-inst-permalink-tape-s677):
 * content/experiments/bm-02.yaml's tapeModel (bm-02, version 1). A shared link puts its settings in
 * the form and calculates nothing; the reader applies them, which is the same contract BM-05's
 * binding states.
 *
 * WHY THIS ONE WAS MISSING, measured 2026-10-12. Of the laboratories a reader can set up, BM-02 and
 * LQ-02 were the only two whose component rendered no `<LabTapeLink>` and used no tape-link hook:
 * 27 lab components render one, these two did not. So a reader could arrange BM-02's twenty controls
 * and had no way to keep the arrangement, share it, or come back to it.
 *
 * The count of per-lab `permalink.ts` codecs is NOT the measure of that, and reading it as one is
 * how I nearly wrote seven unnecessary modules: SR-04, SR-05, LQ-03, LQ-04 and LQ-08 have no codec
 * and offer a reader a link anyway, through the generic tape. A codec is a lab's own `?a=1&b=2`
 * query format; the tape is the shared mechanism. BM-02 needs only the tape.
 *
 * The laboratory draws no random numbers -- `computeBm02Snapshot` is a pure function of the accepted
 * inputs and `Bm02Inputs` carries no seed -- so the deterministic stream and allocation below are
 * the honest values rather than placeholders, as in SR-05's binding.
 */
import type { DraftTapeBinding } from "../permalink/draftTape.ts";
import { BM02_DEFAULTS, validateBm02Parameters } from "./parameters.ts";

export const BM02_DRAFT_TAPE: DraftTapeBinding = Object.freeze({
  environment: Object.freeze({
    experimentId: "bm-02",
    mode: "bm-02:default",
    modelId: "bm-02",
    modelVersion: 1,
    constantSetId: "modern-si-2019",
    streamVersion: "deterministic",
    allocationId: "deterministic",
  }),
  defaults: BM02_DEFAULTS,
  validate: validateBm02Parameters,
});
