import { DiscoveryInvestigationProvider } from "../discovery/investigation/context.tsx";
import { INVESTIGATIONS } from "../discovery/investigation/specs.ts";
import { PPE_EXPLANATION as LIGHT_EXPLANATION } from "../discovery/lightQuanta/journeyExercises.ts";
import { PPE_TASK as LIGHT_TASK } from "../discovery/lightQuanta/journeyI.ts";
import { PPE_TASK as MASS_TASK } from "../discovery/massEnergy/journeyIV.ts";
import { MASS_GIVEN_UP_EXERCISE } from "../discovery/massEnergy/massExercise.ts";
import { PpeTask } from "../discovery/PpeTask.tsx";
import { PPE_EXPLANATION as CLOCK_EXPLANATION } from "../discovery/relativity/journeyExercises.ts";
import { PPE_TASK as CLOCK_TASK } from "../discovery/relativity/journeyIII.ts";
import { LazyChapterInvestigationLab } from "./LazyChapterInvestigationLab.tsx";

const CHAPTERS = {
  "light-quanta": {
    section: "s8",
    task: LIGHT_TASK,
    label: "the photoelectric apparatus",
    explanation: LIGHT_EXPLANATION.workedExplanation,
  },
  "special-relativity": {
    section: "s4",
    task: CLOCK_TASK,
    label: "the moving-clock laboratory",
    explanation: CLOCK_EXPLANATION.workedExplanation,
  },
  "mass-energy": {
    section: "s0",
    task: MASS_TASK,
    label: "the system-boundary ledger",
    explanation: MASS_GIVEN_UP_EXERCISE.workedExplanation,
  },
} as const;

/** A placement of the journey's task and store, never another copy of either. */
export function PaperChapterInvestigation({ paper, section }: { paper: string; section: string }) {
  if (paper !== "light-quanta" && paper !== "special-relativity" && paper !== "mass-energy")
    return null;
  const chapter = CHAPTERS[paper];
  if (chapter.section !== section) return null;
  const spec = INVESTIGATIONS[paper];
  return (
    <div data-face-reading data-paper-investigation={paper}>
      <DiscoveryInvestigationProvider key={paper} spec={spec}>
        <PpeTask task={chapter.task} />
        <p className="fine">
          <a href={`#${spec.laboratoryAnchor}`}>Open {chapter.label} in this reading</a> to try the
          change. This is the same saved investigation you open in{" "}
          <a href={`/discover/${paper}/#${spec.promptId}`}>the discovery journey</a> and{" "}
          <a href="/notebook/">your notebook</a>.
        </p>
        <details>
          <summary>Read the worked explanation at any time</summary>
          <p>{chapter.explanation}</p>
          {paper === "mass-energy" && (
            <p>
              With the boundary around the body and its light together, the emitted energy remains
              inside the isolated system. No energy has left that system, so its mass is unchanged.
              The body alone has lost the energy carried by the light.
            </p>
          )}
        </details>
        <LazyChapterInvestigationLab
          paper={paper}
          laboratoryAnchor={spec.laboratoryAnchor}
          promptId={spec.promptId}
          instrumentId={spec.experimentId}
          label={chapter.label}
        />
      </DiscoveryInvestigationProvider>
    </div>
  );
}
