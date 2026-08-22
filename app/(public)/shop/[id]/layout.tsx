import { getProductById, getProductBySlug } from "@/lib/api/products";
import { JsonLd, breadcrumbs, product as productLd } from "@/lib/seo/json-ld";
import { pageMetadata } from "@/lib/seo/metadata";

/**
 * A product's title, description and structured data.
 *
 * The price in the `Offer` is the price the checkout charges, read from the
 * same row, because a price in a search result that does not match the one at
 * the till is worse than showing no price at all: Google drops the merchant
 * for it, and a shopper who notices does not come back.
 */

type Props = { params: Promise<{ id: string }> };

/** The route takes either shape, so both are tried before giving up. */
async function load(idOrSlug: string) {
  const byId = await getProductById(idOrSlug).catch(() => null);
  if (byId) return byId;
  return getProductBySlug(idOrSlug).catch(() => null);
}

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  const item = await load(id);
  if (!item) {
    return pageMetadata({
      title: "Shop",
      description: "Official EVO TV merchandise.",
      path: `/shop/${id}`,
      noIndex: true,
    });
  }

  const description =
    item.description?.trim() || `${item.name}, official EVO TV merchandise.`;

  return pageMetadata({
    title: item.name,
    description,
    path: `/shop/${item.slug ?? item.id}`,
    image: item.images?.[0],
  });
}

export default async function ProductLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const item = await load(id);
  if (!item) return <>{children}</>;

  const path = `/shop/${item.slug ?? item.id}`;

  return (
    <>
      <JsonLd
        data={[
          productLd({
            name: item.name,
            description: item.description,
            path,
            image: item.images?.[0],
            price: item.priceNgn,
            currency: "NGN",
            inStock: (item.inventory ?? 0) > 0,
            variantPrices: (item.variants ?? []).map((v) => v.priceNgn),
          }),
          breadcrumbs([
            { name: "EVO TV", path: "/" },
            { name: "Shop", path: "/shop" },
            { name: item.name, path },
          ]),
        ]}
      />
      {children}
    </>
  );
}
