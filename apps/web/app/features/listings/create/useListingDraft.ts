/**
 * useListingDraft
 *
 * Encapsulates localStorage autosave and restore logic for the listing creation form.
 * Extracted from the CreateListing route to keep the route thin.
 */
import { useEffect, useRef, useCallback, useState } from "react";
import type { UseFormGetValues, UseFormSetValue } from "react-hook-form";
import type { z } from "zod";
import type { listingSchema } from "~/lib/validation/listing";

type FormValues = z.input<typeof listingSchema>;

interface DraftSnapshot {
  step: number;
  values: Record<string, unknown>;
  categorySpecificData?: Record<string, unknown>;
}

const DRAFT_KEY = "listingDraft_v1";
const AUTOSAVE_DEBOUNCE_MS = 1_500;
const MAX_STEPS = 5;

interface UseListingDraftOptions {
  currentStep: number;
  draftValues: FormValues;
  categorySpecificData: Record<string, unknown>;
  isSubmitting: boolean;
  getValues: UseFormGetValues<FormValues>;
  setValue: UseFormSetValue<FormValues>;
  setCurrentStep: (step: number) => void;
  setCategorySpecificData: (data: Record<string, unknown>) => void;
}

export function useListingDraft({
  currentStep,
  draftValues,
  categorySpecificData,
  isSubmitting,
  getValues,
  setValue,
  setCurrentStep,
  setCategorySpecificData,
}: UseListingDraftOptions) {
  const [hasDraft, setHasDraft] = useState(false);
  const [draftDecisionPending, setDraftDecisionPending] = useState(false);
  const lastSnapshotRef = useRef<string | null>(null);

  // Check for saved draft on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(DRAFT_KEY);
      if (!saved) return;
      JSON.parse(saved); // validate JSON
      setHasDraft(true);
      setDraftDecisionPending(true);
      lastSnapshotRef.current = saved;
    } catch {
      /* corrupt draft — ignore */
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const buildSnapshot = useCallback(
    (): string =>
      JSON.stringify({
        step: currentStep,
        values: getValues(),
        categorySpecificData,
      }),
    [categorySpecificData, currentStep, getValues],
  );

  // Autosave with debounce
  useEffect(() => {
    if (draftDecisionPending || isSubmitting) return undefined;

    const snapshot = buildSnapshot();
    if (snapshot === lastSnapshotRef.current) return undefined;

    const id = setTimeout(() => {
      try {
        localStorage.setItem(DRAFT_KEY, snapshot);
        lastSnapshotRef.current = snapshot;
      } catch {
        // quota exceeded or private browsing — continue silently
      }
    }, AUTOSAVE_DEBOUNCE_MS);

    return () => clearTimeout(id);
  }, [buildSnapshot, draftDecisionPending, draftValues, isSubmitting]);

  const clearSavedDraft = useCallback(() => {
    localStorage.removeItem(DRAFT_KEY);
    lastSnapshotRef.current = null;
    setHasDraft(false);
    setDraftDecisionPending(false);
  }, []);

  const restoreDraft = useCallback(() => {
    try {
      const saved = localStorage.getItem(DRAFT_KEY);
      if (!saved) return;
      const { step, values, categorySpecificData: savedCSD } = JSON.parse(saved) as DraftSnapshot;
      Object.entries(values ?? {}).forEach(([key, val]) => {
        setValue(key as Parameters<typeof setValue>[0], val as never);
      });
      setCategorySpecificData(savedCSD ?? {});
      setCurrentStep(Math.min(Math.max(1, step), MAX_STEPS));
      setHasDraft(false);
      setDraftDecisionPending(false);
      lastSnapshotRef.current = saved;
    } catch {
      /* ignore corrupt draft */
    }
  }, [setValue, setCategorySpecificData, setCurrentStep]);

  const discardDraft = useCallback(() => {
    clearSavedDraft();
  }, [clearSavedDraft]);

  return { hasDraft, draftDecisionPending, restoreDraft, discardDraft, clearSavedDraft };
}
