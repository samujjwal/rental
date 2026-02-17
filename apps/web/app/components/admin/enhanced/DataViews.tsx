/**
 * Data View Components
 * Multiple view modes: Table, Cards, List for different screen sizes
 */

import React from "react";
import {
  Box,
  Card,
  CardContent,
  CardActions,
  Grid,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Avatar,
  IconButton,
  Typography,
  Chip,
  Divider,
  ToggleButtonGroup,
  ToggleButton,
  Tooltip,
} from "@mui/material";
import {
  ViewList as ListIcon,
  ViewModule as CardIcon,
  TableChart as TableIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Visibility as ViewIcon,
} from "@mui/icons-material";
import type { ColumnDef } from "@tanstack/react-table";

export type ViewMode = "table" | "cards" | "list";

type DataRow = Record<string, unknown> & { id?: string | number };

interface DataViewProps<T extends DataRow> {
  data: T[];
  columns: ColumnDef<T>[];
  viewMode: ViewMode;
  onRowClick?: (row: T) => void;
  onRowEdit?: (row: T) => void;
  onRowDelete?: (row: T) => void;
  onRowView?: (row: T) => void;
}

const getColumnId = <T extends DataRow>(
  col?: ColumnDef<T>
): string | undefined => {
  if (!col) return undefined;
  if (typeof col.id === "string") return col.id;
  if (
    "accessorKey" in col &&
    typeof (col as { accessorKey?: unknown }).accessorKey === "string"
  ) {
    return (col as { accessorKey: string }).accessorKey;
  }
  return undefined;
};

interface ViewModeToggleProps {
  value: ViewMode;
  onChange: (mode: ViewMode) => void;
  availableModes?: ViewMode[];
}

export const ViewModeToggle: React.FC<ViewModeToggleProps> = ({
  value,
  onChange,
  availableModes = ["table", "cards", "list"],
}) => {
  return (
    <ToggleButtonGroup
      value={value}
      exclusive
      onChange={(_, newMode) => {
        if (newMode !== null) {
          onChange(newMode);
        }
      }}
      size="small"
      aria-label="view mode"
    >
      {availableModes.includes("table") && (
        <ToggleButton value="table" aria-label="table view">
          <Tooltip title="Table View">
            <TableIcon fontSize="small" />
          </Tooltip>
        </ToggleButton>
      )}
      {availableModes.includes("cards") && (
        <ToggleButton value="cards" aria-label="card view">
          <Tooltip title="Card View">
            <CardIcon fontSize="small" />
          </Tooltip>
        </ToggleButton>
      )}
      {availableModes.includes("list") && (
        <ToggleButton value="list" aria-label="list view">
          <Tooltip title="List View">
            <ListIcon fontSize="small" />
          </Tooltip>
        </ToggleButton>
      )}
    </ToggleButtonGroup>
  );
};

export const CardView = <T extends DataRow>({
  data,
  columns,
  onRowClick,
  onRowEdit,
  onRowDelete,
  onRowView,
}: DataViewProps<T>) => {
  const getDisplayValue = (row: T, columnId: string) => {
    const value = row[columnId as keyof T];
    if (value === null || value === undefined) return "-";
    if (typeof value === "boolean") return value ? "Yes" : "No";
    if (typeof value === "object") return JSON.stringify(value);
    return String(value);
  };

  const getPrimaryField = () => {
    const nameField = columns.find((col) => {
      const id = getColumnId(col);
      return id ? ["name", "title", "label"].includes(id) : false;
    });
    return getColumnId(nameField ?? columns[0]) || "id";
  };

  const getSecondaryFields = () => {
    return columns.slice(0, 4).filter((col) => {
      const id = getColumnId(col);
      return id !== getPrimaryField() && id !== "id" && id !== "actions";
    });
  };

  return (
    <Grid container spacing={2}>
      {data.map((row, index) => {
        const primaryField = getPrimaryField();
        const secondaryFields = getSecondaryFields();

        return (
          <Grid
            size={{ xs: 12, sm: 6, md: 4, lg: 3 }}
            key={row.id ?? index}
          >
            <Card
              sx={{
                height: "100%",
                display: "flex",
                flexDirection: "column",
                cursor: onRowClick ? "pointer" : "default",
                transition: "all 0.2s ease-in-out",
                "&:hover": {
                  transform: "translateY(-4px)",
                  boxShadow: 4,
                },
              }}
              onClick={() => onRowClick?.(row)}
            >
              <CardContent sx={{ flexGrow: 1 }}>
                <Typography variant="h6" gutterBottom noWrap>
                  {getDisplayValue(row, primaryField)}
                </Typography>

                <Box
                  sx={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 1,
                    mt: 2,
                  }}
                >
                  {secondaryFields.map((col) => {
                    const id = getColumnId(col);
                    if (!id) return null;
                    const header = col.header || id;

                    return (
                      <Box key={id}>
                        <Typography variant="caption" color="text.secondary">
                          {String(header)}
                        </Typography>
                        <Typography variant="body2" noWrap>
                          {getDisplayValue(row, id)}
                        </Typography>
                      </Box>
                    );
                  })}
                </Box>
              </CardContent>

              <CardActions sx={{ justifyContent: "flex-end", px: 2, pb: 2 }}>
                {onRowView && (
                  <IconButton
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRowView(row);
                    }}
                    aria-label="view"
                  >
                    <ViewIcon fontSize="small" />
                  </IconButton>
                )}
                {onRowEdit && (
                  <IconButton
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRowEdit(row);
                    }}
                    aria-label="edit"
                  >
                    <EditIcon fontSize="small" />
                  </IconButton>
                )}
                {onRowDelete && (
                  <IconButton
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRowDelete(row);
                    }}
                    aria-label="delete"
                    color="error"
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                )}
              </CardActions>
            </Card>
          </Grid>
        );
      })}
    </Grid>
  );
};

export const ListView = <T extends DataRow>({
  data,
  columns,
  onRowClick,
  onRowEdit,
  onRowDelete,
  onRowView,
}: DataViewProps<T>) => {
  const getDisplayValue = (row: T, columnId: string) => {
    const value = row[columnId as keyof T];
    if (value === null || value === undefined) return "-";
    if (typeof value === "boolean") return value ? "Yes" : "No";
    if (typeof value === "object") return JSON.stringify(value);
    return String(value);
  };

  const getPrimaryField = () => {
    const nameField = columns.find((col) => {
      const id = getColumnId(col);
      return id ? ["name", "title", "label"].includes(id) : false;
    });
    return getColumnId(nameField ?? columns[0]) || "id";
  };

  const getSecondaryField = () => {
    const secondaryFields = columns.filter((col) => {
      const id = getColumnId(col);
      return id !== getPrimaryField() && id !== "id" && id !== "actions";
    });
    return getColumnId(secondaryFields[0]);
  };

  const getStatusField = () => {
    const statusField = columns.find((col) => {
      const id = getColumnId(col);
      return id ? ["status", "state", "active"].includes(id) : false;
    });
    return getColumnId(statusField);
  };

  return (
    <List sx={{ width: "100%", bgcolor: "background.paper" }}>
      {data.map((row, index) => {
        const primaryField = getPrimaryField();
        const secondaryField = getSecondaryField();
        const statusField = getStatusField();

        return (
          <React.Fragment key={row.id ?? index}>
            <ListItem
              sx={{
                cursor: onRowClick ? "pointer" : "default",
                transition: "background-color 0.2s ease-in-out",
                "&:hover": {
                  bgcolor: "action.hover",
                },
              }}
              onClick={() => onRowClick?.(row)}
              secondaryAction={
                <Box sx={{ display: "flex", gap: 0.5 }}>
                  {onRowView && (
                    <IconButton
                      edge="end"
                      aria-label="view"
                      onClick={(e) => {
                        e.stopPropagation();
                        onRowView(row);
                      }}
                    >
                      <ViewIcon fontSize="small" />
                    </IconButton>
                  )}
                  {onRowEdit && (
                    <IconButton
                      edge="end"
                      aria-label="edit"
                      onClick={(e) => {
                        e.stopPropagation();
                        onRowEdit(row);
                      }}
                    >
                      <EditIcon fontSize="small" />
                    </IconButton>
                  )}
                  {onRowDelete && (
                    <IconButton
                      edge="end"
                      aria-label="delete"
                      onClick={(e) => {
                        e.stopPropagation();
                        onRowDelete(row);
                      }}
                      color="error"
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  )}
                </Box>
              }
            >
              <ListItemAvatar>
                <Avatar sx={{ bgcolor: "primary.main" }}>
                  {getDisplayValue(row, primaryField).charAt(0).toUpperCase()}
                </Avatar>
              </ListItemAvatar>
              <ListItemText
                primary={
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <Typography variant="body1">
                      {getDisplayValue(row, primaryField)}
                    </Typography>
                    {statusField && (
                      <Chip
                        label={getDisplayValue(row, statusField)}
                        size="small"
                        color={
                          getDisplayValue(row, statusField).toLowerCase() ===
                          "active"
                            ? "success"
                            : "default"
                        }
                      />
                    )}
                  </Box>
                }
                secondary={
                  secondaryField
                    ? getDisplayValue(row, secondaryField)
                    : undefined
                }
              />
            </ListItem>
            {index < data.length - 1 && (
              <Divider variant="inset" component="li" />
            )}
          </React.Fragment>
        );
      })}
    </List>
  );
};

export const DataViews = {
  CardView,
  ListView,
  ViewModeToggle,
};

export default DataViews;
