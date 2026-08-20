"use client";

import { MessageCircle } from "@/components/icons";
import { LiveChat } from "@/components/stream/live-chat";

/**
 * The conversation under a recording.
 *
 * This used to be six invented commenters with invented like counts, seeded off
 * the VOD id so the same strangers appeared under every video, and a posting box
 * that raised "Comment posted" and kept nothing. The mock purge replaced that
 * with an honest line saying comments were not open, which was true until now.
 *
 * It is the live chat component, pointed at a VOD. Same messages, same rules,
 * same bans, same moderation queue and the same live feed, so a reply arrives
 * without a refresh here exactly as it does during a broadcast. A second
 * implementation would have needed all of that again and would have drifted
 * from the first within a week.
 */
export function VodComments({ vodId }: { vodId: string }) {
  return (
    <section>
      <div className="mb-3 flex items-center gap-2">
        <MessageCircle className="size-4 text-muted-foreground" />
        <h2 className="text-lg font-semibold text-foreground">Comments</h2>
      </div>
      {/* A fixed height, because a comment thread that grows the page pushes
          the related rail out of reach on a phone. */}
      <div className="h-[26rem] overflow-hidden rounded-2xl bg-card/40">
        <LiveChat vodId={vodId} />
      </div>
    </section>
  );
}
