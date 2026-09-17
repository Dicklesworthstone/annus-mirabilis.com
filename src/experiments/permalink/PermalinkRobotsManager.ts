"use client";

import { useEffect } from "react";
import { getPermalinkRobotsPolicy, type RobotsPolicy } from "./canonical.ts";

export const PERMALINK_ROBOTS_DATA_ATTR = "data-permalink-robots";
export const PERMALINK_ROBOTS_ORIGINAL_ATTR = "data-permalink-robots-original";

/**
 * Applies the permalink robots policy to the document head:
 * - When a ?tape= parameter is present, injects <meta name="robots" content="noindex,follow">
 *   and <link rel="canonical" href="..."> pointing to the stripped canonical document URL.
 * - When absent, removes any dynamically injected noindex tag to preserve indexability.
 *
 * Governed by am-6t51 / am-inst-permalink-tape-s677.
 */
export function applyPermalinkRobots(
  currentUrl: string = typeof window !== "undefined" ? window.location.href : "",
): RobotsPolicy {
  const policy = getPermalinkRobotsPolicy(currentUrl);

  if (typeof document === "undefined") {
    return policy;
  }

  const head = document.head;
  if (!head) return policy;

  let metaRobots = head.querySelector<HTMLMetaElement>(
    `meta[name="robots"][${PERMALINK_ROBOTS_DATA_ATTR}="true"]`,
  );

  if (policy.isNoindex) {
    if (!metaRobots) {
      metaRobots = document.createElement("meta");
      metaRobots.setAttribute("name", "robots");
      metaRobots.setAttribute(PERMALINK_ROBOTS_DATA_ATTR, "true");
      head.appendChild(metaRobots);
    }
    metaRobots.setAttribute("content", policy.robots);

    // Update ANY existing canonical in place. Querying only our own marked link
    // meant a canonical emitted by page metadata was invisible here and a second
    // one was appended, leaving two rel=canonical elements on the page.
    let canonicalLink = head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!canonicalLink) {
      canonicalLink = document.createElement("link");
      canonicalLink.setAttribute("rel", "canonical");
      canonicalLink.setAttribute(PERMALINK_ROBOTS_DATA_ATTR, "true");
      head.appendChild(canonicalLink);
    } else if (!canonicalLink.hasAttribute(PERMALINK_ROBOTS_ORIGINAL_ATTR)) {
      // Remember the page's own href so removing the tape parameter restores it
      // rather than deleting a canonical this manager did not create.
      canonicalLink.setAttribute(
        PERMALINK_ROBOTS_ORIGINAL_ATTR,
        canonicalLink.getAttribute("href") ?? "",
      );
    }
    canonicalLink.setAttribute("href", policy.canonicalUrl);
  } else if (metaRobots) {
    metaRobots.remove();
    const canonicalLink = head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (canonicalLink) {
      const original = canonicalLink.getAttribute(PERMALINK_ROBOTS_ORIGINAL_ATTR);
      if (original !== null) {
        // The page owned this canonical; restore it instead of removing it.
        canonicalLink.setAttribute("href", original);
        canonicalLink.removeAttribute(PERMALINK_ROBOTS_ORIGINAL_ATTR);
      } else if (canonicalLink.getAttribute(PERMALINK_ROBOTS_DATA_ATTR) === "true") {
        canonicalLink.remove();
      }
    }
  }

  return policy;
}

/**
 * Client component mounted in RootLayout that monitors the URL
 * and ensures tape permalinks are marked noindex,follow while clean routes remain indexable.
 */
export function PermalinkRobotsManager(): null {
  useEffect(() => {
    applyPermalinkRobots();

    const handleNavigation = () => {
      applyPermalinkRobots();
    };

    window.addEventListener("popstate", handleNavigation);
    window.addEventListener("hashchange", handleNavigation);

    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;

    history.pushState = function (...args) {
      const result = originalPushState.apply(this, args);
      applyPermalinkRobots();
      return result;
    };

    history.replaceState = function (...args) {
      const result = originalReplaceState.apply(this, args);
      applyPermalinkRobots();
      return result;
    };

    return () => {
      window.removeEventListener("popstate", handleNavigation);
      window.removeEventListener("hashchange", handleNavigation);
      history.pushState = originalPushState;
      history.replaceState = originalReplaceState;
    };
  }, []);

  return null;
}
