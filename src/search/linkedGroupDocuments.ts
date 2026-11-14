import { LINKED_OBSERVER_LESSON } from "../experiments/groups/linkedObserverLesson.ts";
import { type SearchDocument, validateSearchDocument } from "./core.ts";
import { type SearchProfile, searchProfile } from "./documents.ts";

/** Index the same public question that introduces the linked workbench. */
export function linkedGroupDocuments(profile: SearchProfile): readonly SearchDocument[] {
  searchProfile(profile);
  // Like the authored discovery exercises, this lesson has no publication review yet.
  if (profile !== "scaffold") return [];
  const lesson = LINKED_OBSERVER_LESSON;
  return [
    validateSearchDocument({
      id: `linked-group:${lesson.id}`,
      type: "instrument",
      paper: lesson.paper,
      section: "",
      lang: "en",
      route: lesson.href,
      anchor: "",
      face: "",
      title: lesson.title,
      text: `${lesson.question} ${lesson.description}`,
      terms: [],
      scopeLabel: "Special relativity · linked instruments",
    }),
  ];
}
