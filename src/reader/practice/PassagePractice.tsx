import { ExercisePart } from "../../components/discover/ExercisePart.tsx";
import { ExplanationPart } from "../../components/discover/ExplanationPart.tsx";
import { NumericPart } from "../../components/discover/NumericPart.tsx";
import {
  practiceAnchor,
  practiceForPassage,
  practiceHref,
  practiceNotebookBinding,
  practiceQuestionHref,
} from "./catalogue.ts";
import "./practice.css";

/** Section pages carry the actual questions; the whole paper links to that same reading place. */
export function PassagePractice({
  paperId,
  sectionId,
  argumentId,
  passageTitle,
  sectionPage,
}: Readonly<{
  paperId: string;
  sectionId: string;
  argumentId: string;
  passageTitle: string;
  sectionPage: boolean;
}>) {
  const record = practiceForPassage(paperId, sectionId, argumentId);
  if (!record) return null;
  const count = record.questions.length;
  const label = `${count} ${count === 1 ? "question" : "questions"}`;
  if (!sectionPage)
    return (
      <p className="fine" data-passage-practice-link={record.argument}>
        <a href={practiceHref(record)}>
          Practice: {passageTitle} ({label})
        </a>
      </p>
    );
  return (
    <details
      id={practiceAnchor(record)}
      className="passage-practice"
      data-passage-practice={record.argument}
      tabIndex={-1}
    >
      <summary>Try this argument yourself ({label})</summary>
      <p className="fine">
        These questions also appear in the discovery journey. The worked explanations are available
        before you answer. Save a response explicitly to keep it in your private notebook; your
        saved responses can be reopened here or in the journey.
      </p>
      {record.questions.map((question) => {
        const notebook = practiceNotebookBinding(record, question);
        const saved = notebook ? { notebook } : {};
        return (
          <fieldset
            key={question.part.id}
            className="passage-practice-question"
            aria-label={question.title}
          >
            <legend>{question.title}</legend>
            {question.preparation && (
              <div className="passage-practice-context">
                <p className="eyebrow">{question.preparation.label}</p>
                {question.preparation.paragraphs.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
                {question.preparation.links && (
                  <ul>
                    {question.preparation.links.map((link) => (
                      <li key={link.href}>
                        <a href={link.href}>{link.label}</a>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
            {question.kind === "expression" && <ExercisePart part={question.part} {...saved} />}
            {question.kind === "numeric" && (
              <>
                <NumericPart part={question.part} {...saved} />
                <p className="fine">{question.part.reference.executionLabel}</p>
              </>
            )}
            {question.kind === "explanation" && <ExplanationPart part={question.part} {...saved} />}
            <p className="fine">
              <a href={practiceQuestionHref(record.paper, question)}>
                Read this question in the discovery journey
              </a>
            </p>
          </fieldset>
        );
      })}
    </details>
  );
}
