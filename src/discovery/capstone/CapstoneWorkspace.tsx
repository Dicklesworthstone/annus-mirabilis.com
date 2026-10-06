import type { ReactNode } from "react";
import { renderedEquation } from "../../app/capstones/renderedEquations.ts";
import { tapePath } from "../../reader/sitePaths.ts";
import { CapstoneWorksheet } from "./CapstoneWorksheet.tsx";
import { loadCapstone } from "./loadCapstone.ts";
import "./worksheet.css";

/** Preserve each paper's existing source-linked, script-free page as the reference edition. */
export function CapstoneWorkspace({ paper, children }: Readonly<{ paper: string; children: ReactNode }>) {
  const { capstone, equations } = loadCapstone(paper);
  return <div className="capstone-page">
    <p className="capstone-controls"><a href="#capstone-worksheet">Open the optional reconstruction worksheet</a></p>
    <div className="capstone-reference">{children}</div>
    <CapstoneWorksheet capstone={capstone}
      equations={equations.map((equation) => ({ ...equation, html: renderedEquation(paper, equation.equationId)?.html ?? "", href: `/papers/${paper}/view/parallel/#${equation.displayUnit}` }))}
      instruments={capstone.presets.map((preset, index) => ({ id: `${preset.instrumentId}-${index}`, href: `/lab/${preset.instrumentId}/`, tapeHref: preset.tapeId ? tapePath(preset.tapeId) : null, purpose: preset.purpose, lookFor: preset.lookFor.map((item) => item.description) }))}
    />
  </div>;
}
