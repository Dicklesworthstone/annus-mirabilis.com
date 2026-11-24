import { recordingLaboratory } from "./recordingEntry.ts";
import type { NotebookRecordingEntry } from "./schema.ts";

function element<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  text = "",
): HTMLElementTagNameMap[K] {
  const result = document.createElement(tag);
  result.textContent = text;
  return result;
}

/** Private words stay in text nodes. Opening this view does not decode ranges, run or restore. */
export function appendRecordingView(
  host: HTMLElement,
  entry: NotebookRecordingEntry,
  download: (source: string, filename: string, type: string) => void,
): void {
  const laboratory = recordingLaboratory(entry.recording.experimentId);
  if (!laboratory) return;
  const section = element("section");
  section.setAttribute("data-notebook-recording", laboratory.experimentId);
  section.append(
    element(
      "p",
      "This recording preserves the saved settings, scientific checkpoints and your own stop notes. " +
        "A compatible replay is checked in the laboratory before its result is accepted.",
    ),
  );
  const open = element("a", "Open " + laboratory.title + " to restore a saved stop");
  open.href = laboratory.href;
  section.append(
    open,
    element(
      "p",
      "In the laboratory, open the recording controls, choose “Show notebook recordings”, " +
        "then open this recording. Previewing and opening do not run it; choose Restore when you are ready.",
    ),
  );
  const stops = element("ol");
  for (const stop of entry.recording.stops) {
    const item = element("li");
    item.append(element("h4", stop.label));
    if (stop.note) item.append(element("p", stop.note));
    const checkpoint = stop.tape.acceptedCheckpoint as Readonly<Record<string, unknown>>;
    item.append(
      element(
        "p",
        checkpoint.scientificState
          ? "Saved scientific checkpoint. Restore verifies its accepted output digest."
          : "Saved settings only. Calculate these settings as a new run in the laboratory.",
      ),
    );
    const seed = element(
      "p",
      typeof stop.tape.seed === "string" ? "Exact seed: " : "No seeded stream declared.",
    );
    if (typeof stop.tape.seed === "string") seed.append(element("code", stop.tape.seed));
    item.append(seed);
    const details = element("details");
    details.append(element("summary", "Saved settings"));
    details.append(element("pre", JSON.stringify(stop.tape.initialConditions, null, 2)));
    item.append(details);
    stops.append(item);
  }
  section.append(stops);
  const exportButton = element("button", "Download this recording");
  exportButton.type = "button";
  exportButton.className = "secondary";
  exportButton.addEventListener("click", () => {
    // The compact envelope is the recording owner's accepted JSON format, including all notes.
    download(
      JSON.stringify(entry.recording),
      laboratory.experimentId + "-experiment.json",
      "application/json;charset=utf-8",
    );
  });
  section.append(exportButton);
  host.append(section);
}
