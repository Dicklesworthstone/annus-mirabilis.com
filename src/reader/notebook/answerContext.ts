import type { DiscoveryPaper } from "../../content/schemas/discovery.ts";

/** A published question can use the reading notebook without opening a journey's notes. */
export type NotebookAnswerContext = Readonly<{
  paper: DiscoveryPaper;
  revision: string;
}>;

export type NotebookAnswerBinding = Readonly<{
  title: string;
  sourceAnchor: string;
  /** Omit on discovery guides, whose existing provider supplies this identity. */
  context?: NotebookAnswerContext;
}>;
