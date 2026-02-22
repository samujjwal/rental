import { useState, useRef, useEffect } from "react";
import { Trash2, X, Clock } from "lucide-react";
import { ConfirmDialog } from "~/components/ui/ConfirmDialog";
import { FadeIn } from "~/components/animations";

export interface BulkActionsToolbarProps {
  selectedCount: number;
  onClearSelection: () => void;
  onDelete?: () => void;
  onStatusChange?: (status: string) => void;
  availableStatuses?: Array<{ value: string; label: string; icon?: React.ReactNode }>;
  isLoading?: boolean;
}

/**
 * BulkActionsToolbar Component — pure Tailwind
 */
export function BulkActionsToolbar({
  selectedCount,
  onClearSelection,
  onDelete,
  onStatusChange,
  availableStatuses = [],
  isLoading = false,
}: BulkActionsToolbarProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const handleStatusChange = (status: string) => {
    setMenuOpen(false);
    onStatusChange?.(status);
  };

  const handleDeleteConfirm = () => {
    onDelete?.();
    setDeleteDialogOpen(false);
  };

  if (selectedCount === 0) return null;

  return (
    <FadeIn direction="down">
      <div className="flex items-center gap-2 rounded-md bg-primary/10 px-4 py-2 mb-3">
        <span className="flex-1 text-sm font-medium">{selectedCount} selected</span>

        {onStatusChange && availableStatuses.length > 0 && (
          <div ref={menuRef} className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen(!menuOpen)}
              disabled={isLoading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md hover:bg-primary/20 disabled:opacity-50"
            >
              <Clock className="h-4 w-4" />
              Change Status
            </button>
            {menuOpen && (
              <div className="absolute right-0 z-50 mt-1 w-48 rounded-md border bg-popover shadow-lg">
                {availableStatuses.map((status) => (
                  <button
                    key={status.value}
                    type="button"
                    className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground"
                    onClick={() => handleStatusChange(status.value)}
                  >
                    {status.icon}
                    {status.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {onDelete && (
          <button
            type="button"
            onClick={() => setDeleteDialogOpen(true)}
            disabled={isLoading}
            className="p-1.5 rounded-md hover:bg-destructive/20 text-destructive disabled:opacity-50"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}

        <button
          type="button"
          onClick={onClearSelection}
          className="p-1.5 rounded-md hover:bg-primary/20"
        >
          <X className="h-4 w-4" />
        </button>

        <ConfirmDialog
          open={deleteDialogOpen}
          onClose={() => setDeleteDialogOpen(false)}
          onConfirm={handleDeleteConfirm}
          title="Delete Selected Items?"
          message={`Are you sure you want to delete ${selectedCount} item${selectedCount > 1 ? "s" : ""}? This action cannot be undone.`}
          confirmText="Delete"
          confirmColor="error"
          isLoading={isLoading}
        />
      </div>
    </FadeIn>
  );
}

/**
 * Hook for managing bulk selection
 */
export function useBulkSelection<T extends { id: string }>(items: T[]) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const isSelected = (id: string) => selected.has(id);
  const isAllSelected = items.length > 0 && selected.size === items.length;
  const isIndeterminate = selected.size > 0 && selected.size < items.length;

  const handleSelectAll = () => {
    if (isAllSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(items.map((item) => item.id)));
    }
  };

  const handleSelect = (id: string) => {
    const newSelected = new Set(selected);
    if (newSelected.has(id)) newSelected.delete(id);
    else newSelected.add(id);
    setSelected(newSelected);
  };

  const clearSelection = () => setSelected(new Set());

  const getSelectedItems = () => items.filter((item) => selected.has(item.id));

  return {
    selected,
    selectedCount: selected.size,
    isSelected,
    isAllSelected,
    isIndeterminate,
    handleSelectAll,
    handleSelect,
    clearSelection,
    getSelectedItems,
  };
}

/**
 * BulkSelectCheckbox — pure Tailwind
 */
export interface BulkSelectCheckboxProps {
  checked: boolean;
  indeterminate?: boolean;
  onChange: () => void;
  disabled?: boolean;
}

export function BulkSelectCheckbox({
  checked,
  indeterminate = false,
  onChange,
  disabled = false,
}: BulkSelectCheckboxProps) {
  return (
    <input
      type="checkbox"
      checked={checked}
      ref={(el) => { if (el) el.indeterminate = indeterminate; }}
      onChange={onChange}
      disabled={disabled}
      aria-label="select all items"
      className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-ring disabled:opacity-50"
    />
  );
}

/**
 * ItemSelectCheckbox — pure Tailwind
 */
export interface ItemSelectCheckboxProps {
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
  ariaLabel?: string;
}

export function ItemSelectCheckbox({
  checked,
  onChange,
  disabled = false,
  ariaLabel = "select item",
}: ItemSelectCheckboxProps) {
  return (
    <input
      type="checkbox"
      checked={checked}
      onChange={onChange}
      disabled={disabled}
      aria-label={ariaLabel}
      onClick={(e) => e.stopPropagation()}
      className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-ring disabled:opacity-50"
    />
  );
}
