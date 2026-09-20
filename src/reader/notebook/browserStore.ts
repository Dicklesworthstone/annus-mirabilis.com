import { createNotebookStore, type NotebookStore } from "./notebookStore.ts";
import { createNotebookStorage } from "./storage.ts";

let notebook: NotebookStore | undefined;
/** One in-tab owner shared by the global notebook and optional laboratory capture controls. */
export function getNotebookStore(): NotebookStore {
  notebook ??= createNotebookStore(createNotebookStorage());
  return notebook;
}
