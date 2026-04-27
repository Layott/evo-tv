import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth, type SessionUser } from "./index";

export async function getSession() {
  return auth.api.getSession({ headers: await headers() });
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  const session = await getSession();
  return session?.user ?? null;
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireRole(
  role: "user" | "premium" | "admin"
): Promise<SessionUser> {
  const user = await requireUser();
  const userRole = (user as SessionUser & { role?: string }).role ?? "user";
  if (role === "admin" && userRole !== "admin") redirect("/home");
  if (role === "premium" && !["premium", "admin"].includes(userRole)) {
    redirect("/upgrade");
  }
  return user;
}
