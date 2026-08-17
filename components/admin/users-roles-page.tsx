"use client";

import * as React from "react";
import Link from "next/link";
import { ExternalLink, Loader2, Search, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  adminGrantRoleByEmail,
  adminListUsers,
  adminSetUserRole,
  adminSuspendUser,
} from "@/lib/client";
import {
  ASSIGNABLE_ROLES,
  hasMinRole,
  roleInfo,
  roleLabel,
  type PlatformRole,
} from "@/lib/auth/role-catalog";
import { useAuth } from "@/components/providers";
import type { Profile, Role } from "@/lib/types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { UserAvatar } from "@/components/ui/user-avatar";

interface AdminProfile extends Profile {
  /** Null when the account has never signed in. Not the same as "long ago". */
  lastActive: string | null;
  suspended: boolean;
  email: string;
}

function roleTone(role: string): "emerald" | "amber" | "blue" | "neutral" {
  if (role === "admin" || role === "head_admin") return "emerald";
  if (role === "premium") return "amber";
  if (role === "user") return "blue";
  return "neutral";
}

export function UsersRolesPage() {
  const queryClient = useQueryClient();
  // Support can find an account and read it. Granting roles and suspending are
  // admin verbs on the API, so they are not offered below that.
  const { role: viewerRole } = useAuth();
  const canManage = hasMinRole(viewerRole, "admin");

  const usersQ = useQuery({
    queryKey: ["admin", "users"],
    queryFn: () => adminListUsers({ limit: 200 }),
  });

  // The endpoint sends `suspended` and a real `lastActive` now. It used to send
  // neither, and `lastActive` fell back to `createdAt`, which put a confident
  // wrong date in the column for every account.
  const all: AdminProfile[] = React.useMemo(
    () =>
      (usersQ.data?.users ?? []).map((p) => ({
        ...p,
        suspended: p.suspended,
        lastActive: p.lastActive,
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
          <UserAvatar
            src={row.avatarUrl}
            name={row.displayName}
            handle={row.handle}
            seed={row.id}
            decorative
            className="h-8 w-8 shrink-0"
          />
          <div>
            <div className="text-sm font-medium text-foreground">{row.displayName}</div>
            <div className="text-xs text-muted-foreground">@{row.handle}</div>
          </div>
        </div>
      ),
    },
    {
      key: "role",
      header: "Role",
      sortable: true,
      accessor: (r) => r.role,
      cell: (row) => (
        <StatusBadge tone={roleTone(row.role)}>{roleLabel(row.role)}</StatusBadge>
      ),
    },
    {
      key: "country",
      header: "Country",
      // Blank beats a badge reading "NG" for somebody who never told us.
      cell: (row) =>
        row.country ? (
          <StatusBadge tone="neutral">{row.country}</StatusBadge>
        ) : (
          <span className="text-xs text-muted-foreground">Unknown</span>
        ),
    },
    {
      key: "created",
      header: "Created",
      sortable: true,
      accessor: (r) => new Date(r.createdAt).getTime(),
      cell: (row) => <span className="text-xs text-muted-foreground">{formatDate(row.createdAt)}</span>,
    },
    {
      key: "lastActive",
      header: "Last active",
      sortable: true,
      // Never-signed-in sorts oldest rather than to "now".
      accessor: (r) => (r.lastActive ? new Date(r.lastActive).getTime() : 0),
      cell: (row) => (
        <span className="text-xs text-muted-foreground">
          {row.lastActive ? timeAgo(row.lastActive) : "Never signed in"}
        </span>
      ),
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
    mutationFn: ({ id, role }: { id: string; role: PlatformRole }) =>
      adminSetUserRole(id, role),
    onSuccess: async (_r, v) => {
      setSelected((prev) =>
        prev && prev.id === v.id ? { ...prev, role: v.role as Role } : prev,
      );
      toast.success(`Role changed to ${roleLabel(v.role)}`);
      await refresh();
    },
    onError: (e: Error) => toast.error(e.message || "Could not change the role"),
  });

  /**
   * Granting a role to somebody who is not on this page.
   *
   * Adding an admin starts from an email address, not from a row in a list of
   * every account on the platform. The endpoint refuses to create an account,
   * so the person has to have signed up: an admin account minted with no
   * password and no verified email would be a worse door than the one this
   * opens.
   */
  const [grantOpen, setGrantOpen] = React.useState(false);
  const [grantEmail, setGrantEmail] = React.useState("");
  const [grantRole, setGrantRole] = React.useState<PlatformRole>("admin");

  const grantMut = useMutation({
    mutationFn: () => adminGrantRoleByEmail(grantEmail.trim(), grantRole),
    onSuccess: async (result) => {
      toast.success(`${result.email} is now ${roleLabel(result.role)}`);
      setGrantOpen(false);
      setGrantEmail("");
      await refresh();
    },
    onError: (e: Error) => toast.error(e.message || "Could not grant the role"),
  });

  const suspendMut = useMutation({
    mutationFn: ({ id }: { id: string; suspended: boolean }) => adminSuspendUser(id),
    onSuccess: async (_r, v) => {
      toast.success("User suspended");
      await refresh();
    },
    onError: (e: Error) => toast.error(e.message || "Could not suspend the user"),
  });

  function handleRoleChange(id: string, role: PlatformRole) {
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
      <PageHeader
        title="Users & roles"
        description="Search accounts, manage roles and suspensions."
        actions={
          canManage ? (
            <Button type="button" onClick={() => setGrantOpen(true)}>
              <UserPlus className="h-4 w-4" />
              Grant a role
            </Button>
          ) : null
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by handle or name"
            className="border-border bg-card pl-8"
          />
        </div>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-44 border-border bg-card">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All roles</SelectItem>
            {ASSIGNABLE_ROLES.map((role) => (
              <SelectItem key={role.value} value={role.value}>
                {role.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="ml-auto text-xs text-muted-foreground">{filtered.length} accounts</div>
      </div>

      <DataTable<AdminProfile>
        data={filtered}
        columns={columns}
        rowKey={(r) => r.id}
        onRowClick={(r) => setSelected(r)}
      />

      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent className="w-full overflow-y-auto border-border bg-background text-foreground sm:max-w-md">
          {selected ? (
            <>
              <SheetHeader>
                <SheetTitle>{selected.displayName}</SheetTitle>
                <SheetDescription>@{selected.handle}</SheetDescription>
              </SheetHeader>
              <div className="space-y-5 px-4 pb-4">
                <div className="flex items-center gap-3">
                  <UserAvatar
                    src={selected.avatarUrl}
                    name={selected.displayName}
                    handle={selected.handle}
                    seed={selected.id}
                    decorative
                    className="h-16 w-16 shrink-0"
                    textClassName="text-lg"
                  />
                  <div className="flex-1">
                    <div className="text-sm text-foreground">{selected.displayName}</div>
                    <div className="text-xs text-muted-foreground">@{selected.handle}</div>
                    <div className="mt-1 text-xs text-muted-foreground">{selected.bio || "No bio yet."}</div>
                  </div>
                </div>

                <dl className="grid grid-cols-2 gap-3 text-sm">
                  <Info label="Country">{selected.country || "Unknown"}</Info>
                  <Info label="Member since">{formatDate(selected.createdAt)}</Info>
                  <Info label="Last active">
                    {selected.lastActive ? timeAgo(selected.lastActive) : "Never signed in"}
                  </Info>
                  <Info label="Onboarded">{selected.onboardedAt ? "Yes" : "No"}</Info>
                </dl>

                <div className="space-y-1.5">
                  <Label>Role</Label>
                  <Select
                    value={selected.role}
                    disabled={!canManage}
                    onValueChange={(v) => handleRoleChange(selected.id, v as PlatformRole)}
                  >
                    <SelectTrigger className="w-full border-border bg-card">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ASSIGNABLE_ROLES.map((role) => (
                        <SelectItem key={role.value} value={role.value}>
                          {role.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {/* What the role actually reaches, next to the control that
                      grants it. Nine roles is more than anybody holds in their
                      head, and the difference between Support and Moderator is
                      exactly the kind of thing that gets guessed wrong. */}
                  <p className="text-xs text-muted-foreground">
                    {roleInfo(selected.role)?.summary ?? ""}
                  </p>
                </div>

                <div className="flex items-center justify-between rounded-lg border border-border bg-card/40 p-3">
                  <div>
                    <div className="text-sm font-medium text-foreground">Suspend account</div>
                    <div className="text-xs text-muted-foreground">Prevents login and posting.</div>
                  </div>
                  <Switch
                    checked={selected.suspended}
                    disabled={!canManage}
                    onCheckedChange={(v) => handleSuspendToggle(selected.id, v)}
                  />
                </div>
              </div>
              <SheetFooter>
                <Button asChild variant="outline" className="bg-card hover:bg-accent">
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

      <Dialog open={grantOpen} onOpenChange={setGrantOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Grant a role</DialogTitle>
            <DialogDescription>
              The person must already have an EVO TV account. This changes their
              role, it does not create one or send an invitation.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="grant-email">Email</Label>
              <Input
                id="grant-email"
                type="email"
                value={grantEmail}
                onChange={(e) => setGrantEmail(e.target.value)}
                placeholder="name@evotv.co"
                className="border-border bg-card"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="grant-role">Role</Label>
              <Select
                value={grantRole}
                onValueChange={(v) => setGrantRole(v as PlatformRole)}
              >
                <SelectTrigger id="grant-role" className="border-border bg-card">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ASSIGNABLE_ROLES.map((role) => (
                    <SelectItem key={role.value} value={role.value}>
                      {role.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {roleInfo(grantRole)?.summary ?? ""}
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setGrantOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={!grantEmail.trim() || grantMut.isPending}
              onClick={() => grantMut.mutate()}
            >
              {grantMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Grant role
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className="text-foreground">{children}</dd>
    </div>
  );
}
