import React from "react";
import {
  Box,
  Typography,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  TableContainer,
} from "@mui/material";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type ColumnFiltersState,
} from "@tanstack/react-table";

interface TanStackTableProps {
  data: any[];
  columns: any[];
  totalCount: number;
}

export function TanStackTable({
  data,
  columns,
  totalCount,
}: TanStackTableProps) {
  console.log("TanStackTable props:", {
    data: data.slice(0, 2),
    columns: columns.slice(0, 2),
    totalCount,
  });

  // Debug: Show actual data structure
  if (data.length > 0) {
    console.log("First data row keys:", Object.keys(data[0]));
    console.log("First data row:", data[0]);
  }

  // Debug: Show column structure
  console.log("Columns:", columns);

  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    []
  );

  const tableColumns = React.useMemo<ColumnDef<any>[]>(
    () =>
      columns.map((col: any) => {
        console.log("Processing column:", col);
        return {
          id: col.id || col.accessorKey,
          header: col.header,
          accessorKey: col.accessorKey,
          cell: (info: any) => {
            const value = info.getValue();
            // Format dates and handle null/undefined values
            if (value == null) return "N/A";
            if (col.id === "createdAt" && typeof value === "string") {
              return new Date(value).toLocaleDateString();
            }
            return String(value);
          },
        };
      }),
    [columns]
  );

  console.log("Table columns created:", tableColumns);

  const table = useReactTable({
    data,
    columns: tableColumns,
    state: {
      sorting,
      columnFilters,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  console.log("React table created:", table);

  return (
    <Box>
      <Typography variant="body2" sx={{ mb: 2 }}>
        TanStackTable: Rendering {data.length} rows with {columns.length}{" "}
        columns
        {sorting.length > 0 &&
          ` | Sorted by: ${sorting[0].id} ${sorting[0].desc ? "desc" : "asc"}`}
      </Typography>

      <Typography variant="body2" sx={{ mb: 1, color: "gray" }}>
        Debug: Header groups: {table.getHeaderGroups().length}, Rows:{" "}
        {table.getRowModel().rows.length}, Sorting: {JSON.stringify(sorting)}
      </Typography>

      <TableContainer>
        <Table>
          <TableHead>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableCell
                    key={header.id}
                    sx={{
                      cursor: header.column.getCanSort()
                        ? "pointer"
                        : "default",
                      fontWeight: "bold",
                      backgroundColor: "#f5f5f5",
                    }}
                    onClick={header.column.getToggleSortingHandler()}
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                    {{
                      asc: " 🔼",
                      desc: " 🔽",
                    }[header.column.getIsSorted() as string] ?? ""}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableHead>
          <TableBody>
            {table.getRowModel().rows.map((row) => (
              <TableRow key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Typography variant="body2" sx={{ mt: 2 }}>
        Showing {table.getRowModel().rows.length} of {totalCount} results
      </Typography>
    </Box>
  );
}
