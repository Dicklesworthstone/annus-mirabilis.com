import { exportWorksheet } from "../../discovery/capstone/worksheetState.ts";
import { capstoneCaptureText } from "./capstoneEntry.ts";
import type { NotebookCapstoneEntry } from "./schema.ts";

/** Text only, even for imported snapshots. Opening a saved attempt never runs or replaces anything. */
export function appendCapstoneView(
  host: HTMLElement,
  entry: NotebookCapstoneEntry,
  download: (text: string, filename: string, type: string) => void,
): void {
  const doc = host.ownerDocument;
  const date = doc.createElement("p");
  date.textContent = `Snapshot saved ${entry.createdAt}. Later worksheet edits do not change this copy.`;
  const details = doc.createElement("details");
  const summary = doc.createElement("summary");
  summary.textContent = "Read the complete saved reconstruction";
  const content = doc.createElement("pre");
  content.textContent = capstoneCaptureText(entry.capstone);
  content.style.whiteSpace = "pre-wrap";
  content.style.overflowWrap = "anywhere";
  details.append(summary, content);
  const exportButton = doc.createElement("button");
  exportButton.type = "button";
  exportButton.className = "secondary";
  exportButton.textContent = "Export this attempt as worksheet JSON";
  exportButton.addEventListener("click", () =>
    download(
      exportWorksheet(entry.capstone.worksheet),
      "capstone-worksheet.json",
      "application/json",
    ),
  );
  const help = doc.createElement("p");
  help.textContent =
    "Open the capstone and choose a snapshot from your notebook to restore it after reviewing. The link does not carry your private work. An exported worksheet can also be imported there.";
  host.append(date, details, exportButton, help);
}
