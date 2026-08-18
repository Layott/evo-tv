"use client";

import * as React from "react";
import { Toaster } from "sonner";
import { ThemeProvider } from "./theme-provider";
import { QueryProvider } from "./query-provider";
import { AuthProvider } from "./auth-provider";
import { I18nProvider } from "./i18n-provider";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
      <QueryProvider>
        <AuthProvider>
          {/* Inside AuthProvider, because the account's chosen language is read
              from the same session. */}
          <I18nProvider>{children}</I18nProvider>
          <Toaster position="top-right" richColors theme="dark" />
        </AuthProvider>
      </QueryProvider>
    </ThemeProvider>
  );
}

export { useAuth } from "./auth-provider";
