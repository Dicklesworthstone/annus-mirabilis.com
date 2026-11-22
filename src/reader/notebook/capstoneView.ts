import { SKETCH_LIMITS, sketchPath } from "../../discovery/capstone/worksheetSketch.ts";
import { exportWorksheet } from "../../discovery/capstone/worksheetState.ts";
import { capstoneCaptureText } from "./capstoneEntry.ts";
import type { NotebookCapstoneEntry } from "./schema.ts";

/** Private words stay text; drawings use admitted numeric geometry. Opening never runs or replaces work. */
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
  const sketch = entry.capstone.worksheet.sketch;
  if (sketch.strokes.length) {
    const namespace = "http://www.w3.org/2000/svg";
    const svg = doc.createElementNS(namespace, "svg");
    svg.setAttribute("viewBox", `0 0 ${SKETCH_LIMITS.width} ${SKETCH_LIMITS.height}`);
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", `Your saved drawing: ${sketch.description || "no description"}`);
    svg.style.display = "block";
    svg.style.width = "100%";
    svg.style.height = "auto";
    svg.style.border = "1px solid";
    const title = doc.createElementNS(namespace, "title");
    title.textContent = "Your saved drawing";
    const description = doc.createElementNS(namespace, "desc");
    description.textContent = sketch.description || "no description";
    const path = doc.createElementNS(namespace, "path");
    path.setAttribute("d", sketchPath(sketch.strokes));
    path.setAttribute("fill", "none");
    path.setAttribute("stroke", "currentColor");
    path.setAttribute("stroke-width", "3");
    path.setAttribute("stroke-linecap", "round");
    path.setAttribute("stroke-linejoin", "round");
    svg.append(title, description, path);
    details.append(svg);
  }
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
