import { useCallback, useEffect, useMemo, useState } from "react";

interface DashboardPreferencesState {
  hidden: string[];
  pinned: string[];
}

const DEFAULT_STATE: DashboardPreferencesState = {
  hidden: [],
  pinned: [],
};

export function useDashboardPreferences<T extends { id: string }>(
  storageKey: string,
  sections: T[]
) {
  const [preferences, setPreferences] = useState<DashboardPreferencesState>(
    DEFAULT_STATE
  );
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") {
      setIsLoaded(true);
      return;
    }

    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) {
        setIsLoaded(true);
        return;
      }

      const parsed = JSON.parse(raw) as Partial<DashboardPreferencesState>;
      const validIds = new Set(sections.map((section) => section.id));

      setPreferences({
        hidden: Array.isArray(parsed.hidden)
          ? parsed.hidden.filter((id) => validIds.has(id))
          : [],
        pinned: Array.isArray(parsed.pinned)
          ? parsed.pinned.filter((id) => validIds.has(id))
          : [],
      });
    } catch {
      setPreferences(DEFAULT_STATE);
    } finally {
      setIsLoaded(true);
    }
  }, [sections, storageKey]);

  // P2.2 FIX: Proper cleanup for localStorage with storage event listener
  useEffect(() => {
    if (!isLoaded || typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(storageKey, JSON.stringify(preferences));
  }, [isLoaded, preferences, storageKey]);

  // P2.2 FIX: Listen for storage changes from other tabs/windows
  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === storageKey && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue) as Partial<DashboardPreferencesState>;
          const validIds = new Set(sections.map((section) => section.id));

          setPreferences({
            hidden: Array.isArray(parsed.hidden)
              ? parsed.hidden.filter((id) => validIds.has(id))
              : [],
            pinned: Array.isArray(parsed.pinned)
              ? parsed.pinned.filter((id) => validIds.has(id))
              : [],
          });
        } catch {
          // Invalid data, ignore
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);

    // P2.2 FIX: Cleanup event listener to prevent memory leak
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [storageKey, sections]);

  const togglePinned = useCallback((sectionId: string) => {
    setPreferences((current) => {
      const alreadyPinned = current.pinned.includes(sectionId);
      return {
        ...current,
        pinned: alreadyPinned
          ? current.pinned.filter((id) => id !== sectionId)
          : [sectionId, ...current.pinned.filter((id) => id !== sectionId)],
      };
    });
  }, []);

  const toggleHidden = useCallback((sectionId: string) => {
    setPreferences((current) => {
      const isHidden = current.hidden.includes(sectionId);
      return {
        ...current,
        hidden: isHidden
          ? current.hidden.filter((id) => id !== sectionId)
          : [...current.hidden, sectionId],
      };
    });
  }, []);

  const resetPreferences = useCallback(() => {
    setPreferences(DEFAULT_STATE);
  }, []);

  const orderedSections = useMemo(() => {
    const pinnedOrder = new Map(
      preferences.pinned.map((id, index) => [id, index] as const)
    );

    return [...sections].sort((left, right) => {
      const leftPinned = pinnedOrder.has(left.id);
      const rightPinned = pinnedOrder.has(right.id);

      if (leftPinned && rightPinned) {
        return (pinnedOrder.get(left.id) ?? 0) - (pinnedOrder.get(right.id) ?? 0);
      }
      if (leftPinned) return -1;
      if (rightPinned) return 1;
      return 0;
    });
  }, [preferences.pinned, sections]);

  return {
    hiddenIds: new Set(preferences.hidden),
    pinnedIds: new Set(preferences.pinned),
    orderedSections,
    togglePinned,
    toggleHidden,
    resetPreferences,
  };
}