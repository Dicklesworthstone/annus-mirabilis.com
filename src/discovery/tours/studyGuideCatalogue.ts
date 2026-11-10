/** Loaded only with the optional guide, never by the edition's initial navigation. */
import generated from "../../generated/study-tours.json";
import { type GuidedTour, getGuidedTour } from "./catalogue.ts";

const STUDY_GUIDES = generated as readonly GuidedTour[];
export function getAnyGuidedTour(id: string): GuidedTour | null {
  return getGuidedTour(id) ?? STUDY_GUIDES.find((tour) => tour.id === id) ?? null;
}
