"use client";

import { type RefObject, useEffect, useRef } from "react";
import {
  bindLaboratoryVisibility,
  type VisibilityControlledSession,
} from "./bindLaboratoryVisibility.ts";

export function useLaboratoryVisibility(
  session: VisibilityControlledSession,
  observationRegion?: RefObject<HTMLElement | null>,
) {
  const region = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!region.current) return;
    return bindLaboratoryVisibility(
      region.current,
      session,
      observationRegion?.current ?? region.current,
    );
  }, [session, observationRegion]);
  return region;
}
