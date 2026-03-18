import React, { useState, useCallback } from "react";
import { CheckSquare, Square, MoreHorizontal, Trash2, Play, Pause, Archive, X, ChevronDown } from "lucide-react";
import { cn } from "~/lib/utils";
import { UnifiedButton } from "~/components/ui";

export type BulkAction = {
  id: string;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  variant?: "default" | "destructive" | "outline";
  disabled?: boolean;
  onClick: (selectedIds: string[]) => void | Promise<void>;
};

interface BulkActionsToolbarProps<T extends { id: string }> {
  items: T[];
  actions: BulkAction[];
  onSelectionChange?: (selectedIds: string[]) => void;
  className?: string;
  selectAllLabel?: string;
  selectedLabel?: (count: number) => string;
}

export function BulkActionsToolbar<T extends { id: string }>({
  items,
  actions,
  onSelectionChange,
  className,
  selectAllLabel = "Select all",
  selectedLabel = (count) => `${count} selected`,
}: BulkActionsToolbarProps<T>) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isProcessing, setIsProcessing] = useState(false);
  const [showActions, setShowActions] = useState(false);

  const allSelected = items.length > 0 && selectedIds.size === items.length;
  const someSelected = selectedIds.size > 0 && selectedIds.size < items.length;
  const hasSelection = selectedIds.size > 0;

  const toggleSelectAll = useCallback(() => {
    if (allSelected) {
      setSelectedIds(new Set());
      onSelectionChange?.([]);
    } else {
      const allIds = items.map((item) => item.id);
      setSelectedIds(new Set(allIds));
      onSelectionChange?.(allIds);
    }
  }, [allSelected, items, onSelectionChange]);

  const toggleSelectItem = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      const idsArray = Array.from(next);
      onSelectionChange?.(idsArray);
      return next;
    });
  }, [onSelectionChange]);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
    onSelectionChange?.([]);
  }, [onSelectionChange]);

  const handleAction = async (action: BulkAction) => {
    if (isProcessing || selectedIds.size === 0) return;
    
    setIsProcessing(true);
    try {
      const idsArray = Array.from(selectedIds);
      await action.onClick(idsArray);
      // Clear selection after successful action
      clearSelection();
    } finally {
      setIsProcessing(false);
      setShowActions(false);
    }
  };

  return (
    <div className={cn("flex items-center gap-3", className)}>
      {/* Select All Checkbox */}
      <button
        onClick={toggleSelectAll}
        className={cn(
          "flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors",
          hasSelection
            ? "bg-primary/10 text-primary hover:bg-primary/20"
            : "hover:bg-muted text-muted-foreground"
        )}
        aria-label={allSelected ? "Deselect all" : selectAllLabel}
      >
        {allSelected ? (
          <CheckSquare className="w-5 h-5" />
        ) : someSelected ? (
          <div className="relative">
            <Square className="w-5 h-5" />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-2 h-2 bg-primary rounded-sm" />
            </div>
          </div>
        ) : (
          <Square className="w-5 h-5" />
        )}
        <span>{hasSelection ? selectedLabel(selectedIds.size) : selectAllLabel}</span>
      </button>

      {/* Clear Selection */}
      {hasSelection && (
        <button
          onClick={clearSelection}
          className="p-2 rounded-md hover:bg-muted text-muted-foreground transition-colors"
          aria-label="Clear selection"
        >
          <X className="w-4 h-4" />
        </button>
      )}

      {/* Bulk Actions Dropdown */}
      {hasSelection && actions.length > 0 && (
        <div className="relative">
          <UnifiedButton
            variant="outline"
            size="sm"
            onClick={() => setShowActions(!showActions)}
            rightIcon={<ChevronDown className="w-4 h-4" />}
            disabled={isProcessing}
          >
            <MoreHorizontal className="w-4 h-4 mr-1" />
            Actions
          </UnifiedButton>

          {showActions && (
            <div className="absolute left-0 top-full mt-1 bg-popover border rounded-lg shadow-lg py-1 min-w-48 z-50">
              {actions.map((action) => {
                const Icon = action.icon;
                return (
                  <button
                    key={action.id}
                    onClick={() => handleAction(action)}
                    disabled={isProcessing || action.disabled}
                    className={cn(
                      "w-full flex items-center gap-2 px-4 py-2 text-sm text-left transition-colors",
                      action.variant === "destructive"
                        ? "text-destructive hover:bg-destructive/10"
                        : "hover:bg-accent",
                      (isProcessing || action.disabled) && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    {Icon && <Icon className="w-4 h-4" />}
                    {action.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Processing Overlay */}
      {isProcessing && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          Processing...
        </div>
      )}
    </div>
  );
}

// Hook for managing bulk selection state
export function useBulkSelection<T extends { id: string }>(items: T[]) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const toggleSelectAll = useCallback(() => {
    if (selectedIds.size === items.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(items.map((item) => item.id)));
    }
  }, [items, selectedIds.size]);

  const toggleSelectItem = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const isSelected = useCallback(
    (id: string) => selectedIds.has(id),
    [selectedIds]
  );

  const selectedItems = items.filter((item) => selectedIds.has(item.id));

  return {
    selectedIds,
    selectedItems,
    selectedCount: selectedIds.size,
    isAllSelected: items.length > 0 && selectedIds.size === items.length,
    hasSelection: selectedIds.size > 0,
    toggleSelectAll,
    toggleSelectItem,
    clearSelection,
    isSelected,
  };
}

// Individual checkbox component for use in lists
interface BulkSelectCheckboxProps {
  id: string;
  isSelected: boolean;
  onToggle: (id: string) => void;
  className?: string;
}

export function BulkSelectCheckbox({
  id,
  isSelected,
  onToggle,
  className,
}: BulkSelectCheckboxProps) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onToggle(id);
      }}
      className={cn(
        "p-1 rounded transition-colors",
        isSelected ? "text-primary" : "text-muted-foreground hover:text-foreground",
        className
      )}
      aria-label={isSelected ? "Deselect item" : "Select item"}
    >
      {isSelected ? (
        <CheckSquare className="w-5 h-5" />
      ) : (
        <Square className="w-5 h-5" />
      )}
    </button>
  );
}

export default BulkActionsToolbar;
