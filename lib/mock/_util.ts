export const now = () => new Date().toISOString();

export const daysAgo = (d: number) =>
  new Date(Date.now() - d * 86_400_000).toISOString();

export const daysAhead = (d: number) =>
  new Date(Date.now() + d * 86_400_000).toISOString();

export const hoursAgo = (h: number) =>
  new Date(Date.now() - h * 3_600_000).toISOString();

export const hoursAhead = (h: number) =>
  new Date(Date.now() + h * 3_600_000).toISOString();

export const minutesAgo = (m: number) =>
  new Date(Date.now() - m * 60_000).toISOString();

export const sleep = (ms = 200 + Math.random() * 200) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

export function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

export function pickN<T>(arr: readonly T[], n: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
}

export function byId<T extends { id: string }>(list: readonly T[], id: string): T | null {
  return list.find((item) => item.id === id) ?? null;
}

export function bySlug<T extends { slug: string }>(
  list: readonly T[],
  slug: string
): T | null {
  return list.find((item) => item.slug === slug) ?? null;
}

export function paginate<T>(list: readonly T[], page = 1, pageSize = 20) {
  const start = (page - 1) * pageSize;
  return {
    data: list.slice(start, start + pageSize),
    page,
    pageSize,
    total: list.length,
    hasMore: start + pageSize < list.length,
  };
}
