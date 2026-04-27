"use client";

import * as React from "react";
import {
  Cast,
  CastIcon,
  Loader2,
  RadioTower,
  Wifi,
  WifiHigh,
  WifiLow,
} from "lucide-react";
import { toast } from "sonner";

import {
  type CastDevice,
  type CastSignal,
  castKindLabel,
  discoverCastDevices,
} from "@/lib/mock/cast";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Props {
  /** Title shown for context (stream/vod title). */
  contextTitle: string;
  /** Variant for parent layout — "outline" matches share/report button styling. */
  variant?: "outline" | "ghost";
  size?: "sm" | "default";
  className?: string;
}

const SIGNAL_ICON: Record<CastSignal, typeof Wifi> = {
  strong: Wifi,
  ok: WifiHigh,
  weak: WifiLow,
};

const SIGNAL_LABEL: Record<CastSignal, string> = {
  strong: "Strong",
  ok: "Good",
  weak: "Weak",
};

export function CastButton({
  contextTitle,
  variant = "outline",
  size = "sm",
  className,
}: Props) {
  const [open, setOpen] = React.useState(false);
  const [devices, setDevices] = React.useState<CastDevice[] | null>(null);
  const [discovering, setDiscovering] = React.useState(false);
  const [activeDevice, setActiveDevice] = React.useState<CastDevice | null>(null);

  React.useEffect(() => {
    if (!open || devices) return;
    let cancelled = false;
    setDiscovering(true);
    discoverCastDevices()
      .then((d) => {
        if (cancelled) return;
        setDevices(d);
      })
      .catch(() => {
        if (cancelled) return;
        toast.error("Couldn't scan the network");
      })
      .finally(() => {
        if (!cancelled) setDiscovering(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, devices]);

  function rescan() {
    setDevices(null);
  }

  function pick(device: CastDevice) {
    setActiveDevice(device);
    setOpen(false);
    toast.success(`Casting to ${device.name}`, {
      description: `${castKindLabel(device.kind)} · ${contextTitle}`,
    });
  }

  function stopCasting() {
    if (!activeDevice) return;
    toast.message("Stopped casting", {
      description: `Disconnected from ${activeDevice.name}`,
    });
    setActiveDevice(null);
  }

  return (
    <>
      <Button
        type="button"
        variant={variant}
        size={size}
        onClick={() => setOpen(true)}
        className={className}
        aria-label="Cast"
      >
        {activeDevice ? (
          <CastIcon className="size-3.5 text-sky-400" />
        ) : (
          <Cast className="size-3.5" />
        )}
        Cast
      </Button>

      {activeDevice ? (
        <button
          type="button"
          onClick={stopCasting}
          className="inline-flex items-center gap-2 rounded-full border border-sky-500/40 bg-sky-500/10 px-3 py-1.5 text-xs font-semibold text-sky-300 transition-colors hover:bg-sky-500/20"
        >
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sky-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-sky-400" />
          </span>
          Casting to {activeDevice.name}
          <span className="ml-1 text-sky-400/80">· Stop</span>
        </button>
      ) : null}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md border-neutral-800 bg-neutral-950">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Cast className="size-4 text-sky-400" />
              Cast to a device
            </DialogTitle>
            <DialogDescription>
              Pick a screen on your network to send <span className="font-medium text-neutral-300">{contextTitle}</span> to.
            </DialogDescription>
          </DialogHeader>

          {discovering && (
            <div className="flex items-center gap-3 rounded-xl border border-neutral-800 bg-neutral-900/60 p-4 text-sm text-neutral-300">
              <RadioTower className="size-5 animate-pulse text-sky-400" />
              <div>
                <div className="font-semibold">Scanning your network…</div>
                <div className="text-xs text-neutral-500">
                  Make sure your devices are on the same Wi-Fi.
                </div>
              </div>
            </div>
          )}

          {!discovering && devices && devices.length === 0 && (
            <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-6 text-center">
              <p className="text-sm text-neutral-300">No devices nearby.</p>
              <p className="mt-1 text-xs text-neutral-500">
                Make sure your TV is awake and on the same Wi-Fi.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={rescan}
                className="mt-3 border-neutral-800"
              >
                Scan again
              </Button>
            </div>
          )}

          {!discovering && devices && devices.length > 0 && (
            <div className="flex flex-col gap-1">
              {devices.map((d) => {
                const SignalIcon = SIGNAL_ICON[d.signal];
                const isActive = activeDevice?.id === d.id;
                return (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => pick(d)}
                    className={`flex items-center justify-between gap-3 rounded-lg border px-3 py-3 text-left transition-colors ${
                      isActive
                        ? "border-sky-500/50 bg-sky-500/10"
                        : "border-neutral-800 bg-neutral-900/60 hover:border-neutral-700 hover:bg-neutral-900"
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-neutral-800 text-neutral-200">
                        <Cast className="size-4" />
                      </span>
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-neutral-100">
                          {d.name}
                        </div>
                        <div className="truncate text-[11px] text-neutral-500">
                          {castKindLabel(d.kind)} · {d.room}
                        </div>
                      </div>
                    </div>
                    <span className="flex items-center gap-1 text-[11px] text-neutral-400">
                      <SignalIcon
                        className={`size-3.5 ${
                          d.signal === "strong"
                            ? "text-emerald-400"
                            : d.signal === "ok"
                            ? "text-sky-400"
                            : "text-amber-400"
                        }`}
                      />
                      {SIGNAL_LABEL[d.signal]}
                    </span>
                  </button>
                );
              })}
              <Button
                variant="ghost"
                size="sm"
                onClick={rescan}
                disabled={discovering}
                className="mt-2 self-start text-xs text-neutral-400"
              >
                {discovering ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" />
                    Scanning…
                  </>
                ) : (
                  "Scan again"
                )}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
