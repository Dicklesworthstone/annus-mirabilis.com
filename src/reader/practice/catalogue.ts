/** Existing discovery questions, placed beside the argument each one asks the reader to use. */
import type { DiscoveryPaper } from "../../content/schemas/discovery.ts";
import {
  DISPLACEMENT_SCALE_EXERCISE,
  SQUARE_ROOT_IN_WORDS,
} from "../../discovery/brownian/journeyExercises.ts";
import { MOLECULAR_NUMBER_EXERCISE } from "../../discovery/brownian/molecularNumberExercise.ts";
import { EINSTEIN_ONE_SECOND } from "../../discovery/brownian/numericExercises.ts";
import type { ExpressionExercisePart } from "../../discovery/exercises/answer.ts";
import type { ExplanationExercisePart } from "../../discovery/exercises/explanation.ts";
import type { NumericExercisePart } from "../../discovery/exercises/numeric.ts";
import { REAL_JOURNEYS } from "../../discovery/journeys/realJourneys.ts";
import { GREATEST_ENERGY_EXERCISE } from "../../discovery/lightQuanta/electronExercise.ts";
import { ENTROPY_COUNT_EXERCISE } from "../../discovery/lightQuanta/entropyExercise.ts";
import {
  H_FROM_STOPPING_LINE,
  INTENSITY_EXPLANATION,
  LOCKED_POSITIONS_EXPLANATION,
  PPE_EXPLANATION as PHOTOELECTRIC_EXPLANATION,
  QUANTA_PER_SECOND,
  THRESHOLD_TWO_EV,
} from "../../discovery/lightQuanta/journeyExercises.ts";
import { PPE_TASK as PHOTOELECTRIC_TASK } from "../../discovery/lightQuanta/journeyI.ts";
import { GREATEST_ELECTRON_ENERGY } from "../../discovery/lightQuanta/numericExercises.ts";
import {
  EQUAL_AND_OPPOSITE_EXPLANATION,
  MASS_GIVEN_UP_EXERCISE,
  PULSE_SUM_EXERCISE,
} from "../../discovery/massEnergy/massExercise.ts";
import {
  BOX_RECOIL,
  PROXY_AT_SIX_TENTHS,
  SEALED_LAMP_YEAR,
} from "../../discovery/massEnergy/numericExercises.ts";
import { MOVING_CLOCK_EXERCISE } from "../../discovery/relativity/clockExercise.ts";
import {
  CLOCK_SPEED_EXERCISE,
  COMPOSITION_EXERCISE,
  LIGHT_CLOCK_PATH,
  SIMULTANEITY_EXPLANATION,
  PPE_EXPLANATION as TRANSPORTED_CLOCK_EXPLANATION,
} from "../../discovery/relativity/journeyExercises.ts";
import { PPE_TASK as TRANSPORTED_CLOCK_TASK } from "../../discovery/relativity/journeyIII.ts";
import { MOVING_ROD } from "../../discovery/relativity/numericExercises.ts";
import type { NotebookAnswerBinding } from "../notebook/answerContext.ts";

type Preparation = Readonly<{
  label: string;
  paragraphs: readonly string[];
  links?: readonly Readonly<{ href: string; label: string }>[];
}>;

export type PracticeQuestion = Readonly<{
  title: string;
  preparation?: Preparation;
}> &
  (
    | Readonly<{ kind: "expression"; part: ExpressionExercisePart }>
    | Readonly<{ kind: "numeric"; part: NumericExercisePart }>
    | Readonly<{ kind: "explanation"; part: ExplanationExercisePart }>
  );

export type PassagePracticeRecord = Readonly<{
  paper: DiscoveryPaper;
  section: string;
  argument: string;
  questions: readonly PracticeQuestion[];
}>;

/** Only placement and context are authored here. The question and checker stay with their owner. */
function passage(record: PassagePracticeRecord): PassagePracticeRecord {
  return Object.freeze({
    ...record,
    questions: Object.freeze(
      record.questions.map((question) =>
        Object.freeze({
          ...question,
          ...(question.preparation
            ? {
                preparation: Object.freeze({
                  ...question.preparation,
                  paragraphs: Object.freeze([...question.preparation.paragraphs]),
                  ...(question.preparation.links
                    ? {
                        links: Object.freeze(
                          question.preparation.links.map((link) => Object.freeze({ ...link })),
                        ),
                      }
                    : {}),
                }),
              }
            : {}),
        }),
      ),
    ),
  });
}
const modernConstants: Preparation = Object.freeze({
  label: "Modern calculation",
  paragraphs: Object.freeze([
    "This application uses today's SI constants. The given scenario is a model calculation; its result is not a historical measurement.",
  ]),
});

export const PASSAGE_PRACTICE: readonly PassagePracticeRecord[] = Object.freeze([
  passage({
    paper: "brownian-motion",
    section: "s4",
    argument: "arg-bm-gaussian",
    questions: [
      {
        kind: "explanation",
        part: SQUARE_ROOT_IN_WORDS,
        title: "Why the spread grows as the square root of time",
      },
      {
        kind: "expression",
        part: DISPLACEMENT_SCALE_EXERCISE,
        title: "From one displacement axis to two",
      },
      {
        kind: "numeric",
        part: EINSTEIN_ONE_SECOND,
        title: "A particle's displacement in one second",
        preparation: {
          label: "Apply the result to the paper's numerical example",
          paragraphs: [
            "The numerical example appears in section 5. It combines this section's one-axis spread with the diffusivity and the printed inputs, converted into SI units in the question below.",
          ],
          links: [
            {
              href: "/papers/brownian-motion/s5/#arg-bm-observable",
              label: "Read the numerical prediction in section 5",
            },
          ],
        },
      },
    ],
  }),
  passage({
    paper: "brownian-motion",
    section: "s5",
    argument: "arg-bm-inference",
    questions: [
      {
        kind: "expression",
        part: MOLECULAR_NUMBER_EXERCISE,
        title: "Infer the molecular number",
      },
    ],
  }),
  passage({
    paper: "light-quanta",
    section: "s5",
    argument: "arg-lq-independent-configurations",
    questions: [
      {
        kind: "explanation",
        part: LOCKED_POSITIONS_EXPLANATION,
        title: "What independence changes in the count",
        preparation: {
          label: "Modern counterexample",
          paragraphs: [
            "The independence laboratory lets you compare independently placed points with a locked configuration. This teaching construction tests the role of an assumption; it is not an experiment reported in the paper.",
          ],
          links: [{ href: "/lab/lq-05/", label: "Open the independence counterexample" }],
        },
      },
    ],
  }),
  passage({
    paper: "light-quanta",
    section: "s6",
    argument: "arg-lq-entropy-correspondence",
    questions: [
      {
        kind: "expression",
        part: ENTROPY_COUNT_EXERCISE,
        title: "Count the independent radiation units",
      },
    ],
  }),
  passage({
    paper: "light-quanta",
    section: "s8",
    argument: "arg-lq-photoelectric-energy",
    questions: [
      {
        kind: "expression",
        part: GREATEST_ENERGY_EXERCISE,
        title: "The greatest escaping electron energy",
      },
      {
        kind: "numeric",
        part: GREATEST_ELECTRON_ENERGY,
        title: "Calculate the escaping electron energy",
        preparation: modernConstants,
      },
      {
        kind: "numeric",
        part: THRESHOLD_TWO_EV,
        title: "Find the threshold frequency",
        preparation: modernConstants,
      },
      {
        kind: "numeric",
        part: QUANTA_PER_SECOND,
        title: "Energy per quantum and the arrival rate",
        preparation: modernConstants,
      },
      {
        kind: "explanation",
        part: INTENSITY_EXPLANATION,
        title: "Brightness and electron energy",
      },
      {
        kind: "explanation",
        part: PHOTOELECTRIC_EXPLANATION,
        title: "Light below and above the threshold",
        preparation: {
          label: "The model investigation behind this question",
          paragraphs: [PHOTOELECTRIC_TASK.task, PHOTOELECTRIC_TASK.perturbPrompt],
          links: [
            { href: "/lab/lq-08/", label: "Open the photoelectric laboratory" },
            {
              href: `/discover/light-quanta/#${PHOTOELECTRIC_TASK.promptId}`,
              label: "Read the investigation in its discovery journey",
            },
          ],
        },
      },
    ],
  }),
  passage({
    paper: "light-quanta",
    section: "s8",
    argument: "arg-lq-stopping-and-losses",
    questions: [
      {
        kind: "numeric",
        part: H_FROM_STOPPING_LINE,
        title: "Infer the energy scale from the stopping line",
        preparation: modernConstants,
      },
    ],
  }),
  passage({
    paper: "special-relativity",
    section: "s1",
    argument: "arg-sr-synchronization",
    questions: [
      {
        kind: "explanation",
        part: SIMULTANEITY_EXPLANATION,
        title: "What the clocks agree to measure",
      },
    ],
  }),
  passage({
    paper: "special-relativity",
    section: "s4",
    argument: "arg-sr-clock-and-length",
    questions: [
      {
        kind: "expression",
        part: MOVING_CLOCK_EXERCISE,
        title: "Relate a moving clock to the frame clocks",
      },
      {
        kind: "numeric",
        part: MOVING_ROD,
        title: "Measure a moving rod",
      },
      {
        kind: "expression",
        part: CLOCK_SPEED_EXERCISE,
        title: "Infer the speed from clock readings",
      },
      {
        kind: "numeric",
        part: LIGHT_CLOCK_PATH,
        title: "Compare a light clock's paths",
        preparation: {
          label: "A later teaching construction",
          paragraphs: [
            "The two-mirror light clock is a later way to see the factor in section 4. It is not a construction described in the 1905 paper.",
          ],
        },
      },
    ],
  }),
  passage({
    paper: "special-relativity",
    section: "s4",
    argument: "arg-sr-transported-clock",
    questions: [
      {
        kind: "explanation",
        part: TRANSPORTED_CLOCK_EXPLANATION,
        title: "Two light-clock paths and one reading",
        preparation: {
          label: "The model investigation behind this question",
          paragraphs: [TRANSPORTED_CLOCK_TASK.task, TRANSPORTED_CLOCK_TASK.perturbPrompt],
          links: [
            { href: "/lab/sr-05/", label: "Open the transported-clock laboratory" },
            {
              href: `/discover/special-relativity/#${TRANSPORTED_CLOCK_TASK.promptId}`,
              label: "Read the investigation in its discovery journey",
            },
          ],
        },
      },
    ],
  }),
  passage({
    paper: "special-relativity",
    section: "s5",
    argument: "arg-sr-velocity-composition",
    questions: [
      {
        kind: "expression",
        part: COMPOSITION_EXERCISE,
        title: "Compose two velocities",
      },
    ],
  }),
  passage({
    paper: "mass-energy",
    section: "s0",
    argument: "arg-me-two-ledgers",
    questions: [
      {
        kind: "expression",
        part: PULSE_SUM_EXERCISE,
        title: "Add the two transformed pulse energies",
      },
      {
        kind: "explanation",
        part: EQUAL_AND_OPPOSITE_EXPLANATION,
        title: "Why the two emissions are equal and opposite",
      },
    ],
  }),
  passage({
    paper: "mass-energy",
    section: "s0",
    argument: "arg-me-small-speed",
    questions: [
      {
        kind: "numeric",
        part: PROXY_AT_SIX_TENTHS,
        title: "Compare the finite-speed proxy with the limit",
        preparation: modernConstants,
      },
    ],
  }),
  passage({
    paper: "mass-energy",
    section: "s0",
    argument: "arg-me-mass-change",
    questions: [
      {
        kind: "expression",
        part: MASS_GIVEN_UP_EXERCISE,
        title: "Inertia given up with emitted energy",
      },
      {
        kind: "numeric",
        part: SEALED_LAMP_YEAR,
        title: "Account for a sealed lamp's energy",
        preparation: {
          label: "Modern calculation",
          paragraphs: [
            "Treat the light and heat as energy leaving the box. The box keeps its matter, and its energy decreases. This application uses today's SI speed of light.",
          ],
        },
      },
      {
        kind: "numeric",
        part: BOX_RECOIL,
        title: "Compare the box recoil and emitted energy",
        preparation: {
          label: "Later argument: 1906",
          paragraphs: [
            "This is Einstein's later box argument, offered as a comparison with the result just derived. It is not part of the September 1905 paper.",
          ],
          links: [{ href: "/lab/me-03/", label: "Explore the later box argument" }],
        },
      },
    ],
  }),
]);

export function practiceForPassage(
  paper: string,
  section: string,
  argument: string,
): PassagePracticeRecord | undefined {
  return PASSAGE_PRACTICE.find(
    (entry) => entry.paper === paper && entry.section === section && entry.argument === argument,
  );
}

export function practiceAnchor(record: PassagePracticeRecord): string {
  return `practice-${record.argument}`;
}

export function practiceHref(record: PassagePracticeRecord): string {
  return `/papers/${record.paper}/${record.section}/#${practiceAnchor(record)}`;
}

/** Register only rendered disclosures, with the question of their containing source argument. */
export function practiceNavigationFor(
  paper: string,
  section: string | undefined,
  argumentsInPage: readonly Readonly<{ id: string; section: string; question: string }>[],
): Readonly<{ anchors: readonly string[]; questions: Readonly<Record<string, string>> }> {
  const places =
    section === undefined
      ? []
      : argumentsInPage.flatMap((argument) => {
          const record = practiceForPassage(paper, section, argument.id);
          return record && argument.section === section
            ? [{ anchor: practiceAnchor(record), question: argument.question }]
            : [];
        });
  return Object.freeze({
    anchors: Object.freeze(places.map((place) => place.anchor)),
    questions: Object.freeze(
      Object.fromEntries(places.map((place) => [place.anchor, place.question])),
    ),
  });
}

export function practiceQuestionHref(paper: DiscoveryPaper, question: PracticeQuestion): string {
  return `/discover/${paper}/#${question.kind === "explanation" ? "explanation" : "exercise"}-${question.part.id}`;
}

/** Match the current Discover identity without creating or loading its separate stage-note store. */
export function practiceNotebookBinding(
  record: PassagePracticeRecord,
  question: PracticeQuestion,
): NotebookAnswerBinding | undefined {
  const journey = REAL_JOURNEYS.find((entry) => entry.paper === record.paper);
  if (!journey) return undefined;
  return Object.freeze({
    title: question.title,
    sourceAnchor: record.argument,
    context: Object.freeze({ paper: record.paper, revision: String(journey.revision) }),
  });
}
