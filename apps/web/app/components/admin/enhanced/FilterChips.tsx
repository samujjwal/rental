/**
 * Filter Chips Component
 * Visual filter representation with easy removal
 */

import React, { useState, useCallback, useMemo } from "react";
import {
  Box,
  Chip,
  IconButton,
  Menu,
  MenuItem,
  TextField,
  Button,
  Typography,
  Divider,
  Select,
  FormControl,
  InputLabel,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from "@mui/material";
import {
  Add as AddIcon,
  FilterList as FilterIcon,
  Close as CloseIcon,
  CalendarToday as DateIcon,
  TextFields as TextIcon,
  List as SelectIcon,
  Numbers as NumberIcon,
} from "@mui/icons-material";

export interface FilterChip {
  id: string;
  field: string;
  label: string;
  type: "text" | "date" | "select" | "number" | "boolean";
  value: any;
  operator?: "equals" | "contains" | "gt" | "lt" | "gte" | "lte" | "between";
  color?: "primary" | "secondary" | "success" | "warning" | "error" | "info";
  icon?: React.ReactNode;
}

interface FilterChipsProps {
  filters: FilterChip[];
  onFilterAdd: (filter: FilterChip) => void;
  onFilterRemove: (filterId: string) => void;
  onFilterUpdate: (filterId: string, value: any) => void;
  availableFields?: Array<{
    field: string;
    label: string;
    type: FilterChip["type"];
    options?: Array<{ value: string; label: string }>;
  }>;
  maxFilters?: number;
}

export const FilterChips: React.FC<FilterChipsProps> = ({
  filters,
  onFilterAdd,
  onFilterRemove,
  onFilterUpdate,
  availableFields = [],
  maxFilters = 10,
}) => {
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [selectedField, setSelectedField] = useState<string>("");
  const [filterValue, setFilterValue] = useState<any>("");
  const [filterOperator, setFilterOperator] =
    useState<FilterChip["operator"]>("equals");

  // Create a map of unique identifiers to fields for handling duplicates
  const fieldMap = useMemo(() => {
    const map = new Map<string, any>();
    availableFields.forEach((field, index) => {
      // Create unique identifier using field and label combination
      const uniqueId = `${field.field}_${field.label.toLowerCase().replace(/\s+/g, "_")}`;
      map.set(uniqueId, field);
    });
    return map;
  }, [availableFields]);

  const handleAddFilter = useCallback(() => {
    const field = fieldMap.get(selectedField);
    if (!field) return;

    // Create a unique ID that includes field and label to handle duplicates
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
      case "text":
        return <TextIcon fontSize="small" />;
      case "date":
        return <DateIcon fontSize="small" />;
      case "select":
        return <SelectIcon fontSize="small" />;
      case "number":
        return <NumberIcon fontSize="small" />;
      default:
        return <FilterIcon fontSize="small" />;
    }
  };

  const getOperatorLabel = (operator?: FilterChip["operator"]) => {
    switch (operator) {
      case "contains":
        return "contains";
      case "gt":
        return ">";
      case "lt":
        return "<";
      case "gte":
        return "≥";
      case "lte":
        return "≤";
      case "between":
        return "between";
      default:
        return "=";
    }
  };

  return (
    <Box
      sx={{ display: "flex", gap: 1, flexWrap: "wrap", alignItems: "center" }}
    >
      {filters.length > 0 && (
        <Typography variant="caption" color="text.secondary" sx={{ mr: 1 }}>
          Filters:
        </Typography>
      )}

      {filters.map((filter) => (
        <Chip
          key={filter.id}
          icon={
            (filter.icon || getFilterIcon(filter.type)) as React.ReactElement
          }
          label={
            filter.operator && filter.operator !== "equals"
              ? `${filter.label} (${getOperatorLabel(filter.operator)})`
              : filter.label
          }
          onDelete={() => onFilterRemove(filter.id)}
          color={filter.color || "primary"}
          variant="outlined"
          size="small"
          sx={{
            borderRadius: 1,
            "& .MuiChip-deleteIcon": {
              fontSize: "1rem",
            },
          }}
        />
      ))}

      {filters.length < maxFilters && (
        <Chip
          icon={<AddIcon fontSize="small" />}
          label="Add Filter"
          onClick={() => setAddDialogOpen(true)}
          variant="outlined"
          size="small"
          clickable
          sx={{
            borderRadius: 1,
            borderStyle: "dashed",
            "&:hover": {
              borderStyle: "solid",
              backgroundColor: "action.hover",
            },
          }}
        />
      )}

      {filters.length > 0 && (
        <Button
          size="small"
          leftIcon={<CloseIcon fontSize="small" />}
          onClick={() => filters.forEach((f) => onFilterRemove(f.id))}
          sx={{ ml: 1 }}
        >
          Clear All
        </Button>
      )}

      <Dialog
        open={addDialogOpen}
        onClose={() => setAddDialogOpen(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 2,
            boxShadow: 3,
          },
        }}
      >
        <DialogTitle
          sx={{ pb: 2, borderBottom: "1px solid", borderColor: "divider" }}
        >
          Add Filter
        </DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <FormControl fullWidth>
              <InputLabel sx={{ mb: 1 }}>Field</InputLabel>
              <Select
                value={selectedField}
                onChange={(e) => {
                  setSelectedField(e.target.value);
                  setFilterValue("");
                }}
                label="Field"
                size="medium"
              >
                {Array.from(fieldMap.entries()).map(([uniqueId, field]) => (
                  <MenuItem key={uniqueId} value={uniqueId}>
                    <Box
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: 1.5,
                        py: 0.5,
                      }}
                    >
                      {getFilterIcon(field.type)}
                      <span>{field.label}</span>
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {selectedField && (
              <>
                <FormControl fullWidth>
                  <InputLabel sx={{ mb: 1 }}>Operator</InputLabel>
                  <Select
                    value={filterOperator}
                    onChange={(e) =>
                      setFilterOperator(
                        e.target.value as FilterChip["operator"]
                      )
                    }
                    label="Operator"
                    size="medium"
                  >
                    <MenuItem value="equals">Equals</MenuItem>
                    <MenuItem value="not_equals">Not Equals</MenuItem>
                    <MenuItem value="contains">Contains</MenuItem>
                    <MenuItem value="starts_with">Starts With</MenuItem>
                    <MenuItem value="ends_with">Ends With</MenuItem>
                    <MenuItem value="gt">Greater Than</MenuItem>
                    <MenuItem value="gte">Greater Than or Equal</MenuItem>
                    <MenuItem value="lt">Less Than</MenuItem>
                    <MenuItem value="lte">Less Than or Equal</MenuItem>
                    <MenuItem value="in">In (List)</MenuItem>
                    <MenuItem value="not_in">Not In (List)</MenuItem>
                    <MenuItem value="between">Between</MenuItem>
                    <MenuItem value="is_null">Is Null</MenuItem>
                    <MenuItem value="is_not_null">Is Not Null</MenuItem>
                  </Select>
                </FormControl>

                {(() => {
                  const field = availableFields.find(
                    (f) => f.field === selectedField
                  );
                  if (!field) return null;

                  if (field.type === "select" && field.options) {
                    return (
                      <FormControl fullWidth>
                        <InputLabel sx={{ mb: 1 }}>Value</InputLabel>
                        <Select
                          value={filterValue}
                          onChange={(e) => setFilterValue(e.target.value)}
                          label="Value"
                          size="medium"
                        >
                          {field.options.map((option) => (
                            <MenuItem key={option.value} value={option.value}>
                              {option.label}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    );
                  }

                  if (field.type === "number") {
                    if (filterOperator === "between") {
                      return (
                        <Box sx={{ display: "flex", gap: 2 }}>
                          <TextField
                            fullWidth
                            type="number"
                            label="Min Value"
                            value={filterValue?.[0] || ""}
                            onChange={(e) =>
                              setFilterValue([
                                e.target.value,
                                filterValue?.[1] || "",
                              ])
                            }
                            size="medium"
                          />
                          <TextField
                            fullWidth
                            type="number"
                            label="Max Value"
                            value={filterValue?.[1] || ""}
                            onChange={(e) =>
                              setFilterValue([
                                filterValue?.[0] || "",
                                e.target.value,
                              ])
                            }
                            size="medium"
                          />
                        </Box>
                      );
                    }
                    return (
                      <TextField
                        fullWidth
                        type="number"
                        label="Value"
                        value={filterValue}
                        onChange={(e) => setFilterValue(e.target.value)}
                        size="medium"
                      />
                    );
                  }

                  if (field.type === "date") {
                    if (filterOperator === "between") {
                      return (
                        <Box sx={{ display: "flex", gap: 2 }}>
                          <TextField
                            fullWidth
                            type="date"
                            label="Start Date"
                            value={filterValue?.[0] || ""}
                            onChange={(e) =>
                              setFilterValue([
                                e.target.value,
                                filterValue?.[1] || "",
                              ])
                            }
                            InputLabelProps={{ shrink: true }}
                            size="medium"
                          />
                          <TextField
                            fullWidth
                            type="date"
                            label="End Date"
                            value={filterValue?.[1] || ""}
                            onChange={(e) =>
                              setFilterValue([
                                filterValue?.[0] || "",
                                e.target.value,
                              ])
                            }
                            InputLabelProps={{ shrink: true }}
                            size="medium"
                          />
                        </Box>
                      );
                    }
                    return (
                      <TextField
                        fullWidth
                        type="date"
                        label="Value"
                        value={filterValue}
                        onChange={(e) => setFilterValue(e.target.value)}
                        InputLabelProps={{ shrink: true }}
                        size="medium"
                      />
                    );
                  }

                  return (
                    <TextField
                      fullWidth
                      label="Value"
                      value={filterValue}
                      onChange={(e) => setFilterValue(e.target.value)}
                      placeholder="Enter filter value..."
                      size="medium"
                    />
                  );
                })()}
              </>
            )}
          </Box>
        </DialogContent>
        <DialogActions
          sx={{ px: 3, py: 2, borderTop: "1px solid", borderColor: "divider" }}
        >
          <Button onClick={() => setAddDialogOpen(false)} size="medium">
            Cancel
          </Button>
          <Button
            onClick={handleAddFilter}
            variant="contained"
            disabled={
              !selectedField ||
              !filterValue ||
              (filterOperator === "between" &&
                (!Array.isArray(filterValue) ||
                  filterValue.length !== 2 ||
                  !filterValue[0] ||
                  !filterValue[1]))
            }
            size="medium"
          >
            Add Filter
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default FilterChips;
