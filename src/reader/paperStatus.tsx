/**
 * The paper's editorial status, said in one line a reader can take in, with the full statement
 * one click away.
 *
 * WHY. Every paper page opened on a grey slab of hedges, four lines at 1440 and nine on a phone,
 * in our own vocabulary: "not a German transcription, an aligned English translation, or a
 * complete critical edition ... argument units are editorial, not a verified paragraph-by-
 * paragraph source inventory". Every fact in it is true and stays: the record's sourceNotice is
 * rendered whole inside the disclosure. What changes is that the page leads with the paper, and
 * the status is one line that says what the reader most needs to know.
 *
 * THE LINE IS DERIVED FROM THE RECORD'S TYPED STATUS, not written here as a fixed sentence. The
 * schema allows one status today, "explanation-preview"; the Record below makes TypeScript
 * demand a reader's line for any status added later, so a reviewed paper cannot go on being
 * called unreviewed because nobody remembered this file.
 */

import type { ReactNode } from "react";
import type { Paper } from "../content/schemas/reading.ts";

const STATUS_LINE: Readonly<Record<Paper["status"], string>> = {
  "explanation-preview": "Draft explanation, not yet reviewed",
};

export function PaperStatus({
  paper,
  children,
}: {
  readonly paper: Pick<Paper, "status" | "sourceNotice">;
  /** Further status statements that belong with the notice, rendered inside the disclosure. */
  readonly children?: ReactNode;
}) {
  return (
    <details className="callout-note" data-source-status>
      <summary>{STATUS_LINE[paper.status]}</summary>
      <p>{paper.sourceNotice}</p>
      {children}
    </details>
  );
}
