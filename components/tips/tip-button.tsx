"use client";

import * as React from "react";
import { Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TipModal } from "./tip-modal";

interface TipButtonProps {
  streamerHandle: string;
  streamerName: string;
  streamerAvatarUrl: string;
  streamId: string | null;
  streamTitle?: string | null;
  size?: "sm" | "default";
}

export function TipButton({
  streamerHandle,
  streamerName,
  streamerAvatarUrl,
  streamId,
  streamTitle,
  size = "sm",
}: TipButtonProps) {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <Button
        size={size}
        onClick={() => setOpen(true)}
        className="bg-gradient-to-r from-amber-500 via-pink-500 to-fuchsia-500 text-white shadow-md shadow-amber-500/20 hover:from-amber-400 hover:via-pink-400 hover:to-fuchsia-400"
      >
        <Heart className="size-3.5 fill-white" />
        Tip
      </Button>
      <TipModal
        open={open}
        onOpenChange={setOpen}
        streamerHandle={streamerHandle}
        streamerName={streamerName}
        streamerAvatarUrl={streamerAvatarUrl}
        streamId={streamId}
        streamTitle={streamTitle}
      />
    </>
  );
}
