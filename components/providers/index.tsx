"use client";

import * as React from "react";
import { Toaster } from "sonner";
import { ThemeProvider } from "./theme-provider";
import { QueryProvider } from "./query-provider";
import { MockAuthProvider } from "./mock-auth-provider";
import { RoleSwitcher } from "./role-switcher";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
      <QueryProvider>
        <MockAuthProvider>
          {children}
          <Toaster position="top-right" richColors theme="dark" />
          {process.env.NODE_ENV !== "production" && <RoleSwitcher />}
        </MockAuthProvider>
      </QueryProvider>
    </ThemeProvider>
  );
}

export { useMockAuth } from "./mock-auth-provider";
