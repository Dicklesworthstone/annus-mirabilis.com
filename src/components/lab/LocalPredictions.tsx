"use client";

import { LOCAL_PREDICT_PERSISTENCE } from "../../experiments/predict/localPredictPersistence.ts";
import { installPredictPersistence } from "../../experiments/predict/predictPersistence.ts";

// At module evaluation, so it is in place before any gate below it reads it after mount.
installPredictPersistence(LOCAL_PREDICT_PERSISTENCE);

/**
 * Lets the predict gate remember the reader's answers in their local store. Rendered by the site's
 * own routes that hold a gated laboratory (the /lab/ and /discover/ layouts and the paper
 * reader's inline laboratory), and never by an embed, whose gate then asks every time and keeps
 * nothing (src/experiments/predict/predictPersistence.ts). It draws nothing.
 */
export function LocalPredictions(): null {
  return null;
}
