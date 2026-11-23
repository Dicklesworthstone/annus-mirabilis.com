import type { ChapterInvestigation } from "../discovery/investigation/chapterTasks.ts";
import { DiscoveryInvestigationProvider } from "../discovery/investigation/context.tsx";
import { PpeTask } from "../discovery/PpeTask.tsx";
import { LazyChapterInvestigationLab } from "./LazyChapterInvestigationLab.tsx";

/** The explanation and return paths are part of the static reading, independent of lab loading. */
export function AdditionalChapterInvestigation({ chapter }: { chapter: ChapterInvestigation }) {
  const { id, spec } = chapter;
  return (
    <section
      data-face-reading
      data-paper-investigation={chapter.paper}
      data-chapter-investigation={id}
      aria-labelledby={`${id}-title`}
    >
      <h2 id={`${id}-title`}>{chapter.title}</h2>
      <DiscoveryInvestigationProvider key={id} spec={spec} storageId={id}>
        <PpeTask task={chapter.task} />
        <p className="fine">
          <a href={`#${spec.laboratoryAnchor}`}>Open {chapter.laboratoryLabel} in this reading</a>{" "}
          to try the change. Your prediction, captured readings and explanation stay together in{" "}
          <a href="/notebook/">your notebook</a>, separately from the other chapter tasks.
        </p>
        <details data-chapter-worked-explanation={id}>
          <summary>Read the worked explanation at any time</summary>
          {chapter.explanation.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
          <h3>Compare the reasoning</h3>
          <p>
            <strong>Assumption.</strong> {chapter.feedback.assumption}
          </p>
          <p>
            <strong>Quantity.</strong> {chapter.feedback.quantity}
          </p>
          <p>
            <strong>A possible confusion.</strong> {chapter.feedback.confusion}
          </p>
          <h3>Questions for your explanation</h3>
          <p>Use these to revisit your own reasoning. Your words are not scored.</p>
          <ul>
            {chapter.criteria.map((criterion) => (
              <li key={criterion}>{criterion}</li>
            ))}
          </ul>
          <p>
            <a href={spec.sourceHref}>Return to the source argument</a>
          </p>
        </details>
        <details id={`${id}-revisit`}>
          <summary>Revisit your earlier prediction</summary>
          <p>{chapter.revisit}</p>
          <p>
            <a href={`#${spec.promptId}`}>Reopen your prediction and comparison</a>, then add to
            your explanation. The pinned prediction and starting reading stay in view.
          </p>
        </details>
        <LazyChapterInvestigationLab
          paper={chapter.paper}
          laboratoryAnchor={spec.laboratoryAnchor}
          promptId={spec.promptId}
          instrumentId={chapter.laboratory}
          label={chapter.laboratoryLabel}
        />
      </DiscoveryInvestigationProvider>
    </section>
  );
}
