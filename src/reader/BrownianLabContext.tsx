"use client";

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { useInvestigationWitness } from "../discovery/investigation/context.tsx";
import { createSelectionStore } from "../equations/selectionStore.ts";
import { fromTracerDraft, toTracerDraft } from "../experiments/bm01/controls.ts";
import type { Bm01Parameters } from "../experiments/bm01/definition.ts";
import {
  type ApplyFailure,
  applyFailure,
  failureFromThrown,
} from "../experiments/results/applyFailure.ts";
import type { AcceptedSnapshot } from "../experiments/store/instanceStore.ts";
import { useInstrumentView } from "../experiments/store/useExperimentSnapshot.ts";
import type { SharedBrownianLab } from "./brownianLabSession.ts";

export type BrownianCompanionMode = "notes" | "laboratory";
export type BrownianCompanionDraft = Readonly<{ a: string; interval: string }>;
export type BrownianLabContextValue = Readonly<{
  laboratory: SharedBrownianLab | null;
  loading: boolean;
  loadError: string | null;
  mode: BrownianCompanionMode;
  draft: BrownianCompanionDraft | null;
  dirty: boolean;
  failure: ApplyFailure | null;
  selection: ReturnType<typeof createSelectionStore>;
  equationOpen: boolean;
  setEquationOpen(open: boolean): void;
  ensureLaboratory(): Promise<SharedBrownianLab | null>;
  showMode(mode: BrownianCompanionMode): void;
  editDraft(field: keyof BrownianCompanionDraft, value: string): void;
  applyDraft(): void;
  resetDraft(): void;
}>;

const Context = createContext<BrownianLabContextValue | null>(null);
export const useBrownianLab = () => useContext(Context);

function compactDraft(parameters: Bm01Parameters): BrownianCompanionDraft {
  const draft = toTracerDraft(parameters);
  return { a: draft.a, interval: draft.interval };
}

function sameDraft(a: BrownianCompanionDraft | null, b: BrownianCompanionDraft | null) {
  return a?.a === b?.a && a?.interval === b?.interval;
}

function LaboratoryConnection({
  laboratory,
  failure,
  accepted,
}: {
  laboratory: SharedBrownianLab;
  failure: ApplyFailure | null;
  accepted(snapshot: AcceptedSnapshot): void;
}) {
  const view = useInstrumentView(laboratory.session);
  useInvestigationWitness(
    "bm-01",
    laboratory.session,
    laboratory.example.sourceDigest,
    failure !== null,
  );
  useEffect(() => {
    if (view.accepted) accepted(view.accepted);
  }, [view.accepted, accepted]);
  return null;
}

/** The provider is present before any expansion; opening a lab never reparents the passage. */
export function BrownianLabProvider({
  children,
  loadLaboratory,
}: {
  children: ReactNode;
  loadLaboratory?: ((instanceId: string) => Promise<SharedBrownianLab>) | undefined;
}) {
  const id = useId();
  const loader = useRef(
    loadLaboratory ??
      ((instanceId: string) =>
        import("./loadBrownianLab.ts").then((module) => module.loadBrownianLab(instanceId))),
  );
  const [laboratory, setLaboratory] = useState<SharedBrownianLab | null>(null);
  const resource = useRef<SharedBrownianLab | null>(null);
  const pending = useRef<Promise<SharedBrownianLab | null> | null>(null);
  const mounted = useRef(false);
  const lifetime = useRef(0);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [mode, setMode] = useState<BrownianCompanionMode>("notes");
  const [draft, setDraft] = useState<BrownianCompanionDraft | null>(null);
  const draftNow = useRef<BrownianCompanionDraft | null>(null);
  const baseline = useRef<BrownianCompanionDraft | null>(null);
  const [dirty, setDirty] = useState(false);
  const dirtyNow = useRef(false);
  const [failure, setFailure] = useState<ApplyFailure | null>(null);
  const [selection] = useState(createSelectionStore);
  const [equationOpen, setEquationOpen] = useState(false);

  useEffect(() => {
    mounted.current = true;
    lifetime.current++;
    return () => {
      mounted.current = false;
      const ending = ++lifetime.current;
      // StrictMode reconnects this same mounted provider before the microtask. A real departure
      // releases the actual owner once, after all responsive views have released their leases.
      queueMicrotask(() => {
        if (mounted.current || lifetime.current !== ending) return;
        resource.current?.dispose();
        resource.current = null;
      });
    };
  }, []);

  const accepted = useCallback((snapshot: AcceptedSnapshot) => {
    const next = compactDraft(snapshot.parameters as Bm01Parameters);
    const previous = baseline.current;
    baseline.current = next;
    if (!dirtyNow.current || sameDraft(draftNow.current, previous)) {
      draftNow.current = next;
      dirtyNow.current = false;
      setDraft(next);
      setDirty(false);
      setFailure(null);
    }
  }, []);

  const ensureLaboratory = useCallback(() => {
    if (resource.current) return Promise.resolve(resource.current);
    if (pending.current) return pending.current;
    setLoading(true);
    setLoadError(null);
    const request = Promise.resolve()
      .then(() => loader.current(`reading-bm01-${id}`))
      .then((loaded) => {
        if (!mounted.current) {
          loaded.dispose();
          return null;
        }
        resource.current = loaded;
        const initial = compactDraft(loaded.session.acceptedParameters());
        baseline.current = initial;
        draftNow.current = initial;
        dirtyNow.current = false;
        setDraft(initial);
        setDirty(false);
        setLaboratory(loaded);
        return loaded;
      })
      .catch(() => {
        if (mounted.current)
          setLoadError(
            "The tracer controls could not load. You can try again or open the laboratory on its own page.",
          );
        return null;
      })
      .finally(() => {
        if (pending.current === request) pending.current = null;
        if (mounted.current) setLoading(false);
      });
    pending.current = request;
    return request;
  }, [id]);

  const showMode = useCallback(
    (next: BrownianCompanionMode) => {
      setMode(next);
      if (next === "laboratory") void ensureLaboratory();
    },
    [ensureLaboratory],
  );

  const editDraft = useCallback((field: keyof BrownianCompanionDraft, value: string) => {
    if (!draftNow.current) return;
    const next = { ...draftNow.current, [field]: value };
    draftNow.current = next;
    dirtyNow.current = true;
    setDraft(next);
    setDirty(true);
  }, []);

  const applyDraft = useCallback(() => {
    const current = resource.current;
    const entered = draftNow.current;
    if (!current || !entered) return;
    try {
      // The compact controls change only their two fields. The full lab remains authoritative
      // for temperature, viscosity, constants, seed, recording grid and estimator choices.
      const settings = fromTracerDraft({
        ...toTracerDraft(current.session.acceptedParameters()),
        ...entered,
      });
      const refused = applyFailure(current.session.apply(settings));
      setFailure(refused);
      if (refused) return;
      dirtyNow.current = false;
      setDirty(false);
    } catch (error) {
      setFailure(failureFromThrown(error, "Check the radius and observation time."));
    }
  }, []);

  const resetDraft = useCallback(() => {
    if (!resource.current) return;
    const next = compactDraft(resource.current.session.acceptedParameters());
    baseline.current = next;
    draftNow.current = next;
    dirtyNow.current = false;
    setDraft(next);
    setDirty(false);
    setFailure(null);
  }, []);

  return (
    <Context.Provider
      value={{
        laboratory,
        loading,
        loadError,
        mode,
        draft,
        dirty,
        failure,
        selection,
        equationOpen,
        setEquationOpen,
        ensureLaboratory,
        showMode,
        editDraft,
        applyDraft,
        resetDraft,
      }}
    >
      {laboratory ? (
        <LaboratoryConnection laboratory={laboratory} failure={failure} accepted={accepted} />
      ) : null}
      {children}
    </Context.Provider>
  );
}
