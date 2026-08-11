"use client";

import * as React from "react";
import { Coins, Heart, Loader2, Sparkles } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useAuth } from "@/components/providers";
import { sendTip, getCoinBalance } from "@/lib/mock/tips";

const PRESET_AMOUNTS = [50, 200, 500, 1000];

interface TipModalProps {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  streamerHandle: string;
  streamerName: string;
  streamerAvatarUrl: string;
  streamId: string | null;
  streamTitle?: string | null;
}

export function TipModal({
  open,
  onOpenChange,
  streamerHandle,
  streamerName,
  streamerAvatarUrl,
  streamId,
  streamTitle,
}: TipModalProps) {
  const { user } = useAuth();
  const [amount, setAmount] = React.useState<number>(200);
  const [customMode, setCustomMode] = React.useState(false);
  const [customValue, setCustomValue] = React.useState<string>("");
  const [message, setMessage] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [success, setSuccess] = React.useState<{ amount: number; message: string } | null>(null);
  const [balance, setBalance] = React.useState<number>(0);

  React.useEffect(() => {
    if (!open) {
      setAmount(200);
      setCustomMode(false);
      setCustomValue("");
      setMessage("");
      setSuccess(null);
      return;
    }
    if (user) {
      getCoinBalance(user.id).then(setBalance);
    }
  }, [open, user]);

  const finalAmount = customMode ? Math.max(0, parseInt(customValue || "0", 10) || 0) : amount;
  const valid = finalAmount >= 10 && finalAmount <= 50_000 && finalAmount <= balance;

  async function handleSend() {
    if (!user) {
      toast.error("Sign in to tip");
      return;
    }
    if (!valid) return;
    setSubmitting(true);
    const result = await sendTip(streamerHandle, streamId, finalAmount, message, {
      fromUserId: user.id,
      fromHandle: user.handle,
      fromAvatarUrl: user.avatarUrl,
      toStreamerName: streamerName,
      toStreamerAvatarUrl: streamerAvatarUrl,
      streamTitle: streamTitle ?? null,
    });
    if (!result.success) {
      toast.error(result.reason ?? "Tip failed");
      setSubmitting(false);
      return;
    }
    setBalance(result.balance ?? balance - finalAmount);
    setSuccess({ amount: finalAmount, message });
    setSubmitting(false);
    toast.success(`Tipped ${streamerName}!`, {
      description: `${finalAmount.toLocaleString()} EVO Coins sent`,
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-neutral-800 bg-neutral-950 p-0 text-neutral-100 sm:max-w-md">
        <div className="relative overflow-hidden">
          {/* Halo */}
          <div className="pointer-events-none absolute inset-x-0 -top-32 h-64 bg-gradient-to-b from-amber-500/20 via-transparent to-transparent blur-2xl" />
          <DialogHeader className="relative z-10 px-6 pt-6">
            <DialogTitle className="flex items-center gap-2">
              <Heart className="size-5 fill-pink-400 text-pink-400" />
              Send a tip
            </DialogTitle>
            <DialogDescription className="text-neutral-400">
              Cheer on {streamerName} with EVO Coins. They&apos;ll see your message live.
            </DialogDescription>
          </DialogHeader>

          {success ? (
            <div className="relative z-10 space-y-4 px-6 pb-6 pt-4 text-center">
              <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-pink-500 shadow-2xl shadow-amber-500/40 animate-in zoom-in-50">
                <Sparkles className="size-7 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-neutral-50">Tip on its way!</h3>
                <p className="mt-1 text-sm text-neutral-400">
                  You sent <span className="font-semibold text-amber-300 tabular-nums">{success.amount.toLocaleString()}</span>{" "}
                  EVO Coins to {streamerName}.
                </p>
              </div>
              {success.message ? (
                <div className="rounded-lg border border-neutral-800 bg-neutral-900/60 p-3 text-left">
                  <div className="text-[10px] uppercase tracking-wider text-neutral-500">Your message</div>
                  <p className="mt-1 text-sm text-neutral-200">&ldquo;{success.message}&rdquo;</p>
                </div>
              ) : null}
              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  className="flex-1 border-neutral-700"
                  onClick={() => {
                    setSuccess(null);
                    setMessage("");
                    setAmount(200);
                    setCustomMode(false);
                    setCustomValue("");
                  }}
                >
                  Send another
                </Button>
                <Button onClick={() => onOpenChange(false)} className="flex-1 bg-amber-500 text-amber-950 hover:bg-amber-400">
                  Done
                </Button>
              </div>
            </div>
          ) : (
            <div className="relative z-10 space-y-5 px-6 pb-6 pt-4">
              <div className="flex items-center gap-3 rounded-lg border border-neutral-800 bg-neutral-900/40 p-3">
                <Avatar className="size-10 ring-2 ring-pink-500/40">
                  <AvatarImage src={streamerAvatarUrl} alt={streamerName} />
                  <AvatarFallback>{streamerName.slice(0, 2)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{streamerName}</p>
                  <p className="truncate text-[11px] text-neutral-500">@{streamerHandle}</p>
                </div>
                <div className="text-right">
                  <div className="text-[10px] uppercase tracking-wider text-neutral-500">Your balance</div>
                  <div className="flex items-center justify-end gap-1 text-amber-300">
                    <Coins className="size-3.5" />
                    <span className="text-sm font-bold tabular-nums">{balance.toLocaleString()}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider text-neutral-400">Amount</Label>
                <div className="grid grid-cols-4 gap-2">
                  {PRESET_AMOUNTS.map((a) => {
                    const selected = !customMode && amount === a;
                    return (
                      <button
                        key={a}
                        type="button"
                        onClick={() => {
                          setAmount(a);
                          setCustomMode(false);
                        }}
                        className={cn(
                          "flex flex-col items-center justify-center gap-0.5 rounded-lg border px-2 py-3 text-sm transition",
                          selected
                            ? "border-amber-400 bg-amber-500/15 text-amber-100 shadow-md shadow-amber-500/20"
                            : "border-neutral-800 bg-neutral-900/40 text-neutral-300 hover:border-neutral-600",
                        )}
                      >
                        <Coins className={cn("size-3.5", selected ? "text-amber-300" : "text-neutral-500")} />
                        <span className="font-bold tabular-nums">{a.toLocaleString()}</span>
                      </button>
                    );
                  })}
                </div>
                <div>
                  <button
                    type="button"
                    onClick={() => setCustomMode((v) => !v)}
                    className="text-xs text-sky-400 hover:underline"
                  >
                    {customMode ? "Use preset amount" : "Custom amount"}
                  </button>
                  {customMode ? (
                    <div className="mt-2 flex items-center gap-2">
                      <div className="relative flex-1">
                        <Coins className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-amber-400" />
                        <Input
                          type="number"
                          min={10}
                          max={50_000}
                          step={10}
                          inputMode="numeric"
                          value={customValue}
                          onChange={(e) => setCustomValue(e.target.value)}
                          placeholder="50 – 50,000"
                          className="border-neutral-800 bg-neutral-900 pl-8 tabular-nums"
                        />
                      </div>
                      <span className="text-xs text-neutral-500">EVO Coins</span>
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="tip-message" className="text-xs uppercase tracking-wider text-neutral-400">
                    Message
                  </Label>
                  <span className="text-[11px] text-neutral-500 tabular-nums">{message.length}/80</span>
                </div>
                <Input
                  id="tip-message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value.slice(0, 80))}
                  placeholder="GG! Massive clutch!"
                  className="border-neutral-800 bg-neutral-900"
                />
                {message ? (
                  <div className="rounded-lg border border-neutral-800 bg-neutral-900/40 p-3">
                    <div className="text-[10px] uppercase tracking-wider text-neutral-500">Preview</div>
                    <p className="mt-1 text-sm">
                      <span className="font-semibold text-amber-300">@{user?.handle ?? "you"}</span>{" "}
                      <span className="text-neutral-200">tipped {finalAmount.toLocaleString()} coins:</span>{" "}
                      <span className="text-neutral-300">&ldquo;{message}&rdquo;</span>
                    </p>
                  </div>
                ) : null}
              </div>

              <Button
                size="lg"
                onClick={handleSend}
                disabled={!valid || submitting}
                className={cn(
                  "relative w-full overflow-hidden bg-gradient-to-r from-amber-500 via-pink-500 to-fuchsia-500 text-white shadow-xl shadow-amber-500/20 transition-transform",
                  valid && !submitting && "hover:scale-[1.02]",
                )}
              >
                {valid && !submitting ? (
                  <span className="pointer-events-none absolute inset-0 -z-0 animate-pulse rounded-md bg-gradient-to-r from-amber-400/40 via-pink-400/40 to-fuchsia-400/40" />
                ) : null}
                {submitting ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <span className="relative z-10 inline-flex items-center gap-2">
                    <Sparkles className="size-4" />
                    Send {finalAmount.toLocaleString()} coins
                  </span>
                )}
              </Button>

              {!valid && finalAmount > 0 ? (
                <p className="text-center text-[11px] text-neutral-500">
                  {finalAmount > balance
                    ? "Not enough EVO Coins — earn more from quests."
                    : "Tip must be 10–50,000 coins."}
                </p>
              ) : null}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
