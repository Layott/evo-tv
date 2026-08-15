"use client";

import * as React from "react";
import { Loader2, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  adminCreateProduct,
  adminListShopProducts,
  adminListTeams,
  adminRemoveProduct,
  adminUpdateProduct,
} from "@/lib/client";
import type { Product, ProductVariant } from "@/lib/types";
import { hasMinRole } from "@/lib/auth/role-catalog";
import { useAuth } from "@/components/providers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
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
import { MediaUpload, PRODUCT_SPEC } from "./media-upload";
import { formatNgn } from "./utils";

/**
 * The shop.
 *
 * Products had no admin write route at all: the dashboard read the public
 * `/api/products` and that was the whole of its involvement. Everything on sale
 * had to be inserted into Postgres by hand.
 *
 * Orders already had their own screen, so this is the catalogue half: what is
 * for sale, what it costs, what sizes exist, and how many of each are left.
 */

const CATEGORIES: Product["category"][] = [
  "jersey",
  "apparel",
  "accessory",
  "digital",
  "collectible",
];

interface ProductDraft {
  id: string | null;
  name: string;
  description: string;
  category: Product["category"];
  priceNgn: string;
  images: string[];
  variants: ProductVariant[];
  featured: boolean;
  active: boolean;
  teamId: string;
  inventory: string;
}

function draftFrom(product: Product | null): ProductDraft {
  return {
    id: product?.id ?? null,
    name: product?.name ?? "",
    description: product?.description ?? "",
    category: product?.category ?? "apparel",
    priceNgn: product ? String(product.priceNgn) : "",
    images: product?.images ?? [],
    variants: product?.variants ?? [],
    featured: product?.featured ?? false,
    active: product?.active ?? true,
    teamId: product?.teamId ?? "none",
    inventory: product ? String(product.inventory) : "0",
  };
}

/** `Large` -> `large`, so a variant id is stable and readable in an order. */
function variantId(label: string): string {
  return (
    label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || `v${Date.now()}`
  );
}

export function ShopManagerPage() {
  const queryClient = useQueryClient();
  const { role } = useAuth();
  // Support can see the catalogue to answer "is this in stock". Changing it is
  // an admin verb on the API, so the buttons follow.
  const canEdit = hasMinRole(role, "admin");

  const [search, setSearch] = React.useState("");
  const [showInactive, setShowInactive] = React.useState(true);
  const [draft, setDraft] = React.useState<ProductDraft | null>(null);
  const [confirmRemove, setConfirmRemove] = React.useState<Product | null>(null);

  const productsQ = useQuery({
    queryKey: ["admin", "shop-products"],
    queryFn: () => adminListShopProducts(),
  });
  const teamsQ = useQuery({
    queryKey: ["admin", "teams"],
    queryFn: () => adminListTeams(),
  });

  const products = productsQ.data ?? [];
  const teams = teamsQ.data ?? [];

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      if (!showInactive && !p.active) return false;
      if (!q) return true;
      return p.name.toLowerCase().includes(q) || p.slug.toLowerCase().includes(q);
    });
  }, [products, search, showInactive]);

  const refresh = React.useCallback(
    () => queryClient.invalidateQueries({ queryKey: ["admin", "shop-products"] }),
    [queryClient],
  );

  const save = useMutation({
    mutationFn: async (input: ProductDraft) => {
      const payload = {
        name: input.name.trim(),
        description: input.description.trim(),
        category: input.category,
        priceNgn: Math.max(0, Math.round(Number(input.priceNgn) || 0)),
        images: input.images.filter(Boolean),
        variants: input.variants,
        featured: input.featured,
        active: input.active,
        teamId: input.teamId === "none" ? null : input.teamId,
        inventory: Math.max(0, Math.round(Number(input.inventory) || 0)),
      };
      return input.id
        ? adminUpdateProduct(input.id, payload)
        : adminCreateProduct(payload);
    },
    onSuccess: async (_p, input) => {
      toast.success(input.id ? "Product saved" : "Product added to the shop");
      setDraft(null);
      await refresh();
    },
    onError: (err: unknown) =>
      toast.error(err instanceof Error ? err.message : "Could not save the product"),
  });

  const remove = useMutation({
    mutationFn: (product: Product) => adminRemoveProduct(product.id),
    onSuccess: async (result) => {
      // The server decides between a delete and a deactivation, so the toast
      // says which one happened rather than guessing.
      toast.success(result.message ?? "Removed from the shop");
      setConfirmRemove(null);
      await refresh();
    },
    onError: (err: unknown) =>
      toast.error(err instanceof Error ? err.message : "Could not remove it"),
  });

  const stockOf = (product: Product) =>
    product.variants.length > 0
      ? product.variants.reduce((sum, v) => sum + v.inventory, 0)
      : product.inventory;

  const columns: DataColumn<Product>[] = [
    {
      key: "name",
      header: "Product",
      sortable: true,
      accessor: (row) => row.name,
      cell: (row) => (
        <div className="flex min-w-0 items-center gap-3">
          {row.images[0] ? (
            // eslint-disable-next-line @next/next/no-img-element -- arbitrary admin-entered URL
            <img
              src={row.images[0]}
              alt=""
              className="h-10 w-10 shrink-0 rounded object-cover"
            />
          ) : (
            <div className="h-10 w-10 shrink-0 rounded bg-muted" />
          )}
          <div className="min-w-0">
            <p className="truncate font-medium text-foreground">{row.name}</p>
            <p className="truncate text-xs capitalize text-muted-foreground">
              {row.category}
              {row.variants.length > 0
                ? ` · ${row.variants.length} option${row.variants.length === 1 ? "" : "s"}`
                : ""}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: "price",
      header: "Price",
      sortable: true,
      accessor: (row) => row.priceNgn,
      cell: (row) => (
        <span className="tabular-nums text-foreground">{formatNgn(row.priceNgn)}</span>
      ),
    },
    {
      key: "stock",
      header: "Stock",
      sortable: true,
      accessor: (row) => stockOf(row),
      cell: (row) => {
        const stock = stockOf(row);
        return (
          <span className={stock === 0 ? "text-foreground" : "text-muted-foreground"}>
            {stock === 0 ? "Out of stock" : stock}
          </span>
        );
      },
    },
    {
      key: "state",
      header: "State",
      cell: (row) => (
        <div className="flex gap-1.5">
          <Badge variant={row.active ? "secondary" : "outline"}>
            {row.active ? "On sale" : "Hidden"}
          </Badge>
          {row.featured ? <Badge>Featured</Badge> : null}
        </div>
      ),
    },
    {
      key: "actions",
      header: "",
      className: "text-right",
      cell: (row) =>
        !canEdit ? null : (
          <div className="flex justify-end gap-1">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setDraft(draftFrom(row))}
            >
              Edit
            </Button>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              aria-label={`Remove ${row.name}`}
              onClick={() => setConfirmRemove(row)}
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
        title="Shop"
        description="What is for sale, what it costs, and how many are left. Orders are on their own page."
        actions={
          canEdit ? (
            <Button type="button" onClick={() => setDraft(draftFrom(null))}>
              <Plus className="h-4 w-4" />
              New product
            </Button>
          ) : null
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative min-w-0 flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search products"
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2">
          <Switch id="shop-inactive" checked={showInactive} onCheckedChange={setShowInactive} />
          <Label htmlFor="shop-inactive" className="text-sm text-muted-foreground">
            Include hidden
          </Label>
        </div>
        <div className="ml-auto text-xs text-muted-foreground">
          {filtered.length} product{filtered.length === 1 ? "" : "s"}
        </div>
      </div>

      <DataTable
        data={filtered}
        columns={columns}
        rowKey={(row) => row.id}
        loading={productsQ.isLoading}
        emptyMessage={
          productsQ.isError
            ? "Could not load the shop."
            : "Nothing in the shop yet. Add a product and it appears on the site."
        }
      />

      <Sheet open={draft !== null} onOpenChange={(open) => !open && setDraft(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>{draft?.id ? "Edit product" : "New product"}</SheetTitle>
            <SheetDescription>
              {draft?.id
                ? "The shop URL was set when this was created and does not move when the name changes."
                : "The shop URL comes from the name."}
            </SheetDescription>
          </SheetHeader>

          {draft ? (
            <div className="space-y-4 px-4 pb-8">
              <div className="space-y-2">
                <Label htmlFor="product-name">Name</Label>
                <Input
                  id="product-name"
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  placeholder="EVO TV home jersey"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="product-description">Description</Label>
                <Textarea
                  id="product-description"
                  rows={3}
                  value={draft.description}
                  onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="product-category">Category</Label>
                  <Select
                    value={draft.category}
                    onValueChange={(v) =>
                      setDraft({ ...draft, category: v as Product["category"] })
                    }
                  >
                    <SelectTrigger id="product-category">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((c) => (
                        <SelectItem key={c} value={c} className="capitalize">
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="product-price">Price, naira</Label>
                  <Input
                    id="product-price"
                    inputMode="numeric"
                    value={draft.priceNgn}
                    onChange={(e) => setDraft({ ...draft, priceNgn: e.target.value })}
                    placeholder="15000"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="product-team">Team</Label>
                  <Select
                    value={draft.teamId}
                    onValueChange={(v) => setDraft({ ...draft, teamId: v })}
                  >
                    <SelectTrigger id="product-team">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Not team merchandise</SelectItem>
                      {teams.map((team) => (
                        <SelectItem key={team.id} value={team.id}>
                          {team.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="product-inventory">Stock</Label>
                  <Input
                    id="product-inventory"
                    inputMode="numeric"
                    value={draft.inventory}
                    disabled={draft.variants.length > 0}
                    onChange={(e) => setDraft({ ...draft, inventory: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground">
                    {draft.variants.length > 0
                      ? "Counted per option below."
                      : "Zero shows as out of stock."}
                  </p>
                </div>
              </div>

              {/* Photos */}
              <div className="space-y-2">
                <Label>Photos</Label>
                {draft.images.map((image, index) => (
                  <MediaUpload
                    key={index}
                    label={index === 0 ? "Main photo" : `Photo ${index + 1}`}
                    kind="image"
                    folder="shop"
                    spec={PRODUCT_SPEC}
                    value={image}
                    onChange={(url) =>
                      setDraft({
                        ...draft,
                        images: url
                          ? draft.images.map((img, i) => (i === index ? url : img))
                          : draft.images.filter((_, i) => i !== index),
                      })
                    }
                  />
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={draft.images.length >= 10}
                  onClick={() => setDraft({ ...draft, images: [...draft.images, ""] })}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add a photo
                </Button>
              </div>

              {/* Sizes and colourways */}
              <div className="space-y-2">
                <Label>Options</Label>
                <p className="text-xs text-muted-foreground">
                  Sizes or colourways. Each carries its own price and its own
                  stock, because running out of medium is not running out of the
                  shirt.
                </p>

                {draft.variants.map((v, index) => (
                  <div key={index} className="flex flex-wrap items-center gap-2">
                    <Input
                      value={v.label}
                      placeholder="Large"
                      className="w-32"
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          variants: draft.variants.map((item, i) =>
                            i === index
                              ? {
                                  ...item,
                                  label: e.target.value,
                                  id: variantId(e.target.value),
                                }
                              : item,
                          ),
                        })
                      }
                    />
                    <Input
                      inputMode="numeric"
                      value={String(v.priceNgn)}
                      className="w-28"
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          variants: draft.variants.map((item, i) =>
                            i === index
                              ? { ...item, priceNgn: Number(e.target.value) || 0 }
                              : item,
                          ),
                        })
                      }
                    />
                    <Input
                      inputMode="numeric"
                      value={String(v.inventory)}
                      className="w-24"
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          variants: draft.variants.map((item, i) =>
                            i === index
                              ? { ...item, inventory: Number(e.target.value) || 0 }
                              : item,
                          ),
                        })
                      }
                    />
                    <span className="text-xs text-muted-foreground">
                      {formatNgn(v.priceNgn)} · {v.inventory} left
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label="Remove this option"
                      onClick={() =>
                        setDraft({
                          ...draft,
                          variants: draft.variants.filter((_, i) => i !== index),
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
                  onClick={() =>
                    setDraft({
                      ...draft,
                      variants: [
                        ...draft.variants,
                        {
                          id: `option-${draft.variants.length + 1}`,
                          label: "",
                          priceNgn: Number(draft.priceNgn) || 0,
                          inventory: 0,
                        },
                      ],
                    })
                  }
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add an option
                </Button>
              </div>

              <div className="flex items-center justify-between rounded-lg border border-border p-3">
                <div>
                  <Label htmlFor="product-active" className="text-sm">
                    On sale
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Off hides it from the shop without losing it.
                  </p>
                </div>
                <Switch
                  id="product-active"
                  checked={draft.active}
                  onCheckedChange={(v) => setDraft({ ...draft, active: v })}
                />
              </div>

              <div className="flex items-center justify-between rounded-lg border border-border p-3">
                <Label htmlFor="product-featured" className="text-sm">
                  Featured on the shop front
                </Label>
                <Switch
                  id="product-featured"
                  checked={draft.featured}
                  onCheckedChange={(v) => setDraft({ ...draft, featured: v })}
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="ghost" onClick={() => setDraft(null)}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  disabled={draft.name.trim().length < 2 || save.isPending}
                  onClick={() => save.mutate(draft)}
                >
                  {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {draft.id ? "Save product" : "Add to the shop"}
                </Button>
              </div>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>

      <Dialog
        open={confirmRemove !== null}
        onOpenChange={(o) => !o && setConfirmRemove(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Take this off the shop?</DialogTitle>
            <DialogDescription>
              {confirmRemove
                ? `"${confirmRemove.name}" stops being for sale. If anybody has ordered it the row is kept and simply hidden, so past orders still say what was bought.`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setConfirmRemove(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={remove.isPending}
              onClick={() => confirmRemove && remove.mutate(confirmRemove)}
            >
              Take it off
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
