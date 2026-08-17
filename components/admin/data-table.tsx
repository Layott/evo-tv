"use client";

import * as React from "react";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export interface DataColumn<T> {
  key: string;
  header: React.ReactNode;
  width?: string;
  className?: string;
  sortable?: boolean;
  accessor?: (row: T) => unknown;
  cell: (row: T) => React.ReactNode;
}

interface DataTableProps<T> {
  data: T[];
  columns: DataColumn<T>[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  loading?: boolean;
  emptyMessage?: string;
  initialSort?: { key: string; direction: "asc" | "desc" };
}

export function DataTable<T>({
  data,
  columns,
  rowKey,
  onRowClick,
  loading,
  emptyMessage = "No results.",
  initialSort,
}: DataTableProps<T>) {
  const [sort, setSort] = React.useState<{ key: string; direction: "asc" | "desc" } | null>(
    initialSort ?? null,
  );

  const sortedData = React.useMemo(() => {
    if (!sort) return data;
    const col = columns.find((c) => c.key === sort.key);
    if (!col || !col.accessor) return data;
    const arr = [...data];
    arr.sort((a, b) => {
      const av = col.accessor!(a);
      const bv = col.accessor!(b);
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === "number" && typeof bv === "number") {
        return sort.direction === "asc" ? av - bv : bv - av;
      }
      const as = String(av).toLowerCase();
      const bs = String(bv).toLowerCase();
      if (as < bs) return sort.direction === "asc" ? -1 : 1;
      if (as > bs) return sort.direction === "asc" ? 1 : -1;
      return 0;
    });
    return arr;
  }, [data, sort, columns]);

  const handleSort = (key: string) => {
    setSort((prev) => {
      if (prev?.key !== key) return { key, direction: "asc" };
      if (prev.direction === "asc") return { key, direction: "desc" };
      return null;
    });
  };

  return (
    // `overflow-x-auto`, not `overflow-hidden`: on a phone an eight-column admin
    // table is wider than the screen, and hiding the overflow cut the columns off
    // with no way to reach them. The table scrolls inside its own box so the page
    // itself never scrolls sideways.
    <div className="overflow-x-auto rounded-xl border border-border bg-card/30">
      <Table>
        <TableHeader className="sticky top-0 z-10 bg-card/80 backdrop-blur">
          <TableRow className="border-border hover:bg-transparent">
            {columns.map((col) => (
              <TableHead
                key={col.key}
                // Not `uppercase`: a sortable header renders inside a button and
                // was not picking the transform up, so a table showed "Video"
                // next to "ACCESS". Sentence case for all of them agrees with
                // the rest of the dashboard.
                className={cn("text-xs font-medium tracking-wide text-muted-foreground", col.className)}
                style={col.width ? { width: col.width } : undefined}
              >
                {col.sortable && col.accessor ? (
                  <button
                    type="button"
                    onClick={() => handleSort(col.key)}
                    className="inline-flex items-center gap-1 hover:text-foreground"
                  >
                    {col.header}
                    {sort?.key === col.key ? (
                      sort.direction === "asc" ? (
                        <ArrowUp className="h-3 w-3" />
                      ) : (
                        <ArrowDown className="h-3 w-3" />
                      )
                    ) : (
                      <ArrowUpDown className="h-3 w-3 opacity-40" />
                    )}
                  </button>
                ) : (
                  col.header
                )}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <TableRow key={`skeleton-${i}`} className="border-border">
                {columns.map((col) => (
                  <TableCell key={col.key}>
                    <div className="h-4 w-full rounded bg-muted" />
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : sortedData.length === 0 ? (
            <TableRow className="border-border hover:bg-transparent">
              <TableCell colSpan={columns.length} className="py-10 text-center text-sm text-muted-foreground">
                {emptyMessage}
              </TableCell>
            </TableRow>
          ) : (
            sortedData.map((row) => (
              <TableRow
                key={rowKey(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={cn(
                  "border-border hover:bg-accent",
                  onRowClick ? "cursor-pointer" : "",
                )}
              >
                {columns.map((col) => (
                  <TableCell key={col.key} className={cn("py-3 text-sm text-foreground", col.className)}>
                    {col.cell(row)}
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
