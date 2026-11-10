import type { GuidedTour, TourStop } from "./catalogue.ts";
import type { Syllabus } from "./syllabus.ts";

export const STUDY_BUDGETS = ["one-evening", "full-course"] as const;
export type StudyBudget = (typeof STUDY_BUDGETS)[number];
export function isStudyBudget(value: unknown): value is StudyBudget {
  return value === "one-evening" || value === "full-course";
}

export type StudyStep = TourStop &
  Readonly<{
    kind:
      | "reading"
      | "instrument"
      | "foundation"
      | "journey"
      | "door"
      | "exercise"
      | "results"
      | "margin"
      | "misconceptions"
      | "capstone"
      | "orientation"
      | "connection";
    minutes: number;
    paper?: string;
    section?: string;
    argumentId?: string;
    instrumentId?: string;
    foundationId?: string;
    doorId?: string;
  }>;
export type StudySession = Readonly<{
  id: string;
  title: string;
  summary: string;
  steps: readonly StudyStep[];
  minutes: number;
}>;
export type StudyTour = Readonly<{
  id: string;
  revision: number;
  title: string;
  introduction: string;
  paper: string;
  budget: StudyBudget;
  requiresEquations: true;
  sessions: readonly StudySession[];
  totalMinutes: number;
  preparation: Syllabus;
  sourceNotices: readonly Readonly<{ paper: string; text: string }>[];
  inPreparation: readonly string[];
}>;

export function studyGuide(tour: StudyTour): GuidedTour {
  return {
    id: tour.id,
    revision: tour.revision,
    title: tour.title,
    introduction: tour.introduction,
    paper: tour.paper,
    stops: tour.sessions.flatMap((session) =>
      session.steps.map(({ id, title, activity, href, task, question, explanation }) => ({
        id,
        title,
        activity,
        href,
        task,
        question,
        explanation,
      })),
    ),
  };
}
