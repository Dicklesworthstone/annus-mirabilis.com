import type { Metadata } from "next";
import { ExplanationPart } from "../../../components/discover/ExplanationPart.tsx";
import { DISCOVERY_PAPERS } from "../../../content/schemas/discovery.ts";
import { JourneyNotebook } from "../../../discovery/journeys/JourneyNotebook.tsx";
import { NOTE_PAPER_TITLES } from "../../../discovery/notes/manifest.ts";
import { REVISIT_CASES, REVISIT_OPTIONS } from "../../../discovery/revisit/catalogue.ts";
import {
  RevisitBrowser,
  RevisitCaseVisibility,
  RevisitPaper,
} from "../../../discovery/revisit/RevisitBrowser.tsx";
import "../../../discovery/revisit/revisit.css";

export const metadata: Metadata = {
  title: "Revisit an idea in a changed case",
  description:
    "Choose a worked idea from the four discovery routes, change a condition, and compare your explanation with the authored reasoning. Save your words privately if you wish.",
};

export default function RevisitPage() {
  return (
    <article>
      <header className="page-intro page-flush">
        <p className="eyebrow">Discover · Revisit</p>
        <h1>Try the idea in a changed case</h1>
        <p className="lead">
          Pick an argument you have met before. Change one of its conditions, then explain which
          conclusion changes and which part of the reasoning survives.
        </p>
        <p>
          These are the changed cases from the discovery routes. The original example and the worked
          explanation are always available. You can keep your own explanation privately and compare
          it with an earlier version whenever you choose.
        </p>
        <p>
          <a href="/discover/">Return to the discovery routes</a> ·{" "}
          <a href="/notebook/#discovery-notes">Open your saved discovery notes</a>
        </p>
      </header>
      <div className="reading page-flush">
        <RevisitBrowser cases={REVISIT_OPTIONS}>
          {DISCOVERY_PAPERS.map((paper) => (
            <JourneyNotebook key={paper} paper={paper}>
              <RevisitPaper paper={paper} title={NOTE_PAPER_TITLES[paper]}>
                {REVISIT_CASES.filter((item) => item.paper === paper).map((item) => (
                  <RevisitCaseVisibility key={item.id} id={item.id}>
                    <article
                      className="revisit-card"
                      id={item.id}
                      aria-labelledby={`${item.id}-title`}
                    >
                      <p className="eyebrow">From {item.stageTitle}</p>
                      <h3 id={`${item.id}-title`}>{item.title}</h3>
                      <p>
                        <strong>The original question:</strong> {item.originalQuestion}
                      </p>
                      <details className="revisit-reminder">
                        <summary>Recall the original worked example</summary>
                        <p>{item.originalExample.prompt}</p>
                        <ol>
                          {item.originalExample.steps.map((step) => (
                            <li key={step}>{step}</li>
                          ))}
                        </ol>
                        <p>{item.originalExample.result}</p>
                      </details>
                      <ExplanationPart
                        part={item.part}
                        {...(item.sourceAnchor
                          ? {
                              notebook: {
                                title: `${item.paperTitle}: ${item.title}`,
                                sourceAnchor: item.sourceAnchor,
                              },
                            }
                          : {})}
                      />
                      <nav className="revisit-return" aria-label={`Return from ${item.title}`}>
                        <a href={item.stageHref}>Return to the original discovery step</a>
                        {item.sourceHref && (
                          <a href={item.sourceHref}>Original argument in the paper</a>
                        )}
                        {item.instrument && (
                          <a href={`/lab/${item.instrument.instrumentId}/`}>
                            Open the original step’s laboratory
                          </a>
                        )}
                        <a href={item.href}>Link to this case</a>
                      </nav>
                      {item.instrument && (
                        <p className="fine">
                          The laboratory opens its own model and settings. This case’s changed
                          condition is for you to examine; opening the laboratory does not apply it.
                        </p>
                      )}
                    </article>
                  </RevisitCaseVisibility>
                ))}
              </RevisitPaper>
            </JourneyNotebook>
          ))}
        </RevisitBrowser>
      </div>
    </article>
  );
}
