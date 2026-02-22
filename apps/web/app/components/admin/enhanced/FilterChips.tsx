/**
 * Filter Chips Component
 * Visual filter representation with easy removal — pure Tailwind
 */

import React, { useState, useCallback, useMemo } from "react";
import {
  Plus,
  Filter,
  X,
  Calendar,
  Type,
  List,
  Hash,
} from "lucide-react";

export interface FilterChip {
  id: string;
  field: string;
  label: string;
  type: "text" | "date" | "select" | "number" | "boolean";
  value: unknown;
  operator?: "equals" | "contains" | "gt" | "lt" | "gte" | "lte" | "between";
  color?: "primary" | "secondary" | "success" | "warning" | "error" | "info";
  icon?: React.ReactNode;
}

type AvailableField = {
  field: string;
  label: string;
  type: FilterChip["type"];
  options?: Array<{ value: string; label: string }>;
};

interface FilterChipsProps {
  filters: FilterChip[];
  onFilterAdd: (filter: FilterChip) => void;
  onFilterRemove: (filterId: string) => void;
  onFilterUpdate: (filterId: string, value: unknown) => void;
  availableFields?: AvailableField[];
  maxFilters?: number;
}

const chipColorMap: Record<string, string> = {
  primary: "border-primary/40 bg-primary/5 text-primary",
  secondary: "border-secondary/40 bg-secondary/5 text-secondary-foreground",
  success: "border-green-400/40 bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300",
  warning: "border-yellow-400/40 bg-yellow-50 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300",
  error: "border-red-400/40 bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300",
  info: "border-blue-400/40 bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
};

export const FilterChips: React.FC<FilterChipsProps> = ({
  filters,
  onFilterAdd,
  onFilterRemove,
  onFilterUpdate: _onFilterUpdate,
  availableFields = [],
  maxFilters = 10,
}) => {
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [selectedField, setSelectedField] = useState<string>("");
  const [filterValue, setFilterValue] = useState<string | number | [string, string]>("");
  const [filterOperator, setFilterOperator] = useState<FilterChip["operator"]>("equals");

  const fieldMap = useMemo(() => {
    const map = new Map<string, AvailableField>();
    availableFields.forEach((field) => {
      const uniqueId = `${field.field}_${field.label.toLowerCase().replace(/\s+/g, "_")}`;
      map.set(uniqueId, field);
    });
    return map;
  }, [availableFields]);

  const handleAddFilter = useCallback(() => {
    const field = fieldMap.get(selectedField);
    if (!field) return;
    const uniqueFieldId = `${field.field}_${field.label.toLowerCase().replace(/\s+/g, "_")}`;
    const newFilter: FilterChip = {
      id: `filter_${uniqueFieldId}_${Date.now()}`,
      field: field.field,
      label: `${field.label}: ${filterValue}`,
      type: field.type,
      value: filterValue,
      operator: filterOperator,
      color: "primary",
    };
    onFilterAdd(newFilter);
    setAddDialogOpen(false);
    setSelectedField("");
    setFilterValue("");
    setFilterOperator("equals");
  }, [selectedField, filterValue, filterOperator, fieldMap, onFilterAdd]);

  const getFilterIcon = (type: FilterChip["type"]) => {
    switch (type) {
      case "text": return <Type className="h-3 w-3" />;
      case "date": return <Calendar className="h-3 w-3" />;
      case "select": return <List className="h-3 w-3" />;
      case "number": return <Hash className="h-3 w-3" />;
      default: return <Filter className="h-3 w-3" />;
    }
  };

  const getOperatorLabel = (operator?: FilterChip["operator"]) => {
    switch (operator) {
      case "contains": return "contains";
      case "gt": return ">";
      case "lt": return "<";
      case "gte": return "\u2265";
      case "lte": return "\u2264";
      case "between": return "between";
      default: return "=";
    }
  };

  return (
    <div className="flex gap-1.5 flex-wrap items-center">
      {filters.length > 0 && (
        <span className="text-xs text-muted-foreground mr-1">Filters:</span>
      )}

      {filters.map((filter) => (
        <span
          key={filter.id}
          className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs border ${
            chipColorMap[filter.color || "primary"] || chipColorMap.primary
          }`}
        >
          {filter.icon || getFilterIcon(filter.type)}
          <span>
            {filter.operator && filter.operator !== "equals"
              ? `${filter.label} (${getOperatorLabel(filter.operator)})`
              : filter.label}
          </span>
          <button
            type="button"
            onClick={() => onFilterRemove(filter.id)}
            className="ml-0.5 p-0.5 rounded-sm hover:bg-black/10 dark:hover:bg-white/10"
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}

      {filters.length < maxFilters && (
        <button
          type="button"
          onClick={() => setAddDialogOpen(true)}
          className="inline-flex items-center gap-1 rounded border border-dashed px-2 py-0.5 text-xs text-muted-foreground hover:border-solid hover:bg-accent"
        >
          <Plus className="h-3 w-3" />
          Add Filter
        </button>
      )}

      {filters.length > 0 && (
        <button
          type="button"
          onClick={() => filters.forEach((f) => onFilterRemove(f.id))}
          className="inline-flex items-center gap-1 ml-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <X className="h-3 w-3" />
          Clear All
        </button>
      )}

      {/* Add Filter Dialog */}
      {addDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setAddDialogOpen(false)}>
          <div className="bg-background rounded-lg shadow-xl w-full max-w-lg mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b">
              <h3 className="text-lg font-semibold">Add Filter</h3>
            </div>

            <div className="px-6 py-4 space-y-4">
              {/* Field select */}
              <div>
                <label className="block text-sm font-medium mb-1.5">Field</label>
                <select
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={selectedField}
                  onChange={(e) => { setSelectedField(e.target.value); setFilterValue(""); }}
                >
                  <option value="">Select field...</option>
                  {Array.from(fieldMap.entries()).map(([uniqueId, field]) => (
                    <option key={uniqueId} value={uniqueId}>{field.label}</option>
                  ))}
                </select>
              </div>

              {selectedField && (
                <>
                  {/* Operator select */}
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Operator</label>
                    <select
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      value={filterOperator}
                      onChange={(e) => setFilterOperator(e.target.value as FilterChip["operator"])}
                    >
                      <option value="equals">Equals</option>
                      <option value="contains">Contains</option>
                      <option value="gt">Greater Than</option>
                      <option value="gte">Greater Than or Equal</option>
                      <option value="lt">Less Than</option>
                      <option value="lte">Less Than or Equal</option>
                      <option value="between">Between</option>
                    </select>
                  </div>

                  {/* Value input — varies by field type */}
                  {(() => {
                    const field = fieldMap.get(selectedField);
                    if (!field) return null;

                    if (field.type === "select" && field.options) {
                      return (
                        <div>
                          <label className="block text-sm font-medium mb-1.5">Value</label>
                          <select
                            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            value={String(filterValue)}
                            onChange={(e) => setFilterValue(e.target.value)}
                          >
                            <option value="">Select value...</option>
                            {field.options.map((opt) => (
                              <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                          </select>
                        </div>
                      );
                    }

                    if (field.type === "number" && filterOperator === "between") {
                      const rangeValue = Array.isArray(filterValue) ? filterValue : ["", ""];
                      return (
                        <div className="flex gap-2">
                          <div className="flex-1">
                            <label className="block text-sm font-medium mb-1.5">Min Value</label>
                            <input type="number" className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={rangeValue[0] || ""} onChange={(e) => setFilterValue([e.target.value, rangeValue[1] || ""])} />
                          </div>
                          <div className="flex-1">
                            <label className="block text-sm font-medium mb-1.5">Max Value</label>
                            <input type="number" className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={rangeValue[1] || ""} onChange={(e) => setFilterValue([rangeValue[0] || "", e.target.value])} />
                          </div>
                        </div>
                      );
                    }

                    if (field.type === "date" && filterOperator === "between") {
                      const rangeValue = Array.isArray(filterValue) ? filterValue : ["", ""];
                      return (
                        <div className="flex gap-2">
                          <div className="flex-1">
                            <label className="block text-sm font-medium mb-1.5">Start Date</label>
                            <input type="date" className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={rangeValue[0] || ""} onChange={(e) => setFilterValue([e.target.value, rangeValue[1] || ""])} />
                          </div>
                          <div className="flex-1">
                            <label className="block text-sm font-medium mb-1.5">End Date</label>
                            <input type="date" className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={rangeValue[1] || ""} onChange={(e) => setFilterValue([rangeValue[0] || "", e.target.value])} />
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div>
                        <label className="block text-sm font-medium mb-1.5">Value</label>
                        <input
                          type={field.type === "number" ? "number" : field.type === "date" ? "date" : "text"}
                          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          value={String(filterValue)}
                          onChange={(e) => setFilterValue(e.target.value)}
                          placeholder="Enter filter value..."
                        />
                      </div>
                    );
                  })()}
                </>
              )}
            </div>

            <div className="flex justify-end gap-2 px-6 py-4 border-t">
              <button
                type="button"
                onClick={() => setAddDialogOpen(false)}
                className="px-4 py-2 text-sm rounded-md hover:bg-muted"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAddFilter}
                disabled={
                  !selectedField ||
                  !filterValue ||
                  (filterOperator === "between" &&
                    (!Array.isArray(filterValue) || filterValue.length !== 2 || !filterValue[0] || !filterValue[1]))
                }
                className="px-4 py-2 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:pointer-events-none"
              >
                Add Filter
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FilterChips;
