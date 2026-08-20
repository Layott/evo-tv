"use client";

import * as React from "react";

import { PageHeader } from "@/components/admin/page-header";
import { HowTo } from "@/components/admin/how-to";
import { RUNGS } from "@/lib/video/rungs";

/**
 * How to point an encoder at this platform.
 *
 * Everything here was learned by getting it wrong on air, and none of it was
 * written down anywhere an operator would look. The numbers come from the same
 * ladder the admin screen and nginx use, so this page cannot drift out of step
 * with what the server actually accepts.
 */
export function EncoderSetupPage() {
  return (
    <div className="max-w-3xl">
      <PageHeader
        title="Encoder setup"
        description="OBS, vMix and ffplayout, and the settings this platform needs from each."
      />
      <HowTo page="encoder" />

      <Section title="The shape of it">
        <p>
          The server does not transcode. Whatever the encoder sends is what
          viewers get, so the encoder is what produces the quality ladder: one
          RTMP publish per rung, each with its own resolution and bitrate, all
          to the same server with the same key. The publish name carries the
          rung.
        </p>
        <p>
          Every stream&apos;s four publish names are on its own row under
          Streams, ready to copy. They look like{" "}
          <code className="rounded bg-background px-1.5 py-0.5 font-mono text-xs">
            stream_abc123_hi?key=…
          </code>
          .
        </p>
      </Section>

      <Section title="What each rung should be">
        <div className="space-y-2">
          {RUNGS.map((rung) => (
            <div
              key={rung.suffix}
              className="flex flex-wrap items-baseline justify-between gap-2 rounded-lg bg-card px-3 py-2"
            >
              <span className="text-sm font-medium text-foreground">
                {rung.label}
                {rung.premiumOnly ? (
                  <span className="ml-2 rounded bg-sky-400/20 px-1.5 py-0.5 text-[10px] text-sky-200">
                    Premium viewers only
                  </span>
                ) : null}
              </span>
              <span className="text-xs tabular-nums text-muted-foreground">
                {rung.resolution} · {rung.videoKbps} kbps video ·{" "}
                {rung.audioKbps} kbps audio · suffix{" "}
                <code className="font-mono">{rung.suffix}</code>
              </span>
            </div>
          ))}
        </div>
        <p>
          These are targets, not suggestions. The bandwidth figures in the
          playlist come from the server&apos;s configuration rather than from
          the stream, so an encoder that overshoots makes the playlist promise
          something it cannot keep: a phone picks that rung on the strength of
          the promise and then stalls on it.
        </p>
      </Section>

      <Section title="Settings every rung needs">
        <ul className="space-y-1.5">
          <Bullet>
            <strong className="text-foreground">Keyframe interval: 2 seconds.</strong>{" "}
            Not automatic, not 4. Segments are only cut on a keyframe, and rungs
            whose keyframes do not line up cannot be switched between cleanly,
            so the picture stutters at every quality change.
          </Bullet>
          <Bullet>
            <strong className="text-foreground">CBR, not VBR.</strong> A variable
            bitrate on a rung that advertises a fixed one is the overshoot
            problem in slow motion.
          </Bullet>
          <Bullet>
            <strong className="text-foreground">H.264 High profile, AAC audio.</strong>{" "}
            Anything else will not play on some phones, and the failure is
            silent.
          </Bullet>
          <Bullet>
            <strong className="text-foreground">30 fps.</strong> 60 doubles the
            bitrate for something nobody watching a talk show notices.
          </Bullet>
        </ul>
      </Section>

      <Section title="OBS">
        <ol className="list-decimal space-y-1.5 pl-5">
          <li>Settings, Stream, Service: Custom.</li>
          <li>Server: the RTMP URL from the stream&apos;s row.</li>
          <li>Stream Key: one rung&apos;s key, pasted whole, query string included.</li>
          <li>
            Settings, Output, Advanced: CBR at that rung&apos;s bitrate, keyframe
            interval 2.
          </li>
          <li>
            The other rungs go in a multi-output plugin, each with its own
            resolution, bitrate and key.
          </li>
        </ol>
        <Warned>
          <strong className="text-foreground">obs-multi-rtmp does not load on OBS 32.</strong>{" "}
          Aitum Multistream is the one that works. It honours the resolution you
          set and <em>ignores</em> bitrate and keyframe interval, so set those in
          OBS itself and verify what actually went out rather than trusting the
          dialog: it sent 6.4 Mbps on a rung configured for 400 kbps.
        </Warned>
        <Warned>
          If an output refuses to start with no error on screen, read the OBS log.
          <code className="mx-1 rounded bg-background px-1.5 py-0.5 font-mono text-xs">
            NV_ENC_ERR_INCOMPATIBLE_CLIENT_KEY
          </code>
          means the NVIDIA driver was installed but the machine has not been
          rebooted into it.
        </Warned>
      </Section>

      <Section title="vMix">
        <ol className="list-decimal space-y-1.5 pl-5">
          <li>Stream, cog icon, Destination: Custom RTMP Server.</li>
          <li>URL: the RTMP URL. Stream Name or Key: one rung&apos;s key.</li>
          <li>
            Quality: Custom, then set the resolution and bitrate for that rung
            and a keyframe interval of 2 seconds.
          </li>
          <li>
            vMix streams to three destinations natively, so the rungs are three
            entries in the same dialog rather than a plugin.
          </li>
        </ol>
      </Section>

      <Section title="ffplayout">
        <p>
          ffplayout drives scheduled playout rather than a live desk, so it sends
          one rung and the ladder comes from whatever else is publishing. Point
          its output at the RTMP URL with a rung key, and set{" "}
          <code className="rounded bg-background px-1.5 py-0.5 font-mono text-xs">
            -g 60
          </code>{" "}
          (two seconds at 30 fps) alongside the bitrate for that rung.
        </p>
        <p>
          A stream that has a playout file set on it is played by the scheduler
          rather than waiting for an encoder, which is what the Playout file
          field on the stream is for.
        </p>
      </Section>

      <Section title="Checking it worked">
        <ul className="space-y-1.5">
          <Bullet>
            The stream goes live by itself: the server tells the site when the
            first rung arrives, and nobody has to press anything here.
          </Bullet>
          <Bullet>
            Measure the real bitrate rather than reading it off the encoder.
            Dividing a segment&apos;s size by its duration is the honest number,
            and it is how the 6.4 Mbps overshoot was found.
          </Bullet>
          <Bullet>
            If the feed drops, the broadcast survives for as long as the stream&apos;s
            reconnect window allows, which can be set to wait indefinitely.
          </Bullet>
        </ul>
      </Section>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-8 space-y-3">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h2>
      <div className="space-y-3 text-sm leading-relaxed text-foreground/80">
        {children}
      </div>
    </section>
  );
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <li className="rounded-lg bg-card px-3 py-2">
      <span className="text-sm text-foreground/80">{children}</span>
    </li>
  );
}

function Warned({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-sm text-amber-100/90">
      {children}
    </p>
  );
}

export default EncoderSetupPage;
