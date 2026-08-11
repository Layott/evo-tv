"use client";

import { useQuery } from "@tanstack/react-query";
import { pickAd } from "@/lib/client";

export function AdBanner() {
  const { data: ad } = useQuery({
    queryKey: ["ads", "home_banner"],
    queryFn: () => pickAd("home_banner"),
  });

  if (!ad) return null;

  return (
    <a
      href={ad.clickUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="block overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900/60 transition-colors hover:border-neutral-700"
    >
      <div className="relative">
        <img
          src={ad.mediaUrl}
          alt={ad.advertiser}
          className="h-24 w-full object-cover sm:h-32"
        />
        <span className="absolute right-2 top-2 rounded-md bg-black/70 px-2 py-0.5 text-[10px] uppercase tracking-wider text-neutral-400">
          Ad · {ad.advertiser}
        </span>
      </div>
    </a>
  );
}

export default AdBanner;
