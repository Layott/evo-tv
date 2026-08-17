"use client";

import * as React from "react";
import { useAuth } from "@/components/providers";
import { Button } from "@/components/ui/button";
import { Heart, HeartOff } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export function FollowButton({
  targetType,
  targetId,
  targetLabel,
  className,
  size = "sm",
}: {
  targetType: "team" | "player" | "streamer";
  targetId: string;
  targetLabel?: string;
  className?: string;
  size?: "sm" | "default" | "lg";
}) {
  const { isFollowing, toggleFollow, user } = useAuth();
  const following = isFollowing(targetType, targetId);
  const label = targetLabel ?? targetType;

  const onClick = () => {
    if (!user) {
      toast.error("Sign in to follow");
      return;
    }
    toggleFollow(targetType, targetId);
    if (following) toast.message(`Unfollowed ${label}`);
    else toast.success(`Following ${label}`);
  };

  return (
    <Button
      size={size}
      variant={following ? "outline" : "default"}
      onClick={onClick}
      className={cn(
        following
          ? "bg-input/40 text-foreground hover:bg-accent"
          : "bg-sky-600 text-white hover:bg-sky-500",
        className
      )}
    >
      {following ? (
        <>
          <HeartOff className="size-3.5" />
          Following
        </>
      ) : (
        <>
          <Heart className="size-3.5" />
          Follow
        </>
      )}
    </Button>
  );
}
