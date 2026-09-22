"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { lazy, Suspense } from "react";

// The catalogue and teaching text are not part of an ordinary reading page's initial bundle.
const ActiveTourGuide = lazy(() => import("./ActiveTourGuide.tsx"));

/** Root-layout caller supplies a Suspense boundary for static App Router rendering. */
export function GuidedTourTrail({ compact = false }: { compact?: boolean }) {
  const pathname = usePathname();
  const query = useSearchParams();
  if (!pathname || !query || !["tour", "tourStop", "tourRevision"].some((key) => query.has(key))) {
    return null;
  }
  return (
    <Suspense fallback={<p className="guided-tour-loading"><a href="/tours/">Open guided reading outlines</a></p>}>
      <ActiveTourGuide key={`${pathname}?${query}`} pathname={pathname} search={query.toString()} compact={compact} />
    </Suspense>
  );
}
