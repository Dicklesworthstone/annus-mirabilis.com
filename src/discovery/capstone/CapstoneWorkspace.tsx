import type { ReactNode } from "react";
import { renderedEquation } from "../../app/capstones/renderedEquations.ts";
import { withWalkthroughSelection } from "../../experiments/permalink/walkthroughLocation.ts";
import capstoneLinks from "../../generated/capstone-links.json";
import { tapePath } from "../../reader/sitePaths.ts";
import { CapstoneWorksheet } from "./CapstoneWorksheet.tsx";
import { type ExperimentLaunchIndex, selectedExperimentLaunch } from "./experimentLaunch.ts";
import { loadCapstone } from "./loadCapstone.ts";
import { withCapstoneReturn } from "./returnRoute.ts";
import "./worksheet.css";

/** Preserve each paper's existing source-linked, script-free page as the reference edition. */
export function CapstoneWorkspace({ paper, children }: Readonly<{ paper: string; children: ReactNode }>) {
  const { capstone, equations } = loadCapstone(paper);
  return (
    <div className="capstone-page">
      <p className="capstone-controls">
        <a href="#capstone-worksheet">Open the optional reconstruction worksheet</a>
      </p>
      <div className="capstone-reference">{children}</div>
      <CapstoneWorksheet
        capstone={capstone}
        equations={equations.map((equation) => ({
          ...equation,
          html: renderedEquation(paper, equation.equationId)?.html ?? "",
          href: withCapstoneReturn(`/papers/${paper}/view/parallel/#${equation.displayUnit}`, paper),
        }))}
        instruments={capstone.presets.map((preset, index) => {
          const launch = selectedExperimentLaunch(preset, capstoneLinks as ExperimentLaunchIndex);
          const returningHref = withCapstoneReturn(launch.href, paper);
          const walkthroughHref = launch.ready && preset.tapeId
            ? withWalkthroughSelection(returningHref, preset.instrumentId, preset.tapeId)
            : null;
          return {
            id: `${preset.instrumentId}-${index}`,
            href: walkthroughHref ?? returningHref,
            tapeHref: preset.tapeId ? withCapstoneReturn(tapePath(preset.tapeId), paper) : null,
            purpose: `${preset.purpose} ${launch.notice}`,
            lookFor: preset.lookFor.map((item) => item.description),
          };
        })}
      />
    </div>
  );
}
