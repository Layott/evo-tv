"use client";

import * as React from "react";
import { Loader2, Plus, Search, Trash2 } from "@/components/icons";
import { toast } from "sonner";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  adminCreateShow,
  adminDeleteShow,
  adminGetShow,
  adminListShows,
  adminUpdateShow,
  type AdminShow,
  type MaturityRating,
  type ShowOriginType,
  type ShowPillar,
  type ShowStatus,
  type SocialLink,
} from "@/lib/client";
import {
  formatPrice,
  freeFromDay,
  MAX_PRICE_WINDOWS,
  priceAtDay,
  priceWindowProblems,
  type PriceWindow,
} from "@/lib/shows/pricing";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DataTable, type DataColumn } from "./data-table";
import { PageHeader } from "./page-header";
import { HowTo } from "./how-to";
import { HERO_SPEC, MediaUpload, POSTER_SPEC } from "./media-upload";
import { ShowEpisodesPanel } from "./show-episodes-panel";

/**
 * The Shows CMS.
 *
 * `/api/shows/[slug]` and the whole show/season/episode schema have existed
 * since Phase 9b, and the table has been empty in production the entire time,
 * because there was no screen that could write to it. Every original on the
 * site is currently a poster committed under `public/shows/`. This is where
 * that stops being the only way to publish one.
 *
 * A show created here is live immediately: `/show/[slug]` reads the database
 * first and falls back to the committed artwork registry only when the row is
 * missing.
 */

const PILLARS: ShowPillar[] = ["esports", "anime", "lifestyle"];
const STATUSES: ShowStatus[] = ["upcoming", "airing", "hiatus", "completed"];
const ORIGIN_TYPES: ShowOriginType[] = ["evo_original", "licensed", "syndicated"];
const MATURITY: MaturityRating[] = ["kids", "pg", "teen", "mature"];

const ORIGIN_LABELS: Record<ShowOriginType, string> = {
  evo_original: "EVO Original",
  licensed: "Licensed",
  syndicated: "Syndicated",
};

/**
 * What an editor fills in.
 *
 * No slug: it is the title, reduced, so there is nowhere to type a second name
 * for the same show. No status either: that is worked out from the episodes and
 * the grid, and the only part of it a person decides is whether the series has
 * finished, which is the `ended` switch.
 */
interface ShowDraft {
  id: string | null;
  title: string;
  synopsis: string;
  /** Null means unfiled. */
  pillar: ShowPillar | null;
  originType: ShowOriginType;
  socialLinks: SocialLink[];
  posterUrl: string;
  heroUrl: string;
  tags: string;
  isPremium: boolean;
  priceWindows: PriceWindow[];
  ended: boolean;
  maturityRating: MaturityRating;
}

function draftFrom(
  show: AdminShow | null,
  priceWindows: PriceWindow[] = [],
): ShowDraft {
  return {
    id: show?.id ?? null,
    title: show?.title ?? "",
    synopsis: show?.synopsis ?? "",
    pillar: show?.pillar ?? "esports",
    originType: show?.originType ?? "evo_original",
    socialLinks: show?.socialLinks ?? [],
    posterUrl: show?.posterUrl ?? "",
    heroUrl: show?.heroUrl ?? "",
    tags: (show?.tags ?? []).join(", "),
    isPremium: show?.isPremium ?? false,
    priceWindows,
    ended: Boolean(show?.endedAt),
    maturityRating: show?.maturityRating ?? "teen",
  };
}

/** The platforms worth offering first. Anything else can still be typed. */
const SOCIAL_PLATFORMS = [
  "Instagram",
  "TikTok",
  "YouTube",
  "X",
  "Facebook",
  "Twitch",
  "Website",
];

/**
 * What the URL will be, shown as the title is typed.
 *
 * A copy of the server's slugify rather than a call to it: `lib/api/slugs.ts`
 * is `server-only` because it checks the database for collisions. This is the
 * shape, not the final answer, and the server may still add a suffix if the
 * name is taken.
 */
function slugPreview(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/**
 * The price ladder for a paid show.
 *
 * Each rung says "from this many days after release, this is the price", and a
 * price of zero is where it becomes free. That covers both things the owner
 * asked for with one control: a show that costs less after a fortnight, and one
 * that stops costing anything at all.
 */
function PriceLadder({
  draft,
  setDraft,
}: {
  draft: ShowDraft;
  setDraft: (draft: ShowDraft) => void;
}) {
  const windows = draft.priceWindows;
  const problems = priceWindowProblems(windows);
  const freeDay = freeFromDay(windows);

  const update = (index: number, patch: Partial<PriceWindow>) =>
    setDraft({
      ...draft,
      priceWindows: windows.map((w, i) => (i === index ? { ...w, ...patch } : w)),
    });

  return (
    <div className="space-y-2">
      {windows
        .slice()
        .sort((a, b) => a.fromDay - b.fromDay)
        .map((window, index) => (
          <div key={index} className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {index === 0 ? "From day" : "then from day"}
            </span>
            <Input
              inputMode="numeric"
              className="w-20"
              value={String(window.fromDay)}
              disabled={index === 0}
              onChange={(e) => update(index, { fromDay: Number(e.target.value) || 0 })}
            />
            <span className="text-xs text-muted-foreground">it costs</span>
            <Input
              inputMode="numeric"
              className="w-28"
              value={String(window.priceNgn)}
              onChange={(e) => update(index, { priceNgn: Number(e.target.value) || 0 })}
            />
            <span className="text-xs text-muted-foreground">
              {formatPrice(window.priceNgn)}
            </span>
            {index > 0 ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Remove this price"
                onClick={() =>
                  setDraft({
                    ...draft,
                    priceWindows: windows.filter((_, i) => i !== index),
                  })
                }
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            ) : null}
          </div>
        ))}

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={windows.length >= MAX_PRICE_WINDOWS}
          onClick={() =>
            setDraft({
              ...draft,
              priceWindows: [
                ...windows,
                {
                  fromDay: Math.max(...windows.map((w) => w.fromDay), 0) + 7,
                  priceNgn: Math.max(
                    0,
                    Math.round((windows[windows.length - 1]?.priceNgn ?? 500) / 2),
                  ),
                },
              ],
            })
          }
        >
          <Plus className="h-3.5 w-3.5" />
          Change the price later
        </Button>

        {freeDay === null ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={windows.length >= MAX_PRICE_WINDOWS}
            onClick={() =>
              setDraft({
                ...draft,
                priceWindows: [
                  ...windows,
                  {
                    fromDay: Math.max(...windows.map((w) => w.fromDay), 0) + 14,
                    priceNgn: 0,
                  },
                ],
              })
            }
          >
            Make it free after a while
          </Button>
        ) : null}
      </div>

      <p className="text-xs text-muted-foreground">
        Day 1 costs {formatPrice(priceAtDay(windows, 0))}
        {freeDay === null
          ? ". It stays paid."
          : `, and it is free from day ${freeDay}.`}
      </p>

      {problems.map((problem) => (
        <p key={problem} className="text-xs text-foreground">
          {problem}
        </p>
      ))}
    </div>
  );
}

/** `esports, free fire , ,fps` -> `["esports","free fire","fps"]`. */
function parseTags(value: string): string[] {
  return value
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 30);
}

export function ShowsManagerPage() {
  const queryClient = useQueryClient();

  const [search, setSearch] = React.useState("");
  const [pillar, setPillar] = React.useState<ShowPillar | "all">("all");
  const [status, setStatus] = React.useState<ShowStatus | "all">("all");
  const [showBin, setShowBin] = React.useState(false);

  const showsQ = useQuery({
    queryKey: ["admin", "shows", { pillar, status, showBin }],
    queryFn: () =>
      adminListShows({
        pillar: pillar === "all" ? undefined : pillar,
        status: status === "all" ? undefined : status,
        deleted: showBin ? "include" : undefined,
      }),
  });

  const shows = showsQ.data?.shows ?? [];
  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return shows;
    return shows.filter(
      (s) =>
        s.title.toLowerCase().includes(q) || s.slug.toLowerCase().includes(q),
    );
  }, [shows, search]);

  const [draft, setDraft] = React.useState<ShowDraft | null>(null);
  const [managing, setManaging] = React.useState<AdminShow | null>(null);
  const [confirmDelete, setConfirmDelete] = React.useState<AdminShow | null>(null);

  const refresh = React.useCallback(
    () => queryClient.invalidateQueries({ queryKey: ["admin", "shows"] }),
    [queryClient],
  );

  /**
   * Opening an existing show fetches its price ladder first.
   *
   * The list endpoint does not carry the windows: they are a second table, and
   * loading them for every row of a grid nobody is editing would be a query per
   * card for information the card does not show.
   */
  const [loadingEdit, setLoadingEdit] = React.useState<string | null>(null);
  async function openEdit(show: AdminShow) {
    setLoadingEdit(show.id);
    try {
      const detail = await adminGetShow(show.id);
      setDraft(draftFrom(show, detail?.priceWindows ?? []));
    } catch {
      // The prices are the only thing that needs the extra request, so a
      // failure opens the form without them rather than refusing to open.
      toast.error("Could not load the price ladder. Everything else is editable.");
      setDraft(draftFrom(show, []));
    } finally {
      setLoadingEdit(null);
    }
  }

  const save = useMutation({
    mutationFn: async (input: ShowDraft) => {
      const payload = {
        title: input.title.trim(),
        synopsis: input.synopsis.trim(),
        pillar: input.pillar,
        originType: input.originType,
        socialLinks: input.socialLinks
          .filter((s) => s.platform.trim() && s.url.trim())
          .map((s) => ({ platform: s.platform.trim(), url: s.url.trim() })),
        posterUrl: input.posterUrl.trim(),
        heroUrl: input.heroUrl.trim(),
        tags: parseTags(input.tags),
        isPremium: input.isPremium,
        // Sent empty for a free show, which clears any ladder left behind by a
        // show that used to be paid.
        priceWindows: input.isPremium ? input.priceWindows : [],
        maturityRating: input.maturityRating,
      };
      if (input.id) {
        return adminUpdateShow(input.id, {
          ...payload,
          endedAt: input.ended ? new Date().toISOString() : null,
        });
      }
      return adminCreateShow(payload);
    },
    onSuccess: async (_show, input) => {
      toast.success(input.id ? "Show saved" : "Show created");
      setDraft(null);
      await refresh();
    },
    onError: (err: unknown) =>
      toast.error(err instanceof Error ? err.message : "Could not save the show"),
  });

  const remove = useMutation({
    mutationFn: (show: AdminShow) => adminDeleteShow(show.id),
    onSuccess: async () => {
      toast.success("Show pulled from the site");
      setConfirmDelete(null);
      await refresh();
    },
    onError: (err: unknown) =>
      toast.error(err instanceof Error ? err.message : "Could not pull the show"),
  });

  const columns: DataColumn<AdminShow>[] = [
    {
      key: "title",
      header: "Show",
      sortable: true,
      accessor: (row) => row.title,
      cell: (row) => (
        <div className="flex min-w-0 items-center gap-3">
          {row.posterUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- arbitrary admin-entered URL
            <img
              src={row.posterUrl}
              alt=""
              className="h-10 w-7 shrink-0 rounded object-cover"
            />
          ) : (
            <div className="h-10 w-7 shrink-0 rounded bg-muted" />
          )}
          <div className="min-w-0">
            <p className="truncate font-medium text-foreground">{row.title}</p>
            <p className="truncate text-xs text-muted-foreground">/show/{row.slug}</p>
          </div>
        </div>
      ),
    },
    {
      key: "pillar",
      header: "Pillar",
      sortable: true,
      accessor: (row) => row.pillar,
      cell: (row) => <span className="capitalize">{row.pillar}</span>,
    },
    {
      key: "status",
      // Derived, not chosen: see lib/api/show-state.ts.
      header: "Status",
      sortable: true,
      accessor: (row) => row.status,
      cell: (row) => (
        <span className="capitalize">
          {row.deletedAt ? "Pulled" : row.status}
        </span>
      ),
    },
    {
      key: "counts",
      header: "Episodes",
      sortable: true,
      accessor: (row) => row.totalEpisodes,
      cell: (row) => (
        <span className="tabular-nums text-muted-foreground">
          {row.totalSeasons}S · {row.totalEpisodes}E
        </span>
      ),
    },
    {
      key: "access",
      header: "Access",
      sortable: true,
      accessor: (row) => (row.isPremium ? "paid" : "free"),
      cell: (row) => (
        <Badge variant={row.isPremium ? "default" : "secondary"}>
          {row.isPremium ? "Paid" : "Free"}
        </Badge>
      ),
    },
    {
      key: "actions",
      header: "",
      className: "text-right",
      cell: (row) => (
        <div className="flex justify-end gap-1">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={loadingEdit === row.id}
            onClick={(e) => {
              e.stopPropagation();
              void openEdit(row);
            }}
          >
            {loadingEdit === row.id ? "Opening" : "Edit"}
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            aria-label={`Pull ${row.title}`}
            disabled={Boolean(row.deletedAt)}
            onClick={(e) => {
              e.stopPropagation();
              setConfirmDelete(row);
            }}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Shows"
        description="Series and their episodes. A show published here appears on the site and in the app immediately."
        actions={
          <Button type="button" onClick={() => setDraft(draftFrom(null))}>
            <Plus className="h-4 w-4" />
      <HowTo page="shows" />
            New show
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative min-w-0 flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search title or slug"
            className="pl-9"
          />
        </div>

        <Select value={pillar} onValueChange={(v) => setPillar(v as ShowPillar | "all")}>
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All pillars</SelectItem>
            {PILLARS.map((p) => (
              <SelectItem key={p} value={p} className="capitalize">
                {p}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={status} onValueChange={(v) => setStatus(v as ShowStatus | "all")}>
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any status</SelectItem>
            {STATUSES.map((s) => (
              <SelectItem key={s} value={s} className="capitalize">
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex items-center gap-2">
          <Switch id="show-bin" checked={showBin} onCheckedChange={setShowBin} />
          <Label htmlFor="show-bin" className="text-sm text-muted-foreground">
            Include pulled
          </Label>
        </div>
      </div>

      <DataTable
        data={filtered}
        columns={columns}
        rowKey={(row) => row.id}
        loading={showsQ.isLoading}
        onRowClick={(row) => setManaging(row)}
        emptyMessage={
          showsQ.isError
            ? "Could not load shows."
            : "No shows yet. Create one and it goes live on the site."
        }
      />

      {/* Create and edit */}
      <Sheet open={draft !== null} onOpenChange={(open) => !open && setDraft(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>{draft?.id ? "Edit show" : "New show"}</SheetTitle>
            <SheetDescription>
              {draft?.id
                ? "Renaming a show moves its URL with it, and the old address stops working."
                : "The URL comes from the title. The status comes from the episodes and the grid."}
            </SheetDescription>
          </SheetHeader>

          {draft ? (
            <div className="space-y-4 px-4 pb-8">
              <div className="space-y-2">
                <Label htmlFor="show-title">Title</Label>
                <Input
                  id="show-title"
                  value={draft.title}
                  onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                  placeholder="Otaku and Chillz"
                />
              </div>

              {/* No slug field. The URL is the title, reduced, so there is only
                  one place to say what the show is called. */}
              <p className="text-xs text-muted-foreground">
                Address:{" "}
                <span className="text-foreground">
                  /show/{slugPreview(draft.title) || "…"}
                </span>
              </p>

              <div className="space-y-2">
                <Label htmlFor="show-synopsis">Description</Label>
                <Textarea
                  id="show-synopsis"
                  rows={4}
                  value={draft.synopsis}
                  onChange={(e) => setDraft({ ...draft, synopsis: e.target.value })}
                  placeholder="What the show is, in the words a viewer reads on the page."
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="show-pillar">Pillar</Label>
                  <Select
                    value={draft.pillar ?? "none"}
                    onValueChange={(v) =>
                      setDraft({
                        ...draft,
                        pillar: v === "none" ? null : (v as ShowPillar),
                      })
                    }
                  >
                    <SelectTrigger id="show-pillar">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                    {/* Radix cannot hold an empty value, so "none" is the
                        sentinel and null is what reaches the API. A programme
                        that is none of the three used to be filed as esports
                        because the field had no way to say otherwise. */}
                      <SelectItem value="none">No pillar</SelectItem>
                      {PILLARS.map((p) => (
                        <SelectItem key={p} value={p} className="capitalize">
                          {p}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>


                <div className="space-y-2">
                  <Label htmlFor="show-origin">Origin</Label>
                  <Select
                    value={draft.originType}
                    onValueChange={(v) =>
                      setDraft({ ...draft, originType: v as ShowOriginType })
                    }
                  >
                    <SelectTrigger id="show-origin">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ORIGIN_TYPES.map((o) => (
                        <SelectItem key={o} value={o}>
                          {ORIGIN_LABELS[o]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="show-maturity">Maturity</Label>
                  <Select
                    value={draft.maturityRating}
                    onValueChange={(v) =>
                      setDraft({ ...draft, maturityRating: v as MaturityRating })
                    }
                  >
                    <SelectTrigger id="show-maturity">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MATURITY.map((m) => (
                        <SelectItem key={m} value={m} className="uppercase">
                          {m}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="show-tags">Tags</Label>
                <Input
                  id="show-tags"
                  value={draft.tags}
                  onChange={(e) => setDraft({ ...draft, tags: e.target.value })}
                  placeholder="anime, comedy, weekly"
                />
                <p className="text-xs text-muted-foreground">Separated by commas.</p>
              </div>

              <div className="space-y-2">
                <Label>Creator links</Label>
                <p className="text-xs text-muted-foreground">
                  Shown to viewers on the show page. One row per platform.
                </p>

                {draft.socialLinks.map((link, index) => (
                  <div key={index} className="flex flex-col gap-2 sm:flex-row">
                    <Select
                      value={link.platform}
                      onValueChange={(v) =>
                        setDraft({
                          ...draft,
                          socialLinks: draft.socialLinks.map((l, i) =>
                            i === index ? { ...l, platform: v } : l,
                          ),
                        })
                      }
                    >
                      <SelectTrigger className="sm:w-40">
                        <SelectValue placeholder="Platform" />
                      </SelectTrigger>
                      <SelectContent>
                        {SOCIAL_PLATFORMS.map((platform) => (
                          <SelectItem key={platform} value={platform}>
                            {platform}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      value={link.url}
                      placeholder="https://instagram.com/…"
                      className="min-w-0 flex-1"
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          socialLinks: draft.socialLinks.map((l, i) =>
                            i === index ? { ...l, url: e.target.value } : l,
                          ),
                        })
                      }
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label="Remove this link"
                      onClick={() =>
                        setDraft({
                          ...draft,
                          socialLinks: draft.socialLinks.filter((_, i) => i !== index),
                        })
                      }
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={draft.socialLinks.length >= 8}
                  onClick={() =>
                    setDraft({
                      ...draft,
                      socialLinks: [...draft.socialLinks, { platform: "Instagram", url: "" }],
                    })
                  }
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add a link
                </Button>
              </div>

              <MediaUpload
                label="Poster"
                kind="image"
                folder="shows"
                spec={POSTER_SPEC}
                value={draft.posterUrl}
                onChange={(url) => setDraft({ ...draft, posterUrl: url })}
                hint="Used on cards and the show page"
              />

              <MediaUpload
                label="Hero image"
                kind="image"
                folder="shows"
                spec={HERO_SPEC}
                value={draft.heroUrl}
                onChange={(url) => setDraft({ ...draft, heroUrl: url })}
                hint="The top of the show page"
              />

              <div className="space-y-3 rounded-lg border border-border p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="show-premium" className="text-sm">
                      Paid show
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      New episodes inherit this. Each can be overridden.
                    </p>
                  </div>
                  <Switch
                    id="show-premium"
                    checked={draft.isPremium}
                    onCheckedChange={(v) =>
                      setDraft({
                        ...draft,
                        isPremium: v,
                        // A paid show with no ladder has no price, so the first
                        // rung is created with it rather than left to be found.
                        priceWindows:
                          v && draft.priceWindows.length === 0
                            ? [{ fromDay: 0, priceNgn: 500 }]
                            : draft.priceWindows,
                      })
                    }
                  />
                </div>

                {draft.isPremium ? <PriceLadder draft={draft} setDraft={setDraft} /> : null}
              </div>

              {draft.id ? (
                <div className="flex items-center justify-between rounded-lg border border-border p-3">
                  <div>
                    <Label htmlFor="show-ended" className="text-sm">
                      This series has finished
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      The status is worked out from the episodes and the grid.
                      Whether a series is over is the one part of it nobody can
                      infer, so it is set here.
                    </p>
                  </div>
                  <Switch
                    id="show-ended"
                    checked={draft.ended}
                    onCheckedChange={(v) => setDraft({ ...draft, ended: v })}
                  />
                </div>
              ) : null}

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="ghost" onClick={() => setDraft(null)}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  disabled={draft.title.trim().length < 2 || save.isPending}
                  onClick={() => save.mutate(draft)}
                >
                  {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {draft.id ? "Save show" : "Create show"}
                </Button>
              </div>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>

      {/* Seasons and episodes */}
      <Sheet open={managing !== null} onOpenChange={(open) => !open && setManaging(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
          <SheetHeader>
            <SheetTitle>{managing?.title}</SheetTitle>
            <SheetDescription>/show/{managing?.slug}</SheetDescription>
          </SheetHeader>
          <div className="px-4 pb-8">
            {managing ? <ShowEpisodesPanel show={managing} /> : null}
          </div>
        </SheetContent>
      </Sheet>

      <Dialog
        open={confirmDelete !== null}
        onOpenChange={(open) => !open && setConfirmDelete(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Pull this show?</DialogTitle>
            <DialogDescription>
              {confirmDelete
                ? `"${confirmDelete.title}" disappears from the site and the app, along with its episodes. The rows are kept.`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setConfirmDelete(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={remove.isPending}
              onClick={() => confirmDelete && remove.mutate(confirmDelete)}
            >
              Pull show
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
