"use client";

import * as React from "react";
import Link from "next/link";
import { ExternalLink, Search } from "lucide-react";
import { toast } from "sonner";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { adminListUsers, adminSetUserRole, adminSuspendUser } from "@/lib/client";
import type { Profile, Role } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { DataTable, type DataColumn } from "./data-table";
import { PageHeader } from "./page-header";
import { StatusBadge } from "./status-badge";
import { formatDate, timeAgo } from "./utils";

interface AdminProfile extends Profile {
  lastActive: string;
  suspended: boolean;
}

function roleTone(role: Role): "emerald" | "amber" | "blue" | "neutral" {
  if (role === "admin") return "emerald";
  if (role === "premium") return "amber";
  if (role === "user") return "blue";
  return "neutral";
}

export function UsersRolesPage() {
  const queryClient = useQueryClient();

  const usersQ = useQuery({
    queryKey: ["admin", "users"],
    queryFn: () => adminListUsers({ limit: 200 }),
  });

  // `lastActive` and `suspended` are not on the users endpoint yet, so they are
  // filled from what the row does carry rather than invented per render.
  const all: AdminProfile[] = React.useMemo(
    () =>
      (usersQ.data?.users ?? []).map((p) => ({
        ...p,
        suspended: Boolean((p as { suspended?: boolean }).suspended),
        lastActive: (p as { lastActive?: string }).lastActive ?? p.createdAt,
      })),
    [usersQ.data],
  );

  const refresh = React.useCallback(
    () => queryClient.invalidateQueries({ queryKey: ["admin", "users"] }),
    [queryClient],
  );
  const [search, setSearch] = React.useState("");
  const [roleFilter, setRoleFilter] = React.useState<string>("all");
  const [selected, setSelected] = React.useState<AdminProfile | null>(null);

  const filtered = React.useMemo(() => {
    let rows = all;
    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter(
        (p) => p.handle.toLowerCase().includes(q) || p.displayName.toLowerCase().includes(q),
      );
    }
    if (roleFilter !== "all") rows = rows.filter((p) => p.role === roleFilter);
    return rows;
  }, [all, search, roleFilter]);

  const columns: DataColumn<AdminProfile>[] = [
    {
      key: "user",
      header: "User",
      sortable: true,
      accessor: (r) => r.handle,
      cell: (row) => (
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 overflow-hidden rounded-full bg-neutral-800">
            {}
            <img src={row.avatarUrl} alt="" className="h-full w-full object-cover" />
          </div>
          <div>
            <div className="text-sm font-medium text-neutral-100">{row.displayName}</div>
            <div className="text-xs text-neutral-500">@{row.handle}</div>
          </div>
        </div>
      ),
    },
    {
      key: "role",
      header: "Role",
      sortable: true,
      accessor: (r) => r.role,
      cell: (row) => <StatusBadge tone={roleTone(row.role)}>{row.role}</StatusBadge>,
    },
    {
      key: "country",
      header: "Country",
      cell: (row) => <StatusBadge tone="neutral">{row.country}</StatusBadge>,
    },
    {
      key: "created",
      header: "Created",
      sortable: true,
      accessor: (r) => new Date(r.createdAt).getTime(),
      cell: (row) => <span className="text-xs text-neutral-400">{formatDate(row.createdAt)}</span>,
    },
    {
      key: "lastActive",
      header: "Last active",
      sortable: true,
      accessor: (r) => new Date(r.lastActive).getTime(),
      cell: (row) => <span className="text-xs text-neutral-400">{timeAgo(row.lastActive)}</span>,
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      accessor: (r) => (r.suspended ? 0 : 1),
      cell: (row) =>
        row.suspended ? (
          <StatusBadge tone="red">Suspended</StatusBadge>
        ) : (
          <StatusBadge tone="emerald" dot>
            Active
          </StatusBadge>
        ),
    },
  ];

  const roleMut = useMutation({
    mutationFn: ({ id, role }: { id: string; role: Role }) =>
      adminSetUserRole(id, role as "user" | "premium" | "creator" | "admin"),
    onSuccess: async (_r, v) => {
      setSelected((prev) => (prev && prev.id === v.id ? { ...prev, role: v.role } : prev));
      toast.success(`Role changed to ${v.role}`);
      await refresh();
    },
    onError: (e: Error) => toast.error(e.message || "Could not change the role"),
  });

  const suspendMut = useMutation({
    mutationFn: ({ id }: { id: string; suspended: boolean }) => adminSuspendUser(id),
    onSuccess: async (_r, v) => {
      toast.success("User suspended");
      await refresh();
    },
    onError: (e: Error) => toast.error(e.message || "Could not suspend the user"),
  });

  function handleRoleChange(id: string, role: Role) {
    roleMut.mutate({ id, role });
  }

  /**
   * Lifting a suspension needs the sanction id, which this list does not carry,
   * so only issuing one is wired. The moderation page is where a sanction is
   * reviewed and lifted.
   */
  function handleSuspendToggle(id: string, suspended: boolean) {
    if (!suspended) {
      toast.error("Lift a suspension from the Moderation page");
      return;
    }
    suspendMut.mutate({ id, suspended });
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Users & roles" description="Search accounts, manage roles and suspensions." />

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-neutral-500" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by handle or name"
            className="border-neutral-800 bg-neutral-900 pl-8"
          />
        </div>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-44 border-neutral-800 bg-neutral-900">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All roles</SelectItem>
            <SelectItem value="user">Users</SelectItem>
            <SelectItem value="premium">Premium</SelectItem>
            <SelectItem value="admin">Admins</SelectItem>
          </SelectContent>
        </Select>
        <div className="ml-auto text-xs text-neutral-500">{filtered.length} accounts</div>
      </div>

      <DataTable<AdminProfile>
        data={filtered}
        columns={columns}
        rowKey={(r) => r.id}
        onRowClick={(r) => setSelected(r)}
      />

      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent className="w-full overflow-y-auto border-neutral-800 bg-neutral-950 text-neutral-100 sm:max-w-md">
          {selected ? (
            <>
              <SheetHeader>
                <SheetTitle>{selected.displayName}</SheetTitle>
                <SheetDescription>@{selected.handle}</SheetDescription>
              </SheetHeader>
              <div className="space-y-5 px-4 pb-4">
                <div className="flex items-center gap-3">
                  <div className="h-16 w-16 overflow-hidden rounded-full bg-neutral-800">
                    {}
                    <img src={selected.avatarUrl} alt="" className="h-full w-full object-cover" />
                  </div>
                  <div className="flex-1">
                    <div className="text-sm text-neutral-200">{selected.displayName}</div>
                    <div className="text-xs text-neutral-500">@{selected.handle}</div>
                    <div className="mt-1 text-xs text-neutral-500">{selected.bio || "No bio yet."}</div>
                  </div>
                </div>

                <dl className="grid grid-cols-2 gap-3 text-sm">
                  <Info label="Country">{selected.country}</Info>
                  <Info label="Member since">{formatDate(selected.createdAt)}</Info>
                  <Info label="Last active">{timeAgo(selected.lastActive)}</Info>
                  <Info label="Onboarded">{selected.onboardedAt ? "Yes" : "No"}</Info>
                </dl>

                <div className="space-y-1.5">
                  <Label>Role</Label>
                  <Select value={selected.role} onValueChange={(v) => handleRoleChange(selected.id, v as Role)}>
                    <SelectTrigger className="w-full border-neutral-800 bg-neutral-900">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="user">User</SelectItem>
                      <SelectItem value="premium">Premium</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center justify-between rounded-lg border border-neutral-800 bg-neutral-900/40 p-3">
                  <div>
                    <div className="text-sm font-medium text-neutral-100">Suspend account</div>
                    <div className="text-xs text-neutral-400">Prevents login and posting.</div>
                  </div>
                  <Switch
                    checked={selected.suspended}
                    onCheckedChange={(v) => handleSuspendToggle(selected.id, v)}
                  />
                </div>
              </div>
              <SheetFooter>
                <Button asChild variant="outline" className="border-neutral-700 bg-neutral-900 hover:bg-neutral-800">
                  <Link href={`/profile/${selected.handle}`}>
                    <ExternalLink className="h-4 w-4" />
                    View profile
                  </Link>
                </Button>
              </SheetFooter>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-wider text-neutral-500">{label}</dt>
      <dd className="text-neutral-200">{children}</dd>
    </div>
  );
}
