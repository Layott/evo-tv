"use client";

export const CART_KEY = "evotv_cart_v1";
export const ORDERS_KEY = "evotv_orders_v1";

export interface CartLine {
  productId: string;
  variantId: string | null;
  qty: number;
}

function read(): CartLine[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(CART_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as CartLine[];
  } catch {
    return [];
  }
}

function write(lines: CartLine[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(CART_KEY, JSON.stringify(lines));
  window.dispatchEvent(new CustomEvent("evotv-cart-change"));
}

export function getCart(): CartLine[] {
  return read();
}

export function addToCart(line: CartLine) {
  const lines = read();
  const idx = lines.findIndex(
    (l) => l.productId === line.productId && l.variantId === line.variantId
  );
  if (idx >= 0) {
    lines[idx]!.qty += line.qty;
  } else {
    lines.push(line);
  }
  write(lines);
}

export function updateQty(productId: string, variantId: string | null, qty: number) {
  const lines = read()
    .map((l) =>
      l.productId === productId && l.variantId === variantId ? { ...l, qty } : l
    )
    .filter((l) => l.qty > 0);
  write(lines);
}

export function removeLine(productId: string, variantId: string | null) {
  const lines = read().filter(
    (l) => !(l.productId === productId && l.variantId === variantId)
  );
  write(lines);
}

export function clearCart() {
  write([]);
}
