"use client";

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  BROWNIAN_GERMAN_SOURCE_HREF,
  parseSourceCompanion,
  type SourceCompanionDocument,
  type SourceCompanionPassage,
  type SourceCompanionTarget,
} from "./sourceCompanion.ts";

export type BrownianSourceContextValue = Readonly<{
  passages: readonly SourceCompanionPassage[];
  passage: SourceCompanionPassage | null;
  target: SourceCompanionTarget | null;
  source: SourceCompanionDocument | null;
  loading: boolean;
  error: string | null;
  activation: number;
  returnElement: HTMLElement | null;
  select(passageId: string, sourceId?: string): boolean;
  reveal(returnElement?: HTMLElement): void;
  ensureSource(): Promise<SourceCompanionDocument | null>;
}>;

const Context = createContext<BrownianSourceContextValue | null>(null);
export const useBrownianSource = () => useContext(Context);

/** Small binding metadata arrives with the reading; German text loads only after a source choice. */
export function BrownianSourceProvider({
  passages,
  children,
  fetchSource,
}: {
  passages: readonly SourceCompanionPassage[];
  children: ReactNode;
  fetchSource?: typeof fetch | undefined;
}) {
  const fetcher = useRef(fetchSource);
  const [selection, setSelection] = useState<Readonly<{
    passageId: string;
    sourceId: string;
  }> | null>(null);
  const remembered = useRef(new Map<string, string>());
  const selectedNow = useRef(selection);
  const [source, setSource] = useState<SourceCompanionDocument | null>(null);
  const cached = useRef<SourceCompanionDocument | null>(null);
  const pending = useRef<Promise<SourceCompanionDocument | null> | null>(null);
  const controller = useRef<AbortController | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activation, setActivation] = useState(0);
  const [returnElement, setReturnElement] = useState<HTMLElement | null>(null);
  const mounted = useRef(false);
  const lifetime = useRef(0);

  useEffect(() => {
    mounted.current = true;
    lifetime.current++;
    return () => {
      mounted.current = false;
      const ending = ++lifetime.current;
      queueMicrotask(() => {
        if (mounted.current || lifetime.current !== ending) return;
        controller.current?.abort();
        cached.current = null;
      });
    };
  }, []);

  const ensureSource = useCallback(() => {
    if (cached.current) return Promise.resolve(cached.current);
    if (pending.current) return pending.current;
    if (!mounted.current || !selectedNow.current) return Promise.resolve(null);
    const abort = new AbortController();
    controller.current = abort;
    setLoading(true);
    setError(null);
    const request = Promise.resolve()
      .then(() => (fetcher.current ?? fetch)(BROWNIAN_GERMAN_SOURCE_HREF, { signal: abort.signal }))
      .then(async (response) => {
        if (!response.ok) throw new Error("The German source page did not load.");
        // Never accept a redirected sign-in, missing-page fallback, or another paper's source.
        if (response.url) {
          const url = new URL(response.url, window.location.href);
          if (url.origin !== window.location.origin || url.pathname !== BROWNIAN_GERMAN_SOURCE_HREF)
            throw new Error("The source response is not the requested German page.");
        }
        const html = await response.text();
        if (!mounted.current || abort.signal.aborted || controller.current !== abort) return null;
        const parsed = parseSourceCompanion(html, document);
        if (!parsed) throw new Error("The response has no German source face.");
        cached.current = parsed;
        setSource(parsed);
        return parsed;
      })
      .catch(() => {
        if (mounted.current && !abort.signal.aborted && controller.current === abort)
          setError(
            "The German source could not load here. Try again or open the complete source page.",
          );
        return null;
      })
      .finally(() => {
        if (pending.current === request) pending.current = null;
        if (mounted.current && controller.current === abort) setLoading(false);
      });
    pending.current = request;
    return request;
  }, []);

  const select = useCallback(
    (passageId: string, sourceId?: string) => {
      const passage = passages.find((item) => item.id === passageId);
      const wanted = sourceId ?? remembered.current.get(passageId);
      const target = wanted
        ? passage?.targets.find((item) => item.id === wanted)
        : passage?.targets[0];
      if (!passage || !target) return false;
      const next = { passageId, sourceId: target.id };
      selectedNow.current = next;
      remembered.current.set(passageId, target.id);
      setSelection(next);
      // Completion publishes only the shared page. It never restores an old target or mode.
      void ensureSource();
      return true;
    },
    [passages, ensureSource],
  );

  const reveal = useCallback(
    (origin?: HTMLElement) => {
      if (origin) setReturnElement(origin);
      setActivation((value) => value + 1);
      void ensureSource();
    },
    [ensureSource],
  );

  const passage = passages.find((item) => item.id === selection?.passageId) ?? null;
  const target = passage?.targets.find((item) => item.id === selection?.sourceId) ?? null;
  return (
    <Context.Provider
      value={{
        passages,
        passage,
        target,
        source,
        loading,
        error,
        activation,
        returnElement,
        select,
        reveal,
        ensureSource,
      }}
    >
      {children}
    </Context.Provider>
  );
}
