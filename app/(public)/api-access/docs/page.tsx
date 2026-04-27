"use client";

import * as React from "react";
import Link from "next/link";
import { Copy, ExternalLink } from "lucide-react";
import { toast } from "sonner";

import { ApiAccessShell } from "@/components/api-access/api-access-shell";
import { API_DOC_ENDPOINTS } from "@/lib/mock/api-keys";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const METHOD_TONES: Record<string, string> = {
  GET: "bg-emerald-500/10 text-emerald-300 ring-emerald-500/30",
  POST: "bg-sky-500/10 text-sky-300 ring-sky-500/30",
  DELETE: "bg-red-500/10 text-red-300 ring-red-500/30",
  PUT: "bg-amber-500/10 text-amber-300 ring-amber-500/30",
};

export default function ApiAccessDocsPage() {
  const [activeId, setActiveId] = React.useState<string>(
    API_DOC_ENDPOINTS[0]?.items[0]?.id ?? "",
  );

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const ids = API_DOC_ENDPOINTS.flatMap((s) => s.items.map((i) => i.id));
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting);
        if (visible.length > 0) {
          // Pick the topmost visible
          visible.sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
          const id = visible[0]!.target.id;
          if (id) setActiveId(id);
        }
      },
      { rootMargin: "-30% 0px -60% 0px", threshold: 0 },
    );
    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

  async function copy(text: string, label = "Copied") {
    if (typeof navigator === "undefined" || !navigator.clipboard) {
      toast.message("Clipboard unavailable");
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      toast.success(label);
    } catch {
      toast.error("Could not copy");
    }
  }

  return (
    <ApiAccessShell>
      <div className="grid gap-6 lg:grid-cols-[200px_minmax(0,1fr)]">
        <aside className="hidden lg:block">
          <nav className="sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto rounded-xl border border-neutral-800 bg-neutral-900/40 p-3 text-sm">
            {API_DOC_ENDPOINTS.map((section) => (
              <div key={section.section} className="mb-3 last:mb-0">
                <div className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
                  {section.section}
                </div>
                {section.items.map((item) => (
                  <a
                    key={item.id}
                    href={`#${item.id}`}
                    className={cn(
                      "block rounded-md px-2 py-1 text-xs transition",
                      activeId === item.id
                        ? "bg-neutral-950 text-sky-300"
                        : "text-neutral-400 hover:bg-neutral-900 hover:text-neutral-100",
                    )}
                  >
                    {item.title}
                  </a>
                ))}
              </div>
            ))}
          </nav>
        </aside>

        <div className="space-y-8">
          <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-5">
            <h2 className="text-base font-semibold text-neutral-50">Quick start</h2>
            <p className="mt-1 text-sm text-neutral-400">
              All endpoints accept <code className="rounded bg-neutral-800 px-1 py-0.5 text-xs">Authorization: Bearer YOUR_KEY</code>. JSON only.
              Rate-limited to ~50 req/sec per key.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button asChild size="sm" variant="outline">
                <Link href="/api-access/keys">Get a key</Link>
              </Button>
              <Button asChild size="sm" variant="ghost">
                <Link href="https://github.com/" target="_blank">
                  <ExternalLink className="size-3.5" />
                  Postman collection
                </Link>
              </Button>
            </div>
          </div>

          {API_DOC_ENDPOINTS.map((section) => (
            <section key={section.section} className="space-y-4">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-neutral-300">
                {section.section}
              </h3>
              {section.items.map((endpoint) => {
                const curl = `curl https://api.evo.tv${endpoint.path.replace(/\{(\w+)\}/g, "<$1>")} \\\n  -H "Authorization: Bearer evo_live_***"`;
                const sample = JSON.stringify(endpoint.sample, null, 2);
                return (
                  <article
                    key={endpoint.id}
                    id={endpoint.id}
                    className="scroll-mt-24 rounded-xl border border-neutral-800 bg-neutral-900/40 p-5"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={cn(
                          "rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ring-1 ring-inset",
                          METHOD_TONES[endpoint.method],
                        )}
                      >
                        {endpoint.method}
                      </span>
                      <code className="font-mono text-sm text-neutral-100">
                        {endpoint.path}
                      </code>
                    </div>
                    <h4 className="mt-2 text-base font-semibold text-neutral-50">
                      {endpoint.title}
                    </h4>
                    <p className="mt-1 text-sm text-neutral-400">{endpoint.description}</p>

                    {endpoint.params.length > 0 ? (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {endpoint.params.map((p) => (
                          <span
                            key={p}
                            className="rounded-md bg-neutral-800 px-2 py-0.5 font-mono text-[11px] text-neutral-300"
                          >
                            {p}
                          </span>
                        ))}
                      </div>
                    ) : null}

                    <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
                      <CodeBlock label="cURL" code={curl} onCopy={() => copy(curl, "cURL copied")} />
                      <CodeBlock
                        label="Sample response"
                        code={sample}
                        onCopy={() => copy(sample, "Response copied")}
                      />
                    </div>
                  </article>
                );
              })}
            </section>
          ))}
        </div>
      </div>
    </ApiAccessShell>
  );
}

function CodeBlock({
  label,
  code,
  onCopy,
}: {
  label: string;
  code: string;
  onCopy: () => void;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-neutral-800 bg-neutral-950">
      <div className="flex items-center justify-between border-b border-neutral-800 px-3 py-1.5">
        <span className="text-[10px] uppercase tracking-wider text-neutral-500">{label}</span>
        <Button
          size="sm"
          variant="ghost"
          className="h-6 px-2 text-xs text-neutral-300"
          onClick={onCopy}
        >
          <Copy className="size-3" />
          Copy
        </Button>
      </div>
      <pre className="overflow-x-auto p-3 text-[12px] leading-relaxed text-neutral-200">
        <code>{code}</code>
      </pre>
    </div>
  );
}
