import { MessageCircle } from "@/components/icons";

/**
 * Comments, honestly.
 *
 * There is no comments backend: no `/api/vods/[id]/comments`, no table in
 * `db/schema`. This component used to hide that behind six invented commenters
 * with invented handles ("viper", "blaze", "havoc", "nyx"), invented like
 * counts and staggered fake timestamps, seeded off the VOD id so the same
 * strangers appeared under every video on the site.
 *
 * The posting box was the worse half. It appended to React state and raised a
 * "Comment posted" toast, so a real viewer would write something, be told it
 * worked, and find it gone on reload.
 *
 * The app repo settled this during the mock purge and has rendered an honest
 * state ever since; the website was simply missed. The rule in this codebase is
 * the one written when `lib/mock` was deleted: an empty screen is a missing
 * feature, a fabricated one is a lie that ships.
 *
 * The props signature is unchanged so the call site in `vod/[id]/view.tsx` does
 * not move, and this is the whole component to replace when the endpoint lands.
 */
export function VodComments(_props: { vodId: string }) {
  return (
    <section>
      <div className="mb-3 flex items-center gap-2">
        <MessageCircle className="size-4 text-muted-foreground" />
        <h2 className="text-lg font-semibold text-foreground">Comments</h2>
      </div>
      {/* A written line on a filled surface, not a dashed box and not a titled
          empty container. */}
      <div className="rounded-2xl bg-card/40 p-6">
        <p className="text-sm text-muted-foreground">
          Comments are not open on VODs yet. Chat is live on every stream while
          it is running.
        </p>
      </div>
    </section>
  );
}

export default VodComments;
