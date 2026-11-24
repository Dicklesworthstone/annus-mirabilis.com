import type { RecordedExperiment } from "../../experiments/permalink/recordedExperiments.ts";
import type { NotebookStore } from "./notebookStore.ts";
import { NotebookRecordingError, recordingLaboratory } from "./recordingEntry.ts";
import { type NotebookRecordingEntry, parseNotebookEntry } from "./schema.ts";

/** Store a copy of the reader's recording; scientific admission stays with the tape owner. */
export function makeRecordingEntry(
  recording: RecordedExperiment,
  id = crypto.randomUUID(),
  createdAt = new Date().toISOString(),
): NotebookRecordingEntry {
  const laboratory = recordingLaboratory(recording.experimentId);
  if (!laboratory)
    throw new NotebookRecordingError(
      "notebook-recording-save-instrument",
      "This laboratory does not yet support notebook recordings.",
    );
  return parseNotebookEntry({
    id,
    createdAt,
    kind: "recording",
    title: recording.title,
    text: "",
    frame: {
      paper: laboratory.paper,
      anchor: laboratory.anchor,
      view: "reading",
      detail: 1,
      lens: "paper",
      open: "",
    },
    recording,
  }) as NotebookRecordingEntry;
}

/** Uses the existing notebook namespace, capacity checks and recoverable storage behavior. */
export function saveNotebookRecording(store: NotebookStore, recording: RecordedExperiment) {
  return store.add(makeRecordingEntry(recording));
}
