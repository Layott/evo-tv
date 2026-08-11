"use client";

import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { useAuth } from "@/components/providers";
import { Button } from "@/components/ui/button";

export function AdminGuard({ children }: { children: React.ReactNode }) {
  const { role } = useAuth();

  if (role !== "admin") {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-8">
        <div className="w-full max-w-md rounded-xl border border-neutral-800 bg-neutral-900/50 p-6 text-center">
          <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-red-500/10 text-red-400">
            <ShieldAlert className="h-5 w-5" />
          </div>
          <h2 className="text-lg font-semibold text-neutral-100">Admin access required</h2>
          <p className="mt-1 text-sm text-neutral-400">
            You do not have permission to view this page. Switch to an admin account or head back to the app.
          </p>
          <Button asChild className="mt-4 bg-sky-600 hover:bg-sky-500">
            <Link href="/home">Back to home</Link>
          </Button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
