import React, { useState, useEffect, useCallback } from "react";
import { Save, Bookmark, X, ChevronDown } from "lucide-react";
import { cn } from "~/lib/utils";
import { UnifiedButton, Dialog, DialogFooter } from "~/components/ui";

export interface FilterPreset {
  id: string;
  name: string;
  filters: Record<string, string>;
  createdAt: string;
  isDefault?: boolean;
}

interface FilterPresetsProps {
  currentFilters: Record<string, string>;
  onApplyPreset: (filters: Record<string, string>) => void;
  storageKey: string;
  className?: string;
  maxPresets?: number;
}

const PRESETS_STORAGE_PREFIX = "filter_presets_";

export function FilterPresets({
  currentFilters,
  onApplyPreset,
  storageKey,
  className,
  maxPresets = 10,
}: FilterPresetsProps) {
  const [presets, setPresets] = useState<FilterPreset[]>([]);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [showPresetsDropdown, setShowPresetsDropdown] = useState(false);
  const [newPresetName, setNewPresetName] = useState("");
  const [presetToDelete, setPresetToDelete] = useState<string | null>(null);

  // Load presets from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(`${PRESETS_STORAGE_PREFIX}${storageKey}`);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setPresets(parsed);
      } catch {
        console.error("Failed to parse filter presets");
      }
    }
  }, [storageKey]);

  // Save presets to localStorage
  const savePresets = useCallback(
    (newPresets: FilterPreset[]) => {
      setPresets(newPresets);
      localStorage.setItem(
        `${PRESETS_STORAGE_PREFIX}${storageKey}`,
        JSON.stringify(newPresets)
      );
    },
    [storageKey]
  );

  // Check if current filters match any preset
  const hasActiveFilters = Object.keys(currentFilters).some(
    (key) => key !== "page" && key !== "limit" && currentFilters[key]
  );

  // Save new preset
  const handleSavePreset = () => {
    if (!newPresetName.trim() || presets.length >= maxPresets) return;

    // Remove page and limit from saved filters
    const filtersToSave: Record<string, string> = {};
    Object.entries(currentFilters).forEach(([key, value]) => {
      if (key !== "page" && key !== "limit" && value) {
        filtersToSave[key] = value;
      }
    });

    if (Object.keys(filtersToSave).length === 0) return;

    const newPreset: FilterPreset = {
      id: `preset_${Date.now()}`,
      name: newPresetName.trim(),
      filters: filtersToSave,
      createdAt: new Date().toISOString(),
    };

    savePresets([...presets, newPreset]);
    setNewPresetName("");
    setShowSaveDialog(false);
  };

  // Delete preset
  const handleDeletePreset = (presetId: string) => {
    const newPresets = presets.filter((p) => p.id !== presetId);
    savePresets(newPresets);
    setPresetToDelete(null);
  };

  // Apply preset
  const handleApplyPreset = (preset: FilterPreset) => {
    onApplyPreset(preset.filters);
    setShowPresetsDropdown(false);
  };

  // Find matching preset
  const matchingPreset = presets.find((preset) => {
    const presetKeys = Object.keys(preset.filters).sort();
    const currentKeys = Object.keys(currentFilters)
      .filter((k) => k !== "page" && k !== "limit" && currentFilters[k])
      .sort();

    if (presetKeys.length !== currentKeys.length) return false;

    return presetKeys.every((key, index) => {
      return (
        currentKeys[index] === key &&
        preset.filters[key] === currentFilters[key]
      );
    });
  });

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {/* Save Current Filters Button */}
      {hasActiveFilters && !matchingPreset && (
        <UnifiedButton
          variant="outline"
          size="sm"
          onClick={() => setShowSaveDialog(true)}
          leftIcon={<Save className="w-4 h-4" />}
        >
          Save Filters
        </UnifiedButton>
      )}

      {/* Presets Dropdown */}
      {presets.length > 0 && (
        <div className="relative">
          <UnifiedButton
            variant={matchingPreset ? "primary" : "outline"}
            size="sm"
            onClick={() => setShowPresetsDropdown(!showPresetsDropdown)}
            leftIcon={<Bookmark className="w-4 h-4" />}
            rightIcon={<ChevronDown className="w-4 h-4" />}
          >
            {matchingPreset ? matchingPreset.name : "Presets"}
          </UnifiedButton>

          {showPresetsDropdown && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setShowPresetsDropdown(false)}
              />
              <div className="absolute right-0 top-full mt-1 bg-popover border rounded-lg shadow-lg py-1 min-w-56 z-50 max-h-80 overflow-y-auto">
                <div className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase">
                  Saved Presets
                </div>
                {presets.map((preset) => (
                  <div
                    key={preset.id}
                    className={cn(
                      "flex items-center justify-between px-3 py-2 hover:bg-accent cursor-pointer group",
                      matchingPreset?.id === preset.id && "bg-primary/10"
                    )}
                  >
                    <button
                      onClick={() => handleApplyPreset(preset)}
                      className="flex-1 text-left text-sm"
                    >
                      <div className="font-medium">{preset.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {Object.keys(preset.filters).length} filters
                      </div>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setPresetToDelete(preset.id);
                      }}
                      className="p-1.5 rounded opacity-0 group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive transition-all"
                      aria-label="Delete preset"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                {hasActiveFilters && !matchingPreset && (
                  <>
                    <div className="border-t my-1" />
                    <button
                      onClick={() => {
                        setShowPresetsDropdown(false);
                        setShowSaveDialog(true);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent text-primary"
                    >
                      <Save className="w-4 h-4" />
                      Save current filters...
                    </button>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* Save Dialog */}
      <Dialog
        open={showSaveDialog}
        onClose={() => {
          setShowSaveDialog(false);
          setNewPresetName("");
        }}
        title="Save Filter Preset"
        description="Save your current filter combination for quick access later."
        size="sm"
      >
        <div className="space-y-4 py-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Preset Name
            </label>
            <input
              type="text"
              value={newPresetName}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewPresetName(e.target.value)}
              placeholder="e.g., Weekend Cars in Kathmandu"
              maxLength={50}
              autoFocus
              className="w-full px-3 py-2 border border-input rounded-md bg-background text-sm focus:ring-2 focus:ring-ring focus:border-ring"
            />
            <p className="text-xs text-muted-foreground mt-1">
              {Object.keys(currentFilters).filter(
                (k) => k !== "page" && k !== "limit" && currentFilters[k]
              ).length}{" "}
              filters will be saved
            </p>
          </div>
          {presets.length >= maxPresets && (
            <p className="text-sm text-destructive">
              Maximum {maxPresets} presets reached. Delete an existing preset to
              save a new one.
            </p>
          )}
        </div>
        <DialogFooter>
          <UnifiedButton
            variant="outline"
            onClick={() => {
              setShowSaveDialog(false);
              setNewPresetName("");
            }}
          >
            Cancel
          </UnifiedButton>
          <UnifiedButton
            onClick={handleSavePreset}
            disabled={!newPresetName.trim() || presets.length >= maxPresets}
          >
            Save Preset
          </UnifiedButton>
        </DialogFooter>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog
        open={!!presetToDelete}
        onClose={() => setPresetToDelete(null)}
        title="Delete Preset?"
        description="This action cannot be undone."
        size="sm"
      >
        <DialogFooter>
          <UnifiedButton variant="outline" onClick={() => setPresetToDelete(null)}>
            Cancel
          </UnifiedButton>
          <UnifiedButton
            variant="destructive"
            onClick={() => presetToDelete && handleDeletePreset(presetToDelete)}
          >
            Delete
          </UnifiedButton>
        </DialogFooter>
      </Dialog>
    </div>
  );
}

// Hook for managing filter presets
export function useFilterPresets(storageKey: string) {
  const [presets, setPresets] = useState<FilterPreset[]>([]);

  useEffect(() => {
    const stored = localStorage.getItem(`${PRESETS_STORAGE_PREFIX}${storageKey}`);
    if (stored) {
      try {
        setPresets(JSON.parse(stored));
      } catch {
        console.error("Failed to parse filter presets");
      }
    }
  }, [storageKey]);

  const savePreset = useCallback(
    (name: string, filters: Record<string, string>) => {
      const newPreset: FilterPreset = {
        id: `preset_${Date.now()}`,
        name,
        filters,
        createdAt: new Date().toISOString(),
      };
      const newPresets = [...presets, newPreset];
      setPresets(newPresets);
      localStorage.setItem(
        `${PRESETS_STORAGE_PREFIX}${storageKey}`,
        JSON.stringify(newPresets)
      );
      return newPreset;
    },
    [presets, storageKey]
  );

  const deletePreset = useCallback(
    (id: string) => {
      const newPresets = presets.filter((p) => p.id !== id);
      setPresets(newPresets);
      localStorage.setItem(
        `${PRESETS_STORAGE_PREFIX}${storageKey}`,
        JSON.stringify(newPresets)
      );
    },
    [presets, storageKey]
  );

  return { presets, savePreset, deletePreset };
}

export default FilterPresets;
