"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { mountCapstoneReturnLinks } from "./returnLinks.ts";
import {
  CAPSTONE_RETURN_PAPERS,
  type CapstoneReturnContext,
  capstoneReturnHref,
  nextCapstoneReturn,
  worksheetPaper,
} from "./returnRoute.ts";
import "./returnTrail.css";

/** Public navigation context only. The worksheet store remains the sole owner of private work. */
export function CapstoneReturnTrail() {
  const pathname = usePathname() ?? "";
  const search = useSearchParams()?.toString() ?? "";
  const [context, setContext] = useState<CapstoneReturnContext | null>(null);
  const current = nextCapstoneReturn(context, pathname, search);
  const paper = worksheetPaper(pathname) ?? current?.paper ?? null;

  useEffect(() => {
    setContext((previous) => nextCapstoneReturn(previous, pathname, search));
  }, [pathname, search]);

  useEffect(() => {
    // Back to a historical entry with no token must not inherit a later page's return context.
    const restore = () => setContext(nextCapstoneReturn(null, window.location.pathname, window.location.search));
    window.addEventListener("popstate", restore);
    window.addEventListener("pageshow", restore);
    return () => {
      window.removeEventListener("popstate", restore);
      window.removeEventListener("pageshow", restore);
    };
  }, []);

  useEffect(() => {
    const main = document.querySelector<HTMLElement>("main");
    if (!paper || !main) return;
    return mountCapstoneReturnLinks(main, paper);
  }, [paper, pathname]);

  if (!current) return null;
  return (
    <nav className="capstone-return" aria-label="Return to reconstruction worksheet">
      <a href={capstoneReturnHref(current.paper)}>
        Return to your {CAPSTONE_RETURN_PAPERS[current.paper]} worksheet
      </a>
      <p>Your worksheet stays separate from this source or experiment.</p>
    </nav>
  );
}
